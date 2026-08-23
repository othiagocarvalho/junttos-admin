import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// useLojaData é um hook com React e Supabase — não dá para montar em vitest
// (environment 'node', sem jsdom nem rede). O que dá para travar, e é o que
// mais importa aqui, é a ORDEM das operações dentro de excluirPedido: ela é a
// diferença entre devolver o estoque e abrir furo.
//
// A regra de negócio em si (quando devolver) está testada de verdade em
// utils/estoqueMov.test.js, via precisaDevolverEstoque.

const fonte = readFileSync(new URL('./useLojaData.js', import.meta.url), 'utf8')
const corpo = (() => {
  const ini = fonte.indexOf('async function excluirPedido(id)')
  expect(ini).toBeGreaterThan(-1)          // se sumiu, o teste falha em vez de mentir
  const fim = fonte.indexOf('\n  }', fonte.indexOf('return true', ini))
  return fonte.slice(ini, fim)
})()

const pos = t => {
  const i = corpo.indexOf(t)
  expect(i, `trecho ausente em excluirPedido: ${t}`).toBeGreaterThan(-1)
  return i
}

describe('excluirPedido — a ordem que impede o furo de estoque', () => {
  it('lê o pedido ANTES de apagar', () => {
    // Depois do DELETE não há de onde tirar os itens nem o status.
    expect(pos("select('status, produtos')")).toBeLessThan(pos('.delete({ count:'))
  })

  it('devolve o estoque ANTES do DELETE', () => {
    expect(pos("modo:       'restauro'")).toBeLessThan(pos('.delete({ count:'))
  })

  it('aborta antes do DELETE quando a devolução falha', () => {
    // O throw das falhas precisa vir ANTES do delete, senão o pedido some com
    // a peça não devolvida — que é exatamente o defeito corrigido.
    expect(pos('falhas.length > 0')).toBeLessThan(pos('.delete({ count:'))
    expect(corpo).toContain('O pedido NÃO foi excluído')
  })

  it('só devolve quando a regra manda — nada de devolver em pedido cancelado', () => {
    expect(corpo).toContain('precisaDevolverEstoque(pedido.status)')
    expect(pos('precisaDevolverEstoque(pedido.status)')).toBeLessThan(pos("modo:       'restauro'"))
  })

  it('reaproveita aplicarEstoque — sem lógica paralela de devolução', () => {
    // Um caminho só para mexer em estoque. Duplicar a lógica é como as duas
    // pontas divergem com o tempo.
    expect(corpo).toContain('await aplicarEstoque(')
    expect(corpo).not.toMatch(/restaurarVariacoes|decrementarVariacoes/)
  })

  it('compensa a devolução quando o DELETE falha depois dela', () => {
    // Estoque devolvido + pedido ainda vivo = estoque inflado. Refaz a baixa.
    expect(pos('falhouDelete')).toBeGreaterThan(pos('.delete({ count:'))
    expect(corpo).toContain("modo:       'baixa'")
    expect(corpo).toContain('falhouDelete && devolveu')
  })

  it('continua conferindo a contagem do DELETE', () => {
    // Trava anterior, que não pode ter se perdido: DELETE de zero linhas é
    // 204 sem erro no PostgREST.
    expect(corpo).toContain("count: 'exact'")
    expect(corpo).toContain('count === 0')
  })
})
