import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// POR QUE ESTE TESTE EXISTE
//
// Bug de produção: excluir pedido mostrava "r is not a function" e não excluía
// nada. A função excluirPedido estava certa — e tinha testes, que passavam. O
// problema é que ela NUNCA ERA ALCANÇADA: ClientDashboardDesktop montava
// PedidosCatalogo sem passar a prop, então `excluirPedido` chegava undefined e
// chamá-la estourava (minificado, "excluirPedido" vira "r").
//
// Testar a função não pega isso. O que pega é conferir a FIAÇÃO: todo lugar
// que monta o componente precisa passar as props de ação. Como os pontos de
// montagem estão espalhados por três arquivos e um deles é JSX numa linha só,
// a varredura é na fonte.
// ─────────────────────────────────────────────────────────────────────────────

const RAIZ = new URL('../..', import.meta.url).pathname

function arquivosJsx(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivosJsx(caminho, acc)
    else if (/\.jsx?$/.test(nome) && !/\.test\./.test(nome)) acc.push(caminho)
  }
  return acc
}

/** Recorta cada `<PedidosCatalogo ... />` da fonte, com atributos. */
function montagens() {
  const achados = []
  for (const arq of arquivosJsx(RAIZ)) {
    const fonte = readFileSync(arq, 'utf8')
    let i = fonte.indexOf('<PedidosCatalogo')
    while (i !== -1) {
      const fim = fonte.indexOf('/>', i)
      achados.push({ arquivo: arq.replace(RAIZ, ''), trecho: fonte.slice(i, fim + 2) })
      i = fonte.indexOf('<PedidosCatalogo', i + 1)
    }
  }
  return achados
}

// Props de AÇÃO: sem elas a tela renderiza bonitinho e explode no clique, que
// é o pior modo de falha possível.
const OBRIGATORIAS = ['pedidos', 'updatePedido', 'cancelarPedido', 'excluirPedido', 'theme', 'lojaId']

describe('PedidosCatalogo — fiação dos pontos de montagem', () => {
  const todas = montagens()

  it('encontra os pontos de montagem (se não achar, o teste não vale nada)', () => {
    // Trava contra o próprio teste virar decoração: se a varredura parar de
    // achar as montagens, ele passaria de graça para sempre.
    expect(todas.length).toBeGreaterThanOrEqual(5)
  })

  it.each(OBRIGATORIAS)('toda montagem passa a prop "%s"', prop => {
    const faltando = todas.filter(m => !new RegExp(`\\b${prop}=`).test(m.trecho))
    expect(faltando.map(f => f.arquivo), `prop "${prop}" ausente`).toEqual([])
  })

  it('nenhuma montagem passa excluirPedido vazio ou nulo', () => {
    const ruins = todas.filter(m => /excluirPedido=\{(undefined|null|''|"")\}/.test(m.trecho))
    expect(ruins.map(r => r.arquivo)).toEqual([])
  })
})

describe('PedidosCatalogo — prop de ação ausente não pode virar TypeError', () => {
  const fonte = readFileSync(new URL('./PedidosCatalogo.jsx', import.meta.url), 'utf8')

  it('confere que excluirPedido é função antes de chamar', () => {
    // Segunda camada: mesmo que uma montagem nova esqueça a prop, a pessoa lê
    // uma frase em vez de "r is not a function".
    expect(fonte).toContain("typeof excluirPedido !== 'function'")
    const guarda = fonte.indexOf("typeof excluirPedido !== 'function'")
    const chamada = fonte.indexOf('await excluirPedido(')
    expect(guarda).toBeGreaterThan(-1)
    expect(guarda).toBeLessThan(chamada)
  })

  it('confere o mesmo para updatePedido', () => {
    expect(fonte).toContain("typeof updatePedido !== 'function'")
  })
})
