import { describe, it, expect } from 'vitest'
import { calcularTotalVenda, calcularTotalComAjuste, decrementarVariacoes, restaurarVariacoes, calcularResumoTroca, calcularAjusteTroca, parseValorBR, montarGravacaoVenda } from './venda.js'

const produtosData = [
  { nome: 'Blusa Básica', preco_venda: 50 },
  { nome: 'Calça Jeans', preco_venda: 120 },
  { nome: 'Vestido Floral', preco_venda: 80 },
]

describe('calcularTotalVenda', () => {
  it('soma correta de múltiplos itens com quantidades diferentes', () => {
    const itens = [
      { nome: 'Blusa Básica', quantidade: 3 },
      { nome: 'Calça Jeans', quantidade: 2 },
    ]
    // 3×50 + 2×120 = 150 + 240 = 390
    expect(calcularTotalVenda(itens, produtosData)).toBe(390)
  })

  it('soma de um único item com quantidade > 1', () => {
    const itens = [{ nome: 'Vestido Floral', quantidade: 5 }]
    // 5×80 = 400
    expect(calcularTotalVenda(itens, produtosData)).toBe(400)
  })

  it('total zerado quando nenhum item selecionado', () => {
    expect(calcularTotalVenda([], produtosData)).toBe(0)
  })

  it('alteração de quantidade recalcula o total corretamente', () => {
    const itensAntes  = [{ nome: 'Blusa Básica', quantidade: 1 }]
    const itensDepois = [{ nome: 'Blusa Básica', quantidade: 4 }]
    expect(calcularTotalVenda(itensAntes,  produtosData)).toBe(50)
    expect(calcularTotalVenda(itensDepois, produtosData)).toBe(200)
  })
})

describe('calcularTotalComAjuste', () => {
  it('sem ajuste: retorna o subtotal intacto', () => {
    expect(calcularTotalComAjuste(150, 'desconto', 'valor', 0)).toBe(150)
  })

  it('sem ajuste (valor undefined): retorna o subtotal intacto', () => {
    expect(calcularTotalComAjuste(150, 'desconto', 'valor', undefined)).toBe(150)
  })

  it('desconto em R$: subtrai o valor fixo', () => {
    expect(calcularTotalComAjuste(150, 'desconto', 'valor', 20)).toBe(130)
  })

  it('acréscimo em R$: soma o valor fixo', () => {
    expect(calcularTotalComAjuste(150, 'acrescimo', 'valor', 10)).toBe(160)
  })

  it('desconto em %: aplica percentual sobre o subtotal', () => {
    expect(calcularTotalComAjuste(200, 'desconto', 'percentual', 10)).toBe(180)
  })

  it('acréscimo em %: aplica percentual sobre o subtotal', () => {
    expect(calcularTotalComAjuste(200, 'acrescimo', 'percentual', 5)).toBe(210)
  })

  it('desconto maior que subtotal: nunca retorna negativo (mínimo 0)', () => {
    expect(calcularTotalComAjuste(50, 'desconto', 'valor', 80)).toBe(0)
  })

  it('desconto de 100%: total fica 0', () => {
    expect(calcularTotalComAjuste(300, 'desconto', 'percentual', 100)).toBe(0)
  })

  it('subtotal 0 sem ajuste: retorna 0', () => {
    expect(calcularTotalComAjuste(0, 'desconto', 'valor', 0)).toBe(0)
  })

  it('desconto em R$ com subtotal fracionado', () => {
    expect(calcularTotalComAjuste(99.9, 'desconto', 'valor', 9.9)).toBeCloseTo(90)
  })
})

const VARIACOES_BASE = [
  { cor: 'P', custo: 0, quantidade: 10 },
  { cor: 'M', custo: 0, quantidade: 8 },
  { cor: 'G', custo: 0, quantidade: 5 },
]

describe('decrementarVariacoes', () => {
  it('qty=1: decrementa 1 unidade corretamente (regressão)', () => {
    const result = decrementarVariacoes(VARIACOES_BASE, [{ variacao: 'M', quantidade: 1 }])
    expect(result.find(v => v.cor === 'M').quantidade).toBe(7)
    expect(result.find(v => v.cor === 'P').quantidade).toBe(10)
    expect(result.find(v => v.cor === 'G').quantidade).toBe(5)
  })

  it('qty>1: decrementa a quantidade real (caso que estava quebrado)', () => {
    const result = decrementarVariacoes(VARIACOES_BASE, [{ variacao: 'M', quantidade: 5 }])
    expect(result.find(v => v.cor === 'M').quantidade).toBe(3)
    expect(result.find(v => v.cor === 'P').quantidade).toBe(10)
    expect(result.find(v => v.cor === 'G').quantidade).toBe(5)
  })

  it('múltiplas variações, quantidades diferentes', () => {
    const result = decrementarVariacoes(VARIACOES_BASE, [
      { variacao: 'P', quantidade: 3 },
      { variacao: 'G', quantidade: 2 },
    ])
    expect(result.find(v => v.cor === 'P').quantidade).toBe(7)
    expect(result.find(v => v.cor === 'M').quantidade).toBe(8)
    expect(result.find(v => v.cor === 'G').quantidade).toBe(3)
  })

  it('quantidade não vai abaixo de 0', () => {
    const result = decrementarVariacoes(VARIACOES_BASE, [{ variacao: 'G', quantidade: 20 }])
    expect(result.find(v => v.cor === 'G').quantidade).toBe(0)
  })

  it('variação inexistente é ignorada, demais ficam intactas', () => {
    const result = decrementarVariacoes(VARIACOES_BASE, [{ variacao: 'XL', quantidade: 3 }])
    expect(result).toEqual(VARIACOES_BASE)
  })
})

describe('restaurarVariacoes', () => {
  it('qty=1: restaura 1 unidade corretamente', () => {
    const base = [{ cor: 'M', custo: 0, quantidade: 3 }]
    const result = restaurarVariacoes(base, [{ variacao: 'M', quantidade: 1 }])
    expect(result.find(v => v.cor === 'M').quantidade).toBe(4)
  })

  it('qty>1: restaura a quantidade real da venda excluída (caso espelhado do bug)', () => {
    const base = [{ cor: 'M', custo: 0, quantidade: 3 }]
    const result = restaurarVariacoes(base, [{ variacao: 'M', quantidade: 5 }])
    expect(result.find(v => v.cor === 'M').quantidade).toBe(8)
  })

  it('restaura múltiplas variações com quantidades distintas', () => {
    const base = [
      { cor: 'P', custo: 0, quantidade: 7 },
      { cor: 'G', custo: 0, quantidade: 3 },
    ]
    const result = restaurarVariacoes(base, [
      { variacao: 'P', quantidade: 3 },
      { variacao: 'G', quantidade: 2 },
    ])
    expect(result.find(v => v.cor === 'P').quantidade).toBe(10)
    expect(result.find(v => v.cor === 'G').quantidade).toBe(5)
  })

  it('decrement + restaurar retorna ao estado original', () => {
    const itens = [{ variacao: 'M', quantidade: 5 }]
    const aposVenda   = decrementarVariacoes(VARIACOES_BASE, itens)
    const aposEstorno = restaurarVariacoes(aposVenda, itens)
    expect(aposEstorno.find(v => v.cor === 'M').quantidade).toBe(8)
  })
})

// ---------------------------------------------------------------------------
// Troca: 3 cenários de comparação entre crédito e produto novo
// ---------------------------------------------------------------------------

const produtosTrocaData = [
  { nome: 'Blusa Rosa',    preco_venda: 80 },
  { nome: 'Calça Branca',  preco_venda: 120 },
  { nome: 'Vestido Azul',  preco_venda: 80 },
  { nome: 'Saia Preta',    preco_venda: 60 },
]

describe('troca: cálculo de diferença (creditoTroca vs subtotalNovos)', () => {
  it('cenário 1 — troca zerada: produto devolvido = produto novo → diferença = 0', () => {
    const devolvido = [{ nome: 'Blusa Rosa', variacao: 'M', quantidade: 1 }]
    const novo      = [{ nome: 'Vestido Azul', variacao: 'P', quantidade: 1 }]
    const creditoTroca    = calcularTotalVenda(devolvido, produtosTrocaData) // 80
    const subtotalNovos   = calcularTotalVenda(novo,      produtosTrocaData) // 80
    const diferenca       = Math.max(0, subtotalNovos - creditoTroca)
    expect(creditoTroca).toBe(80)
    expect(subtotalNovos).toBe(80)
    expect(diferenca).toBe(0)
  })

  it('cenário 2 — produto novo mais caro: cliente paga a diferença', () => {
    const devolvido = [{ nome: 'Blusa Rosa',   variacao: 'M', quantidade: 1 }]
    const novo      = [{ nome: 'Calça Branca', variacao: 'G', quantidade: 1 }]
    const creditoTroca    = calcularTotalVenda(devolvido, produtosTrocaData) // 80
    const subtotalNovos   = calcularTotalVenda(novo,      produtosTrocaData) // 120
    const diferenca       = Math.max(0, subtotalNovos - creditoTroca)
    expect(creditoTroca).toBe(80)
    expect(subtotalNovos).toBe(120)
    expect(diferenca).toBe(40)
  })

  it('cenário 3 — produto novo mais barato: saldo a favor do cliente (diferença mínima 0)', () => {
    const devolvido = [{ nome: 'Calça Branca', variacao: 'G', quantidade: 1 }]
    const novo      = [{ nome: 'Saia Preta',   variacao: 'P', quantidade: 1 }]
    const creditoTroca    = calcularTotalVenda(devolvido, produtosTrocaData) // 120
    const subtotalNovos   = calcularTotalVenda(novo,      produtosTrocaData) // 60
    const diferencaTroca  = subtotalNovos - creditoTroca                     // -60 (signed)
    const totalCobrado    = Math.max(0, diferencaTroca)                      // 0 (sem cobrança)
    const saldoExibido    = diferencaTroca > 0.005 ? totalCobrado : Math.abs(diferencaTroca)
    expect(creditoTroca).toBe(120)
    expect(subtotalNovos).toBe(60)
    // cobrança em dinheiro = 0 (não há reembolso)
    expect(totalCobrado).toBe(0)
    // valor exibido no card "Saldo a favor" = valor real do saldo, não zero
    expect(saldoExibido).toBe(60)
    // diferencaTroca signed = -60
    expect(diferencaTroca).toBe(-60)
  })

  it('restaurarVariacoes restaura estoque do produto devolvido na troca', () => {
    const variacoesProduto = [
      { cor: 'M', custo: 0, quantidade: 2 },
      { cor: 'G', custo: 0, quantidade: 5 },
    ]
    const itensTroca = [{ variacao: 'M', quantidade: 1 }]
    const result = restaurarVariacoes(variacoesProduto, itensTroca)
    // estoque de M volta de 2 → 3, G inalterado
    expect(result.find(v => v.cor === 'M').quantidade).toBe(3)
    expect(result.find(v => v.cor === 'G').quantidade).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// calcularResumoTroca — a função que mobile e desktop realmente usam para
// decidir rótulo, cor e valor do resumo da troca.
// ---------------------------------------------------------------------------

describe('calcularResumoTroca', () => {
  it('cenário 1 — crédito igual ao produto novo: troca zerada, sem cobrança', () => {
    const devolvido = [{ nome: 'Blusa Rosa',   variacao: 'M', quantidade: 1 }]
    const novo      = [{ nome: 'Vestido Azul', variacao: 'P', quantidade: 1 }]
    const credito   = calcularTotalVenda(devolvido, produtosTrocaData) // 80
    const subtotal  = calcularTotalVenda(novo,      produtosTrocaData) // 80

    const r = calcularResumoTroca(subtotal, credito)
    expect(r.zerada).toBe(true)
    expect(r.aCobrar).toBe(false)
    expect(r.saldoAFavor).toBe(false)
    expect(r.diferenca).toBe(0)
    expect(r.valorCobrado).toBe(0)
    expect(r.rotulo).toBe('Troca zerada')
  })

  it('cenário 2 — produto novo mais caro: cliente paga só a diferença', () => {
    const devolvido = [{ nome: 'Blusa Rosa',   variacao: 'M', quantidade: 1 }]
    const novo      = [{ nome: 'Calça Branca', variacao: 'G', quantidade: 1 }]
    const credito   = calcularTotalVenda(devolvido, produtosTrocaData) // 80
    const subtotal  = calcularTotalVenda(novo,      produtosTrocaData) // 120

    const r = calcularResumoTroca(subtotal, credito)
    expect(r.aCobrar).toBe(true)
    expect(r.zerada).toBe(false)
    expect(r.diferenca).toBe(40)
    expect(r.valorCobrado).toBe(40)   // cobra a diferença, não os 120
    expect(r.valorExibido).toBe(40)
    expect(r.rotulo).toBe('A cobrar')
  })

  it('cenário 3 — produto novo mais barato: saldo a favor, sem reembolso', () => {
    const devolvido = [{ nome: 'Calça Branca', variacao: 'G', quantidade: 1 }]
    const novo      = [{ nome: 'Saia Preta',   variacao: 'P', quantidade: 1 }]
    const credito   = calcularTotalVenda(devolvido, produtosTrocaData) // 120
    const subtotal  = calcularTotalVenda(novo,      produtosTrocaData) // 60

    const r = calcularResumoTroca(subtotal, credito)
    expect(r.saldoAFavor).toBe(true)
    expect(r.aCobrar).toBe(false)
    expect(r.diferenca).toBe(-60)
    expect(r.valorCobrado).toBe(0)    // não vira dinheiro de volta
    expect(r.valorExibido).toBe(60)   // o card mostra o saldo real, não zero
    expect(r.rotulo).toBe('Saldo a favor')
  })

  it('sobra de centavo do ponto flutuante não vira cobrança', () => {
    const r = calcularResumoTroca(80.000000001, 80)
    expect(r.zerada).toBe(true)
    expect(r.aCobrar).toBe(false)
  })

  it('troca sem produto devolvido é uma venda comum: tudo a cobrar', () => {
    const r = calcularResumoTroca(120, 0)
    expect(r.aCobrar).toBe(true)
    expect(r.valorCobrado).toBe(120)
  })
})

// ---------------------------------------------------------------------------
// Ajuste manual da troca: desconto e acréscimo em R$ digitados pelo operador
// na tela de fechamento. Não vira coluna nova — entra no valor final e no
// ajuste_valor da venda de troca.
// ---------------------------------------------------------------------------

describe('parseValorBR', () => {
  it('aceita vírgula como separador decimal', () => {
    expect(parseValorBR('12,50')).toBe(12.5)
  })
  it('aceita ponto', () => {
    expect(parseValorBR('12.50')).toBe(12.5)
  })
  it('campo vazio, nulo ou texto solto viram 0', () => {
    expect(parseValorBR('')).toBe(0)
    expect(parseValorBR(null)).toBe(0)
    expect(parseValorBR(undefined)).toBe(0)
    expect(parseValorBR('abc')).toBe(0)
  })
})

describe('calcularAjusteTroca', () => {
  it('sem nada digitado: ajuste 0', () => {
    expect(calcularAjusteTroca('', '')).toBe(0)
  })
  it('só desconto: valor negativo', () => {
    expect(calcularAjusteTroca('20', '')).toBe(-20)
  })
  it('só acréscimo: valor positivo', () => {
    expect(calcularAjusteTroca('', '15,50')).toBe(15.5)
  })
  it('os dois juntos: acréscimo menos desconto', () => {
    expect(calcularAjusteTroca('20', '5')).toBe(-15)
  })
  it('valor negativo digitado é ignorado — desconto se pede no campo de desconto', () => {
    expect(calcularAjusteTroca('-30', '')).toBe(0)
    expect(calcularAjusteTroca('', '-30')).toBe(0)
  })
})

describe('calcularResumoTroca com ajuste manual', () => {
  it('desconto abate a diferença a cobrar', () => {
    // novo 120, devolvido 80 → 40 a cobrar; R$ 10 de desconto → 30
    const r = calcularResumoTroca(120, 80, calcularAjusteTroca('10', ''))
    expect(r.aCobrar).toBe(true)
    expect(r.diferenca).toBe(30)
    expect(r.valorCobrado).toBe(30)
    expect(r.rotulo).toBe('A cobrar')
  })

  it('acréscimo soma na diferença a cobrar', () => {
    const r = calcularResumoTroca(120, 80, calcularAjusteTroca('', '25'))
    expect(r.diferenca).toBe(65)
    expect(r.valorCobrado).toBe(65)
  })

  it('desconto exatamente igual à diferença zera a troca', () => {
    const r = calcularResumoTroca(120, 80, calcularAjusteTroca('40', ''))
    expect(r.zerada).toBe(true)
    expect(r.aCobrar).toBe(false)
    expect(r.valorCobrado).toBe(0)
    expect(r.rotulo).toBe('Troca zerada')
  })

  it('desconto maior que a diferença vira saldo a favor, sem reembolso', () => {
    const r = calcularResumoTroca(120, 80, calcularAjusteTroca('60', ''))
    expect(r.saldoAFavor).toBe(true)
    expect(r.valorCobrado).toBe(0)     // não vira dinheiro de volta
    expect(r.valorExibido).toBe(20)
  })

  it('acréscimo converte saldo a favor em cobrança', () => {
    // novo 60, devolvido 120 → saldo a favor de 60; taxa de 80 → cobra 20
    const r = calcularResumoTroca(60, 120, calcularAjusteTroca('', '80'))
    expect(r.aCobrar).toBe(true)
    expect(r.valorCobrado).toBe(20)
  })

  it('ajuste omitido mantém o comportamento anterior (default 0)', () => {
    expect(calcularResumoTroca(120, 80)).toEqual(calcularResumoTroca(120, 80, 0))
  })
})

// ── Etapa 2: preço pelo produto_id ─────────────────────────────────────────
describe('calcularTotalVenda com produto_id', () => {
  const produtosData = [{ id: 'a', nome: 'SHORT', preco_venda: 40 }, { id: 'b', nome: 'SHORT', preco_venda: 60 }]
  it('usa o preço do produto do id, não o primeiro de mesmo nome', () => {
    expect(calcularTotalVenda([{ produto_id: 'b', nome: 'SHORT', quantidade: 2 }], produtosData)).toBe(120)
  })
  it('item sem id continua pelo nome', () => {
    expect(calcularTotalVenda([{ nome: 'SHORT', quantidade: 1 }], produtosData)).toBe(40)
  })
})

// ---------------------------------------------------------------------------
// montarGravacaoVenda — o que mobile e desktop gravam em lf_vendas. Os três
// cenários da troca, do jeito que a tela chega no "Confirmar Troca": o
// "Valor Total" já veio do cálculo da tela (calcularResumoTroca.valorCobrado).
// ---------------------------------------------------------------------------

describe('montarGravacaoVenda — troca', () => {
  const cadastro = [
    { id: 'p-blusa',  nome: 'Blusa Rosa',   preco_venda: 80 },
    { id: 'p-calca',  nome: 'Calça Branca', preco_venda: 120 },
    { id: 'p-vest',   nome: 'Vestido Azul', preco_venda: 80 },
    { id: 'p-saia',   nome: 'Saia Preta',   preco_venda: 60 },
  ]
  const item = (id, nome, variacao) => ({ produto_id: id, nome, variacao, obs: variacao, quantidade: 1 })
  // Simula a tela: o efeito de total preenche "Valor Total" e o pagamento único.
  function telaTroca({ devolvido, novo, desconto = '', acrescimo = '', forma = 'Pix' }) {
    const r = calcularResumoTroca(
      calcularTotalVenda(novo, cadastro), calcularTotalVenda(devolvido, cadastro), calcularAjusteTroca(desconto, acrescimo),
    )
    const valor = r.valorCobrado.toFixed(2).replace('.', ',')
    return montarGravacaoVenda({
      isTroca: true, produtos: novo, produtoTroca: devolvido, produtosData: cadastro,
      valor, pagamentos: [{ forma, valor }], trocaDesconto: desconto, trocaAcrescimo: acrescimo,
    })
  }

  it('cenário 1 — crédito igual ao produto novo: troca zerada, forma "Troca" com 0', () => {
    const g = telaTroca({ devolvido: [item('p-blusa', 'Blusa Rosa', 'M')], novo: [item('p-vest', 'Vestido Azul', 'P')] })
    expect(g.valor).toBe(0)
    expect(g.ajuste_valor).toBe(-80)                // valor = subtotal (80) + ajuste (-80)
    expect(JSON.parse(g.forma_pgto)).toEqual([{ forma: 'Troca', valor: 0 }])
    expect(g.tipo_venda).toBe('troca')
    expect(g.produto_devolvido).toEqual([item('p-blusa', 'Blusa Rosa', 'M')])
  })

  it('cenário 2 — crédito MENOR que o produto novo: cliente paga só a diferença', () => {
    const g = telaTroca({ devolvido: [item('p-blusa', 'Blusa Rosa', 'M')], novo: [item('p-calca', 'Calça Branca', 'G')], forma: 'Cartão de Débito' })
    expect(g.valor).toBe(40)
    expect(g.ajuste_valor).toBe(-80)                // 120 − 80 = 40
    expect(JSON.parse(g.forma_pgto)).toEqual([{ forma: 'Cartão de Débito', valor: 40 }])
    expect(g.tipo_venda).toBe('troca')
  })

  it('cenário 3 — crédito MAIOR que o produto novo: saldo a favor não vira dinheiro, grava zerada', () => {
    const g = telaTroca({ devolvido: [item('p-calca', 'Calça Branca', 'G')], novo: [item('p-saia', 'Saia Preta', 'P')] })
    expect(g.valor).toBe(0)
    expect(g.ajuste_valor).toBe(-120)
    expect(JSON.parse(g.forma_pgto)).toEqual([{ forma: 'Troca', valor: 0 }])
  })

  it('cenário 3 + outro produto: completa o crédito e cobra só o que passar', () => {
    // Calça 120 devolvida; Saia 60 + Vestido 80 = 140 → cobra 20
    const g = telaTroca({
      devolvido: [item('p-calca', 'Calça Branca', 'G')],
      novo: [item('p-saia', 'Saia Preta', 'P'), item('p-vest', 'Vestido Azul', 'P')],
    })
    expect(g.valor).toBe(20)
    expect(g.ajuste_valor).toBe(-120)
    expect(JSON.parse(g.forma_pgto)).toEqual([{ forma: 'Pix', valor: 20 }])
  })

  it('cenário 3 + acréscimo manual: converte o saldo a favor em cobrança', () => {
    // Calça 120 devolvida, Saia 60 nova, acréscimo 80 → cobra 20
    const g = telaTroca({ devolvido: [item('p-calca', 'Calça Branca', 'G')], novo: [item('p-saia', 'Saia Preta', 'P')], acrescimo: '80' })
    expect(g.valor).toBe(20)
    expect(g.ajuste_valor).toBe(-40)                // −120 de crédito + 80 de acréscimo
  })

  it('desconto manual entra no ajuste_valor junto com o crédito', () => {
    const g = telaTroca({ devolvido: [item('p-blusa', 'Blusa Rosa', 'M')], novo: [item('p-calca', 'Calça Branca', 'G')], desconto: '10' })
    expect(g.valor).toBe(30)
    expect(g.ajuste_valor).toBe(-90)
  })

  it('valor = subtotal do produto novo + ajuste_valor nos três cenários (relatórios contam com isso)', () => {
    for (const [dev, novo] of [
      [[item('p-blusa', 'Blusa Rosa', 'M')], [item('p-vest', 'Vestido Azul', 'P')]],
      [[item('p-blusa', 'Blusa Rosa', 'M')], [item('p-calca', 'Calça Branca', 'G')]],
    ]) {
      const g = telaTroca({ devolvido: dev, novo })
      expect(g.valor).toBeCloseTo(calcularTotalVenda(novo, cadastro) + g.ajuste_valor, 2)
    }
  })

  it('troca sem produto devolvido não manda produto_devolvido', () => {
    const g = telaTroca({ devolvido: [], novo: [item('p-saia', 'Saia Preta', 'P')] })
    expect(g.produto_devolvido).toBeUndefined()
    expect(g.valor).toBe(60)
    expect(g.ajuste_valor).toBe(0)
  })
})

describe('montarGravacaoVenda — venda normal (sem mudança de comportamento)', () => {
  const pg = (forma, valor) => ({ forma, valor })
  it('sem ajuste', () => {
    const g = montarGravacaoVenda({
      isTroca: false, produtos: [{ nome: 'Calça Jeans', quantidade: 1 }], produtosData,
      valor: '120,00', pagamentos: [pg('Pix', '120,00')], ajusteTipo: 'desconto', ajusteModo: 'valor', ajusteInput: '',
    })
    expect(g).toEqual({ valor: 120, ajuste_valor: 0, forma_pgto: JSON.stringify([{ forma: 'Pix', valor: 120 }]), tipo_venda: 'venda', produto_devolvido: undefined })
  })
  it('desconto em % e acréscimo em R$', () => {
    const base = { isTroca: false, produtos: [{ nome: 'Calça Jeans', quantidade: 1 }], produtosData, valor: '108,00', pagamentos: [pg('Pix', '100'), pg('Dinheiro', '8')] }
    expect(montarGravacaoVenda({ ...base, ajusteTipo: 'desconto', ajusteModo: 'percentual', ajusteInput: '10' }).ajuste_valor).toBe(-12)
    expect(montarGravacaoVenda({ ...base, ajusteTipo: 'acrescimo', ajusteModo: 'valor', ajusteInput: '5,50' }).ajuste_valor).toBe(5.5)
    expect(JSON.parse(montarGravacaoVenda({ ...base, ajusteInput: '' }).forma_pgto)).toEqual([{ forma: 'Pix', valor: 100 }, { forma: 'Dinheiro', valor: 8 }])
  })
  it('venda normal com valor 0 NÃO vira forma "Troca"', () => {
    const g = montarGravacaoVenda({ isTroca: false, produtos: [], produtosData, valor: '0', pagamentos: [pg('Pix', '0')], ajusteInput: '' })
    expect(JSON.parse(g.forma_pgto)).toEqual([{ forma: 'Pix', valor: 0 }])
    expect(g.tipo_venda).toBe('venda')
  })
  it('campos vazios ou com lixo viram 0, como antes', () => {
    const g = montarGravacaoVenda({ isTroca: false, produtos: [], produtosData, valor: '', pagamentos: [pg('Pix', ''), pg('Pix', undefined)], ajusteInput: 'abc' })
    expect(g.valor).toBe(0)
    expect(g.ajuste_valor).toBe(0)
    expect(JSON.parse(g.forma_pgto)).toEqual([{ forma: 'Pix', valor: 0 }, { forma: 'Pix', valor: 0 }])
  })
})
