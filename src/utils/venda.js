export function decrementarVariacoes(variacoes, itens) {
  const qtdPorVariacao = {}
  itens.forEach(item => {
    const label = item.variacao
    qtdPorVariacao[label] = (qtdPorVariacao[label] || 0) + (item.quantidade || 1)
  })
  return (variacoes || []).map(v => {
    const labelKey = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
    const labelVal = labelKey ? String(v[labelKey]) : null
    const qtd = qtdPorVariacao[labelVal] || 0
    return qtd > 0
      ? { ...v, quantidade: Math.max(0, Number(v.quantidade || 0) - qtd) }
      : v
  })
}

export function restaurarVariacoes(variacoes, itens) {
  const qtdPorVariacao = {}
  itens.forEach(item => {
    const label = item.variacao
    qtdPorVariacao[label] = (qtdPorVariacao[label] || 0) + (item.quantidade || 1)
  })
  return (variacoes || []).map(v => {
    const labelKey = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
    const labelVal = labelKey ? String(v[labelKey]) : null
    const qtd = qtdPorVariacao[labelVal] || 0
    return qtd > 0
      ? { ...v, quantidade: Number(v.quantidade || 0) + qtd }
      : v
  })
}

export function calcularTotalVenda(itens, produtosData) {
  return itens.reduce((sum, item) => {
    const pd = produtosData.find(p => p.nome === item.nome)
    const preco = Number(pd?.preco_venda || 0)
    const qty = Number(item.quantidade || 1)
    return sum + preco * qty
  }, 0)
}

/**
 * Aplica desconto ou acréscimo sobre um subtotal.
 * @param {number} subtotal
 * @param {'desconto'|'acrescimo'} tipoAjuste
 * @param {'valor'|'percentual'} modoAjuste
 * @param {number} valorAjuste — sempre positivo; 0 = sem ajuste
 * @returns {number} total final (nunca negativo)
 */
export function calcularTotalComAjuste(subtotal, tipoAjuste, modoAjuste, valorAjuste) {
  if (!valorAjuste || valorAjuste <= 0) return Math.max(0, subtotal)
  const ajuste = modoAjuste === 'percentual'
    ? subtotal * (valorAjuste / 100)
    : valorAjuste
  return tipoAjuste === 'desconto'
    ? Math.max(0, subtotal - ajuste)
    : subtotal + ajuste
}
