// Som de confirmação do bipe (CampoScanner: leitor físico e câmera).
//
// ─── POR QUE WEB AUDIO, E NÃO <audio> ───────────────────────────────────────
// 1. Sem arquivo: o tom é sintetizado na hora, nada para baixar.
// 2. Modo silencioso do iPhone: no iOS o Web Audio RESPEITA a chave de
//    silêncio, e um <audio> a ignora (é tratado como reprodução de mídia).
//    Loja com cliente do lado: se a vendedora silenciou o celular, o bipe tem
//    que ficar quieto. Onde existe (Safari 16.4+), navigator.audioSession
//    'ambient' reforça isso e não interrompe música tocando no aparelho.
//    Android não tem chave física: segue o volume de mídia.
//
// ─── DESTRAVAR ─────────────────────────────────────────────────────────────
// Navegadores (iOS principalmente) só liberam áudio depois de um gesto do
// usuário. `destravarAudio()` TEM de ser chamado dentro de um toque/tecla:
// a leitura da câmera chega por callback do zxing, que não conta como gesto.
// Por isso o CampoScanner chama destravarAudio() no toque do botão de câmera
// — não remova essa chamada achando que é redundante.

/** Parâmetros de cada som. Volume baixo: toca 20+ vezes seguidas. */
export const SONS = {
  ok:   { frequencia: 1760, duracaoMs: 70,  volume: 0.08, forma: 'sine' },
  erro: { frequencia: 220,  duracaoMs: 150, volume: 0.12, forma: 'square' },
}

/** Vibração no erro (Android). Curta: o som já diferencia. */
export const VIBRACAO_ERRO_MS = 120

export function parametrosBipe(tipo) {
  return SONS[tipo] || null
}

/**
 * iPhone/iPad. O iPadOS 13+ se apresenta como "Macintosh" — o que o denuncia
 * é ter tela de toque.
 */
export function ehIOS(userAgent = '', maxTouchPoints = 0) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1
}

/** Vibra só no erro, só onde a API existe, e nunca no iOS. */
export function deveVibrar(tipo, { userAgent = '', maxTouchPoints = 0, temVibrate = false } = {}) {
  return tipo === 'erro' && temVibrate && !ehIOS(userAgent, maxTouchPoints)
}

let contexto = null

function obterContexto() {
  if (contexto) return contexto
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  try {
    // Antes de criar o contexto: a categoria de sessão vale para o que vier.
    if (navigator.audioSession) navigator.audioSession.type = 'ambient'
  } catch { /* API experimental — sem ela o padrão do Web Audio já basta */ }
  try {
    contexto = new Ctx()
  } catch {
    return null
  }
  return contexto
}

/** Chamar dentro de um gesto do usuário (ver cabeçalho). Nunca lança. */
export function destravarAudio() {
  try {
    const ctx = obterContexto()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  } catch { /* som é acessório: nunca pode quebrar o bipe */ }
}

/** Toca o som de 'ok' ou 'erro' (e vibra no erro, no Android). Nunca lança. */
export function tocarBipe(tipo) {
  try {
    if (typeof navigator !== 'undefined' && deveVibrar(tipo, {
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      temVibrate: typeof navigator.vibrate === 'function',
    })) {
      navigator.vibrate(VIBRACAO_ERRO_MS)
    }

    const p = parametrosBipe(tipo)
    const ctx = obterContexto()
    if (!p || !ctx || ctx.state !== 'running') return

    const t = ctx.currentTime
    const dur = p.duracaoMs / 1000
    const osc = ctx.createOscillator()
    const ganho = ctx.createGain()
    osc.type = p.forma
    osc.frequency.value = p.frequencia
    // Rampa até ~0 no fim: cortar o tom seco produz um estalo.
    ganho.gain.setValueAtTime(p.volume, t)
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(ganho).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  } catch { /* som é acessório: nunca pode quebrar o bipe */ }
}
