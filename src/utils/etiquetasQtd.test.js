import { describe, it, expect } from 'vitest'
import {
  MODOS, ROTULO_MODO, QTD_MAX,
  normalizarQtd, copiasDe, expandirEtiquetas, qtdsIniciais,
} from './etiquetasQtd'
import { etiquetasDoProduto } from './codigoBarras'

// Grade real da Tropicale: 3 cores, estoques diferentes de propósito, para
// distinguir o modo 'estoque' do 'personalizada'.
const PRODUTO = {
  id: '16c37d44-7df1-445d-9330-923fde6cf83a',
  nome: 'VESTIDO CURTO PATY MEL',
  preco_venda: 44.9,
  variacoes: [
    { cor: 'ROSA', quantidade: 10 },
    { cor: 'NUDE', quantidade: 3 },
    { cor: 'PRETO', quantidade: 1 },
  ],
}
const ETQ = etiquetasDoProduto(PRODUTO, 'tropicaleatacado')
const [ROSA, NUDE, PRETO] = ETQ

describe('os dois modos que já existiam não podem mudar', () => {
  it("'uma' dá exatamente uma etiqueta por variação", () => {
    expect(expandirEtiquetas(ETQ, 'uma')).toHaveLength(3)
    expect(ETQ.map(et => copiasDe(et, 'uma'))).toEqual([1, 1, 1])
  })

  it("'estoque' dá uma por peça", () => {
    expect(expandirEtiquetas(ETQ, 'estoque')).toHaveLength(14)  // 10 + 3 + 1
  })

  it("'estoque' tem piso 1 mesmo com estoque zerado ou ausente", () => {
    // Selecionar a variação e receber zero etiqueta seria surpresa silenciosa.
    expect(copiasDe({ quantidade: 0 }, 'estoque')).toBe(1)
    expect(copiasDe({}, 'estoque')).toBe(1)
  })

  it('modo desconhecido cai no comportamento padrão, não em zero', () => {
    expect(expandirEtiquetas(ETQ, 'qualquer-coisa')).toHaveLength(3)
  })

  it('nenhum modo é afetado por um mapa de quantidades sobrando', () => {
    // A trava contra vazamento de estado entre modos: mesmo que o mapa
    // sobreviva por bug, 'uma' e 'estoque' têm de ignorá-lo.
    const sujo = { [ROSA.codigo]: 99, [NUDE.codigo]: 99, [PRETO.codigo]: 99 }
    expect(expandirEtiquetas(ETQ, 'uma', sujo)).toHaveLength(3)
    expect(expandirEtiquetas(ETQ, 'estoque', sujo)).toHaveLength(14)
  })
})

describe("modo 'personalizada'", () => {
  it('começa em 1 por variação — padrão razoável, não o estoque', () => {
    const q = qtdsIniciais(ETQ, 'personalizada')
    expect(Object.values(q)).toEqual([1, 1, 1])
    expect(expandirEtiquetas(ETQ, 'personalizada', q)).toHaveLength(3)
  })

  it('o total é a soma real do que foi digitado', () => {
    const q = { [ROSA.codigo]: 5, [NUDE.codigo]: 2, [PRETO.codigo]: 12 }
    expect(expandirEtiquetas(ETQ, 'personalizada', q)).toHaveLength(19)
  })

  it('cada variação sai com a quantidade dela, não com a média', () => {
    const q = { [ROSA.codigo]: 4, [NUDE.codigo]: 0, [PRETO.codigo]: 1 }
    const saida = expandirEtiquetas(ETQ, 'personalizada', q)
    const porRotulo = saida.reduce((a, et) => ({ ...a, [et.rotulo]: (a[et.rotulo] || 0) + 1 }), {})
    expect(porRotulo).toEqual({ ROSA: 4, PRETO: 1 })
  })

  it('0 pula a variação sem tirar as outras', () => {
    const q = { [ROSA.codigo]: 0, [NUDE.codigo]: 0, [PRETO.codigo]: 3 }
    const saida = expandirEtiquetas(ETQ, 'personalizada', q)
    expect(saida).toHaveLength(3)
    expect(saida.every(et => et.rotulo === 'PRETO')).toBe(true)
  })

  it('tudo zerado dá folha vazia — quem chama decide travar o botão', () => {
    const q = Object.fromEntries(ETQ.map(et => [et.codigo, 0]))
    expect(expandirEtiquetas(ETQ, 'personalizada', q)).toHaveLength(0)
  })

  it('variação sem entrada no mapa vale 1, não 0', () => {
    // Acontece quando a seleção do Estoque muda com o modal aberto.
    expect(expandirEtiquetas(ETQ, 'personalizada', { [ROSA.codigo]: 7 })).toHaveLength(9)
  })

  it('as keys do React continuam únicas com quantidades altas', () => {
    const q = { [ROSA.codigo]: 50, [NUDE.codigo]: 50, [PRETO.codigo]: 50 }
    const saida = expandirEtiquetas(ETQ, 'personalizada', q)
    expect(new Set(saida.map(et => et._k)).size).toBe(150)
  })
})

describe('normalizarQtd — o que o campo aceita', () => {
  it('inteiro dentro da faixa passa', () => {
    expect(normalizarQtd(7)).toBe(7)
    expect(normalizarQtd('7')).toBe(7)
  })

  it('campo apagado vira 0, não NaN', () => {
    expect(normalizarQtd('')).toBe(0)
    expect(normalizarQtd(null)).toBe(0)
    expect(normalizarQtd(undefined)).toBe(0)
  })

  it('texto colado vira 0', () => {
    expect(normalizarQtd('abc')).toBe(0)
    expect(normalizarQtd('1e5abc')).toBe(0)
  })

  it('negativo vira 0 — não existe imprimir menos que nada', () => {
    expect(normalizarQtd(-5)).toBe(0)
    expect(normalizarQtd('-1')).toBe(0)
  })

  it('decimal trunca: meia etiqueta não existe', () => {
    expect(normalizarQtd(2.9)).toBe(2)
    expect(normalizarQtd('3.5')).toBe(3)
  })

  it('acima do teto trava no teto — freio contra dedo escorregado', () => {
    expect(normalizarQtd(10000)).toBe(QTD_MAX)
    expect(normalizarQtd(QTD_MAX)).toBe(QTD_MAX)
  })

  it('Infinity cai em 0, e não no teto', () => {
    // Escolha deliberada: entre mandar 999 etiquetas e mandar nenhuma diante
    // de um valor sem sentido, nenhuma é o erro barato. Vale para os dois
    // sinais.
    expect(normalizarQtd(Infinity)).toBe(0)
    expect(normalizarQtd(-Infinity)).toBe(0)
  })

  it('o teto vale também vindo pelo mapa, não só pelo campo', () => {
    expect(copiasDe(ROSA, 'personalizada', { [ROSA.codigo]: 99999 })).toBe(QTD_MAX)
  })
})

describe('troca de modo reseta — sem misturar estado', () => {
  it('sair de personalizada descarta o mapa inteiro', () => {
    expect(qtdsIniciais(ETQ, 'uma')).toEqual({})
    expect(qtdsIniciais(ETQ, 'estoque')).toEqual({})
  })

  it('personalizada → uma → personalizada volta em 1, não nos valores antigos', () => {
    // O cenário exato do requisito: se os 20 voltassem, a lojista imprimiria
    // uma quantidade que não pediu nesta sessão.
    let q = qtdsIniciais(ETQ, 'personalizada')
    q = { ...q, [ROSA.codigo]: 20 }
    expect(expandirEtiquetas(ETQ, 'personalizada', q)).toHaveLength(22)

    q = qtdsIniciais(ETQ, 'uma')            // troca para 1 por variação
    expect(expandirEtiquetas(ETQ, 'uma', q)).toHaveLength(3)

    q = qtdsIniciais(ETQ, 'personalizada')  // e volta
    expect(expandirEtiquetas(ETQ, 'personalizada', q)).toHaveLength(3)
  })

  it('cada modo da lista tem rótulo próprio, e são distintos', () => {
    expect(MODOS).toEqual(['uma', 'estoque', 'personalizada'])
    const rotulos = MODOS.map(m => ROTULO_MODO[m])
    expect(rotulos.every(Boolean)).toBe(true)
    expect(new Set(rotulos).size).toBe(3)
  })
})

describe('lista vazia não quebra nenhum modo', () => {
  it.each(MODOS)('%s', modo => {
    expect(expandirEtiquetas([], modo, qtdsIniciais([], modo))).toEqual([])
  })
})
