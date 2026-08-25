import { describe, it, expect } from 'vitest'
import {
  cssTermica, documentoFileira, documentosParaQz, configQz, alturaMaxBarrasMm,
  ETQ_PAD_X_MM, ETQ_PAD_TOP_MM, ETQ_PAD_BOTTOM_MM, ETQ_TEXTO_MM,
  DENSIDADE_DPI, DENSIDADE_DPMM, deslocamentoCss,
} from './etiquetasHtml'

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

  // ─── Densidade ────────────────────────────────────────────────────────────
  // O caminho direto manda HTML RASTERIZADO (type 'pixel'): a densidade decide
  // quantos pontos o QZ desenha para os mesmos milímetros. Com o padrão
  // (density: 0 = "pergunte ao driver"), driver que não responde deixa o QZ
  // escolher sozinho — a última brecha de escala deste caminho.

  it('a densidade vai em pontos por MILÍMETRO, não em DPI', () => {
    // Armadilha conferida na fonte do qz-tray 2.2.6 (qz-tray.js:1580): a
    // densidade segue o `units` do config, e o nosso é 'mm'. `density: 203`
    // não diria "203 DPI" — diria 203 pontos por milímetro, 25× a cabeça real.
    const c = configQz({ papelMm: 100, alturaMm: 25 })
    expect(c.units).toBe('mm')
    expect(c.density).toBe(DENSIDADE_DPMM)
    expect(c.density).not.toBe(DENSIDADE_DPI)
    expect(c.density).toBeLessThan(10)
  })

  it('a conversão bate com os 203dpi da cabeça da L42PRO', () => {
    expect(DENSIDADE_DPI).toBe(203)
    expect(Math.round(DENSIDADE_DPMM * 25.4)).toBe(DENSIDADE_DPI)
  })
})

// ─── Contenção vertical ─────────────────────────────────────────────────────
// Bug real (25/08/2026): UMA etiqueta pedia DUAS folhas ao Chrome. A causa era
// a página declarada (30mm) ser mais alta que a etiqueta física (25mm), mas a
// mesma segunda folha aparece se o CONTEÚDO passar da caixa — e o conteúdo tem
// como passar sozinho: o SVG do JsBarcode tem viewBox, então "height: auto"
// escala pela proporção do código, e código mais curto é SVG mais alto.

describe('alturaMaxBarrasMm — o teto que impede o conteúdo de mandar na página', () => {
  it('é o que sobra da etiqueta depois dos respiros e do texto', () => {
    // 25 − 1 (topo) − 6,1 (nome + variação, medidos no Chrome) − 3 (baixo)
    expect(alturaMaxBarrasMm(25)).toBe(14.9)
    expect(alturaMaxBarrasMm(30)).toBe(19.9)
  })

  it('as quatro parcelas fecham a altura da célula — a margem é estrutural', () => {
    // É o invariante que dá a garantia: se cap + texto + respiros somam a
    // altura inteira, então MESMO com o código no tamanho máximo a base dele
    // fica a ETQ_PAD_BOTTOM_MM do picote. A margem deixa de depender da sobra
    // que o "justify-content: center" porventura deixar.
    for (const h of [20, 25, 30, 40]) {
      const soma = alturaMaxBarrasMm(h) + ETQ_TEXTO_MM + ETQ_PAD_TOP_MM + ETQ_PAD_BOTTOM_MM
      expect(+soma.toFixed(2)).toBe(h)
    }
  })

  it('sempre sobra menos do que a etiqueta inteira — senão não é teto', () => {
    for (const h of [15, 20, 25, 30, 40]) expect(alturaMaxBarrasMm(h)).toBeLessThan(h)
  })

  it('etiqueta baixa demais espreme a barra, não faz ela sumir', () => {
    // Altura negativa apagaria o código de barras em silêncio, que é o pior
    // desfecho: a etiqueta sai bonita e simplesmente não bipa.
    expect(alturaMaxBarrasMm(8)).toBe(4)
    expect(alturaMaxBarrasMm(1)).toBeGreaterThan(0)
  })
})

// ─── Respiro até o picote ───────────────────────────────────────────────────
// Relato do papel impresso: código de barras encostando na linha de corte de
// baixo, e conteúdo puxado para a esquerda dentro da célula. Barra cortada não
// é defeito estético — o leitor recusa a leitura e a peça cai na busca manual.

describe('respiro dentro da célula', () => {
  it('reserva embaixo pelo menos os 2mm de segurança pedidos', () => {
    expect(ETQ_PAD_BOTTOM_MM).toBeGreaterThanOrEqual(2)
  })

  it('reserva MAIS embaixo do que em cima — é o que absorve o deslocamento', () => {
    // A térmica começa a imprimir alguns décimos depois do sensor de picote e
    // o conteúdo inteiro desce. Simetria aqui devolveria o problema.
    expect(ETQ_PAD_BOTTOM_MM).toBeGreaterThan(ETQ_PAD_TOP_MM)
  })

  it('o respiro lateral afasta a barra do picote vertical', () => {
    // Era 1mm, que é menos que a tolerância de posicionamento do rolo.
    expect(ETQ_PAD_X_MM).toBeGreaterThanOrEqual(2)
  })
})

describe('cssTermica — a etiqueta contém o próprio conteúdo', () => {
  const css = cssTermica({ larguraMm: 33, alturaMm: 25, papelMm: 33, colunas: 1, gapMm: 0.5 })

  it('centraliza as caixas, não só o texto dentro delas', () => {
    // Só "text-align: center" não centraliza nada visível: as caixas nascem
    // esticadas na largura inteira (align-items: stretch é o padrão), então o
    // texto já ocupava a largura toda e "centrar" não movia nada.
    const item = css.slice(css.indexOf('.etq-item {'), css.indexOf('.etq-nome'))
    expect(item).toContain('align-items: center')
    expect(item).toContain('text-align: center')
  })

  it('o respiro vem das constantes, e é assimétrico', () => {
    expect(css).toContain(
      'padding: ' + ETQ_PAD_TOP_MM + 'mm ' + ETQ_PAD_X_MM + 'mm ' + ETQ_PAD_BOTTOM_MM + 'mm'
    )
  })

  it('nome e variação podem encolher, mas nunca passar da célula', () => {
    // "max-width: 100%" é o par obrigatório do align-items: center — sem ele a
    // caixa encolhida cresce até o texto inteiro (nowrap) e o ellipsis nunca
    // chega a agir.
    const nome = css.slice(css.indexOf('.etq-nome {'), css.indexOf('.etq-var'))
    const varia = css.slice(css.indexOf('.etq-var {'), css.indexOf('.etq-svg'))
    expect(nome).toContain('max-width: 100%')
    expect(varia).toContain('max-width: 100%')
  })

  it('o código de barras é a única caixa que NÃO encolhe', () => {
    // A largura útil inteira é o que mantém a barra estreita acima do piso de
    // leitura de ~0,19mm (ver o cálculo em utils/codigoBarras.js).
    const svg = css.slice(css.indexOf('.etq-svg {'))
    expect(svg).toContain('align-self: stretch')
    expect(svg).toContain('width: 100%')
  })

  it('a etiqueta recorta o que passar dela', () => {
    // Sem isto o excesso vaza para a etiqueta de baixo e estica a fileira além
    // da página — é assim que uma etiqueta vira duas.
    expect(css).toMatch(/\.etq-item \{[\s\S]*?overflow: hidden;[\s\S]*?\}/)
  })

  it('o código de barras tem teto, derivado da altura da etiqueta', () => {
    expect(css).toContain('max-height: ' + alturaMaxBarrasMm(25) + 'mm')
  })

  it('a linha da variação é de uma linha só, como o nome', () => {
    // "Rosa Bebê Estampado · R$ 1.234,56" quebrava em duas e comia a altura
    // reservada ao código.
    const bloco = css.slice(css.indexOf('.etq-var'), css.indexOf('.etq-svg'))
    expect(bloco).toContain('white-space: nowrap')
    expect(bloco).toContain('text-overflow: ellipsis')
  })
})

// ─── Compensação de registro da impressora ──────────────────────────────────
// A geometria do documento já foi provada correta medindo o PDF de impressão
// (fileira a 100,2% do nominal, colunas em 0/33,5/67mm sem deriva). O que
// sobra é onde a cabeça começa a pintar em relação ao picote físico — e isso
// nenhum CSS descobre. Estas constantes são o parafuso de regulagem.

describe('deslocamentoCss — o parafuso de registro', () => {
  it('sem deslocamento não emite NADA', () => {
    // É a garantia de que o padrão (0) produz o CSS byte a byte igual ao de
    // antes desta função existir. Sem regressão possível por acidente.
    expect(deslocamentoCss(0, 0)).toBe('')
    expect(deslocamentoCss()).toBe('')
  })

  it('usa posicionamento relativo — a caixa de layout não se move', () => {
    // Margem empurraria a caixa e poderia paginar; transform é monolítico para
    // o fragmentador. Paginação é a cicatriz desta família de bug (uma
    // etiqueta virando duas folhas), então o que se move é só a pintura.
    expect(deslocamentoCss(2, 0)).toContain('position: relative')
    expect(deslocamentoCss(2, 0)).not.toContain('margin')
    expect(deslocamentoCss(2, 0)).not.toContain('transform')
  })

  it('x vai para "left" e y para "top", em mm', () => {
    expect(deslocamentoCss(2, 0)).toContain('left: 2mm')
    expect(deslocamentoCss(2, 0)).toContain('top: 0mm')
    expect(deslocamentoCss(0, 1.5)).toContain('top: 1.5mm')
  })

  it('aceita negativo — o desvio pode ser para qualquer lado', () => {
    expect(deslocamentoCss(-1.5, 0)).toContain('left: -1.5mm')
  })

  it('um eixo só já basta para emitir a regra', () => {
    expect(deslocamentoCss(0, 1)).not.toBe('')
    expect(deslocamentoCss(1, 0)).not.toBe('')
  })
})

describe('cssTermica — o deslocamento chega nos dois caminhos', () => {
  const MED = { larguraMm: 33, alturaMm: 25, papelMm: 100, colunas: 3, gapMm: 0.5 }

  it('sem offset, o CSS é IDÊNTICO ao de antes da compensação existir', () => {
    expect(cssTermica({ ...MED, offsetXMm: 0, offsetYMm: 0 })).toBe(cssTermica(MED))
  })

  it('com offset, a fileira inteira é deslocada — e só ela', () => {
    const css = cssTermica({ ...MED, offsetXMm: 2, offsetYMm: -1 })
    const fileira = css.slice(css.indexOf('.etq-fileira {'), css.indexOf('.etq-item {'))
    expect(fileira).toContain('left: 2mm')
    expect(fileira).toContain('top: -1mm')
    // A célula não se mexe: o deslocamento é do conjunto, não de cada etiqueta.
    const item = css.slice(css.indexOf('.etq-item {'), css.indexOf('.etq-nome'))
    expect(item).not.toContain('position: relative')
  })

  it('o deslocamento não vira linha em branco no meio da regra', () => {
    expect(cssTermica(MED)).not.toMatch(/\n\s*\n/)
  })

  it('nada mais muda com o offset ligado', () => {
    const semOff = cssTermica(MED)
    const comOff = cssTermica({ ...MED, offsetXMm: 2 })
    // A única diferença é a linha nova.
    const diff = comOff.split('\n').filter(l => !semOff.split('\n').includes(l))
    expect(diff).toEqual(['  position: relative; left: 2mm; top: 0mm;'])
  })
})
