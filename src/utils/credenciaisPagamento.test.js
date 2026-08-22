import { describe, it, expect } from 'vitest'
import {
  salvarCredencialMercadoPago, podeAtivarMercadoPago,
  validarAccessTokenMP, pareceTokenDeTeste,
} from './credenciaisPagamento'

// O ponto destes testes é uma decisão de segurança, não de UI: o access token
// do Mercado Pago NÃO pode ir para lf_config, que não tem RLS e é lida pelo
// catálogo público com select('*') direto do navegador.

// `sessao` e `count` entraram junto com a correção da falha silenciosa:
//   • sessao: null simula a sessão expirada do relato;
//   • count: quantas linhas o UPDATE pegou. 0 é o no-op silencioso — o
//     PostgREST devolve 204 SEM erro nesse caso, e era assim que a tela
//     mostrava sucesso sem ter gravado nada.
function clientFake({
  erroInsert = null, erroUpdate = null, count = 1,
  sessao = { access_token: 'jwt-de-teste' }, erroSessao = null,
} = {}) {
  const c = { inserts: [], updates: [], opcoesUpdate: null }
  c.auth = {
    getSession: async () => ({ data: { session: sessao }, error: erroSessao }),
  }
  c.from = tabela => ({
    insert: linha => {
      c.inserts.push({ tabela, linha })
      return Promise.resolve({ error: erroInsert })
    },
    update: (linha, opcoes) => ({
      eq: (col, val) => {
        c.opcoesUpdate = opcoes
        c.updates.push({ tabela, linha, filtro: { [col]: val } })
        return Promise.resolve({ error: erroUpdate, count })
      },
    }),
  })
  return c
}

const UNIQUE = { code: '23505', message: 'duplicate key value violates unique constraint' }

describe('salvarCredencialMercadoPago', () => {
  it('grava em lf_credenciais_pagamento, nunca em lf_config', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-1', webhookSecret: 's3g' })
    expect(c.inserts).toHaveLength(1)
    expect(c.inserts[0].tabela).toBe('lf_credenciais_pagamento')
    expect(c.inserts[0].tabela).not.toBe('lf_config')
  })

  it('NÃO usa upsert — ON CONFLICT exige policy de SELECT, que a tabela não tem', async () => {
    // Este é o bug que quebrou produção: `.upsert(..., {onConflict})` vira
    // INSERT ... ON CONFLICT DO UPDATE, e o Postgres precisa enxergar a linha
    // conflitante por uma policy de SELECT para resolver. A tabela não tem
    // nenhuma, de propósito, para o token não voltar ao navegador.
    const c = clientFake()
    expect(c.from('lf_credenciais_pagamento').upsert).toBeUndefined()
    await salvarCredencialMercadoPago(c, 'x', { token: 'a' })
    expect(c.inserts).toHaveLength(1)
  })

  it('grava token e segredo na linha da loja', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-1', webhookSecret: 's3g' })
    expect(c.inserts[0].linha).toMatchObject({
      loja_id: 'tropicaleatacado',
      mercadopago_access_token: 'APP_USR-1',
      mercadopago_webhook_secret: 's3g',
    })
  })

  it('loja que já tem credencial cai no UPDATE, sem erro para a usuária', async () => {
    const c = clientFake({ erroInsert: UNIQUE })
    const { error } = await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'novo' })
    expect(error).toBeNull()
    expect(c.updates).toHaveLength(1)
    expect(c.updates[0].filtro).toEqual({ loja_id: 'tropicaleatacado' })
    expect(c.updates[0].linha.mercadopago_access_token).toBe('novo')
    // O UPDATE não pode tentar reescrever a chave primária.
    expect(c.updates[0].linha.loja_id).toBeUndefined()
  })

  it('erro que não é 23505 sobe, em vez de virar UPDATE às cegas', async () => {
    const rls = { code: '42501', message: 'new row violates row-level security policy' }
    const c = clientFake({ erroInsert: rls })
    const { error } = await salvarCredencialMercadoPago(c, 'x', { token: 'a' })
    expect(error).toBe(rls)
    expect(c.updates).toHaveLength(0)
  })

  it('falha no UPDATE também é propagada', async () => {
    const c = clientFake({ erroInsert: UNIQUE, erroUpdate: { message: 'permission denied' } })
    const { error } = await salvarCredencialMercadoPago(c, 'x', { token: 'a' })
    expect(error.message).toBe('permission denied')
  })

  it('apara espaço — token colado do painel do MP vem com sobra', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'x', { token: '  APP_USR-1  ', webhookSecret: '  s  ' })
    expect(c.inserts[0].linha.mercadopago_access_token).toBe('APP_USR-1')
    expect(c.inserts[0].linha.mercadopago_webhook_secret).toBe('s')
  })

  it('campo vazio grava null, o que desconfigura a loja', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'x', { token: '', webhookSecret: '' })
    expect(c.inserts[0].linha.mercadopago_access_token).toBeNull()
  })

  it('sem lojaId nem chega a tocar no banco', async () => {
    const c = clientFake()
    const { error } = await salvarCredencialMercadoPago(c, '', { token: 'a' })
    expect(error).toBeTruthy()
    expect(c.inserts).toHaveLength(0)
  })

  it('não encadeia .select() — pedir a linha de volta bateria na falta de policy', async () => {
    const c = clientFake()
    expect(c.from('lf_credenciais_pagamento').select).toBeUndefined()
    await salvarCredencialMercadoPago(c, 'x', { token: 'a' })
    expect(c.inserts).toHaveLength(1)
  })
})

describe('podeAtivarMercadoPago', () => {
  it('token novo digitado libera a ativação', () => {
    expect(podeAtivarMercadoPago({ token: 'APP_USR-1', jaConfigurado: false })).toBe(true)
  })

  it('loja já configurada continua podendo, com o campo vazio', () => {
    // O campo abre vazio a cada visita porque o token não volta do banco;
    // vazio não pode significar "desligar".
    expect(podeAtivarMercadoPago({ token: '', jaConfigurado: true })).toBe(true)
  })

  it('sem token e sem configuração prévia, não liga', () => {
    expect(podeAtivarMercadoPago({ token: '', jaConfigurado: false })).toBe(false)
    expect(podeAtivarMercadoPago({ token: '   ', jaConfigurado: false })).toBe(false)
    expect(podeAtivarMercadoPago({})).toBe(false)
  })
})

describe('validarAccessTokenMP', () => {
  // O valor que estava gravado na Tropicale: 14 caracteres, sem hífen. O MP
  // respondia 403 e a cliente via "Não foi possível gerar o QR Code agora".
  it('barra o valor curto e sem hífen que causou o bug', () => {
    expect(validarAccessTokenMP('12345678901234')).toBeTruthy()
    expect(validarAccessTokenMP('1234567890')).toBeTruthy()
    expect(validarAccessTokenMP('semhifenmasbemcomprido')).toBeTruthy()
  })

  it('aceita access token de produção', () => {
    expect(validarAccessTokenMP('APP_USR-1234567890123456-082215-abc123def456abc123def456abc12345-123456789')).toBeNull()
  })

  it('aceita token de teste — é legítimo em sandbox', () => {
    expect(validarAccessTokenMP('TEST-1234567890123456-082215-abcdef1234567890abcdef1234567890-123456789')).toBeNull()
  })

  it('vazio é válido: significa "manter o que já está gravado"', () => {
    // O campo abre sempre em branco porque a tabela não tem policy de SELECT.
    expect(validarAccessTokenMP('')).toBeNull()
    expect(validarAccessTokenMP('   ')).toBeNull()
    expect(validarAccessTokenMP(null)).toBeNull()
  })
})

describe('pareceTokenDeTeste', () => {
  it('reconhece o prefixo TEST-', () => {
    expect(pareceTokenDeTeste('TEST-abc-def-ghi-jkl')).toBe(true)
  })

  it('token de produção não dispara o aviso', () => {
    expect(pareceTokenDeTeste('APP_USR-abc-def-ghi-jkl')).toBe(false)
    expect(pareceTokenDeTeste('')).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// A falha silenciosa relatada em 25/08/2026
//
// A Tropicale preenchia o Access Token, salvava, via a confirmação na tela — e
// `atualizado_em` no banco ficava com o mesmo timestamp. Causa: no PostgREST,
// UPDATE que não casa nenhuma linha é 204 SEM ERRO, e esta tabela filtra por
// RLS contra o claim do JWT. Sessão ruim = linha invisível = no-op silencioso.
// ─────────────────────────────────────────────────────────────────────────────
describe('falha silenciosa: UPDATE que não pega linha nenhuma', () => {
  it('count 0 vira ERRO — era isto que a tela engolia', async () => {
    const c = clientFake({ erroInsert: UNIQUE, count: 0 })
    const { error } = await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-x' })
    expect(error).toBeTruthy()
    expect(error.message).toMatch(/não encontrou a credencial/i)
    // E o UPDATE chegou a ser tentado: o erro é sobre o resultado, não sobre
    // ter desistido antes.
    expect(c.updates).toHaveLength(1)
  })

  it('count 1 é sucesso, como sempre foi', async () => {
    const c = clientFake({ erroInsert: UNIQUE, count: 1 })
    expect((await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })).error).toBeNull()
  })

  it('count null NÃO vira erro — desconhecido não é falha', async () => {
    // Se um dia o PostgREST não mandar o Content-Range, o comportamento volta
    // a ser o de antes em vez de recusar uma gravação que funcionou.
    const c = clientFake({ erroInsert: UNIQUE, count: null })
    expect((await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })).error).toBeNull()
  })

  it('pede a contagem exata ao PostgREST', async () => {
    // Sem o Prefer: count=exact o supabase-js nem tenta ler o Content-Range,
    // e `count` chega sempre null — a defesa acima viraria decoração.
    const c = clientFake({ erroInsert: UNIQUE })
    await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })
    expect(c.opcoesUpdate).toEqual({ count: 'exact' })
  })

  it('INSERT que passa de primeira não precisa de contagem', async () => {
    const c = clientFake()
    expect((await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })).error).toBeNull()
    expect(c.updates).toHaveLength(0)
  })
})

describe('sessão expirada — não manda escrita condenada', () => {
  it('sem sessão devolve erro explicando, e NÃO escreve nada', async () => {
    const c = clientFake({ sessao: null })
    const { error } = await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-x' })
    expect(error).toBeTruthy()
    expect(error.message).toMatch(/sessão expirou/i)
    expect(c.inserts).toHaveLength(0)
    expect(c.updates).toHaveLength(0)
  })

  it('sessão sem access_token conta como sem sessão', async () => {
    const c = clientFake({ sessao: {} })
    expect((await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })).error).toBeTruthy()
    expect(c.inserts).toHaveLength(0)
  })

  it('erro ao ler a sessão sobe, não é engolido', async () => {
    const c = clientFake({ erroSessao: new Error('storage indisponível') })
    const { error } = await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })
    expect(error.message).toBe('storage indisponível')
    expect(c.inserts).toHaveLength(0)
  })

  it('com sessão válida o caminho normal continua igual', async () => {
    const c = clientFake()
    expect((await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })).error).toBeNull()
    expect(c.inserts).toHaveLength(1)
  })
})
