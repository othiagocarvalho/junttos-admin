import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calcularRankingCorrida, diasRestantesCorrida } from './corrida.js'

// ── Fixtures ────────────────────────────────────────────────────

const PERIODO = { data_inicio: '2026-06-01', data_fim: '2026-06-30' }

const vendas = [
  // Carla — 3 vendas no período
  { data: '2026-06-05T10:00:00', valor: 500, vendedora: 'Carla', produtos: [{ nome: 'Blusa', quantidade: 2 }, { nome: 'Calça', quantidade: 1 }] },
  { data: '2026-06-10T14:00:00', valor: 300, vendedora: 'Carla', produtos: [{ nome: 'Blusa', quantidade: 1 }] },
  { data: '2026-06-20T09:00:00', valor: 200, vendedora: 'Carla', produtos: [{ nome: 'Vestido', quantidade: 1 }] },
  // Ana — 2 vendas no período
  { data: '2026-06-03T11:00:00', valor: 400, vendedora: 'Ana', produtos: [{ nome: 'Blusa', quantidade: 3 }] },
  { data: '2026-06-18T16:00:00', valor: 600, vendedora: 'Ana', produtos: [{ nome: 'Calça', quantidade: 2 }] },
  // Bia — 1 venda no período
  { data: '2026-06-12T15:00:00', valor: 150, vendedora: 'Bia', produtos: [{ nome: 'Vestido', quantidade: 1 }] },
  // Fora do período — deve ser ignorada
  { data: '2026-05-30T10:00:00', valor: 999, vendedora: 'Carla', produtos: [{ nome: 'Blusa', quantidade: 5 }] },
  { data: '2026-07-01T10:00:00', valor: 999, vendedora: 'Ana',   produtos: [{ nome: 'Blusa', quantidade: 5 }] },
  // Sem vendedora — deve ser ignorada
  { data: '2026-06-15T10:00:00', valor: 800, vendedora: null, produtos: [{ nome: 'Blusa', quantidade: 2 }] },
]

// ── calcularRankingCorrida ──────────────────────────────────────

describe('calcularRankingCorrida — faturamento', () => {
  const corrida = { ...PERIODO, tipo_medicao: 'faturamento' }

  it('retorna vazio quando sem vendas', () => {
    expect(calcularRankingCorrida([], corrida)).toEqual([])
  })

  it('retorna vazio quando todas as vendas estão fora do período', () => {
    const foraDoperiodo = vendas.filter(v => v.data.startsWith('2026-05') || v.data.startsWith('2026-07'))
    expect(calcularRankingCorrida(foraDoperiodo, corrida)).toEqual([])
  })

  it('retorna vazio quando nenhuma venda tem campo vendedora', () => {
    const semVendedora = [{ data: '2026-06-10T10:00:00', valor: 500, vendedora: null, produtos: [] }]
    expect(calcularRankingCorrida(semVendedora, corrida)).toEqual([])
  })

  it('ranking ordenado do maior faturamento para o menor', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    // Ana: 400+600 = 1000, Carla: 500+300+200 = 1000... wait
    // Carla: 500+300+200 = 1000, Ana: 400+600 = 1000, Bia: 150
    // In case of tie, sort is stable (original order in array) - but let's check the values
    const nomes = ranking.map(r => r.vendedora)
    expect(ranking[0].valor).toBeGreaterThanOrEqual(ranking[1].valor)
    expect(ranking[1].valor).toBeGreaterThanOrEqual(ranking[2].valor)
  })

  it('faturamento correto para cada vendedora', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    const carla = ranking.find(r => r.vendedora === 'Carla')
    const ana   = ranking.find(r => r.vendedora === 'Ana')
    const bia   = ranking.find(r => r.vendedora === 'Bia')
    expect(carla.valor).toBe(1000) // 500+300+200
    expect(ana.valor).toBe(1000)   // 400+600
    expect(bia.valor).toBe(150)
  })

  it('posicao começa em 1', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    expect(ranking[0].posicao).toBe(1)
    expect(ranking[1].posicao).toBe(2)
  })

  it('vendas fora do período são ignoradas', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    const carla = ranking.find(r => r.vendedora === 'Carla')
    // A venda de R$999 em maio não deve entrar
    expect(carla.valor).toBe(1000)
  })

  it('inclui 3 vendedoras (exclui null e fora do período)', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    expect(ranking).toHaveLength(3)
  })
})

describe('calcularRankingCorrida — ticket_medio', () => {
  const corrida = { ...PERIODO, tipo_medicao: 'ticket_medio' }

  it('ticket médio correto para cada vendedora', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    const carla = ranking.find(r => r.vendedora === 'Carla')
    const ana   = ranking.find(r => r.vendedora === 'Ana')
    const bia   = ranking.find(r => r.vendedora === 'Bia')
    // Carla: (500+300+200)/3 ≈ 333.33
    expect(carla.valor).toBeCloseTo(1000 / 3)
    // Ana: (400+600)/2 = 500
    expect(ana.valor).toBe(500)
    // Bia: 150/1 = 150
    expect(bia.valor).toBe(150)
  })

  it('maior ticket médio fica em 1º lugar', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    expect(ranking[0].vendedora).toBe('Ana') // ticket médio = 500
  })
})

describe('calcularRankingCorrida — pa', () => {
  const corrida = { ...PERIODO, tipo_medicao: 'pa' }

  it('PA correto para cada vendedora', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    const carla = ranking.find(r => r.vendedora === 'Carla')
    const ana   = ranking.find(r => r.vendedora === 'Ana')
    const bia   = ranking.find(r => r.vendedora === 'Bia')
    // Carla: vendas com (2+1=3), (1), (1) = 5 itens / 3 vendas ≈ 1.667
    expect(carla.valor).toBeCloseTo(5 / 3)
    // Ana: (3), (2) = 5 itens / 2 vendas = 2.5
    expect(ana.valor).toBeCloseTo(2.5)
    // Bia: (1) = 1 item / 1 venda = 1
    expect(bia.valor).toBe(1)
  })

  it('maior PA fica em 1º lugar', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    expect(ranking[0].vendedora).toBe('Ana')
  })
})

describe('calcularRankingCorrida — quantidade_produto', () => {
  const corrida = { ...PERIODO, tipo_medicao: 'quantidade_produto', produto_alvo: 'Blusa' }

  it('conta apenas unidades do produto alvo', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    const carla = ranking.find(r => r.vendedora === 'Carla')
    const ana   = ranking.find(r => r.vendedora === 'Ana')
    // Carla: Blusa(2) + Blusa(1) = 3
    expect(carla.valor).toBe(3)
    // Ana: Blusa(3) = 3
    expect(ana.valor).toBe(3)
  })

  it('exclui vendedoras que não venderam o produto alvo', () => {
    const ranking = calcularRankingCorrida(vendas, corrida)
    const bia = ranking.find(r => r.vendedora === 'Bia')
    // Bia vendeu apenas Vestido, não Blusa
    expect(bia).toBeUndefined()
  })

  it('produto diferente do alvo não é contado', () => {
    const corrida2 = { ...PERIODO, tipo_medicao: 'quantidade_produto', produto_alvo: 'Vestido' }
    const ranking = calcularRankingCorrida(vendas, corrida2)
    const carla = ranking.find(r => r.vendedora === 'Carla')
    expect(carla.valor).toBe(1) // apenas Vestido(1)
  })

  it('retorna vazio quando nenhuma vendedora vendeu o produto alvo', () => {
    const corrida2 = { ...PERIODO, tipo_medicao: 'quantidade_produto', produto_alvo: 'Produto Inexistente' }
    expect(calcularRankingCorrida(vendas, corrida2)).toEqual([])
  })
})

describe('calcularRankingCorrida — limite de datas', () => {
  it('venda exatamente na data_inicio é incluída', () => {
    const vendaNoInicio = [{ data: '2026-06-01T00:00:00', valor: 100, vendedora: 'Tati', produtos: [] }]
    const corrida = { ...PERIODO, tipo_medicao: 'faturamento' }
    const ranking = calcularRankingCorrida(vendaNoInicio, corrida)
    expect(ranking).toHaveLength(1)
    expect(ranking[0].vendedora).toBe('Tati')
  })

  it('venda exatamente na data_fim é incluída', () => {
    const vendaNoFim = [{ data: '2026-06-30T23:59:00', valor: 200, vendedora: 'Tati', produtos: [] }]
    const corrida = { ...PERIODO, tipo_medicao: 'faturamento' }
    const ranking = calcularRankingCorrida(vendaNoFim, corrida)
    expect(ranking).toHaveLength(1)
    expect(ranking[0].valor).toBe(200)
  })
})

// ── diasRestantesCorrida ────────────────────────────────────────

describe('diasRestantesCorrida', () => {
  // Fixa a data atual para 2026-06-15
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T10:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna 0 quando data_fim é hoje', () => {
    expect(diasRestantesCorrida({ data_fim: '2026-06-15' })).toBe(0)
  })

  it('retorna 1 quando data_fim é amanhã', () => {
    expect(diasRestantesCorrida({ data_fim: '2026-06-16' })).toBe(1)
  })

  it('retorna número correto de dias futuros', () => {
    expect(diasRestantesCorrida({ data_fim: '2026-06-30' })).toBe(15)
  })

  it('retorna -1 quando data_fim foi ontem (encerrada)', () => {
    expect(diasRestantesCorrida({ data_fim: '2026-06-14' })).toBe(-1)
  })

  it('retorna negativo para corridas muito antigas', () => {
    expect(diasRestantesCorrida({ data_fim: '2026-06-01' })).toBeLessThan(0)
  })
})
