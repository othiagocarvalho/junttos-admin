import { describe, it, expect } from 'vitest'
import { detectarItensEsgotados } from './catalogo.js'

const mkProd = (id, variacoes) => ({ id, variacoes })
const mkItem = (produtoId, variacao, qtd) => ({
  key: `${produtoId}_${variacao}`,
  produtoId,
  variacao,
  qtd,
})

describe('detectarItensEsgotados', () => {
  it('retorna vazio quando carrinho está vazio', () => {
    expect(detectarItensEsgotados([], [])).toEqual([])
  })

  it('retorna vazio quando todos os itens têm estoque suficiente', () => {
    const carrinho = [mkItem('p1', 'M', 2), mkItem('p2', 'G', 1)]
    const freshProds = [
      mkProd('p1', [{ tamanho: 'M', quantidade: 5 }]),
      mkProd('p2', [{ tamanho: 'G', quantidade: 3 }]),
    ]
    expect(detectarItensEsgotados(carrinho, freshProds)).toEqual([])
  })

  it('detecta item com estoque zerado', () => {
    const carrinho = [mkItem('p1', 'P', 1)]
    const freshProds = [mkProd('p1', [{ tamanho: 'P', quantidade: 0 }])]
    expect(detectarItensEsgotados(carrinho, freshProds)).toEqual(['p1_P'])
  })

  it('detecta item quando qtd pedida supera estoque', () => {
    const carrinho = [mkItem('p1', 'GG', 5)]
    const freshProds = [mkProd('p1', [{ tamanho: 'GG', quantidade: 3 }])]
    expect(detectarItensEsgotados(carrinho, freshProds)).toEqual(['p1_GG'])
  })

  it('detecta item com quantidade null no banco (tratado como 0)', () => {
    const carrinho = [mkItem('p1', 'XG', 1)]
    const freshProds = [mkProd('p1', [{ tamanho: 'XG', quantidade: null }])]
    expect(detectarItensEsgotados(carrinho, freshProds)).toEqual(['p1_XG'])
  })

  it('detecta apenas itens esgotados em carrinho misto', () => {
    const carrinho = [mkItem('p1', 'M', 2), mkItem('p1', 'G', 1), mkItem('p2', 'P', 3)]
    const freshProds = [
      mkProd('p1', [{ tamanho: 'M', quantidade: 10 }, { tamanho: 'G', quantidade: 0 }]),
      mkProd('p2', [{ tamanho: 'P', quantidade: 5 }]),
    ]
    expect(detectarItensEsgotados(carrinho, freshProds)).toEqual(['p1_G'])
  })

  it('detecta item cujo produto sumiu do banco', () => {
    const carrinho = [mkItem('p99', 'M', 1)]
    expect(detectarItensEsgotados(carrinho, [])).toEqual(['p99_M'])
  })

  it('detecta item cujo tamanho sumiu do produto no banco', () => {
    const carrinho = [mkItem('p1', 'PP', 1)]
    const freshProds = [mkProd('p1', [{ tamanho: 'M', quantidade: 5 }])]
    expect(detectarItensEsgotados(carrinho, freshProds)).toEqual(['p1_PP'])
  })

  it('ignora itens sem variação (produtos sem tamanho)', () => {
    const carrinho = [{ key: 'p1_', produtoId: 'p1', variacao: '', qtd: 1 }]
    const freshProds = [mkProd('p1', [])]
    expect(detectarItensEsgotados(carrinho, freshProds)).toEqual([])
  })

  it('aceita estoque exatamente igual à quantidade pedida (não é esgotado)', () => {
    const carrinho = [mkItem('p1', 'M', 3)]
    const freshProds = [mkProd('p1', [{ tamanho: 'M', quantidade: 3 }])]
    expect(detectarItensEsgotados(carrinho, freshProds)).toEqual([])
  })
})
