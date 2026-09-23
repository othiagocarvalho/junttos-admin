import { describe, it, expect } from 'vitest'
import { parametrosBipe, ehIOS, deveVibrar, tocarBipe, destravarAudio, SONS } from './bipe.js'

const UA_IPHONE  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const UA_IPAD_OS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

describe('parametrosBipe', () => {
  it('acerto: agudo, curto (~70ms), volume baixo', () => {
    const p = parametrosBipe('ok')
    expect(p.duracaoMs).toBe(70)
    expect(p.frequencia).toBeGreaterThan(1000)
    expect(p.volume).toBeLessThanOrEqual(0.1)
  })

  it('erro: grave e mais longo (~150ms) — distinguível do acerto', () => {
    const erro = parametrosBipe('erro')
    expect(erro.duracaoMs).toBe(150)
    expect(erro.frequencia).toBeLessThan(SONS.ok.frequencia / 4)
  })

  it('tipo desconhecido não tem som', () => {
    expect(parametrosBipe('outro')).toBeNull()
  })
})

describe('ehIOS', () => {
  it('iPhone', () => expect(ehIOS(UA_IPHONE, 5)).toBe(true))
  it('iPadOS se passando por Mac, com toque', () => expect(ehIOS(UA_IPAD_OS, 5)).toBe(true))
  it('Mac de verdade (sem toque) não é iOS', () => expect(ehIOS(UA_IPAD_OS, 0)).toBe(false))
  it('Android não é iOS', () => expect(ehIOS(UA_ANDROID, 5)).toBe(false))
})

describe('deveVibrar', () => {
  it('Android com vibrate: vibra no erro', () => {
    expect(deveVibrar('erro', { userAgent: UA_ANDROID, maxTouchPoints: 5, temVibrate: true })).toBe(true)
  })
  it('nunca vibra no acerto', () => {
    expect(deveVibrar('ok', { userAgent: UA_ANDROID, maxTouchPoints: 5, temVibrate: true })).toBe(false)
  })
  it('nunca vibra no iOS, mesmo que a API exista', () => {
    expect(deveVibrar('erro', { userAgent: UA_IPHONE, maxTouchPoints: 5, temVibrate: true })).toBe(false)
  })
  it('sem a API, não vibra', () => {
    expect(deveVibrar('erro', { userAgent: UA_ANDROID, maxTouchPoints: 5, temVibrate: false })).toBe(false)
  })
})

describe('sem Web Audio (ambiente de teste/navegador antigo)', () => {
  it('tocarBipe e destravarAudio não lançam', () => {
    expect(() => destravarAudio()).not.toThrow()
    expect(() => tocarBipe('ok')).not.toThrow()
    expect(() => tocarBipe('erro')).not.toThrow()
  })
})
