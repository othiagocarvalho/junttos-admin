import { describe, it, expect } from 'vitest'
import { calcularTotalVenda, calcularTotalComAjuste, decrementarVariacoes, restaurarVariacoes } from './venda.js'

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
