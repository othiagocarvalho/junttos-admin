function getVariacaoLabel(v) {
  const key = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
  return key ? String(v[key]) : null
}

/**
 * Compara os itens do carrinho com o estoque fresco do banco.
 * Retorna os keys dos itens que esgotaram ou têm qty insuficiente.
 *
 * @param {Array} carrinho  — items: { key, produtoId, variacao, qtd, ... }
 * @param {Array} freshProds — produtos frescos do banco: { id, variacoes }
 * @returns {string[]} — keys dos itens esgotados
 */
export function detectarItensEsgotados(carrinho, freshProds) {
  const freshMap = {}
  for (const p of (freshProds || [])) freshMap[p.id] = p

  return carrinho
    .filter(item => {
      if (!item.variacao) return false
      const fp = freshMap[item.produtoId]
      if (!fp) return true  // produto sumiu do banco → tratar como esgotado
      const fv = (fp.variacoes || []).find(v => getVariacaoLabel(v) === item.variacao)
      if (!fv) return true  // tamanho sumiu → tratar como esgotado
      return (fv.quantidade || 0) < item.qtd
    })
    .map(item => item.key)
}
