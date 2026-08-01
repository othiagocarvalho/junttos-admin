import { describe, it, expect } from 'vitest'
import {
  estoqueAtual,
  mediaDiariaPorNome,
  nivelDoProduto,
  MINIMO_PADRAO,
} from './estoque'

// Datas fixas: o critério usa uma janela relativa a "hoje", então os testes
// passam o `hoje` explicitamente em vez de depender do relógio da máquina.
const HOJE = new Date('2026-07-31T12:00:00')
const diasAtras = n => {
  const d = new Date(HOJE)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

describe('estoqueAtual', () => {
  it('soma as variações (é onde o Mercado guarda o estoque real)', () => {
    expect(estoqueAtual({ variacoes: [{ cor: 'Único', quantidade: 50 }] })).toBe(50)
    expect(estoqueAtual({ variacoes: [{ quantidade: 3 }, { quantidade: 4 }] })).toBe(7)
  })

  it('cai para a coluna quantidade quando não há variação', () => {
    expect(estoqueAtual({ variacoes: [], quantidade: 12 })).toBe(12)
    expect(estoqueAtual({ quantidade: 5 })).toBe(5)
  })

  it('não quebra com produto vazio ou campos inválidos', () => {
    expect(estoqueAtual(null)).toBe(0)
    expect(estoqueAtual({})).toBe(0)
    expect(estoqueAtual({ variacoes: [{ quantidade: 'x' }] })).toBe(0)
  })
})

describe('mediaDiariaPorNome', () => {
  it('divide o total vendido pela janela de 30 dias', () => {
    const vendas = [
      { data: diasAtras(1), produtos: [{ nome: 'Arroz 5kg', quantidade: 30 }] },
    ]
    expect(mediaDiariaPorNome(vendas, HOJE)['Arroz 5kg']).toBeCloseTo(1)
  })

  it('acumula o mesmo produto em vendas diferentes', () => {
    const vendas = [
      { data: diasAtras(2), produtos: [{ nome: 'Feijão 1kg', quantidade: 15 }] },
      { data: diasAtras(5), produtos: [{ nome: 'Feijão 1kg', quantidade: 15 }] },
    ]
    expect(mediaDiariaPorNome(vendas, HOJE)['Feijão 1kg']).toBeCloseTo(1)
  })

  it('ignora vendas fora da janela', () => {
    const vendas = [{ data: diasAtras(60), produtos: [{ nome: 'Arroz 5kg', quantidade: 300 }] }]
    expect(mediaDiariaPorNome(vendas, HOJE)['Arroz 5kg']).toBeUndefined()
  })

  it('não quebra com venda sem produtos ou sem data', () => {
    expect(mediaDiariaPorNome([{ data: diasAtras(1) }], HOJE)).toEqual({})
    expect(mediaDiariaPorNome([{ produtos: [{ nome: 'X', quantidade: 1 }] }], HOJE)).toEqual({})
    expect(mediaDiariaPorNome(null, HOJE)).toEqual({})
  })
})

describe('nivelDoProduto', () => {
  it('usa o piso padrão quando o produto não tem giro', () => {
    const n = nivelDoProduto({ variacoes: [{ quantidade: 50 }] }, 0)
    expect(n.minimo).toBe(MINIMO_PADRAO)
    expect(n.estado).toBe('ok')
  })

  it('eleva o mínimo para cobrir uma semana de venda', () => {
    // 3 un/dia × 7 dias = 21, acima do piso de 10
    const n = nivelDoProduto({ variacoes: [{ quantidade: 21 }] }, 3)
    expect(n.minimo).toBe(21)
    expect(n.estado).toBe('ok')
  })

  it('classifica ok / baixo / crítico pelas faixas do critério', () => {
    const comQtd = q => nivelDoProduto({ variacoes: [{ quantidade: q }] }, 0)
    expect(comQtd(10).estado).toBe('ok')       // razão 1.0
    expect(comQtd(20).estado).toBe('ok')       // acima do mínimo
    expect(comQtd(9).estado).toBe('baixo')     // razão 0.9
    expect(comQtd(4).estado).toBe('baixo')     // razão 0.4 — limite inclusivo
    expect(comQtd(3).estado).toBe('critico')   // razão 0.3
    expect(comQtd(0).estado).toBe('critico')   // sem estoque
  })

  it('limita a barra em 100% mesmo com estoque acima do mínimo', () => {
    expect(nivelDoProduto({ variacoes: [{ quantidade: 500 }] }, 0).pct).toBe(100)
    expect(nivelDoProduto({ variacoes: [{ quantidade: 5 }] }, 0).pct).toBe(50)
  })

  it('devolve a cor correspondente ao estado', () => {
    expect(nivelDoProduto({ variacoes: [{ quantidade: 50 }] }, 0).cor).toBe('#17864F')
    expect(nivelDoProduto({ variacoes: [{ quantidade: 6 }] }, 0).cor).toBe('#E07A0C')
    expect(nivelDoProduto({ variacoes: [{ quantidade: 1 }] }, 0).cor).toBe('#C4321F')
  })
})
