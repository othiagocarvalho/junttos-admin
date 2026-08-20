// Single-flight para `supabase.auth.refreshSession()`.
//
// ─── POR QUE EXISTE ─────────────────────────────────────────────────────────
// O refresh token do Supabase é de USO ÚNICO e rotaciona a cada renovação.
// Duas renovações disparadas quase ao mesmo tempo viram DUAS chamadas de rede
// a /auth/v1/token?grant_type=refresh_token, e a segunda roda com o token que
// a primeira acabou de rotacionar. Dá para ver as duas no DevTools, ambas 200,
// com timestamps quase idênticos.
//
// O estrago é silencioso: sobra uma sessão que a UI ainda mostra como válida
// mas cujo token o servidor já não aceita. E o supabase-js não avisa — quando
// não acha sessão utilizável ele manda a ANON KEY no lugar do token
// (SupabaseClient._getAccessToken faz `session?.access_token ?? supabaseKey`).
// Como as tabelas lf_* estão sem RLS, isso passa despercebido no painel
// inteiro e só aparece no Storage, como 403 "new row violates row-level
// security policy".
//
// ─── POR QUE A LIB NÃO RESOLVE SOZINHA ──────────────────────────────────────
// O `_callRefreshToken` do GoTrueClient tem dedup próprio, via
// `refreshingDeferred`: quem chega enquanto um refresh está em voo recebe a
// mesma promise. Só que o `refreshSession()` PÚBLICO passa antes por um lock
// (GoTrueClient.refreshSession → _acquireLock). Duas chamadas concorrentes
// então SERIALIZAM em vez de colapsar: quando a segunda entra, a primeira já
// terminou, o `refreshingDeferred` voltou a ser null, e ela dispara um segundo
// refresh de rede de verdade — agora com o token recém-rotacionado.
//
// Ou seja: o dedup precisa acontecer ANTES do lock. É o que este módulo faz.

// Estado por client: os três clients do projeto (supabase, supabaseAdmin,
// supabaseConsultor) têm storageKey e sessão próprios, então cada um precisa
// do seu próprio slot. WeakMap para não segurar client vivo à toa.
const emVoo = new WeakMap()
const concluidoEm = new WeakMap()

/**
 * Renova a sessão no máximo uma vez por vez, por client.
 *
 * Quem chama enquanto uma renovação está em andamento recebe a MESMA promise,
 * sem tocar na rede. Devolve o mesmo formato de `auth.refreshSession()`:
 * `{ data: { session, user }, error }`.
 *
 * @param {object} client              client do Supabase
 * @param {number} [opts.janelaMs=0]   se um refresh terminou há menos que
 *   isso, devolve a sessão atual (via getSession, sem rede de auth) em vez de
 *   gastar outro refresh token. Serve para eventos que disparam em rajada —
 *   visibilitychange e focus chegam juntos ao voltar para a aba, e o segundo
 *   pode chegar depois de o primeiro já ter resolvido, quando o single-flight
 *   sozinho não pegaria.
 */
export function renovarSessao(client, { janelaMs = 0 } = {}) {
  const jaEmVoo = emVoo.get(client)
  if (jaEmVoo) return jaEmVoo

  if (janelaMs > 0) {
    const ultimo = concluidoEm.get(client)
    if (ultimo && Date.now() - ultimo < janelaMs) {
      // Mesmo formato de retorno, sem queimar um refresh token.
      return client.auth.getSession()
    }
  }

  const promessa = Promise.resolve(client.auth.refreshSession())
    .finally(() => {
      emVoo.delete(client)
      // Marca também quando falha: numa rajada de eventos, insistir a cada
      // disparo só multiplicaria o problema que este módulo existe para evitar.
      concluidoEm.set(client, Date.now())
    })

  emVoo.set(client, promessa)
  return promessa
}

/**
 * Handler de "a aba voltou": confere se há sessão e renova, uma vez só.
 *
 * Mora aqui, e não dentro do componente, para poder ser testado sem DOM — foi
 * exatamente a duplicidade deste handler (registrado em `visibilitychange` E
 * em `focus`) que disparava os dois refreshes.
 *
 * Silencioso de propósito: se falhar, o refresh no momento da ação ainda tenta
 * de novo, e o onAuthStateChange derruba a sessão se for o caso — nada de
 * alerta na cara de quem só voltou para a aba.
 *
 * @param {object}   client
 * @param {function} [opts.estaVisivel] como decidir se a aba está à vista
 * @param {function} [opts.aoFalhar]    recebe a mensagem de erro
 * @param {number}   [opts.janelaMs]    ver renovarSessao
 */
export function criarRenovadorAoVoltar(client, {
  estaVisivel = () => typeof document === 'undefined' || document.visibilityState === 'visible',
  aoFalhar = null,
  janelaMs = 10_000,
} = {}) {
  return async function aoVoltar() {
    if (!estaVisivel()) return
    const { data } = await client.auth.getSession()
    if (!data?.session) return          // deslogada: nada a renovar
    const { error } = await renovarSessao(client, { janelaMs })
    if (error) aoFalhar?.(error.message)
  }
}

/** Só para teste: zera o estado entre casos. */
export function _resetRenovacao(client) {
  emVoo.delete(client)
  concluidoEm.delete(client)
}
