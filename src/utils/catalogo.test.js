import { describe, it, expect } from 'vitest'
import { detectarItensEsgotados, produtoVisivelNoCatalogo } from './catalogo.js'

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

describe('produtoVisivelNoCatalogo', () => {
  it('mostra produto com pelo menos uma foto', () => {
    expect(produtoVisivelNoCatalogo({ fotos: ['a.jpg'] })).toBe(true)
  })

  it('esconde produto sem foto — card vazio não vende', () => {
    expect(produtoVisivelNoCatalogo({ fotos: [] })).toBe(false)
    expect(produtoVisivelNoCatalogo({ fotos: null })).toBe(false)
    expect(produtoVisivelNoCatalogo({})).toBe(false)
    expect(produtoVisivelNoCatalogo(null)).toBe(false)
  })

  it('esconde quando fotos não é array (JSONB objeto solto)', () => {
    expect(produtoVisivelNoCatalogo({ fotos: {} })).toBe(false)
  })

  it('esconde quando o array só tem entrada vazia', () => {
    expect(produtoVisivelNoCatalogo({ fotos: [null, ''] })).toBe(false)
  })

  // ── A3: produto sem variação passou a aparecer (decisão de 20/08/2026) ──
  it('mostra produto SEM variação nenhuma, desde que tenha foto', () => {
    expect(produtoVisivelNoCatalogo({ fotos: ['a.jpg'], variacoes: [] })).toBe(true)
    expect(produtoVisivelNoCatalogo({ fotos: ['a.jpg'], variacoes: null })).toBe(true)
    expect(produtoVisivelNoCatalogo({ fotos: ['a.jpg'] })).toBe(true)
  })

  it('mostra produto com variação e estoque zerado (segue visível, não some)', () => {
    expect(produtoVisivelNoCatalogo({ fotos: ['a.jpg'], variacoes: [{ tamanho: 'M', quantidade: 0 }] })).toBe(true)
  })

  it('variação não influencia mais a decisão — só a foto decide', () => {
    expect(produtoVisivelNoCatalogo({ fotos: [], variacoes: [{ cor: 'Preto', quantidade: 4 }] })).toBe(false)
    expect(produtoVisivelNoCatalogo({ fotos: ['a.jpg'], variacoes: [] })).toBe(true)
  })

  it('os 37 publicados da tropicaleatacado passam — inclusive os 13 sem variação', () => {
    // Todos os 37 têm exatamente 1 foto; 13 deles têm variacoes = [].
    const catalogo = Array.from({ length: 37 }, (_, i) => ({
      fotos: ['foto.jpg'],
      variacoes: i < 13 ? [] : [{ cor: 'AZUL', quantidade: 2 }],
    }))
    expect(catalogo.filter(produtoVisivelNoCatalogo)).toHaveLength(37)
  })
})
