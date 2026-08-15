import { describe, it, expect, beforeEach } from 'vitest'
import {
  chaveRascunho, salvarRascunho, lerRascunho, limparRascunho,
  extrairRascunho, rascunhoTemConteudo, RASCUNHO_VALIDO_HORAS,
} from './rascunhoVenda'

const store = {}
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] },
}

const form = {
  nome: 'Maria', tel: '85999', vendedora: 'Ana', obs: '',
  produtos: [{ nome: 'Vestido', quantidade: 2 }],
  pagamentos: [{ forma: 'Pix', valor: '150' }],
}

beforeEach(() => { for (const k of Object.keys(store)) delete store[k] })

describe('rascunho de venda', () => {
  it('separa por loja — não vaza entre lojas', () => {
    expect(chaveRascunho('lojaA')).not.toBe(chaveRascunho('lojaB'))
    salvarRascunho('lojaA', extrairRascunho(form))
    expect(lerRascunho('lojaA')).not.toBeNull()
    expect(lerRascunho('lojaB')).toBeNull()
  })

  it('guarda produtos, pagamento e ajuste', () => {
    salvarRascunho('l', extrairRascunho(form, { ajusteTipo: 'acrescimo', ajusteModo: 'percentual', ajusteInput: '10' }))
    const r = lerRascunho('l')
    expect(r.produtos).toHaveLength(1)
    expect(r.pagamentos[0].forma).toBe('Pix')
    expect(r.ajusteTipo).toBe('acrescimo')
    expect(r.ajusteModo).toBe('percentual')
    expect(r.ajusteInput).toBe('10')
    expect(r.nome).toBe('Maria')
  })

  it('form vazio não vira rascunho', () => {
    salvarRascunho('l', extrairRascunho({ produtos: [], pagamentos: [] }))
    expect(lerRascunho('l')).toBeNull()
    expect(rascunhoTemConteudo({ produtos: [] })).toBe(false)
  })

  it('rascunho velho não ressuscita', () => {
    salvarRascunho('l', extrairRascunho(form))
    const futuro = Date.now() + (RASCUNHO_VALIDO_HORAS + 1) * 36e5
    expect(lerRascunho('l', futuro)).toBeNull()
    expect(lerRascunho('l')).toBeNull()   // e some do storage
  })

  it('dentro da validade continua valendo', () => {
    salvarRascunho('l', extrairRascunho(form))
    expect(lerRascunho('l', Date.now() + 1 * 36e5)).not.toBeNull()
  })

  it('limparRascunho remove', () => {
    salvarRascunho('l', extrairRascunho(form))
    limparRascunho('l')
    expect(lerRascunho('l')).toBeNull()
  })

  it('JSON corrompido não quebra', () => {
    store[chaveRascunho('l')] = '{isso não é json'
    expect(lerRascunho('l')).toBeNull()
  })

  it('não guarda o valor total (é recalculado dos produtos)', () => {
    salvarRascunho('l', extrairRascunho({ ...form, valor: '999' }))
    expect(lerRascunho('l').valor).toBeUndefined()
  })
})
