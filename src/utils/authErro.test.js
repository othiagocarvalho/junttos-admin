import { describe, it, expect } from 'vitest'
import { isErroAuth } from './authErro.js'

describe('isErroAuth', () => {
  it('sem erro não é erro de auth', () => {
    expect(isErroAuth(null)).toBe(false)
    expect(isErroAuth(undefined)).toBe(false)
  })

  // O erro real que o PostgREST devolve com token morto no localStorage —
  // capturado direto da API em produção durante a investigação do redirect.
  it('reconhece o 401 que derrubou a resolução de loja', () => {
    expect(isErroAuth({
      code: 'PGRST301',
      details: 'None of the keys was able to decode the JWT',
      message: 'No suitable key or wrong key type',
    })).toBe(true)
  })

  it('reconhece 401 por code e por status', () => {
    expect(isErroAuth({ code: '401' })).toBe(true)
    expect(isErroAuth({ status: 401 })).toBe(true)
  })

  it('reconhece pela mensagem, em qualquer caixa', () => {
    expect(isErroAuth({ message: 'JWT expired' })).toBe(true)
    expect(isErroAuth({ message: 'Invalid token' })).toBe(true)
    expect(isErroAuth({ message: 'Unauthorized' })).toBe(true)
  })

  // Se esses passassem por auth, o App.jsx descartaria a sessão da lojista à
  // toa e ainda assim cairia na tela de falha.
  it('não confunde erro de dado com erro de auth', () => {
    expect(isErroAuth({ code: 'PGRST116', message: 'multiple rows returned' })).toBe(false)
    expect(isErroAuth({ code: '23505', message: 'duplicate key value' })).toBe(false)
    expect(isErroAuth({ message: 'Failed to fetch' })).toBe(false)
  })
})
