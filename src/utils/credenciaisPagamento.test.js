import { describe, it, expect } from 'vitest'
import {
  salvarCredencialMercadoPago, podeAtivarMercadoPago,
  validarAccessTokenMP, pareceTokenDeTeste,
} from './credenciaisPagamento'

// O ponto destes testes é uma decisão de segurança, não de UI: o access token
// do Mercado Pago NÃO pode ir para lf_config, que não tem RLS e é lida pelo
// catálogo público com select('*') direto do navegador.
//
// A gravação deixou de ser UPDATE via PostgREST e virou a função
// public.salvar_credencial_mercadopago (SECURITY DEFINER). Motivo: sem policy
// de SELECT nesta tabela — que é o que mantém o token ilegível pelo navegador
// — os dois caminhos de UPDATE morrem, e por causas opostas:
//
//   com WHERE  → o Postgres aplica policies de SELECT para ler a coluna do
//                filtro, não acha nenhuma, esconde a linha: 0 linhas, 204,
//                nenhum erro. (medido no banco em 23/08/2026)
//   sem WHERE  → 400 21000 "UPDATE requires a WHERE clause", trava nativa do
//                PostgREST. (confirmado em produção em 23/08/2026)
//
// Por isso o fake abaixo NÃO expõe `.from`: se o código voltar a mandar
// insert/update daqui, vira TypeError e o teste quebra na hora.
function clientFake({
  erroRpc = null,
  sessao  = { access_token: 'jwt-de-teste' }, erroSessao = null,
} = {}) {
  const c = { rpcs: [] }
  c.auth = {
    getSession: async () => ({ data: { session: sessao }, error: erroSessao }),
  }
  c.rpc = (fn, params) => {
    c.rpcs.push({ fn, params })
    return Promise.resolve({ data: null, error: erroRpc })
  }
  return c
}

const RPC = 'salvar_credencial_mercadopago'

describe('salvarCredencialMercadoPago', () => {
  it('chama a função de gravação, e não uma escrita direta em tabela', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-1', webhookSecret: 's3g' })
    expect(c.rpcs).toHaveLength(1)
    expect(c.rpcs[0].fn).toBe(RPC)
    // Nunca em lf_config, que não tem RLS e o catálogo público lê inteira.
    expect(c.rpcs[0].fn).not.toMatch(/lf_config/)
  })

  it('NÃO manda insert nem update daqui — os dois caminhos estão fechados', async () => {
    // Substitui o antigo "NÃO usa upsert". A raiz é a mesma dos três bugs:
    // upsert precisava enxergar a linha para resolver ON CONFLICT, o UPDATE
    // com WHERE precisava enxergá-la para o filtro, e sem WHERE o PostgREST
    // recusa. Quem faz ON CONFLICT agora é a função, onde não há RLS
    // escondendo nada.
    const c = clientFake()
    expect(c.from).toBeUndefined()
    await salvarCredencialMercadoPago(c, 'x', { token: 'a' })
    expect(c.rpcs).toHaveLength(1)
  })

  it('manda loja, token e segredo como parâmetros da função', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-1', webhookSecret: 's3g' })
    expect(c.rpcs[0].params).toEqual({
      p_loja_id:        'tropicaleatacado',
      p_access_token:   'APP_USR-1',
      p_webhook_secret: 's3g',
    })
  })

  it('não manda atualizado_em — o carimbo é do relógio do servidor', async () => {
    // Antes ia `new Date().toISOString()` do navegador. A função usa now(),
    // que não depende do relógio da máquina da lojista estar certo.
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-1' })
    expect('atualizado_em' in c.rpcs[0].params).toBe(false)
  })

  it('primeira gravação e regravação são a mesma chamada', async () => {
    // O ON CONFLICT mora na função: o cliente não precisa mais tentar INSERT,
    // levar 409 e cair num UPDATE. Aquele 409 no console some junto.
    const c = clientFake()
    const { error } = await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'novo' })
    expect(error).toBeNull()
    expect(c.rpcs).toHaveLength(1)
  })

  it('apara espaço — token colado do painel do MP vem com sobra', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'x', { token: '  APP_USR-1  ', webhookSecret: '  s  ' })
    expect(c.rpcs[0].params.p_access_token).toBe('APP_USR-1')
    expect(c.rpcs[0].params.p_webhook_secret).toBe('s')
  })

  // ── Campo vazio MANTÉM o que está gravado ───────────────────────────────
  // `null` no parâmetro é o contrato de "não mexe nesta coluna": a função faz
  // coalesce(excluded.x, cred.x). Verificado contra o banco em 23/08/2026, em
  // transação abortada — gravando só o token, o segredo ficou intacto.

  it('só o access token digitado: o segredo do webhook vai NULL (preserva)', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-1', webhookSecret: '' })
    expect(c.rpcs[0].params.p_access_token).toBe('APP_USR-1')
    expect(c.rpcs[0].params.p_webhook_secret).toBeNull()
  })

  it('só o segredo do webhook digitado: o access token vai NULL (preserva)', async () => {
    // A sequência exata do relato: token salvo antes, tela limpa os campos,
    // lojista volta e digita só a chave do webhook. Antes, isto apagava o
    // token e derrubava o Pix com QR Code.
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: '', webhookSecret: 's3g' })
    expect(c.rpcs[0].params.p_webhook_secret).toBe('s3g')
    expect(c.rpcs[0].params.p_access_token).toBeNull()
  })

  it('espaço em branco conta como vazio, não como valor', async () => {
    const c = clientFake()
    await salvarCredencialMercadoPago(c, 'x', { token: '   ', webhookSecret: 's3g' })
    expect(c.rpcs[0].params.p_access_token).toBeNull()
  })

  it('nada digitado não gera chamada nenhuma', async () => {
    // Salvar a tela de Configurações sem tocar nas chaves não pode mandar um
    // write — no desenho antigo esse write apagava as duas de uma vez.
    const c = clientFake()
    const { error } = await salvarCredencialMercadoPago(c, 'x', { token: '', webhookSecret: '' })
    expect(error).toBeNull()
    expect(c.rpcs).toHaveLength(0)
  })

  it('sem lojaId nem chega a tocar no banco', async () => {
    const c = clientFake()
    const { error } = await salvarCredencialMercadoPago(c, '', { token: 'a' })
    expect(error).toBeTruthy()
    expect(c.rpcs).toHaveLength(0)
  })

  it('sucesso é ausência de erro — não há mais count para interpretar', async () => {
    // A função ou lança exceção, ou o ON CONFLICT gravou. Não existe caminho
    // que responda sucesso sem ter escrito, que era o buraco do 204.
    const c = clientFake()
    expect((await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-1' })).error).toBeNull()
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
// Erros que a função devolve — cada um com mensagem que diz o que fazer.
// A falha silenciosa de 25/08/2026 (204 sem gravar) não tem mais como existir:
// o caminho de sucesso agora escreve por construção.
// ─────────────────────────────────────────────────────────────────────────────
describe('erros vindos da função de gravação', () => {
  it('função ausente no banco: manda rodar a migration, em vez de "não salva"', async () => {
    // PGRST202 = o PostgREST não achou a função. Acontece se o deploy do
    // código subir antes de rodar a migration, que é DDL e vai à mão.
    const c = clientFake({ erroRpc: { code: 'PGRST202', message: 'Could not find the function' } })
    const { error } = await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-1' })
    expect(error).toBeTruthy()
    expect(error.message).toMatch(/migration_rpc_salvar_credencial_mp\.sql/)
    expect(error.message).toMatch(/nada foi gravado/i)
  })

  it('claim de loja que não bate vira mensagem de sessão, não erro cru', async () => {
    // 42501 é o errcode que a função lança quando
    // auth.jwt() -> app_metadata ->> loja_id difere da loja alvo. Verificado
    // no banco em 23/08/2026: claim de outra loja e claim ausente foram os
    // dois rejeitados sem escrever.
    const c = clientFake({ erroRpc: { code: '42501', message: 'insufficient_privilege' } })
    const { error } = await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-1' })
    expect(error.message).toMatch(/não tem permissão para esta loja/i)
    expect(error.message).toMatch(/nada foi gravado/i)
  })

  it('erro desconhecido sobe como veio, sem ser mascarado', async () => {
    const cru = { code: '08006', message: 'connection failure' }
    const c = clientFake({ erroRpc: cru })
    const { error } = await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-1' })
    expect(error).toBe(cru)
  })
})

describe('sessão expirada — não manda escrita condenada', () => {
  it('sem sessão devolve erro explicando, e NÃO chama a função', async () => {
    const c = clientFake({ sessao: null })
    const { error } = await salvarCredencialMercadoPago(c, 'tropicaleatacado', { token: 'APP_USR-x' })
    expect(error).toBeTruthy()
    expect(error.message).toMatch(/sessão expirou/i)
    expect(c.rpcs).toHaveLength(0)
  })

  it('sessão sem access_token conta como sem sessão', async () => {
    const c = clientFake({ sessao: {} })
    expect((await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })).error).toBeTruthy()
    expect(c.rpcs).toHaveLength(0)
  })

  it('erro ao ler a sessão sobe, não é engolido', async () => {
    const c = clientFake({ erroSessao: new Error('storage indisponível') })
    const { error } = await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })
    expect(error.message).toBe('storage indisponível')
    expect(c.rpcs).toHaveLength(0)
  })

  it('com sessão válida o caminho normal continua igual', async () => {
    const c = clientFake()
    expect((await salvarCredencialMercadoPago(c, 'x', { token: 'APP_USR-x' })).error).toBeNull()
    expect(c.rpcs).toHaveLength(1)
  })
})
