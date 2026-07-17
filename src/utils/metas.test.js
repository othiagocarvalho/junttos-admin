import { describe, it, expect } from 'vitest'
import { calcularPA, calcularProgressoMeta } from './metas.js'

describe('calcularPA', () => {
  it('retorna 0 quando não há vendas', () => {
    expect(calcularPA([])).toBe(0)
  })

  it('1 venda com 1 produto → PA = 1', () => {
    const vendas = [{ produtos: [{ quantidade: 1 }], valor: 50 }]
    expect(calcularPA(vendas)).toBe(1)
  })

  it('2 vendas com 3 itens cada → PA = 3', () => {
    const mk = qtd => ({ produtos: [{ quantidade: qtd }], valor: 100 })
    expect(calcularPA([mk(3), mk(3)])).toBe(3)
  })

  it('itens desiguais: calcula média correta (4+2)/2 = 3', () => {
    const v1 = { produtos: [{ quantidade: 2 }, { quantidade: 2 }], valor: 100 }
    const v2 = { produtos: [{ quantidade: 1 }, { quantidade: 1 }], valor: 80 }
    expect(calcularPA([v1, v2])).toBe(3)
  })

  it('venda sem campo produtos conta como 0 itens', () => {
    const vendas = [{ valor: 50 }, { produtos: [{ quantidade: 2 }], valor: 80 }]
    // 0 + 2 = 2 itens / 2 vendas = 1
    expect(calcularPA(vendas)).toBe(1)
  })

  it('produto sem quantidade usa 1 como padrão', () => {
    const vendas = [{ produtos: [{ nome: 'Blusa' }], valor: 80 }]
    expect(calcularPA(vendas)).toBe(1)
  })
})

describe('calcularProgressoMeta', () => {
  // Mês fechado — todos os dias já passaram, diaAtual = diasNoMes
  const mesFechado = '2026-01'
  const vendas = [
    { data: '2026-01-05T10:00:00', valor: 500, produtos: [] },
    { data: '2026-01-15T14:00:00', valor: 300, produtos: [] },
    { data: '2026-02-10T10:00:00', valor: 200, produtos: [] }, // outro mês, deve ser ignorado
  ]

  it('realizado = soma das vendas do mês', () => {
    const { realizado } = calcularProgressoMeta(vendas, 1000, mesFechado)
    expect(realizado).toBe(800)
  })

  it('pct correto quando meta definida', () => {
    const { pct } = calcularProgressoMeta(vendas, 1000, mesFechado)
    expect(pct).toBeCloseTo(80)
  })

  it('atingida = true quando realizado >= meta', () => {
    const { atingida } = calcularProgressoMeta(vendas, 800, mesFechado)
    expect(atingida).toBe(true)
  })

  it('faltam = 0 quando meta atingida', () => {
    const { faltam } = calcularProgressoMeta(vendas, 800, mesFechado)
    expect(faltam).toBe(0)
  })

  it('faltam > 0 quando meta não atingida', () => {
    const { faltam } = calcularProgressoMeta(vendas, 1000, mesFechado)
    expect(faltam).toBe(200)
  })

  it('pct = 0 quando meta não definida (0)', () => {
    const { pct } = calcularProgressoMeta(vendas, 0, mesFechado)
    expect(pct).toBe(0)
  })

  it('vendas de outros meses não contam', () => {
    const { realizado } = calcularProgressoMeta(vendas, 1000, '2026-02')
    expect(realizado).toBe(200)
  })
})
