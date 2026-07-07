import { describe, it, expect } from 'vitest'
import { calcularTotalVenda } from './venda.js'

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
