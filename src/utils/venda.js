export function calcularTotalVenda(itens, produtosData) {
  return itens.reduce((sum, item) => {
    const pd = produtosData.find(p => p.nome === item.nome)
    const preco = Number(pd?.preco_venda || 0)
    const qty = Number(item.quantidade || 1)
    return sum + preco * qty
  }, 0)
}
