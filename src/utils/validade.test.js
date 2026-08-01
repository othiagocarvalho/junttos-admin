import { describe, it, expect } from 'vitest'
import {
  diasAteVencimento,
  estadoValidade,
  textoVencimento,
  blocoData,
  agruparPorValidade,
  paraDataLocal,
} from './validade'

const HOJE = new Date(2026, 6, 28) // 28/07/2026, local
const emDias = n => {
  const d = new Date(HOJE)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('paraDataLocal', () => {
  it('lê a parte da data como texto, sem shift de fuso', () => {
    // meia-noite UTC viraria dia 27 no Brasil se passasse por new Date() direto
    const d = paraDataLocal('2026-07-28T00:00:00+00:00')
    expect(d.getDate()).toBe(28)
    expect(d.getMonth()).toBe(6)
  })

  it('devolve null para valor ausente ou inválido', () => {
    expect(paraDataLocal(null)).toBeNull()
    expect(paraDataLocal('')).toBeNull()
    expect(paraDataLocal('nao-e-data')).toBeNull()
  })
})

describe('diasAteVencimento', () => {
  it('conta dias corridos a partir de hoje', () => {
    expect(diasAteVencimento(emDias(0), HOJE)).toBe(0)
    expect(diasAteVencimento(emDias(1), HOJE)).toBe(1)
    expect(diasAteVencimento(emDias(9), HOJE)).toBe(9)
  })

  it('devolve negativo para produto já vencido', () => {
    expect(diasAteVencimento(emDias(-1), HOJE)).toBe(-1)
    expect(diasAteVencimento(emDias(-5), HOJE)).toBe(-5)
  })

  it('devolve null quando não há data', () => {
    expect(diasAteVencimento(null, HOJE)).toBeNull()
    expect(diasAteVencimento(undefined, HOJE)).toBeNull()
  })
})

describe('estadoValidade', () => {
  it('urgente cobre vencido e até 3 dias', () => {
    expect(estadoValidade(-10)).toBe('urgente')
    expect(estadoValidade(0)).toBe('urgente')
    expect(estadoValidade(3)).toBe('urgente')
  })

  it('atenção cobre de 4 a 9 dias', () => {
    expect(estadoValidade(4)).toBe('atencao')
    expect(estadoValidade(9)).toBe('atencao')
  })

  it('fora das faixas não aparece na tela', () => {
    expect(estadoValidade(10)).toBeNull()
    expect(estadoValidade(60)).toBeNull()
    expect(estadoValidade(null)).toBeNull()
  })
})

describe('textoVencimento', () => {
  it('usa texto próprio para hoje, amanhã e ontem', () => {
    expect(textoVencimento(0)).toBe('Vence HOJE')
    expect(textoVencimento(1)).toBe('Vence amanhã')
    expect(textoVencimento(-1)).toBe('Vencido ontem')
  })

  it('pluraliza os demais casos', () => {
    expect(textoVencimento(5)).toBe('Vence em 5 dias')
    expect(textoVencimento(-4)).toBe('Vencido há 4 dias')
  })
})

describe('blocoData', () => {
  it('formata dia com 2 dígitos e mês abreviado em maiúsculo', () => {
    expect(blocoData('2026-07-28')).toEqual({ dia: '28', mes: 'JUL' })
    expect(blocoData('2026-01-05')).toEqual({ dia: '05', mes: 'JAN' })
  })

  it('devolve null sem data', () => {
    expect(blocoData(null)).toBeNull()
  })
})

describe('agruparPorValidade', () => {
  const prod = (nome, dias) => ({ nome, ativo: true, data_vencimento: emDias(dias) })

  it('separa nas duas seções e ignora quem está fora da janela', () => {
    const { urgente, atencao } = agruparPorValidade([
      prod('Vencido', -2),
      prod('Hoje', 0),
      prod('Em 3', 3),
      prod('Em 4', 4),
      prod('Em 9', 9),
      prod('Em 10', 10),   // fora
      { nome: 'Sem data', ativo: true, data_vencimento: null }, // fora
    ], HOJE)

    expect(urgente.map(i => i.produto.nome)).toEqual(['Vencido', 'Hoje', 'Em 3'])
    expect(atencao.map(i => i.produto.nome)).toEqual(['Em 4', 'Em 9'])
  })

  it('ordena cada seção do que vence primeiro para o último', () => {
    const { urgente } = agruparPorValidade([prod('C', 3), prod('A', -1), prod('B', 1)], HOJE)
    expect(urgente.map(i => i.produto.nome)).toEqual(['A', 'B', 'C'])
  })

  it('ignora produto inativo', () => {
    const inativo = { nome: 'X', ativo: false, data_vencimento: emDias(0) }
    const { urgente } = agruparPorValidade([inativo], HOJE)
    expect(urgente).toHaveLength(0)
  })

  it('traz cor, texto e bloco de data prontos para a tela', () => {
    const { urgente } = agruparPorValidade([prod('Leite', 0)], HOJE)
    expect(urgente[0].cor).toBe('#C4321F')
    expect(urgente[0].texto).toBe('Vence HOJE')
    expect(urgente[0].bloco).toEqual({ dia: '28', mes: 'JUL' })
  })

  it('não quebra com lista vazia ou nula', () => {
    expect(agruparPorValidade([], HOJE)).toEqual({ urgente: [], atencao: [] })
    expect(agruparPorValidade(null, HOJE)).toEqual({ urgente: [], atencao: [] })
  })
})
