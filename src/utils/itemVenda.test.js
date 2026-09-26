import { describe, it, expect } from 'vitest'
import { ehDoProduto, mesmoItem, produtoDoItem } from './itemVenda'

describe('ehDoProduto', () => {
  it('com id dos dois lados, compara SÓ o id — nome é ignorado', () => {
    expect(ehDoProduto({ produto_id: 'a', nome: 'X' }, 'a', 'Y')).toBe(true)
    expect(ehDoProduto({ produto_id: 'a', nome: 'SHORT' }, 'b', 'SHORT')).toBe(false)
  })
  it('item antigo sem id (rascunho de antes): cai no nome', () => {
    expect(ehDoProduto({ nome: 'SHORT' }, 'a', 'SHORT')).toBe(true)
    expect(ehDoProduto({ nome: 'SHORT' }, 'a', 'OUTRO')).toBe(false)
  })
  it('sem id do produto: cai no nome', () => {
    expect(ehDoProduto({ produto_id: 'a', nome: 'SHORT' }, undefined, 'SHORT')).toBe(true)
  })
  it('item nulo nunca casa', () => {
    expect(ehDoProduto(null, 'a', 'X')).toBe(false)
  })
})

describe('mesmoItem', () => {
  it('mesmo id + mesma variação', () => {
    expect(mesmoItem({ produto_id: 'a', nome: 'X', variacao: 'M' }, { produto_id: 'a', nome: 'renomeado', variacao: 'M' })).toBe(true)
  })
  it('mesmo nome, ids diferentes → itens diferentes (o caso da duplicata)', () => {
    expect(mesmoItem({ produto_id: 'a', nome: 'SHORT', variacao: 'M' }, { produto_id: 'b', nome: 'SHORT', variacao: 'M' })).toBe(false)
  })
  it('variação diferente → itens diferentes; ausente conta como null', () => {
    expect(mesmoItem({ produto_id: 'a', variacao: 'M' }, { produto_id: 'a', variacao: 'G' })).toBe(false)
    expect(mesmoItem({ nome: 'X' }, { nome: 'X', variacao: null })).toBe(true)
  })
  it('um lado sem id: compara pelo nome', () => {
    expect(mesmoItem({ nome: 'X', variacao: 'P' }, { produto_id: 'a', nome: 'X', variacao: 'P' })).toBe(true)
  })
})

describe('produtoDoItem', () => {
  const catalogo = [{ id: 'a', nome: 'SHORT' }, { id: 'b', nome: 'SHORT' }, { id: 'c', nome: 'SAIA' }]
  it('pelo id quando o item tem — mesmo com nome repetido no catálogo', () => {
    expect(produtoDoItem(catalogo, { produto_id: 'b', nome: 'SHORT' }).id).toBe('b')
  })
  it('pelo id mesmo que o nome do item esteja desatualizado', () => {
    expect(produtoDoItem(catalogo, { produto_id: 'c', nome: 'NOME ANTIGO' }).id).toBe('c')
  })
  it('id que não está no catálogo → null (não cai no nome)', () => {
    expect(produtoDoItem(catalogo, { produto_id: 'zzz', nome: 'SAIA' })).toBeNull()
  })
  it('sem id → pelo nome, como antes', () => {
    expect(produtoDoItem(catalogo, { nome: 'SAIA' }).id).toBe('c')
    expect(produtoDoItem(null, { nome: 'SAIA' })).toBeNull()
  })
})
