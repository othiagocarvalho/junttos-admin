// Identidade de um item de venda/troca/pré-venda.
//
// Desde a etapa 2 da correção de duplicata de produto, todo item novo carrega
// `produto_id` (lf_produtos.id) além de nome/variacao/obs/quantidade. O id é
// a identidade de verdade: dois produtos podem ter o mesmo nome (foi o que
// quebrou a baixa de estoque do Short Listrado), o id não.
//
// Itens SEM produto_id continuam existindo — vendas antigas no banco e
// rascunhos de venda salvos no navegador antes desta mudança. Para eles, a
// comparação cai no nome, exatamente como era antes.

/**
 * O item pertence a este produto?
 * Compara por id quando os dois lados têm id; senão, pelo nome.
 */
export function ehDoProduto(item, produtoId, nome) {
  if (!item) return false
  if (produtoId && item.produto_id) return item.produto_id === produtoId
  return item.nome === nome
}

/**
 * Dois itens são a mesma linha do carrinho (mesmo produto + mesma variação)?
 * Mesma regra de ehDoProduto para o produto; variação ausente = null.
 */
export function mesmoItem(a, b) {
  if (!a || !b) return false
  const mesmoProduto = a.produto_id && b.produto_id
    ? a.produto_id === b.produto_id
    : a.nome === b.nome
  return mesmoProduto && (a.variacao ?? null) === (b.variacao ?? null)
}

/**
 * Produto do catálogo (produtosData) de um item: pelo id quando o item tem,
 * pelo nome quando não tem. null quando não está entre os produtos ativos
 * carregados (apagado/desativado depois da venda).
 */
export function produtoDoItem(produtosData, item) {
  const lista = produtosData || []
  if (item?.produto_id) return lista.find(p => p.id === item.produto_id) || null
  return lista.find(p => p.nome === item?.nome) || null
}
