import { describe, it, expect } from 'vitest'
import { buildLojaPayload, isValidSlug, toSlug } from './useCreateLoja'

// ── buildLojaPayload ─────────────────────────────────────────────────────────

describe('buildLojaPayload', () => {
  const base = {
    nome: 'Loja Teste',
    slug: 'loja-teste',
    status: 'Trial',
    plano: 'starter',
    cor_primaria: '#5E2BD0',
    cor_secundaria: '#FF6F5E',
  }

  it('inclui campos obrigatórios corretamente', () => {
    const p = buildLojaPayload(base)
    expect(p.loja_id).toBe('loja-teste')
    expect(p.slug).toBe('loja-teste')
    expect(p.nome).toBe('Loja Teste')
    expect(p.status).toBe('Trial')
    expect(p.plano).toBe('starter')
  })

  it('aplica DEFAULT_FEATURES quando nenhuma feature é passada', () => {
    const p = buildLojaPayload(base)
    expect(p.features.vendas).toBe(true)
    expect(p.features.historico).toBe(true)
    expect(p.features.catalogo_b2b).toBe(false)
    expect(p.features.legado).toBe(false)
  })

  it('mescla features extras sem sobrescrever as defaults', () => {
    const p = buildLojaPayload({ ...base, features: { atacado: true, crm: true } })
    expect(p.features.atacado).toBe(true)
    expect(p.features.crm).toBe(true)
    expect(p.features.vendas).toBe(true)
  })

  it('inclui cadastrado_por_consultor_id quando fornecido', () => {
    const consultorId = 'uuid-consultor-123'
    const p = buildLojaPayload({ ...base, cadastrado_por_consultor_id: consultorId })
    expect(p.cadastrado_por_consultor_id).toBe(consultorId)
  })

  it('omite cadastrado_por_consultor_id quando null', () => {
    const p = buildLojaPayload({ ...base, cadastrado_por_consultor_id: null })
    expect('cadastrado_por_consultor_id' in p).toBe(false)
  })

  it('omite cadastrado_por_consultor_id quando não passado', () => {
    const p = buildLojaPayload(base)
    expect('cadastrado_por_consultor_id' in p).toBe(false)
  })

  it('logo_url fica null quando não passada', () => {
    const p = buildLojaPayload(base)
    expect(p.logo_url).toBeNull()
  })

  it('logo_url é preservada quando passada', () => {
    const p = buildLojaPayload({ ...base, logoUrl: 'https://cdn.example.com/logo.png' })
    expect(p.logo_url).toBe('https://cdn.example.com/logo.png')
  })
})

// ── isValidSlug ──────────────────────────────────────────────────────────────

describe('isValidSlug', () => {
  it('aceita slug simples', () => expect(isValidSlug('loja')).toBe(true))
  it('aceita slug com hífens', () => expect(isValidSlug('minha-loja')).toBe(true))
  it('aceita slug com números', () => expect(isValidSlug('loja123')).toBe(true))
  it('rejeita slug com maiúsculas', () => expect(isValidSlug('Loja')).toBe(false))
  it('rejeita slug com underscore', () => expect(isValidSlug('minha_loja')).toBe(false))
  it('rejeita slug com hífen no início', () => expect(isValidSlug('-loja')).toBe(false))
  it('rejeita slug com hífen no fim', () => expect(isValidSlug('loja-')).toBe(false))
  it('rejeita slug com 1 caractere (mínimo é 2)', () => expect(isValidSlug('a')).toBe(false))
  it('rejeita slug vazio', () => expect(isValidSlug('')).toBe(false))
  it('aceita slug no limite mínimo (2 chars)', () => expect(isValidSlug('ab')).toBe(true))
})

// ── toSlug ───────────────────────────────────────────────────────────────────

describe('toSlug', () => {
  it('converte espaços em hífens', () => expect(toSlug('Minha Loja')).toBe('minha-loja'))
  it('remove acentos', () => expect(toSlug('Ação')).toBe('acao'))
  it('lowercase', () => expect(toSlug('LOJA')).toBe('loja'))
  it('colapsa múltiplos espaços', () => expect(toSlug('loja  teste')).toBe('loja-teste'))
  it('remove caracteres especiais', () => expect(toSlug('loja & filha!')).toBe('loja-filha'))
})
