import { describe, it, expect } from 'vitest'
import {
  parseAssinatura, montarManifesto, hexParaBytes,
  igualEmTempoConstante, assinaturaConfere, dentroDaJanela,
} from '../../supabase/functions/mp-webhook/assinatura.ts'

// A URL de uma Edge Function é pública. Sem validar assinatura, qualquer um
// que a descubra marca pedido como pago mandando um POST. Estes testes travam
// a única coisa que impede isso.

const SEGREDO = 'segredo-do-webhook-da-loja'

async function hmacHex(segredo, msg) {
  const chave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(msg)))
  return [...sig].map(b => b.toString(16).padStart(2, '0')).join('')
}

describe('parseAssinatura', () => {
  it('extrai ts e v1 do header do Mercado Pago', () => {
    expect(parseAssinatura('ts=1700000000,v1=abc123')).toEqual({ ts: '1700000000', v1: 'abc123' })
  })

  it('aguenta espaço e ordem trocada', () => {
    expect(parseAssinatura('v1=abc , ts=42')).toEqual({ ts: '42', v1: 'abc' })
  })

  it('header ausente ou lixo devolve vazio, não quebra', () => {
    expect(parseAssinatura(null)).toEqual({ ts: '', v1: '' })
    expect(parseAssinatura('')).toEqual({ ts: '', v1: '' })
    expect(parseAssinatura('nada-aqui')).toEqual({ ts: '', v1: '' })
  })

  it('não confunde o = interno do valor', () => {
    expect(parseAssinatura('ts=1,v1=aa==bb').v1).toBe('aa==bb')
  })
})

describe('montarManifesto', () => {
  it('segue exatamente o formato documentado pelo MP', () => {
    // Ordem, dois-pontos e ponto-e-vírgula final fazem parte da assinatura:
    // qualquer desvio invalida tudo silenciosamente.
    expect(montarManifesto('123', 'req-9', '1700000000'))
      .toBe('id:123;request-id:req-9;ts:1700000000;')
  })

  it('request-id vazio ainda produz manifesto bem formado', () => {
    expect(montarManifesto('1', '', '2')).toBe('id:1;request-id:;ts:2;')
  })
})

describe('hexParaBytes', () => {
  it('converte hex par', () => {
    expect([...hexParaBytes('00ff10')]).toEqual([0, 255, 16])
  })

  it('hex ímpar ou inválido vira vazio — e vazio nunca casa', () => {
    expect(hexParaBytes('abc').length).toBe(0)
    expect(hexParaBytes('zz').length).toBe(0)
    expect(hexParaBytes('').length).toBe(0)
  })
})

describe('igualEmTempoConstante', () => {
  it('iguais dão true', () => {
    expect(igualEmTempoConstante(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
  })

  it('diferentes dão false', () => {
    expect(igualEmTempoConstante(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
  })

  it('tamanhos diferentes dão false', () => {
    expect(igualEmTempoConstante(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false)
  })

  it('vazio nunca casa — nem com outro vazio', () => {
    // Protege o caso do hex inválido: sem isto, assinatura ilegível passaria.
    expect(igualEmTempoConstante(new Uint8Array(0), new Uint8Array(0))).toBe(false)
  })
})

describe('assinaturaConfere', () => {
  it('aceita a assinatura correta', async () => {
    const manifesto = montarManifesto('99', 'req-1', '1700000000')
    const v1 = await hmacHex(SEGREDO, manifesto)
    expect(await assinaturaConfere(SEGREDO, manifesto, v1)).toBe(true)
  })

  it('aceita hex em maiúscula', async () => {
    const manifesto = montarManifesto('99', 'req-1', '1700000000')
    const v1 = (await hmacHex(SEGREDO, manifesto)).toUpperCase()
    expect(await assinaturaConfere(SEGREDO, manifesto, v1)).toBe(true)
  })

  it('recusa assinatura de outro segredo', async () => {
    const manifesto = montarManifesto('99', 'req-1', '1700000000')
    const v1 = await hmacHex('segredo-errado', manifesto)
    expect(await assinaturaConfere(SEGREDO, manifesto, v1)).toBe(false)
  })

  it('recusa quando o corpo foi adulterado', async () => {
    // O cenário do ataque: interceptou uma notificação real e trocou o id do
    // pagamento para o de outro pedido.
    const v1 = await hmacHex(SEGREDO, montarManifesto('99', 'req-1', '1700000000'))
    const adulterado = montarManifesto('100', 'req-1', '1700000000')
    expect(await assinaturaConfere(SEGREDO, adulterado, v1)).toBe(false)
  })

  it('recusa assinatura vazia ou segredo vazio', async () => {
    const m = montarManifesto('1', 'r', '2')
    expect(await assinaturaConfere(SEGREDO, m, '')).toBe(false)
    expect(await assinaturaConfere('', m, 'abcd')).toBe(false)
  })

  it('recusa hex malformado em vez de estourar', async () => {
    const m = montarManifesto('1', 'r', '2')
    expect(await assinaturaConfere(SEGREDO, m, 'nao-e-hex')).toBe(false)
  })
})

describe('dentroDaJanela', () => {
  const agora = 1_700_000_000_000   // ms

  it('agora está dentro', () => {
    expect(dentroDaJanela('1700000000', agora)).toBe(true)
  })

  it('4 minutos atrás ainda vale', () => {
    expect(dentroDaJanela(String(1_700_000_000 - 240), agora)).toBe(true)
  })

  it('6 minutos atrás não vale — replay é recusado', () => {
    expect(dentroDaJanela(String(1_700_000_000 - 360), agora)).toBe(false)
  })

  it('ts do futuro distante também é recusado', () => {
    expect(dentroDaJanela(String(1_700_000_000 + 3600), agora)).toBe(false)
  })

  it('ts inválido é recusado', () => {
    expect(dentroDaJanela('', agora)).toBe(false)
    expect(dentroDaJanela('abc', agora)).toBe(false)
    expect(dentroDaJanela('0', agora)).toBe(false)
  })
})
