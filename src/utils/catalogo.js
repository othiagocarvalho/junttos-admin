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

/**
 * Um produto só entra no catálogo público quando já tem pelo menos uma
 * variação cadastrada.
 *
 * Regra comercial: produto sem variação é mercadoria que a lojista ainda não
 * terminou de cadastrar (a cor/tamanho entra quando a peça física chega). Se
 * ele aparecesse no catálogo, o cliente final poderia pedir uma peça sem cor
 * definida — pedido que a loja não consegue separar nem faturar.
 *
 * Não confundir com "esgotado": produto COM variação e estoque zerado continua
 * visível e marcado como esgotado, que é o comportamento que já existia.
 * Este filtro vale só para o catálogo público — no painel da lojista
 * (Estoque, Nova Venda, Pedidos) o produto segue visível e editável.
 *
 * @param {object} p — produto: { variacoes }
 * @returns {boolean}
 */
export function produtoVisivelNoCatalogo(p) {
  return Array.isArray(p?.variacoes) && p.variacoes.length > 0
}
