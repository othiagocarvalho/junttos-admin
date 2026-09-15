// Detectores da trava anti-vazamento de segredo no front-end.
//
// POR QUE ISTO EXISTE
// No Vite, TODA variável com prefixo `VITE_` é embutida em texto puro no
// bundle JavaScript que vai para o navegador de qualquer visitante. Durante
// uma auditoria descobrimos que a service key do Supabase e as senhas de admin
// e de gestor estavam na Vercel com esse prefixo (VITE_SUPABASE_SERVICE_KEY,
// VITE_ADMIN_PASSWORD, VITE_GESTOR_PASSWORD). Os bundles publicados estavam
// limpos — nenhum código em src/ lia essas variáveis —, ou seja, o risco era
// dormente: bastava alguém escrever uma linha que as lesse (ou espalhar o
// objeto de ambiente inteiro) para a chave sair publicada no ar.
//
// Estas funções são o que impede a regressão. São puras e sem I/O de
// propósito: quem lê arquivo é scripts/verificar-segredos-no-bundle.mjs, que
// roda depois do `vite build` e derruba o build se achar qualquer coisa aqui.
//
// Elas rodam contra DOIS alvos diferentes:
//   · o bundle gerado (dist/) — procura o VALOR de um segredo em texto puro;
//   · o código-fonte (src/)   — procura o PADRÃO que faria um segredo vazar.

/** Prefixo das chaves secretas novas do Supabase (formato `sb_secret_...`). */
const PREFIXO_SECRET = 'sb_secret_'

/**
 * JWT em três partes separadas por ponto. As chaves legadas do Supabase
 * (anon e service_role) são JWTs; as duas começam com `eyJ`, então o prefixo
 * não distingue uma da outra — só o payload decodificado distingue.
 */
const RE_JWT = /eyJ[A-Za-z0-9_-]{6,}\.(eyJ[A-Za-z0-9_-]{6,})\.[A-Za-z0-9_-]{6,}/g

/** Decodifica base64url. Devolve null em vez de estourar em lixo aleatório. */
function decodificarBase64Url(txt) {
  try {
    const base64 = txt.replace(/-/g, '+').replace(/_/g, '/')
    const pad = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return atob(pad)
  } catch {
    return null
  }
}

/**
 * `true` se o payload de um JWT do Supabase declara `role: service_role`.
 * É esse campo — e não o formato da chave — que dá poder total sobre o banco,
 * ignorando RLS. A chave `anon` tem o mesmo formato e é pública por desenho.
 */
export function ehJwtServiceRole(payloadBase64) {
  const cru = decodificarBase64Url(payloadBase64)
  if (!cru) return false
  try {
    return JSON.parse(cru)?.role === 'service_role'
  } catch {
    return false
  }
}

/** Corta um trecho para o relatório sem despejar o segredo inteiro no log. */
function amostra(txt) {
  return txt.length <= 24 ? txt : `${txt.slice(0, 12)}…${txt.slice(-4)}`
}

/**
 * Procura VALORES de segredo em texto puro. Serve para varrer o bundle
 * publicado (dist/) e também o código-fonte, onde ninguém deve colar chave.
 *
 * Devolve `[{ tipo, trecho, linha }]` — lista vazia quer dizer limpo.
 */
export function acharSegredosNoTexto(texto) {
  if (!texto) return []
  const achados = []

  let idx = texto.indexOf(PREFIXO_SECRET)
  while (idx !== -1) {
    const bruto = texto.slice(idx).match(/^sb_secret_[A-Za-z0-9_-]*/)?.[0] ?? PREFIXO_SECRET
    achados.push({
      tipo: 'chave-secreta-supabase',
      trecho: amostra(bruto),
      linha: linhaDe(texto, idx),
    })
    idx = texto.indexOf(PREFIXO_SECRET, idx + PREFIXO_SECRET.length)
  }

  for (const m of texto.matchAll(RE_JWT)) {
    if (!ehJwtServiceRole(m[1])) continue
    achados.push({
      tipo: 'jwt-service-role',
      trecho: amostra(m[0]),
      linha: linhaDe(texto, m.index),
    })
  }

  return achados
}

/** Número da linha (1-based) de um índice dentro do texto. */
function linhaDe(texto, idx) {
  let linha = 1
  for (let i = 0; i < idx && i < texto.length; i++) if (texto[i] === '\n') linha++
  return linha
}

/**
 * Localiza os acessos ao objeto de ambiente do Vite dentro do código-fonte.
 * Devolve `[{ acesso, seguro, linha, contexto }]`.
 *
 * O que é SEGURO: ler uma propriedade nomeada e estática. O Vite substitui
 * esse acesso pelo valor daquela variável específica, e só dela.
 *
 * O que NÃO é: qualquer outra forma. Sem uma propriedade literal logo atrás,
 * o Vite não tem o que resolver estaticamente e injeta o OBJETO INTEIRO de
 * variáveis no bundle — inclusive as que ninguém pediu. É esse o vazamento
 * que a trava existe para pegar: espalhar (`{...}`), guardar numa constante,
 * serializar, logar, ou indexar com colchete.
 */
export function acharAcessoEnvInteiro(codigo) {
  if (!codigo) return []
  const achados = []
  const re = /import\s*\.\s*meta\s*\.\s*env/g

  for (const m of codigo.matchAll(re)) {
    const depois = codigo.slice(m.index + m[0].length)
    // Só `.PROP` e `?.PROP` com nome literal contam como acesso resolvido.
    const seguro = /^\s*\??\s*\.\s*[A-Za-z_$]/.test(depois)
    achados.push({
      acesso: m[0],
      seguro,
      linha: linhaDe(codigo, m.index),
      contexto: codigo.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, ' ').trim(),
    })
  }

  return achados
}

/** Atalho: só os acessos perigosos, que é o que quebra o build. */
export function acharAcessoEnvInseguro(codigo) {
  return acharAcessoEnvInteiro(codigo).filter(a => !a.seguro)
}
