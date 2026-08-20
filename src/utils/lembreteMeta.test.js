import { describe, it, expect } from 'vitest'
import { deveMostrarLembreteMeta } from './lembreteMeta'

const AGO = new Date(2026, 7, 18, 12, 0, 0)   // 18/08/2026
const SET = new Date(2026, 8, 3, 12, 0, 0)    // 03/09/2026

describe('deveMostrarLembreteMeta', () => {
  it('sem meta e nunca dispensado: mostra', () => {
    expect(deveMostrarLembreteMeta({ metas: {}, dispensadoEm: null, hoje: AGO })).toBe(true)
  })

  it('com meta do mês: não mostra, mesmo sem nunca ter dispensado', () => {
    expect(deveMostrarLembreteMeta({ metas: { '2026-08': 8000 }, hoje: AGO })).toBe(false)
  })

  it('meta zerada não conta como meta definida', () => {
    expect(deveMostrarLembreteMeta({ metas: { '2026-08': 0 }, hoje: AGO })).toBe(true)
  })

  it('dispensado NESTE mês: some', () => {
    expect(deveMostrarLembreteMeta({ metas: {}, dispensadoEm: '2026-08', hoje: AGO })).toBe(false)
  })

  it('virou o mês e continua sem meta: volta sozinho', () => {
    expect(deveMostrarLembreteMeta({ metas: {}, dispensadoEm: '2026-08', hoje: SET })).toBe(true)
  })

  it('virou o mês mas já tem meta nova: não volta', () => {
    expect(deveMostrarLembreteMeta({ metas: { '2026-09': 9000 }, dispensadoEm: '2026-08', hoje: SET })).toBe(false)
  })

  it('meta de mês anterior não silencia o mês atual', () => {
    expect(deveMostrarLembreteMeta({ metas: { '2026-07': 5000 }, hoje: AGO })).toBe(true)
  })

  it('coluna ainda inexistente (undefined) se comporta como nunca dispensado', () => {
    expect(deveMostrarLembreteMeta({ metas: {}, dispensadoEm: undefined, hoje: AGO })).toBe(true)
  })

  it('sem argumento nenhum não quebra', () => {
    expect(typeof deveMostrarLembreteMeta()).toBe('boolean')
  })
})
