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
