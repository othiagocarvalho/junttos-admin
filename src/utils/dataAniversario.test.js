import { describe, it, expect } from 'vitest'
import { mascararDataDigitada, dataDigitadaParaISO, isoParaDataDigitada } from './dataAniversario'

describe('mascararDataDigitada', () => {
  it('insere as barras conforme a quantidade de dígitos', () => {
    expect(mascararDataDigitada('1')).toBe('1')
    expect(mascararDataDigitada('15')).toBe('15')
    expect(mascararDataDigitada('155')).toBe('15/5')
    expect(mascararDataDigitada('1505')).toBe('15/05')
    expect(mascararDataDigitada('15051')).toBe('15/05/1')
    expect(mascararDataDigitada('15051990')).toBe('15/05/1990')
  })

  it('ignora caracteres não numéricos', () => {
    expect(mascararDataDigitada('15/05/1990')).toBe('15/05/1990')
    expect(mascararDataDigitada('ab15cd05ef1990')).toBe('15/05/1990')
  })

  it('corta em 8 dígitos', () => {
    expect(mascararDataDigitada('150519901234')).toBe('15/05/1990')
  })

  it('vazio/nulo -> vazio', () => {
    expect(mascararDataDigitada('')).toBe('')
    expect(mascararDataDigitada(null)).toBe('')
    expect(mascararDataDigitada(undefined)).toBe('')
  })
})

describe('dataDigitadaParaISO', () => {
  it('data válida completa -> ISO', () => {
    expect(dataDigitadaParaISO('15/05/1990')).toBe('1990-05-15')
    expect(dataDigitadaParaISO('01/01/2000')).toBe('2000-01-01')
  })

  it('incompleta -> null', () => {
    expect(dataDigitadaParaISO('15/05')).toBeNull()
    expect(dataDigitadaParaISO('')).toBeNull()
    expect(dataDigitadaParaISO(undefined)).toBeNull()
  })

  it('mês fora do intervalo -> null', () => {
    expect(dataDigitadaParaISO('15/13/1990')).toBeNull()
    expect(dataDigitadaParaISO('15/00/1990')).toBeNull()
  })

  it('dia inexistente pro mês -> null (30/02, 31/04)', () => {
    expect(dataDigitadaParaISO('30/02/1990')).toBeNull()
    expect(dataDigitadaParaISO('31/04/1990')).toBeNull()
  })

  it('29/02 só em ano bissexto', () => {
    expect(dataDigitadaParaISO('29/02/2000')).toBe('2000-02-29')
    expect(dataDigitadaParaISO('29/02/1990')).toBeNull()
  })

  it('ano fora do intervalo plausível -> null', () => {
    expect(dataDigitadaParaISO('15/05/1899')).toBeNull()
    expect(dataDigitadaParaISO('15/05/2999')).toBeNull()
  })
})

describe('isoParaDataDigitada', () => {
  it('ISO -> DD/MM/AAAA', () => {
    expect(isoParaDataDigitada('1990-05-15')).toBe('15/05/1990')
  })

  it('aceita timestamp completo, usa só a parte da data', () => {
    expect(isoParaDataDigitada('1990-05-15T00:00:00.000Z')).toBe('15/05/1990')
  })

  it('vazio/nulo/inválido -> string vazia', () => {
    expect(isoParaDataDigitada('')).toBe('')
    expect(isoParaDataDigitada(null)).toBe('')
    expect(isoParaDataDigitada('não é data')).toBe('')
  })
})
