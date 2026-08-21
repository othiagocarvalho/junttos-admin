import { describe, it, expect } from 'vitest'
import { renovarSessao, criarRenovadorAoVoltar, _resetRenovacao } from './authRefresh'

// Reproduz o bug real: voltar para a aba disparava visibilitychange E focus,
// cada um chamando refreshSession(), e as duas chamadas iam para
// /auth/v1/token?grant_type=refresh_token com um refresh token de uso único.
// Aqui `refreshs` conta chamadas de rede de auth.

function clienteFake({ sessao = { access_token: 'tok' }, atraso = 5, falha = null } = {}) {
  const c = {
    refreshs: 0,
    getSessions: 0,
    auth: {
      async getSession() {
        c.getSessions++
        return { data: { session: sessao }, error: null }
      },
      async refreshSession() {
        c.refreshs++
        await new Promise(r => setTimeout(r, atraso))
        if (falha) return { data: { session: null, user: null }, error: { message: falha } }
        sessao = { access_token: `tok-${c.refreshs}` }
        return { data: { session: sessao, user: {} }, error: null }
      },
    },
  }
  return c
}

describe('renovarSessao — single-flight', () => {
  it('duas chamadas concorrentes viram UMA chamada de rede', async () => {
    const c = clienteFake()
    const [a, b] = await Promise.all([renovarSessao(c), renovarSessao(c)])
    expect(c.refreshs).toBe(1)
    // As duas recebem exatamente o mesmo resultado.
    expect(a).toBe(b)
    expect(a.error).toBeNull()
  })

  it('dez chamadas simultâneas ainda são uma só', async () => {
    const c = clienteFake()
    await Promise.all(Array.from({ length: 10 }, () => renovarSessao(c)))
    expect(c.refreshs).toBe(1)
  })

  it('depois que termina, uma nova chamada renova de verdade', async () => {
    // O single-flight não pode virar cache: sessão precisa poder ser renovada
    // de novo mais tarde.
    const c = clienteFake()
    await renovarSessao(c)
    await renovarSessao(c)
    expect(c.refreshs).toBe(2)
  })

  it('erro no refresh não deixa o slot travado', async () => {
    const c = clienteFake({ falha: 'invalid refresh token' })
    const r = await renovarSessao(c)
    expect(r.error.message).toBe('invalid refresh token')
    // Se o slot não fosse liberado no finally, esta segunda devolveria a
    // promise velha e a sessão nunca mais renovaria.
    await renovarSessao(c)
    expect(c.refreshs).toBe(2)
  })

  it('cada client tem o seu próprio slot', async () => {
    // supabase, supabaseAdmin e supabaseConsultor têm sessões separadas:
    // renovar um não pode calar o outro.
    const a = clienteFake(); const b = clienteFake()
    await Promise.all([renovarSessao(a), renovarSessao(b)])
    expect(a.refreshs).toBe(1)
    expect(b.refreshs).toBe(1)
  })

  it('janelaMs evita um segundo refresh logo depois de um que já terminou', async () => {
    // O caso que o single-flight sozinho não pega: o focus chega depois de o
    // visibilitychange já ter resolvido.
    const c = clienteFake()
    await renovarSessao(c, { janelaMs: 10_000 })
    await renovarSessao(c, { janelaMs: 10_000 })
    expect(c.refreshs).toBe(1)
  })

  it('sem janelaMs não há cooldown — o padrão não muda o comportamento', async () => {
    const c = clienteFake()
    await renovarSessao(c)
    await renovarSessao(c)
    expect(c.refreshs).toBe(2)
  })

  it('passada a janela, volta a renovar', async () => {
    // Sem fake timers de propósito: o clienteFake usa setTimeout para simular
    // a rede, e congelar o relógio deixaria o refresh pendurado para sempre.
    const c = clienteFake({ atraso: 0 })
    await renovarSessao(c, { janelaMs: 15 })
    await new Promise(r => setTimeout(r, 40))
    await renovarSessao(c, { janelaMs: 15 })
    expect(c.refreshs).toBe(2)
  })
})

describe('criarRenovadorAoVoltar — o handler que estava duplicado', () => {
  it('visibilitychange + focus disparados juntos = UM refresh', async () => {
    // É literalmente o bug: os dois eventos chamavam o mesmo handler e cada
    // um fazia a sua chamada de rede.
    const c = clienteFake()
    const aoVoltar = criarRenovadorAoVoltar(c, { estaVisivel: () => true })
    await Promise.all([aoVoltar(), aoVoltar()])
    expect(c.refreshs).toBe(1)
  })

  it('em sequência, dentro da janela, também dá UM refresh', async () => {
    // O focus costuma chegar alguns ms depois, já com o outro resolvido.
    const c = clienteFake()
    const aoVoltar = criarRenovadorAoVoltar(c, { estaVisivel: () => true })
    await aoVoltar()
    await aoVoltar()
    expect(c.refreshs).toBe(1)
  })

  it('aba escondida não renova nada', async () => {
    const c = clienteFake()
    const aoVoltar = criarRenovadorAoVoltar(c, { estaVisivel: () => false })
    await aoVoltar()
    expect(c.refreshs).toBe(0)
    expect(c.getSessions).toBe(0)
  })

  it('deslogada não tenta renovar', async () => {
    const c = clienteFake({ sessao: null })
    const aoVoltar = criarRenovadorAoVoltar(c, { estaVisivel: () => true })
    await aoVoltar()
    expect(c.refreshs).toBe(0)
  })

  it('avisa quem passou aoFalhar, sem lançar', async () => {
    const c = clienteFake({ falha: 'invalid refresh token' })
    const avisos = []
    const aoVoltar = criarRenovadorAoVoltar(c, {
      estaVisivel: () => true,
      aoFalhar: m => avisos.push(m),
    })
    await expect(aoVoltar()).resolves.toBeUndefined()
    expect(avisos).toEqual(['invalid refresh token'])
  })

  it('sem aoFalhar o erro é engolido de propósito — nada estoura na tela', async () => {
    const c = clienteFake({ falha: 'boom' })
    const aoVoltar = criarRenovadorAoVoltar(c, { estaVisivel: () => true })
    await expect(aoVoltar()).resolves.toBeUndefined()
  })
})

describe('_resetRenovacao', () => {
  it('limpa o estado do client', async () => {
    const c = clienteFake()
    await renovarSessao(c, { janelaMs: 10_000 })
    _resetRenovacao(c)
    await renovarSessao(c, { janelaMs: 10_000 })
    expect(c.refreshs).toBe(2)
  })
})
