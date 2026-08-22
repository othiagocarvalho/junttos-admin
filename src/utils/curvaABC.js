// Curva ABC de produtos.
//
// O cálculo vivia inline dentro de Relatorios.jsx (mobile). Saiu de lá porque
// agora ele aparece na tela Metas & Resultados, e regra de negócio duplicada em
// duas telas diverge — foi exatamente o que aconteceu com a comissão.
//
// Regra preservada byte a byte do original:
//   • o valor da venda é rateado igualmente entre os produtos dela
//     (não existe preço por item em lf_vendas.produtos);
//   • cada aparição conta 1 na quantidade;
//   • ordena por valor decrescente e acumula: até 80% classe A, até 95% B,
//     o resto C.

export function calcularCurvaABC(vendas = []) {
  const mapa = {}
  for (const v of vendas || []) {
    const produtos = v?.produtos || []
    const nProd = produtos.length
    // Venda sem produto listado não tem como ratear — fica de fora, como antes.
    // O Number.isFinite é acréscimo: o original fazia `Number(v.valor)/nProd`
    // direto, e valor não-numérico (importação torta, campo em branco) virava
    // NaN, que a tabela renderizava como "R$ NaN". Vira 0.
    const bruto = Number(v?.valor)
    const valorVenda = Number.isFinite(bruto) ? bruto : 0
    const valorPorProd = nProd > 0 ? valorVenda / nProd : 0
    for (const p of produtos) {
      const nome = p?.nome
      if (!nome) continue
      if (!mapa[nome]) mapa[nome] = { nome, qtd: 0, valor: 0 }
      mapa[nome].qtd += 1
      mapa[nome].valor += valorPorProd
    }
  }

  const lista = Object.values(mapa).sort((a, b) => b.valor - a.valor)
  const totalV = lista.reduce((s, p) => s + p.valor, 0)
  let acum = 0
  return lista.map(p => {
    acum += p.valor
    const pctAcum = totalV > 0 ? (acum / totalV) * 100 : 0
    const classe = pctAcum <= 80 ? 'A' : pctAcum <= 95 ? 'B' : 'C'
    return { ...p, classe }
  })
}
