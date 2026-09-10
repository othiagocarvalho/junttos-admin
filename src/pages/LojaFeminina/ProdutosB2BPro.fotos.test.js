import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { moverItem } from './ProdutosB2BPro.jsx'
import { normalizarProduto } from '../../utils/catalogoV2'

// Mesmo motivo de CatalogoPublicoV2.test.jsx: o módulo do catálogo chama
// createClient() no import e depende das env vars do Vite.
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({}) } }))

// A ordem do array `fotos` em lf_produtos É a ordem que o catálogo público
// mostra: CardProduto usa produto.fotos[0] como capa e ModalProduto percorre
// produto.fotos.map(...) na ordem crua (CatalogoPublicoV2.jsx). Por isso a
// reordenação é só isto — mexer no array. Nada muda no catálogo.

describe('moverItem', () => {
  const fotos = ['a.jpg', 'b.jpg', 'c.jpg']

  it('move uma foto para trás', () => {
    expect(moverItem(fotos, 2, 1)).toEqual(['a.jpg', 'c.jpg', 'b.jpg'])
  })

  it('move uma foto para a frente', () => {
    expect(moverItem(fotos, 0, 1)).toEqual(['b.jpg', 'a.jpg', 'c.jpg'])
  })

  it('promover a última a capa é uma sequência de passos, sem buraco no meio', () => {
    let r = fotos
    r = moverItem(r, 2, 1)
    r = moverItem(r, 1, 0)
    expect(r).toEqual(['c.jpg', 'a.jpg', 'b.jpg'])
  })

  it('não muta o array original', () => {
    const original = [...fotos]
    moverItem(fotos, 0, 2)
    expect(fotos).toEqual(original)
  })

  it('nunca perde nem duplica foto', () => {
    const r = moverItem(fotos, 0, 2)
    expect(r).toHaveLength(fotos.length)
    expect([...r].sort()).toEqual([...fotos].sort())
  })

  // As setas das pontas ficam desabilitadas na tela, mas o helper é a última
  // linha de defesa — e devolver a MESMA referência evita render à toa.
  it('índice fora da faixa é no-op e devolve a mesma referência', () => {
    expect(moverItem(fotos, 0, -1)).toBe(fotos)
    expect(moverItem(fotos, 2, 3)).toBe(fotos)
    expect(moverItem(fotos, -1, 0)).toBe(fotos)
    expect(moverItem(fotos, 9, 0)).toBe(fotos)
  })

  it('mover para o mesmo lugar é no-op', () => {
    expect(moverItem(fotos, 1, 1)).toBe(fotos)
  })

  it('lista vazia, de um item ou inválida não quebra', () => {
    expect(moverItem([], 0, 1)).toEqual([])
    expect(moverItem(['só.jpg'], 0, 1)).toEqual(['só.jpg'])
    expect(moverItem(null, 0, 1)).toEqual([])
    expect(moverItem(undefined, 0, 1)).toEqual([])
  })

  it('serve para qualquer lista — inclusive os arquivos ainda não enviados', () => {
    const files = [{ file: 'f1' }, { file: 'f2' }, { file: 'f3' }]
    expect(moverItem(files, 2, 0).map(f => f.file)).toEqual(['f3', 'f1', 'f2'])
  })
})

// ── O catálogo público reflete a ordem sem nenhuma mudança nele ──────────────
// normalizarProduto é o que CatalogoPublicoV2 aplica em cada linha de
// lf_produtos antes de renderizar. Se ele preserva a ordem, o catálogo
// preserva.

describe('a nova ordem chega ao catálogo público', () => {
  const linha = { id: 1, nome: 'Vestido', preco_venda: 90, fotos: ['a.jpg', 'b.jpg', 'c.jpg'] }

  it('normalizarProduto preserva a ordem do array', () => {
    expect(normalizarProduto(linha).fotos).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('reordenar no painel troca a CAPA que o card mostra (fotos[0])', () => {
    const salvo = { ...linha, fotos: moverItem(linha.fotos, 2, 0) }
    expect(normalizarProduto(salvo).fotos[0]).toBe('c.jpg')
  })

  it('a galeria do modal segue a mesma ordem nova', () => {
    const salvo = { ...linha, fotos: moverItem(linha.fotos, 2, 0) }
    expect(normalizarProduto(salvo).fotos).toEqual(['c.jpg', 'a.jpg', 'b.jpg'])
  })

  it('o filtro de vazios do normalizarProduto não embaralha o resto', () => {
    const comBuraco = { ...linha, fotos: ['a.jpg', null, 'c.jpg', ''] }
    expect(normalizarProduto(comBuraco).fotos).toEqual(['a.jpg', 'c.jpg'])
  })
})

// ── Prova no HTML de verdade ────────────────────────────────────────────────
// Renderiza o CardProduto do catálogo público (o mesmo componente que a
// cliente vê) e confere qual <img> saiu. É a evidência de que reordenar no
// painel muda a vitrine sem tocar em CatalogoPublicoV2.

describe('CardProduto renderizado — a capa muda de verdade', () => {
  const A = 'https://cdn/a.jpg', B = 'https://cdn/b.jpg'

  async function htmlDoCard(fotos) {
    const { CardProduto } = await import('../catalogo/CatalogoPublicoV2')
    const produto = normalizarProduto({
      id: 1, nome: 'Camisa', preco_venda: 120, fotos,
      variacoes: [{ tamanho: 'M', quantidade: 3 }],
    })
    return renderToStaticMarkup(createElement(CardProduto, {
      produto, modoAtacado: true, noPedido: 0, aoAbrir: () => {}, prioridade: false,
    }))
  }

  it('antes de reordenar, o card mostra a primeira foto', async () => {
    const html = await htmlDoCard([A, B])
    expect(html).toContain(A)
    expect(html).not.toContain(`src="${B}"`)
  })

  it('depois de mover a 2ª para a frente, o card mostra a OUTRA foto', async () => {
    const html = await htmlDoCard(moverItem([A, B], 1, 0))
    expect(html).toContain(B)
    expect(html).not.toContain(`src="${A}"`)
  })
})
