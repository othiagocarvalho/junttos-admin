// ── Movimentação de estoque (lf_estoque_mov) ────────────────────────────────
// O histórico em si é escrito por um trigger no Postgres
// (supabase/migration_estoque_mov.sql) comparando OLD.variacoes com
// NEW.variacoes. Aqui ficam só as partes que o client precisa: normalizar os
// itens que entram numa baixa/restauração de estoque e apresentar as linhas.

export const TIPOS_MOV = {
  entrada:    { label: 'Entrada',    tone: 'ok'   },
  ajuste:     { label: 'Ajuste',     tone: 'warn' },
  venda:      { label: 'Venda',      tone: 'info' },
  devolucao:  { label: 'Devolução',  tone: 'ok'   },
  balanco:    { label: 'Balanço',    tone: 'warn' },
  cadastro:   { label: 'Cadastro',   tone: 'ok'   },
  importacao: { label: 'Importação', tone: 'ok'   },
}

export function rotuloTipo(tipo) {
  return TIPOS_MOV[tipo]?.label || tipo || '—'
}

export function toneTipo(tipo) {
  return TIPOS_MOV[tipo]?.tone || 'info'
}

/** '+5' / '−3' — sinal de menos tipográfico, alinhado com o resto da UI. */
export function fmtDelta(delta) {
  const n = Number(delta) || 0
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'
}

/**
 * Rótulo de uma variação. Mesma regra de utils/balanco.js:getVarLabel e da
 * função lf_var_label no banco: a primeira chave que não é quantidade/custo.
 */
export function labelVariacao(v) {
  if (!v || typeof v !== 'object') return null
  const k = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
  return k ? String(v[k]) : null
}

/** Rótulos únicos das variações de um produto, para o filtro da tela. */
export function labelsDeVariacoes(produto) {
  const labels = (produto?.variacoes || []).map(labelVariacao).filter(Boolean)
  return [...new Set(labels)]
}

/**
 * Normaliza itens que afetam estoque para o formato que decrementarVariacoes /
 * restaurarVariacoes esperam: { nome, variacao, quantidade }.
 *
 * Existem duas formas no banco para a mesma coisa: lf_vendas.produtos usa
 * `quantidade` (NovaVenda.jsx) e lf_pedidos.produtos usa `qtd`
 * (CatalogoPublico.jsx). Itens sem variação não mexem em estoque — é assim
 * que o app sempre funcionou — e são descartados aqui.
 */
export function normalizarItensEstoque(produtos) {
  return (produtos || [])
    .filter(p => p && p.variacao)
    .map(p => ({
      nome: p.nome,
      variacao: p.variacao,
      quantidade: Number(p.quantidade ?? p.qtd) || 1,
    }))
}

/** Agrupa itens normalizados por nome de produto. */
export function agruparPorNome(itens) {
  const grupos = new Map()
  for (const item of itens || []) {
    if (!grupos.has(item.nome)) grupos.set(item.nome, [])
    grupos.get(item.nome).push(item)
  }
  return [...grupos.entries()].map(([nome, lista]) => ({ nome, itens: lista }))
}

/** Filtra as linhas do extrato por variação. label vazio/nulo = todas. */
export function filtrarPorVariacao(movs, label) {
  if (!label) return movs || []
  return (movs || []).filter(m => m.variacao_label === label)
}

/**
 * A migration é aplicada à mão no Supabase, então existe uma janela em que o
 * código novo já está no ar e as RPCs ainda não. Quando isso acontece, o app
 * escreve direto como antes: fica sem histórico, mas venda e cadastro não
 * quebram. PGRST202 = função ausente no schema cache do PostgREST;
 * 42883 = undefined_function do Postgres.
 */
export function rpcAusente(error) {
  return !!error && (error.code === 'PGRST202' || error.code === '42883')
}

/** Mesma janela, para a tabela: 42P01 = relação inexistente. */
export function tabelaAusente(error) {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205')
}
