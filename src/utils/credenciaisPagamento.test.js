import { describe, it, expect } from 'vitest'
import { salvarCredencialMercadoPago, podeAtivarMercadoPago } from './credenciaisPagamento'

// O ponto destes testes é uma decisão de segurança, não de UI: o access token
// do Mercado Pago NÃO pode ir para lf_config, que não tem RLS e é lida pelo
// catálogo público com select('*') direto do navegador.

function clientFake({ erroInsert = null, erroUpdate = null } = {}) {
  const c = { inserts: [], updates: [] }
  c.from = tabela => ({
    insert: linha => {
      c.inserts.push({ tabela, linha })
      return Promise.resolve({ error: erroInsert })
    },
    update: linha => ({
      eq: (col, val) => {
        c.updates.push({ tabela, linha, filtro: { [col]: val } })
        return Promise.resolve({ error: erroUpdate })
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
