import { describe, it, expect } from 'vitest'
import {
  derivarCategoria, pluralizar, construirCategorias, filtrarPorCategoria,
  CHAVE_TODOS, CHAVE_OUTROS,
} from './categoriaProduto'

describe('pluralizar', () => {
  it('palavra já no plural fica como está', () => {
    expect(pluralizar('Shorts')).toBe('Shorts')
    expect(pluralizar('Saias')).toBe('Saias')
  })
  it('terminação -ão vira -ões (o ingênuo dava "Macacãos")', () => {
    expect(pluralizar('Macacão')).toBe('Macacões')
    expect(pluralizar('Cordão')).toBe('Cordões')
  })
  it('terminação -m vira -ns', () => {
    expect(pluralizar('Batom')).toBe('Batons')
  })
  it('terminação -l vira -is', () => {
    expect(pluralizar('Anel')).toBe('Aneis')
  })
  it('terminação -r/-z ganha -es', () => {
    expect(pluralizar('Colar')).toBe('Colares')
    expect(pluralizar('Nariz')).toBe('Narizes')
  })
  it('caso comum ganha -s', () => {
    expect(pluralizar('Vestido')).toBe('Vestidos')
  })
})

describe('derivarCategoria', () => {
  it('usa a primeira palavra significativa', () => {
    expect(derivarCategoria('Vestido Floral').label).toBe('Vestidos')
    expect(derivarCategoria('Conjunto alfaiataria longo').label).toBe('Conjuntos')
  })
  it('ignora sigla de conjunto e vai para a próxima palavra', () => {
    expect(derivarCategoria('CJ. Vestido rosa').label).toBe('Vestidos')
    expect(derivarCategoria('CJ Blusa canelada').label).toBe('Blusas')
    expect(derivarCategoria('KIT Short academia').label).toBe('Shorts')
  })
  it('ignora número solto no começo', () => {
    expect(derivarCategoria('2 Blusas listradas').label).toBe('Blusas')
  })
  it('ignora token de 3 letras ou menos', () => {
    expect(derivarCategoria('New Vestido curto').label).toBe('Vestidos')
  })
  it('ignora palavra abreviada com ponto', () => {
    expect(derivarCategoria('Cjt. Saia jeans').label).toBe('Saias')
  })
  it('caixa alta e acento não criam categorias diferentes', () => {
    expect(derivarCategoria('VESTIDO CANELADO').chave).toBe(derivarCategoria('Vestido floral').chave)
    expect(derivarCategoria('Saída de praia').chave).toBe(derivarCategoria('SAIDA de praia').chave)
  })
  it('mantém o acento no rótulo exibido', () => {
    expect(derivarCategoria('Saída de praia').label).toBe('Saídas')
    expect(derivarCategoria('Calça jeans').label).toBe('Calças')
  })
  it('prefixo de marcação com separador é ignorado (caso real da mercadodemo)', () => {
    // 18 dos 25 produtos da loja começam com "Demo - " e viravam "Demos"
    expect(derivarCategoria('Demo - Açúcar Refinado 1kg').label).toBe('Açúcares')
    expect(derivarCategoria('Demo - Leite 4 Dias 1L').label).toBe('Leites')
    expect(derivarCategoria('PROMO: Vestido curto').label).toBe('Vestidos')
    expect(derivarCategoria('NOVO | Blusa lisa').label).toBe('Blusas')
  })

  it('hífen no meio do nome não é confundido com prefixo', () => {
    expect(derivarCategoria('Vestido tomara-que-caia').label).toBe('Vestidos')
    expect(derivarCategoria('Saída de praia - conjunto').label).toBe('Saídas')
  })

  it('nome vazio devolve null', () => {
    expect(derivarCategoria('')).toBeNull()
    expect(derivarCategoria(null)).toBeNull()
  })
  it('nome só de sigla ainda devolve algo, sem quebrar', () => {
    expect(derivarCategoria('CJ')).not.toBeNull()
  })
})

describe('construirCategorias', () => {
  const nomes = [
    'Vestido floral', 'Vestido longo', 'Vestido curto',
    'Blusa canelada', 'Blusa de senhora',
    'Anel dourado',              // categoria de 1 → Outros
    'Bolsa de couro',            // categoria de 1 → Outros
  ]

  it('agrupa e ordena por quantidade, com Todos primeiro e Outros por último', () => {
    const { categorias } = construirCategorias(nomes, { minProdutos: 0 })
    expect(categorias[0].chave).toBe(CHAVE_TODOS)
    expect(categorias[1].label).toBe('Vestidos')
    expect(categorias[1].total).toBe(3)
    expect(categorias[2].label).toBe('Blusas')
    expect(categorias.at(-1).chave).toBe(CHAVE_OUTROS)
    expect(categorias.at(-1).total).toBe(2)
  })

  it('"Todos" conta a lista inteira', () => {
    const { categorias } = construirCategorias(nomes, { minProdutos: 0 })
    expect(categorias[0].total).toBe(nomes.length)
  })

  it('categoria de 1 produto não vira chip próprio', () => {
    const { categorias } = construirCategorias(nomes, { minProdutos: 0 })
    expect(categorias.some(c => c.label === 'Aneis')).toBe(false)
  })

  it('não exibe a faixa em loja pequena — evita "Todos / Vestidos / Outros"', () => {
    expect(construirCategorias(nomes).exibir).toBe(false)
  })

  it('exibe a faixa quando há volume e variedade', () => {
    const muitos = [
      ...Array.from({ length: 8 }, (_, i) => `Vestido ${i}`),
      ...Array.from({ length: 6 }, (_, i) => `Blusa ${i}`),
    ]
    expect(construirCategorias(muitos).exibir).toBe(true)
  })

  it('lista vazia não quebra', () => {
    const r = construirCategorias([])
    expect(r.exibir).toBe(false)
    expect(r.categorias[0].chave).toBe(CHAVE_TODOS)
  })
})

describe('filtrarPorCategoria', () => {
  const nomes = ['Vestido floral', 'Vestido longo', 'Blusa canelada', 'Blusa lisa', 'Anel dourado']
  const { mapa } = construirCategorias(nomes, { minProdutos: 0 })

  it('Todos devolve a lista inteira', () => {
    expect(filtrarPorCategoria(nomes, CHAVE_TODOS, mapa)).toHaveLength(5)
  })
  it('filtra pela categoria escolhida', () => {
    const r = filtrarPorCategoria(nomes, 'vestidos', mapa)
    expect(r).toEqual(['Vestido floral', 'Vestido longo'])
  })
  it('Outros junta as categorias raras', () => {
    expect(filtrarPorCategoria(nomes, CHAVE_OUTROS, mapa)).toEqual(['Anel dourado'])
  })
  it('chave nula devolve tudo', () => {
    expect(filtrarPorCategoria(nomes, null, mapa)).toHaveLength(5)
  })
})
