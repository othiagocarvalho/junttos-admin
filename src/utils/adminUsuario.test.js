import { describe, it, expect } from 'vitest'
import { decidirAcessoAdmin, primeiroNome, iniciais, normalizarUsuarioSupabase, ROLE_SUPER, ROLE_GESTOR } from './adminUsuario.js'

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

describe('iniciais', () => {
  it('usa primeira e última palavra', () => {
    expect(iniciais('Thiago Admin')).toBe('TA')
    expect(iniciais('Thiago de Carvalho')).toBe('TC')
  })

  it('nome de uma palavra usa as duas primeiras letras', () => {
    expect(iniciais('Admin')).toBe('AD')
  })

  it('vazio não quebra', () => {
    expect(iniciais('')).toBe('??')
    expect(iniciais(null)).toBe('??')
    expect(iniciais('   ')).toBe('??')
  })
})

// ---------------------------------------------------------------------------
// normalizarUsuarioSupabase — o contrato que a migração precisa preservar.
// ---------------------------------------------------------------------------

describe('normalizarUsuarioSupabase', () => {
  // Conta real do admin, como veio da API durante a Fase 0.
  const doSupabase = {
    id: 'e357e5b4-6ce7-4b99-af2e-14b3fcc76728',
    email: 'admin@junttos.com.br',
    app_metadata: { provider: 'email', providers: ['email'], role: ROLE_SUPER },
    user_metadata: { email_verified: true },
  }

  it('produz o mesmo shape da lista hardcoded', () => {
    const u = normalizarUsuarioSupabase(doSupabase)
    expect(Object.keys(u).sort()).toEqual(['avatar', 'email', 'id', 'name', 'role'])
    expect(u.role).toBe(ROLE_SUPER)
    expect(u.email).toBe('admin@junttos.com.br')
    expect(u.id).toBe('e357e5b4-6ce7-4b99-af2e-14b3fcc76728')
  })

  // A conta real não tem user_metadata.name — sem isso o Dashboard ficaria sem nome.
  it('sem nome no metadata, deriva do e-mail', () => {
    expect(normalizarUsuarioSupabase(doSupabase).name).toBe('Admin')
    expect(normalizarUsuarioSupabase(doSupabase).avatar).toBe('AD')
  })

  it('nome do user_metadata tem precedência', () => {
    const u = normalizarUsuarioSupabase({ ...doSupabase, user_metadata: { name: 'Thiago Admin' } })
    expect(u.name).toBe('Thiago Admin')
    expect(u.avatar).toBe('TA')
  })

  // Recusa deliberada: sem o claim não dá para afirmar nada sobre permissão.
  it('sem app_metadata.role devolve null', () => {
    expect(normalizarUsuarioSupabase({ ...doSupabase, app_metadata: { provider: 'email' } })).toBeNull()
    expect(normalizarUsuarioSupabase({ id: 'x', email: 'a@b.com' })).toBeNull()
    expect(normalizarUsuarioSupabase(null)).toBeNull()
  })

  // role em user_metadata seria editável pelo próprio usuário — não vale.
  it('role em user_metadata é ignorado', () => {
    const forjado = { id: 'x', email: 'a@b.com', user_metadata: { role: ROLE_SUPER } }
    expect(normalizarUsuarioSupabase(forjado)).toBeNull()
  })

  it('o resultado passa nas guardas como a lista antiga passava', () => {
    const u = normalizarUsuarioSupabase(doSupabase)
    expect(decidirAcessoAdmin({ loading: false, user: u, rolesPermitidos: [ROLE_SUPER] })).toBe('ok')
    expect(primeiroNome(u)).toBe('Admin')
  })
})
