// ── Preço progressivo / atacarejo (merc_precos_faixas) ──────────────────
// Cada linha é { produto_id, qtd_minima, preco_faixa }. Uma quantidade pode
// satisfazer várias faixas ao mesmo tempo (ex: 15 un. satisfaz as faixas de
// 6 e de 12) — a que vale é sempre a de maior qtd_minima, porque é a mais
// vantajosa pra quem está levando mais.

/** Faixa aplicável a uma quantidade: a de maior qtd_minima <= quantidade. */
export function faixaAplicavel(produtoId, quantidade, faixas = []) {
  const doProduto = (faixas || []).filter(
    f => f.produto_id === produtoId && Number(f.qtd_minima) <= quantidade
  )
  if (!doProduto.length) return null
  return doProduto.reduce((maior, f) =>
    Number(f.qtd_minima) > Number(maior.qtd_minima) ? f : maior
  )
}

/**
 * Preço efetivo de um item do carrinho. Só aplica a faixa quando ela é
 * mais barata que o preço normal — uma faixa cadastrada errada (mais cara)
 * não pode encarecer a venda por engano.
 */
export function precoEfetivo(item, faixas = []) {
  const faixa = faixaAplicavel(item.id, item.quantidade, faixas)
  const precoFaixa = faixa ? Number(faixa.preco_faixa) : null
  const comDesconto = precoFaixa !== null && precoFaixa < item.preco_venda
  return {
    preco:       comDesconto ? precoFaixa : item.preco_venda,
    comDesconto,
    faixa:       comDesconto ? faixa : null,
  }
}
