import { describe, it, expect } from 'vitest'
import { salvarCredencialMercadoPago, podeAtivarMercadoPago } from './credenciaisPagamento'

// O ponto destes testes é uma decisão de segurança, não de UI: o access token
// do Mercado Pago NÃO pode ir para lf_config, que não tem RLS e é lida pelo
// catálogo público com select('*') direto do navegador.

function clientFake({ erro = null } = {}) {
  const c = { chamadas: [] }
  c.from = tabela => ({
    upsert: (linha, opts) => {
      c.chamadas.push({ tabela, linha, opts })
      return Promise.resolve({ error: erro })
    },
  })
  return c
}

describe('salvarCredencialMercadoPago', () => {
  it('grava em lf_credenciais_pagamento, nunca em lf_config', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-1', webhookSecret: 's3g' })
    expect(c.chamadas).toHaveLength(1)
    expect(c.chamadas[0].tabela).toBe('lf_credenciais_pagamento')
    expect(c.chamadas[0].tabela).not.toBe('lf_config')
  })

  it('grava token e segredo na linha da loja', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-1', webhookSecret: 's3g' })
    expect(c.chamadas[0].linha).toMatchObject({
      loja_id: 'tropicaleatacado',
      mercadopago_access_token: 'APP_USR-1',
      mercadopago_webhook_secret: 's3g',
    })
    expect(c.chamadas[0].opts).toEqual({ onConflict: 'loja_id' })
  })

  it('apara espaço — token colado do painel do MP vem com sobra', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'x', { token: '  APP_USR-1  ', webhookSecret: '  s  ' })
    expect(c.chamadas[0].linha.mercadopago_access_token).toBe('APP_USR-1')
    expect(c.chamadas[0].linha.mercadopago_webhook_secret).toBe('s')
  })

  it('campo vazio grava null, o que desconfigura a loja', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'x', { token: '', webhookSecret: '' })
    expect(c.chamadas[0].linha.mercadopago_access_token).toBeNull()
  })

  it('sem lojaId nem chega a tocar no banco', async () => {
    const c = clientFake()
    const { error } = await salvarCredencialMercadoPago(c, '', { token: 'a' })
    expect(error).toBeTruthy()
    expect(c.chamadas).toHaveLength(0)
  })

  it('propaga erro do banco em vez de fingir sucesso', async () => {
    const c = clientFake({ erro: { message: 'permission denied' } })
    const { error } = await salvarCredencialMercadoPago(c, 'x', { token: 'a' })
    expect(error.message).toBe('permission denied')
  })

  it('não encadeia .select() — pedir a linha de volta bateria na falta de policy', async () => {
    // A tabela não tem policy de SELECT de propósito. Se alguém acrescentar um
    // .select() aqui, o upsert grava e mesmo assim devolve erro de permissão,
    // e a tela mostra falha depois de um sucesso.
    const c = clientFake()
    const q = c.from('lf_credenciais_pagamento')
    expect(q.select).toBeUndefined()
    await salvarCredencialMercadoPago(c, 'x', { token: 'a' })
    expect(c.chamadas).toHaveLength(1)
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
