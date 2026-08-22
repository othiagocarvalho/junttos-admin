import { describe, it, expect } from 'vitest'
import { cssTermica, documentoFileira, documentosParaQz, configQz } from './etiquetasHtml'

// As MESMAS constantes de EtiquetasPrint.jsx. Se elas mudarem lá e não aqui,
// o teste "as medidas do documento vêm dos parâmetros" continua valendo — o
// que ele trava é o documento não ter número solto embutido.
const MEDIDAS = { larguraMm: 40, alturaMm: 30, papelMm: 121, colunas: 3, gapMm: 0.5 }

describe('cssTermica — as medidas vêm todas de fora', () => {
  it('declara a página com o papel e a altura da fileira', () => {
    expect(cssTermica(MEDIDAS)).toContain('@page { size: 121mm 30mm; margin: 0; }')
  })

  it('a fileira tem uma coluna por etiqueta, na largura da etiqueta', () => {
    const css = cssTermica(MEDIDAS)
    expect(css).toContain('grid-template-columns: repeat(3, 40mm)')
    expect(css).toContain('gap: 0 0.5mm')
    expect(css).toContain('width: 121mm; height: 30mm')
  })

  it('a etiqueta sai no tamanho da célula do rolo', () => {
    expect(cssTermica(MEDIDAS)).toContain('width: 40mm; height: 30mm')
  })

  it('mudar a constante muda o CSS — nada está chumbado', () => {
    // É a trava de verdade: se alguém colar 40mm literal aqui dentro, este
    // teste passa a falhar quando a constante mudar lá no componente.
    const outro = cssTermica({ larguraMm: 33, alturaMm: 25, papelMm: 100, colunas: 2, gapMm: 1 })
    expect(outro).toContain('@page { size: 100mm 25mm; margin: 0; }')
    expect(outro).toContain('repeat(2, 33mm)')
    expect(outro).not.toContain('40mm')
    expect(outro).not.toContain('121mm')
  })

  it('sem borda na etiqueta — no papel ela seria tinta em volta de tudo', () => {
    expect(cssTermica(MEDIDAS)).toMatch(/border: none/)
  })

  it('as regras NÃO ficam atrás de @media print', () => {
    // O QZ Tray rasteriza a página como ela está; regra escondida atrás de
    // @media print poderia simplesmente não ser aplicada.
    expect(cssTermica(MEDIDAS)).not.toContain('@media print')
  })
})

describe('documentoFileira', () => {
  it('devolve um documento completo, com o estilo embutido', () => {
    const d = documentoFileira('<div class="etq-fileira">x</div>', MEDIDAS)
    expect(d.startsWith('<!doctype html>')).toBe(true)
    expect(d).toContain('<meta charset="utf-8">')
    expect(d).toContain('<style>')
    expect(d).toContain('@page { size: 121mm 30mm')
    expect(d).toContain('<div class="etq-fileira">x</div>')
    expect(d.trimEnd().endsWith('</html>')).toBe(true)
  })

  it('não referencia CSS externo — o QZ não enxerga o CSS da página', () => {
    const d = documentoFileira('<div>x</div>', MEDIDAS)
    expect(d).not.toContain('<link')
    expect(d).not.toContain('href=')
  })

  it('conteúdo vazio ou ausente não quebra', () => {
    expect(() => documentoFileira(null, MEDIDAS)).not.toThrow()
    expect(documentoFileira(undefined, MEDIDAS)).toContain('</html>')
  })

  it('preserva o SVG do código de barras exatamente como veio', () => {
    // O ponto do desenho: o código impresso é o mesmo nó que o JsBarcode
    // desenhou no preview, não um redesenho com outra configuração.
    const svg = '<svg class="etq-svg"><rect x="0" width="1.6" height="42"/></svg>'
    expect(documentoFileira('<div class="etq-item">' + svg + '</div>', MEDIDAS)).toContain(svg)
  })
})

describe('documentosParaQz', () => {
  it('uma fileira vira uma entrada — e uma entrada é uma página', () => {
    const docs = documentosParaQz(['<i>a</i>', '<i>b</i>', '<i>c</i>'], MEDIDAS)
    expect(docs).toHaveLength(3)
    expect(docs[0].data).toContain('<i>a</i>')
    expect(docs[2].data).toContain('<i>c</i>')
  })

  it('usa o formato que o qz.print espera', () => {
    const [d] = documentosParaQz(['<i>a</i>'], MEDIDAS)
    expect(d.type).toBe('pixel')
    expect(d.format).toBe('html')
    // 'plain' e não 'file': o HTML vai no próprio campo data.
    expect(d.flavor).toBe('plain')
  })

  it('lista vazia, nula ou com buraco não gera página fantasma', () => {
    expect(documentosParaQz([], MEDIDAS)).toEqual([])
    expect(documentosParaQz(null, MEDIDAS)).toEqual([])
    expect(documentosParaQz(['a', '', null, 'b'], MEDIDAS)).toHaveLength(2)
  })
})

describe('configQz — as três configurações que hoje são conferidas na mão', () => {
  it('escala travada: é o "Escala 100%" do diálogo do Chrome', () => {
    // Ligado (o padrão do QZ), ele redimensiona para caber na página — que é
    // exatamente o que já saiu errado quando ninguém conferiu.
    expect(configQz({ papelMm: 121, alturaMm: 30 }).scaleContent).toBe(false)
  })

  it('margem zero: é o "Margens: Nenhuma"', () => {
    expect(configQz({ papelMm: 121, alturaMm: 30 }).margins).toBe(0)
  })

  it('o tamanho da página vem das constantes, em mm', () => {
    const c = configQz({ papelMm: 121, alturaMm: 30 })
    expect(c.size).toEqual({ width: 121, height: 30 })
    expect(c.units).toBe('mm')
  })

  it('preto e branco: meio-tom em barra estreita atrapalha a leitura', () => {
    expect(configQz({ papelMm: 121, alturaMm: 30 }).colorType).toBe('blackwhite')
  })
})
