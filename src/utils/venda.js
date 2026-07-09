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
