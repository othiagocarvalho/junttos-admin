import { describe, it, expect } from 'vitest'
import {
  UNICO,
  normalizarNumero,
  montarLabelVariacao,
  agruparLinhasPlanilha,
  totalizarProdutosImportados,
} from './importarEstoquePlanilha'

describe('normalizarNumero', () => {
  it('aceita vírgula e ponto decimal', () => {
    expect(normalizarNumero('45,90')).toBe(45.9)
    expect(normalizarNumero('45.90')).toBe(45.9)
  })

  it('retorna null para vazio/inválido', () => {
    expect(normalizarNumero('')).toBeNull()
    expect(normalizarNumero(undefined)).toBeNull()
    expect(normalizarNumero('abc')).toBeNull()
  })
})

describe('montarLabelVariacao', () => {
  it('combina cor e tamanho quando as duas dimensões são reais', () => {
    expect(montarLabelVariacao('Preto', 'M')).toBe('Preto M')
  })

  it('usa só a cor quando o tamanho é Único', () => {
    expect(montarLabelVariacao('Preto', 'Único')).toBe('Preto')
    expect(montarLabelVariacao('Preto', '')).toBe('Preto')
  })

  it('usa só o tamanho quando a cor é Único', () => {
    expect(montarLabelVariacao('Único', 'M')).toBe('M')
    expect(montarLabelVariacao('', 'M')).toBe('M')
  })

  it('vira Único quando as duas dimensões são Único/vazias', () => {
    expect(montarLabelVariacao('Único', 'Único')).toBe(UNICO)
    expect(montarLabelVariacao('', '')).toBe(UNICO)
  })
})

describe('agruparLinhasPlanilha', () => {
  it('agrupa múltiplas linhas do mesmo produto num só registro', () => {
    const linhas = [
      { Produto: 'Vestido Floral', Cor: 'Preto', Tamanho: 'P', Quantidade: 5, Custo: 45, Venda: 89.9 },
      { Produto: 'Vestido Floral', Cor: 'Preto', Tamanho: 'M', Quantidade: 3, Custo: 45, Venda: 89.9 },
      { Produto: '  vestido floral  ', Cor: 'Azul', Tamanho: 'M', Quantidade: 2, Custo: 45, Venda: 89.9 },
    ]
    const { produtos, erros } = agruparLinhasPlanilha(linhas)

    expect(erros).toHaveLength(0)
    expect(produtos).toHaveLength(1)
    const [p] = produtos
    expect(p.nome).toBe('Vestido Floral')
    expect(p.precoCusto).toBe(45)
    expect(p.precoVenda).toBe(89.9)
    expect(p.variacoes).toEqual([
      { cor: 'Preto P', quantidade: 5 },
      { cor: 'Preto M', quantidade: 3 },
      { cor: 'Azul M',  quantidade: 2 },
    ])
    expect(p.totalPecas).toBe(10)
  })

  it('agrupa por nome case-insensitive e com espaços nas pontas, mas produtos diferentes viram registros diferentes', () => {
    const linhas = [
      { Produto: 'Blusa Básica', Cor: 'Único', Tamanho: 'Único', Quantidade: 4, Custo: 20, Venda: 49.9 },
      { Produto: 'Calça Jeans',  Cor: 'Único', Tamanho: '38',    Quantidade: 3, Custo: 60, Venda: 129.9 },
    ]
    const { produtos } = agruparLinhasPlanilha(linhas)
    expect(produtos).toHaveLength(2)
    expect(produtos[0].nome).toBe('Blusa Básica')
    expect(produtos[0].variacoes).toEqual([{ cor: UNICO, quantidade: 4 }])
    expect(produtos[1].nome).toBe('Calça Jeans')
    expect(produtos[1].variacoes).toEqual([{ cor: '38', quantidade: 3 }])
  })

  it('coleta erro de linha com quantidade não numérica sem derrubar as outras', () => {
    const linhas = [
      { Produto: 'Body', Cor: 'Único', Tamanho: 'Único', Quantidade: 'abc', Custo: 30, Venda: 59.9 },
      { Produto: 'Body', Cor: 'Único', Tamanho: 'Único', Quantidade: 2,     Custo: 30, Venda: 59.9 },
    ]
    const { produtos, erros } = agruparLinhasPlanilha(linhas)

    expect(erros).toHaveLength(1)
    expect(erros[0]).toMatchObject({ linha: 2, motivo: expect.stringContaining('Quantidade inválida') })
    expect(produtos).toHaveLength(1)
    expect(produtos[0].variacoes).toEqual([{ cor: UNICO, quantidade: 2 }])
  })

  it('coleta erro de linha sem produto (coluna faltando) sem derrubar as outras', () => {
    const linhas = [
      { Cor: 'Preto', Tamanho: 'M', Quantidade: 5, Custo: 45, Venda: 89.9 },
      { Produto: 'Vestido Floral', Cor: 'Preto', Tamanho: 'M', Quantidade: 5, Custo: 45, Venda: 89.9 },
    ]
    const { produtos, erros } = agruparLinhasPlanilha(linhas)

    expect(erros).toHaveLength(1)
    expect(erros[0].linha).toBe(2)
    expect(produtos).toHaveLength(1)
  })

  it('registra aviso quando custo ou venda divergem entre linhas do mesmo produto, mantendo o valor da primeira', () => {
    const linhas = [
      { Produto: 'Calça Jeans', Cor: 'Único', Tamanho: '36', Quantidade: 3, Custo: 60, Venda: 129.9 },
      { Produto: 'Calça Jeans', Cor: 'Único', Tamanho: '38', Quantidade: 5, Custo: 65, Venda: 129.9 },
      { Produto: 'Calça Jeans', Cor: 'Único', Tamanho: '40', Quantidade: 2, Custo: 60, Venda: 139.9 },
    ]
    const { produtos } = agruparLinhasPlanilha(linhas)

    expect(produtos).toHaveLength(1)
    const [p] = produtos
    expect(p.precoCusto).toBe(60)
    expect(p.precoVenda).toBe(129.9)
    expect(p.avisos).toHaveLength(2)
    expect(p.avisos[0]).toContain('Custo')
    expect(p.avisos[1]).toContain('Venda')
  })
})

describe('totalizarProdutosImportados', () => {
  it('soma peças, custo e venda do lote inteiro', () => {
    const produtos = [
      { precoCusto: 10, precoVenda: 20, variacoes: [{ quantidade: 2 }, { quantidade: 3 }] },
      { precoCusto: 5,  precoVenda: 15, variacoes: [{ quantidade: 4 }] },
    ]
    const totais = totalizarProdutosImportados(produtos)
    expect(totais).toEqual({
      totalProdutos: 2,
      totalPecas: 9,
      totalCusto: 5 * 10 + 4 * 5,
      totalVenda: 5 * 20 + 4 * 15,
    })
  })
})
