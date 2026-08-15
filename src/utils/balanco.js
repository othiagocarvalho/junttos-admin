// Extracts the display label from a variacao JSONB object
export function getVarLabel(v) {
  if (!v || typeof v !== 'object') return null
  const k = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
  return k ? String(v[k]) : null
}

// Stable key for grouping items across sub-counts
export function itemKey(produtoId, variacaoLabel, produtoNome) {
  if (produtoId) return `${produtoId}::${variacaoLabel ?? ''}`
  return `ext::${produtoNome ?? ''}`
}

// Groups items from multiple sub-counts by product key.
// Returns Map<key, { key, produto_id, produto_nome, variacao_label, qtd_sistema, porSubcontagem: Map<subId, qty> }>
export function agruparItensPorProduto(itens) {
  const mapa = new Map()
  for (const item of itens) {
    const key = itemKey(item.produto_id, item.variacao_label, item.produto_nome)
    if (!mapa.has(key)) {
      mapa.set(key, {
        key,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        variacao_label: item.variacao_label,
        codigo_barras: item.codigo_barras,
        lote: item.lote,
        validade: item.validade,
        qtd_sistema: item.qtd_sistema ?? null,
        porSubcontagem: new Map(),
      })
    }
    const grupo = mapa.get(key)
    const subId = item.subcontagem_id
    grupo.porSubcontagem.set(subId, (grupo.porSubcontagem.get(subId) ?? 0) + Number(item.quantidade))
    if (grupo.qtd_sistema == null && item.qtd_sistema != null) {
      grupo.qtd_sistema = Number(item.qtd_sistema)
    }
  }
  return mapa
}

// Checks if all sub-counts agree on the same quantity.
// Returns 'ok' | 'divergencia'
export function verificarBatimento(porSubcontagem) {
  const vals = [...porSubcontagem.values()]
  if (vals.length <= 1) return 'ok'
  return vals.every(v => v === vals[0]) ? 'ok' : 'divergencia'
}

// Calculates difference between system quantity and counted quantity.
// Returns null if either value is unknown.
export function calcularDivergencia(qtdSistema, qtdContada) {
  if (qtdSistema == null || qtdContada == null) return null
  return Number(qtdContada) - Number(qtdSistema)
}

// For Conferência mode: builds comparison result per product across sub-counts.
// Returns sorted array with divergências first.
export function compararConferencia(itens) {
  const mapa = agruparItensPorProduto(itens)
  return [...mapa.values()].map(grupo => {
    const batimento = verificarBatimento(grupo.porSubcontagem)
    const vals = [...grupo.porSubcontagem.values()]
    const qtdContada = batimento === 'ok' ? (vals[0] ?? 0) : null
    return {
      ...grupo,
      batimento,
      qtdContada,
      divergencia: calcularDivergencia(grupo.qtd_sistema, qtdContada),
    }
  }).sort((a, b) => {
    if (a.batimento !== b.batimento) return a.batimento === 'divergencia' ? -1 : 1
    return (a.produto_nome ?? '').localeCompare(b.produto_nome ?? '')
  })
}

// Determines whether a Supabase query result indicates an active stock-count lock.
// Must be used with .limit(1), never .maybeSingle(): .maybeSingle() returns
// { data: null, error: PGRST116 } when multiple rows match, causing the check
// to silently pass. Errors are treated as locked (fail-safe).
export function temTravaBal(result) {
  if (!result || result.error) return true
  return Array.isArray(result.data) && result.data.length > 0
}

/**
 * Token expirado é o caso mais comum de erro nessa consulta — a lojista deixa
 * a tela aberta o dia todo. O fail-safe de temTravaBal tratava isso como
 * balanço ativo e mostrava "Balanço em andamento", mandando ela procurar um
 * problema que não existia.
 */
/**
 * Um balanço acontece dentro de um expediente. Passou disso, a sessão ficou
 * órfã — alguém abriu a tela e fechou a aba sem concluir — e não faz sentido
 * seguir travando as vendas da loja por causa dela. Hoje há sessões abertas há
 * mais de 500 horas no banco, salvas de travar vendas só porque estavam com
 * travar_vendas = false.
 *
 * Expira no client, na própria consulta: não depende de cron nem de migration,
 * e a sessão continua no banco para o admin concluir ou auditar depois.
 */
export const BALANCO_VALIDO_HORAS = 12

export function limiteBalancoValido(agora = new Date()) {
  return new Date(agora.getTime() - BALANCO_VALIDO_HORAS * 60 * 60 * 1000).toISOString()
}

export function isErroAuth(error) {
  if (!error) return false
  const code = String(error.code ?? '')
  const msg  = String(error.message ?? '').toLowerCase()
  return code === 'PGRST301' || code === '401' || String(error.status ?? '') === '401'
    || msg.includes('jwt') || msg.includes('token') || msg.includes('unauthorized')
}

/**
 * Consulta a trava de balanço da loja, renovando a sessão uma única vez se o
 * token tiver expirado. O retry evita recarregar a página — a venda em
 * andamento continua no carrinho.
 *
 * Só cai no fail-safe (travado) se o erro persistir ou não for de autenticação.
 * Recebe o client por parâmetro para continuar testável sem rede.
 */
export async function checarTravaBalanco(supabase, lojaId) {
  const consultar = () => supabase
    .from('bal_sessoes')
    .select('id')
    .eq('loja_id', lojaId)
    .eq('status', 'aberta')
    .eq('travar_vendas', true)
    .gte('criado_em', limiteBalancoValido())
    .limit(1)

  let result = await consultar()
  let renovou = false

  if (result?.error && isErroAuth(result.error)) {
    const { error: refreshErr } = await supabase.auth.refreshSession()
    if (!refreshErr) {
      renovou = true
      result = await consultar()
    }
  }

  return { travado: temTravaBal(result), result, renovou }
}

// For Setores mode: sums quantities across all sectors (each covers a different area).
export function somarSetores(itens) {
  const mapa = agruparItensPorProduto(itens)
  return [...mapa.values()].map(grupo => {
    const qtdContada = [...grupo.porSubcontagem.values()].reduce((s, v) => s + v, 0)
    return {
      ...grupo,
      batimento: 'ok',
      qtdContada,
      divergencia: calcularDivergencia(grupo.qtd_sistema, qtdContada),
    }
  }).sort((a, b) => (a.produto_nome ?? '').localeCompare(b.produto_nome ?? ''))
}
