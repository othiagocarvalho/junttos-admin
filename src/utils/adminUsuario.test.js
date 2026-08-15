import { describe, it, expect } from 'vitest'
import { decidirAcessoAdmin, primeiroNome, ROLE_SUPER, ROLE_GESTOR } from './adminUsuario.js'

const superAdmin = { name: 'Thiago Admin',   role: ROLE_SUPER }
const gestor     = { name: 'Gestor Junttos', role: ROLE_GESTOR }

describe('decidirAcessoAdmin', () => {
  // O caso que motivou tudo: sessão ainda carregando não pode ser lida como
  // "deslogado". Sem isso, cada F5 no painel chuta a pessoa para o login.
  it('sessão carregando espera, mesmo sem usuário ainda', () => {
    expect(decidirAcessoAdmin({ loading: true, user: null })).toBe('carregando')
    expect(decidirAcessoAdmin({ loading: true, user: null, rolesPermitidos: [ROLE_SUPER] })).toBe('carregando')
  })

  it('carregando tem precedência sobre role errado', () => {
    expect(decidirAcessoAdmin({ loading: true, user: gestor, rolesPermitidos: [ROLE_SUPER] })).toBe('carregando')
  })

  it('sem usuário depois de carregar manda para o login', () => {
    expect(decidirAcessoAdmin({ loading: false, user: null })).toBe('login')
  })

  it('logado basta quando a rota não exige role', () => {
    expect(decidirAcessoAdmin({ loading: false, user: gestor })).toBe('ok')
  })

  it('Super Admin entra onde só ele pode', () => {
    expect(decidirAcessoAdmin({ loading: false, user: superAdmin, rolesPermitidos: [ROLE_SUPER] })).toBe('ok')
  })

  it('Gestor não entra em rota de Super Admin', () => {
    expect(decidirAcessoAdmin({ loading: false, user: gestor, rolesPermitidos: [ROLE_SUPER] })).toBe('sem-permissao')
  })

  it('Balanço aceita Super Admin e Gestor', () => {
    const roles = [ROLE_SUPER, ROLE_GESTOR]
    expect(decidirAcessoAdmin({ loading: false, user: superAdmin, rolesPermitidos: roles })).toBe('ok')
    expect(decidirAcessoAdmin({ loading: false, user: gestor,     rolesPermitidos: roles })).toBe('ok')
  })

  // Em Fase 2 o role vem de app_metadata e pode simplesmente não estar lá.
  // Tem que barrar, não liberar.
  it('usuário sem role não passa em rota com exigência', () => {
    expect(decidirAcessoAdmin({ loading: false, user: { name: 'X' }, rolesPermitidos: [ROLE_SUPER] })).toBe('sem-permissao')
  })

  it('não explode sem argumento nenhum', () => {
    expect(decidirAcessoAdmin()).toBe('login')
  })
})

describe('primeiroNome', () => {
  it('devolve só o primeiro nome', () => {
    expect(primeiroNome(superAdmin)).toBe('Thiago')
  })

  // Estes são os casos que lançavam TypeError no Dashboard.
  it('nome ausente, vazio ou usuário nulo devolvem string vazia', () => {
    expect(primeiroNome({ role: ROLE_SUPER })).toBe('')
    expect(primeiroNome({ name: '   ' })).toBe('')
    expect(primeiroNome(null)).toBe('')
    expect(primeiroNome(undefined)).toBe('')
  })

  it('ignora espaços em volta e no meio', () => {
    expect(primeiroNome({ name: '  Thiago   Carvalho ' })).toBe('Thiago')
  })

  it('nome único funciona', () => {
    expect(primeiroNome({ name: 'Thiago' })).toBe('Thiago')
  })
})
