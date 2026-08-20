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
 * Um produto só entra no catálogo público quando tem pelo menos uma foto.
 *
 * Regra comercial: o catálogo é vitrine, e card sem foto é um retângulo cinza
 * de 3:4 que não vende nada. Foto é o único mínimo que sobrou — é também o que
 * a seção 2.2 da spec marca como obrigatório (`fotos[]`, ≥1).
 *
 * ─── Por que não exige mais variação ────────────────────────────────────────
 * Até 20/08/2026 esta função também exigia `variacoes.length > 0`: pedido de
 * peça "sem cor definida" era pedido que a loja não conseguia separar. O
 * catálogo novo (CatalogoPublicoV2) resolveu isso na interface — produto sem
 * cor abre o modal com uma célula única "Quantidade", e o pedido sai sem cor
 * porque a peça não tem cor, não porque falta cadastro. Com a regra antiga, 13
 * das 37 peças publicadas da tropicaleatacado ficavam invisíveis mesmo tendo
 * foto e preço.
 *
 * Não confundir com "esgotado": produto com estoque zerado continua visível,
 * como já era. O filtro vale só para o catálogo público — no painel da lojista
 * (Estoque, Nova Venda, Pedidos) o produto segue visível e editável mesmo sem
 * foto nenhuma.
 *
 * @param {object} p — produto: { fotos }
 * @returns {boolean}
 */
export function produtoVisivelNoCatalogo(p) {
  return Array.isArray(p?.fotos) && p.fotos.some(Boolean)
}
