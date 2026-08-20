import { describe, it, expect } from 'vitest'
import { corParaHex, coresDeVariacoes, normalizarNomeCor, HEX_FALLBACK } from './coresProduto'

describe('normalizarNomeCor', () => {
  it('tira acento, caixa e separadores', () => {
    expect(normalizarNomeCor('ROSA BEBÊ')).toBe('rosa bebe')
    expect(normalizarNomeCor('OFF/ FLOR LARANJA')).toBe('off flor laranja')
    expect(normalizarNomeCor('BEGE C/ AZUL')).toBe('bege c azul')
    expect(normalizarNomeCor('AÇAÍ')).toBe('acai')
  })

  it('aceita nulo sem quebrar', () => {
    expect(normalizarNomeCor(null)).toBe('')
    expect(normalizarNomeCor(undefined)).toBe('')
  })
})

describe('corParaHex', () => {
  it('resolve as cores base', () => {
    expect(corParaHex('AZUL').hex).toBe('#2563C9')
    expect(corParaHex('PRETO').hex).toBe('#1A1A1A')
    expect(corParaHex('VINHO').hex).toBe('#6E1A2B')
    expect(corParaHex('NUDE').hex).toBe('#DFC3AC')
  })

  it('prefere a frase mais específica sobre a base', () => {
    expect(corParaHex('ROSA PINK').hex).toBe('#E8317B')
    expect(corParaHex('ROSA').hex).toBe('#F49FC0')
    expect(corParaHex('ROSA BEBÊ').hex).toBe('#F7C8DA')
    expect(corParaHex('AZUL MARINHO').hex).toBe('#1B2A5B')
    expect(corParaHex('AZUL').hex).toBe('#2563C9')
  })

  it('em nome composto vence a cor que aparece primeiro', () => {
    // "bege com detalhe azul" → a peça é bege
    expect(corParaHex('BEGE C/ AZUL').hex).toBe('#D9C7A9')
    // "borboleta laranja" → o desenho é borboleta, a cor é laranja
    expect(corParaHex('BORBOLETA LARANJA').hex).toBe('#F07622')
    expect(corParaHex('AZUL BORBOLETA').hex).toBe('#2563C9')
    expect(corParaHex('OFF/ FLOR ROSA').hex).toBe('#F2EDE3')
  })

  it('casa por palavra inteira, não por pedaço', () => {
    // "off" não pode ser achado dentro de "coffee"
    expect(corParaHex('coffee').exato).toBe(false)
  })

  it('cai no cinza neutro quando o nome não é cor', () => {
    for (const naoCor of ['P', 'M', 'GG', '42 SKINNY', 'Modelo 3', 'Queijo', '']) {
      const r = corParaHex(naoCor)
      expect(r.exato).toBe(false)
      expect(r.hex).toBe(HEX_FALLBACK)
    }
  })

  it('mapeia sem fallback as 35 cores reais do catálogo (tropicaleatacado)', () => {
    const reais = [
      'AZUL', 'AZUL BORBOLETA', 'AZUL C/ BRANCO', 'AZUL MARINHO', 'AZUL PISCINA',
      'AZUL ROYAL', 'AÇAÍ', 'BEGE', 'BEGE C/ AZUL', 'BEGE C/ MARROM', 'BEGE C/ VERDE',
      'BEGE/ FLOR AZUL', 'BORBOLETA AZUL', 'BORBOLETA LARANJA', 'BRANCO',
      'BRANCO COM FLOR', 'FLOR AZUL', 'LARANJA', 'LILÁS', 'MARROM', 'NUDE',
      'OFF C/ AZUL', 'OFF C/ BORBOLETA', 'OFF COM FLOR', 'OFF COM FLORES AMARELAS',
      'OFF/ FLOR LARANJA', 'OFF/ FLOR ROSA', 'PRETO', 'ROSA', 'ROSA BEBÊ',
      'ROSA PINK', 'TERRACOTA', 'VERDE', 'VERMELHO', 'VINHO',
    ]
    const semHex = reais.filter(n => !corParaHex(n).exato)
    expect(semHex).toEqual([])
    expect(reais).toHaveLength(35)
  })
})

describe('coresDeVariacoes', () => {
  it('preserva o nome cadastrado e deriva só o hex', () => {
    const cores = coresDeVariacoes([
      { cor: 'ROSA PINK', quantidade: 3 },
      { cor: 'PRETO', quantidade: 0 },
    ])
    expect(cores).toEqual([
      { nome: 'ROSA PINK', hex: '#E8317B', exato: true },
      { nome: 'PRETO', hex: '#1A1A1A', exato: true },
    ])
  })

  it('mantém a ordem de cadastro e remove duplicata', () => {
    const cores = coresDeVariacoes([
      { cor: 'Azul' }, { cor: 'AZUL' }, { cor: 'Verde' },
    ])
    expect(cores.map(c => c.nome)).toEqual(['Azul', 'Verde'])
  })

  it('usa a chave tamanho quando não há cor', () => {
    expect(coresDeVariacoes([{ tamanho: 'PRETO' }]).map(c => c.nome)).toEqual(['PRETO'])
  })

  it('ignora variação sem rótulo e lista vazia', () => {
    expect(coresDeVariacoes([{ quantidade: 2 }, { cor: '' }])).toEqual([])
    expect(coresDeVariacoes(null)).toEqual([])
    expect(coresDeVariacoes([])).toEqual([])
  })
})
