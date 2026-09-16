import { describe, it, expect } from 'vitest'
import { ehGerente, papelDoUsuario } from './permissoes'

describe('ehGerente', () => {
  it('papel ausente (undefined) -> false', () => {
    expect(ehGerente(undefined)).toBe(false)
  })

  it('papel null -> false', () => {
    expect(ehGerente(null)).toBe(false)
  })

  it("papel 'dono' -> false", () => {
    expect(ehGerente('dono')).toBe(false)
  })

  it("papel 'gerente' -> true", () => {
    expect(ehGerente('gerente')).toBe(true)
  })

  it('valor inesperado não vira gerente por engano', () => {
    expect(ehGerente('qualquer-outra-coisa')).toBe(false)
  })
})

describe('papelDoUsuario', () => {
  it("lê app_metadata.papel do usuário", () => {
    expect(papelDoUsuario({ app_metadata: { papel: 'gerente' } })).toBe('gerente')
    expect(papelDoUsuario({ app_metadata: { papel: 'dono' } })).toBe('dono')
  })

  it('usuário sem app_metadata.papel -> null', () => {
    expect(papelDoUsuario({ app_metadata: {} })).toBeNull()
    expect(papelDoUsuario({})).toBeNull()
  })

  it('usuário nulo/indefinido -> null, sem lançar', () => {
    expect(papelDoUsuario(null)).toBeNull()
    expect(papelDoUsuario(undefined)).toBeNull()
  })
})
