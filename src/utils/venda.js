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

/**
 * Centavo de folga: o crédito da troca e o subtotal do produto novo vêm de
 * multiplicações em ponto flutuante, e 80.00000000001 não é "a cobrar".
 */
export const TOLERANCIA_TROCA = 0.005

/** "12,50" → 12.5. Campo vazio, texto solto ou NaN viram 0. */
export function parseValorBR(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Ajuste manual da troca, já com o sinal certo: desconto abate, acréscimo soma.
 * Valor negativo digitado é ignorado — quem quer abater usa o campo desconto,
 * senão "-50" no acréscimo viraria um desconto disfarçado.
 */
export function calcularAjusteTroca(desconto, acrescimo) {
  return Math.max(0, parseValorBR(acrescimo)) - Math.max(0, parseValorBR(desconto))
}

/**
 * Compara o crédito do produto devolvido com o subtotal do produto novo e
 * devolve os três cenários da troca: a cobrar, saldo a favor ou zerada.
 *
 * Mobile e desktop repetiam essa comparação inline e já tinham divergido —
 * o desktop pintava "saldo a favor" de verde, como se estivesse tudo certo,
 * quando é justamente o caso que a lojista precisa notar (não é
 * reembolsável em dinheiro).
 *
 * @param {number} subtotalNovos  soma do produto novo
 * @param {number} creditoTroca   soma do produto devolvido
 * @param {number} ajuste         ajuste manual já com sinal (ver calcularAjusteTroca);
 *                                0 por padrão, para as chamadas que não ajustam nada
 */
export function calcularResumoTroca(subtotalNovos, creditoTroca, ajuste = 0) {
  const diferenca   = (Number(subtotalNovos) || 0) - (Number(creditoTroca) || 0) + (Number(ajuste) || 0)
  const aCobrar     = diferenca >  TOLERANCIA_TROCA
  const saldoAFavor = diferenca < -TOLERANCIA_TROCA
  return {
    diferenca,
    aCobrar,
    saldoAFavor,
    zerada: !aCobrar && !saldoAFavor,
    // O que a loja efetivamente cobra: saldo a favor não vira dinheiro de volta.
    valorCobrado: aCobrar ? diferenca : 0,
    valorExibido: Math.abs(diferenca),
    rotulo: aCobrar ? 'A cobrar' : saldoAFavor ? 'Saldo a favor' : 'Troca zerada',
  }
}
