import { describe, it, expect, vi } from 'vitest'
import { buscarTodasAsLinhas } from './supabasePaginacao'

/** Simula uma tabela com `total` linhas, respondendo em páginas de `tamanhoPagina`. */
function mockTabela(total, tamanhoPagina) {
  const todas = Array.from({ length: total }, (_, i) => ({ id: i }))
  const chamadas = []
  const construirPagina = vi.fn((from, to) => {
    chamadas.push([from, to])
    return Promise.resolve({ data: todas.slice(from, to + 1), error: null })
  })
  return { construirPagina, chamadas, tamanhoPagina }
}

describe('buscarTodasAsLinhas', () => {
  it('traz tudo quando a tabela tem menos linhas que o limite de uma página', async () => {
    const { construirPagina } = mockTabela(50, 1000)
    const { data, error } = await buscarTodasAsLinhas(construirPagina, 1000)
    expect(error).toBeNull()
    expect(data).toHaveLength(50)
  })

  it('pagina corretamente quando a tabela tem MAIS linhas que o limite — o bug real', async () => {
    // Reproduz exatamente o cenário de produção: tropicaleatacado tem 1115
    // linhas em lf_vendas, mais que o max-rows padrão (1000) do PostgREST.
    const { construirPagina, chamadas } = mockTabela(1115, 1000)
    const { data, error } = await buscarTodasAsLinhas(construirPagina, 1000)
    expect(error).toBeNull()
    expect(data).toHaveLength(1115)
    // 2 chamadas: [0,999] traz 1000 (bate o lote, então busca mais uma),
    // [1000,1999] traz as 115 restantes (< lote, para aqui).
    expect(chamadas).toEqual([[0, 999], [1000, 1999]])
  })

  it('pagina um volume bem maior (3595 linhas, o caso real da audazwear)', async () => {
    const { construirPagina, chamadas } = mockTabela(3595, 1000)
    const { data } = await buscarTodasAsLinhas(construirPagina, 1000)
    expect(data).toHaveLength(3595)
    expect(chamadas).toEqual([[0, 999], [1000, 1999], [2000, 2999], [3000, 3999]])
  })

  it('para exatamente na borda: total múltiplo exato do tamanho da página', async () => {
    const { construirPagina, chamadas } = mockTabela(2000, 1000)
    const { data } = await buscarTodasAsLinhas(construirPagina, 1000)
    expect(data).toHaveLength(2000)
    // 3ª chamada [2000,2999] vem vazia (0 < 1000) e encerra o loop.
    expect(chamadas).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('tabela vazia não quebra e não faz chamada além da primeira', async () => {
    const { construirPagina, chamadas } = mockTabela(0, 1000)
    const { data, error } = await buscarTodasAsLinhas(construirPagina, 1000)
    expect(error).toBeNull()
    expect(data).toEqual([])
    expect(chamadas).toHaveLength(1)
  })

  it('propaga o erro da primeira página que falhar, sem tentar mais nenhuma', async () => {
    const erro = { message: 'timeout' }
    const construirPagina = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({})), error: null })
      .mockResolvedValueOnce({ data: null, error: erro })
    const { data, error } = await buscarTodasAsLinhas(construirPagina, 1000)
    expect(error).toBe(erro)
    expect(data).toBeNull()
    expect(construirPagina).toHaveBeenCalledTimes(2)
  })

  it('respeita um tamanhoPagina diferente do default', async () => {
    const { construirPagina, chamadas } = mockTabela(250, 100)
    const { data } = await buscarTodasAsLinhas(construirPagina, 100)
    expect(data).toHaveLength(250)
    expect(chamadas).toEqual([[0, 99], [100, 199], [200, 299]])
  })
})
