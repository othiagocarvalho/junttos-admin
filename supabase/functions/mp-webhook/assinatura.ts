// Validação da assinatura do webhook do Mercado Pago.
//
// Mora num arquivo separado de propósito: aqui não há import de deno.land nem
// de esm.sh, só Web Crypto — que existe no Deno e no Node. Isso deixa a parte
// que realmente protege a rota coberta por teste (src/utils/mpAssinatura.test.js),
// sem precisar subir um runtime Deno no CI.
//
// O MP manda:
//   x-signature:  ts=<epoch>,v1=<hmac-sha256-hex>
//   x-request-id: <uuid>
// e o manifesto assinado é, literalmente:
//   id:<data.id>;request-id:<x-request-id>;ts:<ts>;

/** Quebra `ts=1700000000,v1=abc...` no que interessa. */
export function parseAssinatura(header: string | null) {
  if (!header) return { ts: '', v1: '' }
  let ts = '', v1 = ''
  for (const parte of header.split(',')) {
    const i = parte.indexOf('=')
    if (i === -1) continue
    const chave = parte.slice(0, i).trim()
    const valor = parte.slice(i + 1).trim()
    if (chave === 'ts') ts = valor
    if (chave === 'v1') v1 = valor
  }
  return { ts, v1 }
}

/** Manifesto exatamente como o MP documenta — ordem e ponto-e-vírgula importam. */
export function montarManifesto(dataId: string, requestId: string, ts: string) {
  return `id:${dataId};request-id:${requestId};ts:${ts};`
}

export function hexParaBytes(hex: string) {
  if (!hex || hex.length % 2 !== 0) return new Uint8Array(0)
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    const b = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(b)) return new Uint8Array(0)
    out[i] = b
  }
  return out
}

/**
 * Comparação em tempo constante.
 *
 * Comparar HMAC com === vaza o segredo byte a byte por timing: o atacante mede
 * quanto tempo a comparação leva e descobre quantos bytes acertou. É ataque
 * conhecido contra webhook, e o custo de evitar é este laço.
 */
export function igualEmTempoConstante(a: Uint8Array, b: Uint8Array) {
  if (a.length === 0 || a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i]
  return dif === 0
}

/** true se `v1` é o HMAC-SHA256 de `manifesto` com `segredo`. */
export async function assinaturaConfere(segredo: string, manifesto: string, v1: string) {
  if (!segredo || !v1) return false
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const calculado = new Uint8Array(
    await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(manifesto)),
  )
  return igualEmTempoConstante(calculado, hexParaBytes(v1.toLowerCase()))
}

/**
 * Assinatura válida capturada e reenviada semanas depois não deve passar.
 * Janela de 5 minutos, como o MP recomenda.
 */
export function dentroDaJanela(ts: string, agoraMs: number, janelaSegundos = 300) {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return false
  return Math.abs(agoraMs / 1000 - n) <= janelaSegundos
}
