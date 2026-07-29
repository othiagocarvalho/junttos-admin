import { describe, it, expect } from 'vitest'
import { calcTaxaConversao, fmtHora } from './consultor'

// ── calcTaxaConversao ────────────────────────────────────────────────────────

describe('calcTaxaConversao', () => {
  it('retorna 0 para array vazio', () => {
    expect(calcTaxaConversao([])).toBe(0)
  })

  it('retorna 0 para null', () => {
    expect(calcTaxaConversao(null)).toBe(0)
  })

  it('retorna 0 para undefined', () => {
    expect(calcTaxaConversao(undefined)).toBe(0)
  })

  it('calcula corretamente com 2 de 4 fechamentos (50%)', () => {
    const visitas = [
      { resultado: 'fechamento' },
      { resultado: 'sem_interesse' },
      { resultado: 'fechamento' },
      { resultado: 'retornar' },
    ]
    expect(calcTaxaConversao(visitas)).toBe(50)
  })

  it('retorna 100 quando todos são fechamentos', () => {
    const visitas = [{ resultado: 'fechamento' }, { resultado: 'fechamento' }]
    expect(calcTaxaConversao(visitas)).toBe(100)
  })

  it('retorna 0 quando nenhum é fechamento', () => {
    const visitas = [{ resultado: 'retornar' }, { resultado: 'sem_interesse' }]
    expect(calcTaxaConversao(visitas)).toBe(0)
  })

  it('arredonda corretamente — 1 de 3 = 33%', () => {
    const visitas = [
      { resultado: 'fechamento' },
      { resultado: 'retornar' },
      { resultado: 'sem_interesse' },
    ]
    expect(calcTaxaConversao(visitas)).toBe(33)
  })

  it('arredonda corretamente — 2 de 3 = 67%', () => {
    const visitas = [
      { resultado: 'fechamento' },
      { resultado: 'fechamento' },
      { resultado: 'sem_interesse' },
    ]
    expect(calcTaxaConversao(visitas)).toBe(67)
  })
})

// ── fmtHora ──────────────────────────────────────────────────────────────────

describe('fmtHora', () => {
  it('formata HH:MM:SS → HH:MM', () => {
    expect(fmtHora('09:30:00')).toBe('09:30')
  })

  it('mantém HH:MM sem modificação', () => {
    expect(fmtHora('14:00')).toBe('14:00')
  })

  it('retorna string vazia para null', () => {
    expect(fmtHora(null)).toBe('')
  })

  it('retorna string vazia para undefined', () => {
    expect(fmtHora(undefined)).toBe('')
  })
})
