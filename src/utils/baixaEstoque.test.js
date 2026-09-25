import { describe, it, expect, vi } from 'vitest'
import {
  aplicarEstoqueItens, criarBuscaPorNome, resolverProduto, itensSemVariacao,
  salvarVendaComEstoque, textoAvisoEstoque, descreverFalha,
  MOTIVOS_FALHA, MOTIVOS_BLOQUEANTES,
} from './baixaEstoque'

// ── Fake do cliente Supabase ───────────────────────────────────────────────
// Implementa só o que criarBuscaPorNome usa (from/select/eq/not is/limit),
// aplicando os filtros de verdade sobre uma tabela em memória — assim o teste
// exercita a QUERY real, inclusive o filtro de ativo.
function fakeSupabase(produtos, { erro = null } = {}) {
  const chamadas = []
  const sb = {
    from(tabela) {
      const filtros = []
      let limite = Infinity
      const q = {
        select() { return q },
        eq(col, val) { filtros.push(p => p[col] === val); chamadas.push(['eq', col, val]); return q },
        not(col, op, val) {
          chamadas.push(['not', col, op, val])
          if (op === 'is') filtros.push(p => !(val === false ? p[col] === false : p[col] === val))
          return q
        },
        limit(n) { limite = n; chamadas.push(['limit', n]); return q },
        then(res, rej) {
          const r = erro
            ? { data: null, error: erro }
            : { data: produtos.filter(p => filtros.every(f => f(p))).slice(0, limite).map(p => ({ id: p.id, variacoes: p.variacoes })), error: null }
          return Promise.resolve(r).then(res, rej)
        },
      }
      chamadas.push(['from', tabela])
      return q
    },
  }
  return { sb, chamadas }
}

const LOJA = 'lojateste'
const prod = (id, nome, variacoes, extra = {}) => ({ id, loja_id: LOJA, nome, ativo: true, variacoes, ...extra })
const cores = (...pares) => pares.map(([cor, quantidade]) => ({ cor, quantidade }))

function montar(produtos, { erroBusca, erroGravacao, pendenciaQuebra } = {}) {
  const { sb, chamadas } = fakeSupabase(produtos, { erro: erroBusca })
  const gravados = []
  const pendencias = []
  const deps = {
    buscarPorNome: criarBuscaPorNome(sb, LOJA),
    gravarVariacoes: vi.fn(async (id, variacoes, ctx) => {
      if (erroGravacao) return erroGravacao
      gravados.push({ id, variacoes, ctx })
      return null
    }),
    registrarPendencia: vi.fn(async p => {
      if (pendenciaQuebra) throw new Error('rpc fora')
      pendencias.push(p)
    }),
  }
  return { deps, gravados, pendencias, chamadas }
}

const venda = (...itens) => itens.map(([nome, variacao, quantidade = 1]) => ({ nome, variacao, quantidade, obs: '' }))
const BAIXA = { modo: 'baixa', tipo: 'venda', origemTipo: 'venda', origemId: 'v1', vendaId: 'v1' }

// ── A query ────────────────────────────────────────────────────────────────
describe('criarBuscaPorNome — a query real', () => {
  it('filtra loja, nome exato, ativo IS NOT FALSE e limit(2) — sem maybeSingle', async () => {
    const { deps, chamadas } = montar([prod('a', 'SHORT', cores(['AZUL', 5]))])
    await deps.buscarPorNome('SHORT')
    expect(chamadas).toEqual([
      ['from', 'lf_produtos'], ['eq', 'loja_id', LOJA], ['eq', 'nome', 'SHORT'],
      ['not', 'ativo', 'is', false], ['limit', 2],
    ])
  })
  it('ativo null conta como ativo (igual ao resto do app)', async () => {
    const { deps } = montar([prod('a', 'SHORT', [], { ativo: null })])
    const { data } = await deps.buscarPorNome('SHORT')
    expect(data.map(p => p.id)).toEqual(['a'])
  })
})

// ── Os 4 casos pedidos ─────────────────────────────────────────────────────
describe('aplicarEstoqueItens — duplicata, inexistente, variação', () => {
  it('DUPLICATA ATIVA → falha visível com os ids, nada gravado, pendência registrada', async () => {
    const m = montar([
      prod('p1', 'SHORT LISTRADO', cores(['AZUL M', 10])),
      prod('p2', 'SHORT LISTRADO', cores(['ROSA', 0])),
    ])
    const falhas = await aplicarEstoqueItens(m.deps, venda(['SHORT LISTRADO', 'AZUL M', 2]), BAIXA)
    expect(falhas).toHaveLength(1)
    expect(falhas[0]).toMatchObject({
      nome: 'SHORT LISTRADO', variacao: 'AZUL M', quantidade: 2, motivo: 'produto_duplicado', modo: 'baixa',
      detalhe: { produto_ids: ['p1', 'p2'] },
    })
    expect(m.gravados).toEqual([])
    expect(m.pendencias).toHaveLength(1)
    expect(m.pendencias[0]).toMatchObject({
      venda_id: 'v1', produto_nome: 'SHORT LISTRADO', variacao: 'AZUL M', quantidade: 2, motivo: 'produto_duplicado',
      detalhe: { produto_ids: ['p1', 'p2'], modo: 'baixa', origem_tipo: 'venda', origem_id: 'v1' },
    })
  })

  it('DUPLICATA COM SÓ UMA ATIVA (caso Audaz) → usa a ativa normalmente, sem falha', async () => {
    const m = montar([
      prod('ativa', 'CAMISA CASH PRETA', cores(['P', 5], ['M', 3])),
      prod('inativa', 'CAMISA CASH PRETA', cores(['P', 0]), { ativo: false }),
    ])
    const falhas = await aplicarEstoqueItens(m.deps, venda(['CAMISA CASH PRETA', 'M', 1]), BAIXA)
    expect(falhas).toEqual([])
    expect(m.pendencias).toEqual([])
    expect(m.gravados).toHaveLength(1)
    expect(m.gravados[0].id).toBe('ativa')
    expect(m.gravados[0].variacoes).toEqual(cores(['P', 5], ['M', 2]))
    expect(m.gravados[0].ctx).toMatchObject({ tipo: 'venda', origemTipo: 'venda', origemId: 'v1' })
  })

  it('PRODUTO NÃO ENCONTRADO → falha visível + pendência (antes: continue mudo)', async () => {
    const m = montar([prod('x', 'OUTRO', cores(['U', 1]))])
    const falhas = await aplicarEstoqueItens(m.deps, venda(['SUMIDO', 'AZUL', 1]), BAIXA)
    expect(falhas.map(f => f.motivo)).toEqual(['produto_nao_encontrado'])
    expect(m.pendencias[0].motivo).toBe('produto_nao_encontrado')
    expect(m.gravados).toEqual([])
  })

  it('só existe INATIVO com esse nome → produto_nao_encontrado', async () => {
    const m = montar([prod('x', 'VELHO', cores(['U', 1]), { ativo: false })])
    const falhas = await aplicarEstoqueItens(m.deps, venda(['VELHO', 'U']), BAIXA)
    expect(falhas[0].motivo).toBe('produto_nao_encontrado')
  })

  it('VARIAÇÃO INEXISTENTE → falha visível; as variações válidas do mesmo produto baixam', async () => {
    const m = montar([prod('p', 'REGATA', cores(['REF 301', 10], ['REF 153', 4]))])
    const falhas = await aplicarEstoqueItens(m.deps, venda(['REGATA', 'REF 999', 1], ['REGATA', 'REF 153', 2]), BAIXA)
    expect(falhas).toHaveLength(1)
    expect(falhas[0]).toMatchObject({ variacao: 'REF 999', motivo: 'variacao_nao_encontrada', detalhe: { produto_id: 'p' } })
    expect(m.gravados[0].variacoes).toEqual(cores(['REF 301', 10], ['REF 153', 2]))
  })

  it('variação inexistente sozinha → nada gravado (antes gravava sem mudança)', async () => {
    const m = montar([prod('p', 'REGATA', cores(['REF 301', 10]))])
    await aplicarEstoqueItens(m.deps, venda(['REGATA', 'REF 999']), BAIXA)
    expect(m.gravados).toEqual([])
  })
})

// ── Demais caminhos ────────────────────────────────────────────────────────
describe('aplicarEstoqueItens — outros caminhos', () => {
  it('tudo certo → sem falhas, grava a baixa', async () => {
    const m = montar([prod('p', 'VESTIDO', cores(['AZUL', 3]))])
    expect(await aplicarEstoqueItens(m.deps, venda(['VESTIDO', 'AZUL', 2]), BAIXA)).toEqual([])
    expect(m.gravados[0].variacoes).toEqual(cores(['AZUL', 1]))
  })
  it('restauro soma de volta', async () => {
    const m = montar([prod('p', 'VESTIDO', cores(['AZUL', 3]))])
    await aplicarEstoqueItens(m.deps, venda(['VESTIDO', 'AZUL', 2]), { ...BAIXA, modo: 'restauro', tipo: 'devolucao' })
    expect(m.gravados[0].variacoes).toEqual(cores(['AZUL', 5]))
  })
  it('erro de gravação → falha erro_gravacao (bloqueante para excluir pedido)', async () => {
    const m = montar([prod('p', 'VESTIDO', cores(['AZUL', 3]))], { erroGravacao: { message: 'timeout' } })
    const falhas = await aplicarEstoqueItens(m.deps, venda(['VESTIDO', 'AZUL']), BAIXA)
    expect(falhas[0]).toMatchObject({ motivo: 'erro_gravacao', detalhe: { produto_id: 'p', erro: 'timeout' } })
    expect(MOTIVOS_BLOQUEANTES).toContain('erro_gravacao')
  })
  it('duplicata / não encontrado / variação NÃO bloqueiam excluir pedido', () => {
    for (const m of ['produto_duplicado', 'produto_nao_encontrado', 'variacao_nao_encontrada']) {
      expect(MOTIVOS_BLOQUEANTES).not.toContain(m)
    }
  })
  it('erro na busca → falha erro_busca, nada gravado', async () => {
    const m = montar([], { erroBusca: { message: 'rede' } })
    const falhas = await aplicarEstoqueItens(m.deps, venda(['VESTIDO', 'AZUL']), BAIXA)
    expect(falhas[0].motivo).toBe('erro_busca')
    expect(m.gravados).toEqual([])
  })
  it('pendência que não grava (RPC fora) não derruba nada: a falha volta mesmo assim', async () => {
    const m = montar([], { pendenciaQuebra: true })
    const falhas = await aplicarEstoqueItens(m.deps, venda(['SUMIDO', 'AZUL']), BAIXA)
    expect(falhas.map(f => f.motivo)).toEqual(['produto_nao_encontrado'])
  })
  it('item sem variação continua ignorado (comportamento de sempre)', async () => {
    const m = montar([])
    expect(await aplicarEstoqueItens(m.deps, [{ nome: 'X', quantidade: 1 }], BAIXA)).toEqual([])
    expect(m.deps.registrarPendencia).not.toHaveBeenCalled()
  })
  it('vários itens do mesmo produto: uma busca, uma gravação', async () => {
    const m = montar([prod('p', 'VESTIDO', cores(['AZUL', 5], ['ROSA', 5]))])
    await aplicarEstoqueItens(m.deps, venda(['VESTIDO', 'AZUL'], ['VESTIDO', 'ROSA', 2]), BAIXA)
    expect(m.deps.gravarVariacoes).toHaveBeenCalledTimes(1)
    expect(m.gravados[0].variacoes).toEqual(cores(['AZUL', 4], ['ROSA', 3]))
  })
})

// ── A venda continua salva ────────────────────────────────────────────────
describe('salvarVendaComEstoque — falha de estoque nunca desfaz a venda', () => {
  const VENDA = { valor: 100, produtos: venda(['SHORT LISTRADO', 'AZUL M']) }

  it('VENDA SALVA mesmo com falha de estoque: devolve a venda e as falhas', async () => {
    const m = montar([
      prod('p1', 'SHORT LISTRADO', cores(['AZUL M', 10])),
      prod('p2', 'SHORT LISTRADO', cores(['ROSA', 0])),
    ])
    const inserir = vi.fn(async () => ({ data: { id: 'venda-1' }, error: null }))
    const r = await salvarVendaComEstoque({ inserir, aplicar: (i, o) => aplicarEstoqueItens(m.deps, i, o) }, VENDA)
    expect(r.error).toBeNull()
    expect(r.venda).toEqual({ id: 'venda-1' })
    expect(r.falhasEstoque.map(f => f.motivo)).toEqual(['produto_duplicado'])
    expect(m.pendencias[0].venda_id).toBe('venda-1')
    expect(inserir).toHaveBeenCalledTimes(1)
  })
  it('produto_devolvido não vai para o insert e é restaurado antes da baixa', async () => {
    const inserir = vi.fn(async () => ({ data: { id: 'v' }, error: null }))
    const aplicar = vi.fn(async () => [])
    await salvarVendaComEstoque({ inserir, aplicar }, { ...VENDA, produto_devolvido: venda(['X', 'P']) })
    expect(inserir.mock.calls[0][0]).not.toHaveProperty('produto_devolvido')
    expect(aplicar.mock.calls.map(c => c[1].modo)).toEqual(['restauro', 'baixa'])
    expect(aplicar.mock.calls[0][1]).toMatchObject({ tipo: 'devolucao', motivo: 'Devolução em troca', vendaId: 'v' })
  })
  it('insert falhou → devolve o erro e NÃO mexe em estoque', async () => {
    const aplicar = vi.fn()
    const r = await salvarVendaComEstoque({ inserir: async () => ({ data: null, error: { code: '23505', message: 'x' } }), aplicar }, VENDA)
    expect(r.error.code).toBe('23505')
    expect(r.venda).toBeNull()
    expect(aplicar).not.toHaveBeenCalled()
  })
  it('PGRST116 (insert OK, select vazio por RLS) conta como salva', async () => {
    const aplicar = vi.fn(async () => [])
    const r = await salvarVendaComEstoque({ inserir: async () => ({ data: null, error: { code: 'PGRST116' } }), aplicar }, VENDA)
    expect(r.error).toBeNull()
    expect(aplicar).toHaveBeenCalled()
  })
  it('se o estoque explodir de forma inesperada, a venda ainda volta salva com falha', async () => {
    const r = await salvarVendaComEstoque({
      inserir: async () => ({ data: { id: 'v' }, error: null }),
      aplicar: async () => { throw new Error('bug') },
    }, VENDA)
    expect(r.error).toBeNull()
    expect(r.venda).toEqual({ id: 'v' })
    expect(r.falhasEstoque).toHaveLength(1)
  })
})

// ── Textos ─────────────────────────────────────────────────────────────────
describe('textos do aviso', () => {
  const f = (motivo, modo = 'baixa', variacao = 'AZUL M') => ({ nome: 'SHORT LISTRADO', variacao, quantidade: 1, motivo, modo, mensagem: MOTIVOS_FALHA[motivo] })
  it('venda, uma falha: frase completa com produto, variação e motivo em português', () => {
    expect(textoAvisoEstoque([f('produto_duplicado')], 'venda')).toBe(
      'Venda salva, mas o estoque de SHORT LISTRADO (AZUL M) não foi baixado: há mais de um produto ativo com esse nome. Ajuste manualmente em Estoque.')
  })
  it('troca: falha na devolução diz "não foi devolvido"', () => {
    expect(textoAvisoEstoque([f('produto_nao_encontrado', 'restauro')], 'venda')).toContain('não foi devolvido')
  })
  it('exclusão de venda', () => {
    expect(textoAvisoEstoque([f('variacao_nao_encontrada', 'restauro')], 'exclusao'))
      .toMatch(/^Venda excluída, mas o estoque de SHORT LISTRADO \(AZUL M\) não foi devolvido: essa variação não existe/)
  })
  it('várias falhas: resumo + lista', () => {
    expect(textoAvisoEstoque([f('produto_duplicado'), f('erro_gravacao')], 'venda'))
      .toBe('Venda salva, mas o estoque de 2 itens não foi atualizado. Ajuste manualmente em Estoque.')
    expect(descreverFalha(f('erro_gravacao'))).toBe('SHORT LISTRADO (AZUL M): não foi possível gravar o estoque')
  })
  it('sem falhas → texto vazio', () => {
    expect(textoAvisoEstoque([], 'venda')).toBe('')
  })
})

// ── Peças puras ────────────────────────────────────────────────────────────
describe('resolverProduto / itensSemVariacao', () => {
  it('1 / 0 / 2 linhas', () => {
    expect(resolverProduto([{ id: 'a' }])).toEqual({ produto: { id: 'a' } })
    expect(resolverProduto([]).motivo).toBe('produto_nao_encontrado')
    expect(resolverProduto(null).motivo).toBe('produto_nao_encontrado')
    expect(resolverProduto([{ id: 'a' }, { id: 'b' }])).toEqual({ motivo: 'produto_duplicado', detalhe: { produto_ids: ['a', 'b'] } })
  })
  it('rótulo ignora quantidade/custo/codigo, e compara como texto', () => {
    const vars = [{ codigo: '789', cor: 'AZUL', quantidade: 1 }, { tamanho: 38, quantidade: 1 }]
    expect(itensSemVariacao(vars, [{ variacao: 'AZUL' }, { variacao: '38' }, { variacao: 'VERDE' }]))
      .toEqual([{ variacao: 'VERDE' }])
  })
})
