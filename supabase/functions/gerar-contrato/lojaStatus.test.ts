import { describe, it, expect } from 'vitest'
import {
  avaliarLojaParaContrato, isLojaExcluida, normalizarStatus, ERRO_LOJA,
} from './lojaStatus.ts'

// Este arquivo é Deno em produção, mas lojaStatus.ts não importa nada de Deno
// — então o vitest testa exatamente o módulo que a Edge Function executa, e
// não uma cópia da regra.

// ── O caso que motivou a mudança ─────────────────────────────────────────────

describe('avaliarLojaParaContrato', () => {
  it('loja ativa gera contrato normalmente', () => {
    expect(avaliarLojaParaContrato({ status: 'Ativo' })).toEqual({ ok: true })
  })

  it('loja em Trial também gera — é o momento mais comum de assinar', () => {
    // Loja nova nasce 'Trial' (EMPTY_FORM em CadastroCliente). Se esta regra
    // usasse isLojaAtiva, que só aceita 'ativo', o contrato de toda loja
    // recém-cadastrada seria recusado.
    expect(avaliarLojaParaContrato({ status: 'Trial' })).toEqual({ ok: true })
  })

  it('loja Inativa ainda gera — inativo não é excluído', () => {
    expect(avaliarLojaParaContrato({ status: 'Inativo' })).toEqual({ ok: true })
  })

  it('loja excluída é recusada', () => {
    const v = avaliarLojaParaContrato({ status: 'excluida' })
    expect(v.ok).toBe(false)
    expect(v).toMatchObject({ erro: ERRO_LOJA, status: 404 })
  })

  it('loja inexistente e loja excluída respondem EXATAMENTE igual', () => {
    // O ponto da correção: a resposta não pode revelar que aquele slug já foi
    // uma loja. Mesmo texto, mesmo código.
    expect(avaliarLojaParaContrato(null)).toEqual(avaliarLojaParaContrato({ status: 'excluida' }))
  })

  it('recusa sempre carrega erro e status — nunca cai no default 200', () => {
    for (const loja of [null, undefined, { status: 'excluida' }]) {
      const v = avaliarLojaParaContrato(loja)
      expect(v.ok).toBe(false)
      if (!v.ok) {
        expect(typeof v.erro).toBe('string')
        expect(v.status).toBe(404)
      }
    }
  })

  it('loja sem status definido não é tratada como excluída', () => {
    // Ausência de status é dado incompleto, não exclusão. Barrar aqui
    // quebraria loja legítima cujo campo nunca foi preenchido.
    expect(avaliarLojaParaContrato({})).toEqual({ ok: true })
    expect(avaliarLojaParaContrato({ status: null })).toEqual({ ok: true })
  })
})

// ── Normalização ─────────────────────────────────────────────────────────────

describe('isLojaExcluida — normalização', () => {
  it('pega as variações de caixa e espaço', () => {
    // lf_config.status é texto livre: 'Ativo' e 'ativo' convivem no banco.
    expect(isLojaExcluida('excluida')).toBe(true)
    expect(isLojaExcluida('Excluida')).toBe(true)
    expect(isLojaExcluida('EXCLUIDA')).toBe(true)
    expect(isLojaExcluida('  excluida  ')).toBe(true)
  })

  it('pega a forma acentuada, digitada à mão no dashboard', () => {
    expect(isLojaExcluida('excluída')).toBe(true)
    expect(isLojaExcluida('Excluída')).toBe(true)
    expect(isLojaExcluida(' EXCLUÍDA ')).toBe(true)
  })

  it('não confunde outros status com excluída', () => {
    ;['ativo', 'Trial', 'Inativo', 'demo', '', 'excluir', 'nao-excluida'].forEach(s => {
      expect(isLojaExcluida(s)).toBe(false)
    })
  })

  it('aguenta valor não-string sem quebrar', () => {
    ;[null, undefined, 0, false, {}, []].forEach(v => {
      expect(isLojaExcluida(v)).toBe(false)
    })
  })
})

describe('normalizarStatus', () => {
  it('devolve string vazia para nulo/indefinido', () => {
    expect(normalizarStatus(null)).toBe('')
    expect(normalizarStatus(undefined)).toBe('')
  })

  it('tira acento, caixa e espaço', () => {
    expect(normalizarStatus('  Excluída ')).toBe('excluida')
    expect(normalizarStatus('ATIVO')).toBe('ativo')
  })
})
