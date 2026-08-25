import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'

// JsBarcode toca no DOM do SVG; no ambiente 'node' do vitest não existe. Aqui
// só interessa a CONTAGEM de etiquetas e fileiras, não o desenho das barras.
vi.mock('jsbarcode', () => ({ default: () => {} }))

const { default: EtiquetasPrint } = await import('./EtiquetasPrint')
const { etiquetasDoProduto, etiquetasDeProdutos } = await import('../../utils/codigoBarras')

const html = el => renderToStaticMarkup(el)
const contar = (s, classe) => (s.match(new RegExp(`class="${classe}"`, 'g')) || []).length

/**
 * Recorta UMA regra do <style> do componente, do seletor até a chave que a
 * fecha.
 *
 * Duas armadilhas que já fizeram teste passar de graça neste arquivo, e que
 * esta função existe para evitar:
 *
 *   1. as declarações têm "${...}" dentro, então a primeira "}" do texto não é
 *      o fim da regra. Os placeholders são apagados antes da busca;
 *   2. regra de uma linha só ("a { b: c }") não tem "\n<recuo>}" nenhum —
 *      procurar por isso atravessava a regra seguinte e trazia junto
 *      declarações que não são daquele seletor.
 */
export function regraCss(fonte, seletor) {
  const i = fonte.indexOf(seletor.trim() + ' {')
  if (i === -1) return ''
  const corpo = fonte.slice(i)
  // Filler do MESMO tamanho: o índice achado no texto mascarado precisa valer
  // no texto original, senão o recorte devolvido sai deslocado.
  const mascarado = corpo.replace(/\$\{[^}]*\}/g, m => '@'.repeat(m.length))
  const fim = mascarado.indexOf('}')
  return fim === -1 ? corpo : corpo.slice(0, fim + 1)
}

/** A DECLARAÇÃO da propriedade, não a menção dela num comentário. */
export function declara(regra, prop, valor) {
  return new RegExp(`(^|[{;])\\s*${prop}:\\s*${valor};`, 'm').test(regra)
}


// Bug real: selecionar 1 produto gerava 159 páginas de impressão, quase todas
// em branco, com o conteúdo só a partir da 157. A causa era o CSS
// (`visibility: hidden` não tira do fluxo, então a tela do Estoque atrás do
// modal continuava gerando páginas), não a contagem de etiquetas — mas o
// sintoma "número de páginas não bate com o que foi selecionado" merece trava
// automatizada nos dois lados.

const UM = {
  id: '16c37d44-7df1-445d-9330-923fde6cf83a', nome: 'VESTIDO CURTO PATY MEL', preco_venda: 44.9,
  variacoes: [{ cor: 'ROSA', quantidade: 10 }, { cor: 'NUDE', quantidade: 10 }, { cor: 'PRETO', quantidade: 10 }],
}
const DOIS = {
  id: 'a1b2c3d4-0000-0000-0000-000000000000', nome: 'CJ. SAIA MID DANIELLY', preco_venda: 33.33,
  variacoes: [{ cor: 'AZUL', quantidade: 4 }, { tamanho: 'M', quantidade: 2 }],
}
// A loja tem 37 produtos; o modal só pode conhecer os que recebeu.
const OUTROS = Array.from({ length: 35 }, (_, i) => ({
  id: `f${i}`.padEnd(36, '0'), nome: `OUTRO ${i}`, preco_venda: 10,
  variacoes: [{ cor: 'X', quantidade: 5 }],
}))

describe('EtiquetasPrint — quantidade impressa bate com a seleção', () => {
  it('1 produto selecionado → uma etiqueta por VARIAÇÃO dele, não por produto da loja', () => {
    // O coração da regressão: 3 variações → 3 etiquetas. Nunca 37 (produtos da
    // loja) nem 72 (variações de todos).
    const s = html(<EtiquetasPrint etiquetas={etiquetasDoProduto(UM, 'tropicaleatacado')} aoFechar={() => {}} theme={{}} />)
    expect(contar(s, 'etq-item')).toBe(3)
  })

  it('produtos não selecionados não vazam para a folha', () => {
    const so1 = etiquetasDoProduto(UM, 'tropicaleatacado')
    const s = html(<EtiquetasPrint etiquetas={so1} aoFechar={() => {}} theme={{}} />)
    expect(s).toContain('VESTIDO CURTO PATY MEL')
    expect(s).not.toContain('OUTRO 0')
    expect(s).not.toContain('CJ. SAIA MID DANIELLY')
    // Sanidade: a lista completa da loja teria bem mais que 3.
    expect(etiquetasDeProdutos([UM, DOIS, ...OUTROS], 'tropicaleatacado').length).toBeGreaterThan(3)
  })

  it('2 produtos selecionados → soma das variações dos dois', () => {
    const s = html(<EtiquetasPrint etiquetas={etiquetasDeProdutos([UM, DOIS], 'tropicaleatacado')} aoFechar={() => {}} theme={{}} />)
    expect(contar(s, 'etq-item')).toBe(5)   // 3 + 2
  })

  it('produto sem variação não gera etiqueta nem folha', () => {
    const s = html(<EtiquetasPrint etiquetas={[]} aoFechar={() => {}} theme={{}} />)
    expect(contar(s, 'etq-item')).toBe(0)
    expect(s).toContain('Nenhuma variação para etiquetar')
  })

  it('no modo A4 padrão não há fileiras — o grid flui e o navegador pagina', () => {
    const s = html(<EtiquetasPrint etiquetas={etiquetasDoProduto(UM, 'tropicaleatacado')} aoFechar={() => {}} theme={{}} />)
    expect(contar(s, 'etq-fileira')).toBe(0)
  })
})

describe('EtiquetasPrint — CSS de impressão não pode voltar a gerar páginas em branco', () => {
  const s = html(<EtiquetasPrint etiquetas={etiquetasDoProduto(UM, 'tropicaleatacado')} aoFechar={() => {}} theme={{}} />)

  it('esconde o resto da página com display:none, não com visibility:hidden', () => {
    // `visibility: hidden` mantém o elemento no fluxo: a tela do Estoque atrás
    // do modal continuava ocupando altura e virou 159 páginas em branco.
    expect(s).toContain('display: none !important')
    // Checa a DECLARAÇÃO, não a menção: o comentário que explica o bug cita a
    // regra antiga de propósito, e procurar pelo texto pegaria o comentário.
    expect(s).not.toContain('visibility: hidden !important')
  })

  it('preserva a cadeia de ancestrais, onde moram as variáveis de tema', () => {
    // Esconder os ancestrais junto levaria --surface/--line/--ink e a etiqueta
    // sairia sem cor nenhuma.
    expect(s).toContain(':has(.etq-overlay)')
  })

  it('zera a margem de html/body — na térmica ela empurrava para uma 2ª página', () => {
    expect(s).toMatch(/html,\s*body\s*\{[^}]*margin:\s*0\s*!important/)
  })
})

// ─── Terceiro modo: quantidade personalizada ────────────────────────────────
// A matemática dos modos vive em src/utils/etiquetasQtd.js e é testada lá (o
// ambiente 'node' não tem DOM para simular a troca de modo). Aqui ficam só as
// garantias de RENDERIZAÇÃO que o util não alcança.

describe('EtiquetasPrint — o seletor dos três modos', () => {
  const so1 = () => etiquetasDoProduto(UM, 'tropicaleatacado')

  it('oferece os três modos, e só eles', () => {
    const s = html(<EtiquetasPrint etiquetas={so1()} aoFechar={() => {}} theme={{}} />)
    expect(s).toContain('value="uma"')
    expect(s).toContain('value="estoque"')
    expect(s).toContain('value="personalizada"')
    expect(s).toContain('Quantidade personalizada')
    // Um <select> só pode ter um valor: a exclusividade é estrutural, não uma
    // regra que dá para esquecer de aplicar.
    expect(contar(s, 'etq-qtds')).toBeLessThanOrEqual(1)
  })

  it('as duas opções que já existiam continuam disponíveis', () => {
    // O controle mudou de checkbox para select; o COMPORTAMENTO não podia sumir.
    const s = html(<EtiquetasPrint etiquetas={so1()} aoFechar={() => {}} theme={{}} />)
    expect(s).toContain('1 por variação')
    expect(s).toContain('1 por peça em estoque')
  })

  it('abre no modo padrão: 1 por variação, sem painel de quantidades', () => {
    const s = html(<EtiquetasPrint etiquetas={so1()} aoFechar={() => {}} theme={{}} />)
    expect(contar(s, 'etq-item')).toBe(3)
    // `contar` casa com class="...": o nome da classe aparece sempre no
    // <style>, então procurar a string solta passaria de graça.
    expect(contar(s, 'etq-qtd-linha')).toBe(0)
    expect(contar(s, 'etq-qtds')).toBe(0)
  })

  it('o subtítulo diz qual modo está valendo', () => {
    const s = html(<EtiquetasPrint etiquetas={so1()} aoFechar={() => {}} theme={{}} />)
    expect(s).toContain('3 etiquetas · uma por variação')
  })
})

describe('EtiquetasPrint — o painel de quantidades não pode ir para o papel', () => {
  const css = html(<EtiquetasPrint etiquetas={etiquetasDoProduto(UM, 'tropicaleatacado')} aoFechar={() => {}} theme={{}} />)

  it('.etq-qtds é escondido no @media print', () => {
    // Impresso, ele empurraria as etiquetas para baixo e gastaria uma fileira
    // inteira de rolo térmico.
    const bloco = css.slice(css.indexOf('@media print'))
    expect(bloco).toMatch(/\.etq-qtds\s*{\s*display:\s*none\s*!important/)
  })

  it('o painel fica FORA da .etq-folha, que é o que a impressora enxerga', () => {
    // Se ele nascesse dentro da folha, viraria uma "etiqueta" no grid — e o
    // display:none acima não salvaria, porque o grid já teria contado a
    // célula. A ordem só aparece na fonte: em tela o painel só existe no modo
    // personalizado, que este ambiente sem DOM não consegue ativar.
    const fonte = readFileSync(new URL('./EtiquetasPrint.jsx', import.meta.url), 'utf8')
    const painel = fonte.indexOf('className="etq-qtds"')
    const folha = fonte.indexOf('className="etq-folha"')
    expect(painel).toBeGreaterThan(-1)
    expect(painel).toBeLessThan(folha)
  })
})

// ─── Preview em tela não pode cortar card na borda ──────────────────────────
// Bug real: no modo térmica, .etq-folha continuava em tela com o grid do A4
// (auto-fill de 200px), mas os filhos ali são FILEIRAS de 121mm (~457px). Oito
// fileiras num grid de quatro colunas de 200px vazavam para fora do container
// — medido em 1109px de conteúdo dentro de 880px de caixa, seis cards cortados
// e o pior 249px para fora. Com 3 etiquetas (uma fileira só) o sintoma sumia,
// que é por que parecia intermitente.

const soUM = () => etiquetasDoProduto(UM, 'tropicaleatacado')
const cssDe = props => html(<EtiquetasPrint etiquetas={soUM()} aoFechar={() => {}} theme={{}} {...props} />)
// O CSS de tela é tudo que vem ANTES do primeiro @media print de cada bloco.
const regra = (fonte, seletor) => {
  const i = fonte.indexOf(seletor + ' {')
  return i === -1 ? '' : fonte.slice(i, fonte.indexOf('}', i))
}

describe('EtiquetasPrint — preview em tela', () => {
  it('o grid do A4 quebra em linhas e não centraliza de forma insegura', () => {
    const r = regra(cssDe(), '.etq-folha')
    // auto-fill = várias linhas sozinho; nunca uma tira de rolagem lateral.
    expect(r).toContain('auto-fill')
    // "safe": com "center" puro, um card mais largo que o container transborda
    // para os dois lados e a metade esquerda fica inalcançável pela rolagem.
    expect(r).toContain('justify-content: safe center')
  })

  it('a linha do painel de quantidades pode encolher — o "+" ficava cortado', () => {
    // Item de grid nasce com min-width:auto = min-content, e o min-content
    // inclui o nome inteiro porque ele é nowrap. Medido: 322px de linha em
    // 288px de caixa, com os três botões "+" fora da borda.
    // Âncora na DECLARAÇÃO (linha própria, com ponto e vírgula), não na
    // string solta: o comentário logo acima cita "min-width: 0" e fazia este
    // teste passar mesmo com a regra removida.
    expect(regra(cssDe(), '.etq-qtd-linha')).toMatch(/^\s*min-width: 0;$/m)
  })
})

describe('EtiquetasPrint — modo térmica em tela empilha fileiras', () => {
  // Não há como trocar o formato sem DOM; o bloco térmico do <style> só é
  // emitido quando `termica` é true. Então a checagem é na fonte, no ramo
  // condicional — que é onde o bug morava.
  const fonte = readFileSync(new URL('./EtiquetasPrint.jsx', import.meta.url), 'utf8')
  // O ramo térmico vai do "${termica ? `" até o "` : `" que abre o ramo A4.
  // Recortar errado aqui é pior que não testar: as asserções passariam
  // casando com regras do bloco A4.
  const ini = fonte.indexOf('${termica ? `')
  const fim = fonte.indexOf('` : `', ini)
  const ramoTermico = fonte.slice(ini, fim)
  it('o recorte do ramo térmico é válido — senão as asserções abaixo mentem', () => {
    expect(ini).toBeGreaterThan(-1)
    expect(fim).toBeGreaterThan(ini)
    // O ramo A4 não pode ter entrado no recorte.
    expect(ramoTermico).not.toContain('Impressão A4 (padrão)')
  })

  it('a folha vira coluna de fileiras, uma por linha, como no papel', () => {
    expect(ramoTermico).toContain('flex-direction: column')
  })

  it('alinha com "safe" — senão a fileira larga corta na esquerda no celular', () => {
    expect(ramoTermico).toContain('align-items: safe center')
  })

  it('a rolagem horizontal é da folha, com padding e snap por etiqueta', () => {
    expect(ramoTermico).toContain('overflow-x: auto')
    expect(ramoTermico).toContain('scroll-snap-type: x proximity')
    // Snap na ETIQUETA, não na fileira: prender só nas pontas da fileira
    // deixaria a rolagem parar no meio de um card.
    expect(ramoTermico).toMatch(/\.etq-fileira \.etq-item \{ scroll-snap-align: start/)
  })

  it('a fileira perde o "margin: 0 auto" da regra base', () => {
    // Margem automática em flex absorve o espaço livre e ANULA o align-items,
    // inclusive o "safe" — o corte à esquerda voltaria.
    expect(ramoTermico).toMatch(/\.etq-fileira \{[^}]*margin: 0;/)
  })

  it('a impressão desfaz o container de rolagem da tela', () => {
    // overflow no papel corta conteúdo, e o padding empurraria a fileira para
    // fora do picote.
    const print = ramoTermico.slice(ramoTermico.indexOf('@media print'))
    expect(print).toMatch(/\.etq-folha \{[^}]*overflow: visible !important/)
    expect(print).toMatch(/\.etq-folha \{[^}]*padding: 0 !important/)
    expect(print).toMatch(/\.etq-folha \{[^}]*display: block !important/)
  })
})

// ─── A página declarada TEM de ser a etiqueta física ────────────────────────
// Bug real de 25/08/2026, na Tropicale: imprimir UMA etiqueta pedia DUAS
// folhas ao Chrome, mesmo com um nome de duas letras. A causa não era o
// conteúdo — era um ajuste empírico de 23/08 que subiu as medidas ~21%
// (33→40mm, 25→30mm, 100→121mm) apostando que o driver reduzia a página. Com o
// driver em 33×25mm, a fileira de 30mm sobrava 5mm e os 5mm viravam a segunda
// folha. Medido: 2 páginas antes, 1 depois.
//
// Estas travas são sobre a RELAÇÃO entre as constantes, não sobre os números
// em si: trocar o rolo continua sendo trocar um número. O que não pode voltar
// é papel e etiqueta discordando entre si.

describe('EtiquetasPrint — as medidas da térmica não podem se contradizer', () => {
  const fonte = readFileSync(new URL('./EtiquetasPrint.jsx', import.meta.url), 'utf8')
  const numero = nome => {
    const m = fonte.match(new RegExp(`const ${nome}\\s*=\\s*([\\d.]+)\\b`))
    return m ? Number(m[1]) : null
  }
  // Recorta UMA regra do <style>: do seletor até a chave que fecha na mesma
  // indentação. Regex com [\s\S]*? atravessaria a regra seguinte e passaria
  // de graça — as declarações têm "${...}" dentro, então [^}]* também não
  // serve para delimitar.
  const LARGURA = numero('LABEL_WIDTH_MM')
  const ALTURA = numero('LABEL_HEIGHT_MM')
  const COLUNAS = numero('LABEL_COLUMNS')
  const GAP = numero('LABEL_GAP_MM')

  it('a etiqueta declarada é a célula medida do rolo (33×25mm)', () => {
    // Se um dia o rolo mudar, muda aqui junto — de propósito: é a medida que
    // precisa casar com o papel configurado no driver.
    expect([LARGURA, ALTURA]).toEqual([33, 25])
  })

  it('a fileira é a do rolo da Tropicale: 3 células por página', () => {
    // Colunas e papel do driver são um par. Com colunas a mais que o papel, as
    // da direita são cortadas fora e a etiqueta some sem erro na tela.
    expect(COLUNAS).toBe(3)
  })

  it('o papel é DERIVADO das colunas, nunca digitado à mão', () => {
    // Foi exatamente um PAPER_WIDTH_MM solto (121mm para 3 × 40mm) que
    // sobreviveu ao ajuste sem ninguém refazer a conta.
    expect(fonte).toMatch(
      /const PAPER_WIDTH_MM\s*=\s*LABEL_COLUMNS \* LABEL_WIDTH_MM \+ \(LABEL_COLUMNS - 1\) \* LABEL_GAP_MM/
    )
    // A conta tem de fechar com o papel configurado no driver: 3 células de
    // 33mm com 0,5mm de picote entre elas = a fileira de 100mm.
    expect(COLUNAS * LARGURA + (COLUNAS - 1) * GAP).toBe(100)
  })

  it('a fileira nunca é mais alta que a página — é isso que gera a 2ª folha', () => {
    const ini = fonte.indexOf('${termica ? `')
    const ramo = fonte.slice(ini, fonte.indexOf('` : `', ini))
    const print = ramo.slice(ramo.indexOf('@media print'))
    // Página e fileira saem da MESMA constante de altura. Enquanto isso for
    // verdade, sobra zero para transbordar.
    expect(print).toContain('@page { size: ${PAPER_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm; margin: 0; }')
    const fileira = regraCss(print, '.etq-fileira')
    expect(fileira).toContain('height: ${LABEL_HEIGHT_MM}mm !important')
    expect(fileira).toContain('width: ${PAPER_WIDTH_MM}mm !important')
  })

  it('a etiqueta recorta o próprio conteúdo, e só na térmica', () => {
    // A outra porta para a segunda folha: conteúdo maior que a caixa empurra a
    // fileira para além da página. No A4 o card continua podendo crescer.
    expect(declara(regraCss(fonte, '.etq-fileira .etq-item'), 'overflow', 'hidden')).toBe(true)
    expect(declara(regraCss(fonte, '.etq-fileira .etq-var'), 'white-space', 'nowrap')).toBe(true)
    expect(regraCss(fonte, '.etq-fileira .etq-svg')).toContain('max-height: ${BARRAS_MAX_MM}mm')
    // E o A4 continua sem recorte: lá o card cresce com o conteúdo.
    expect(declara(regraCss(fonte, '.etq-item'), 'overflow', 'hidden')).toBe(false)
  })

  it('o teto do código de barras vem do util, não de um número colado aqui', () => {
    expect(fonte).toContain('const BARRAS_MAX_MM   = alturaMaxBarrasMm(LABEL_HEIGHT_MM)')
  })
})

// ─── Centralização e respiro até o picote ───────────────────────────────────
// Relato do papel impresso na Tropicale (25/08/2026): conteúdo puxado para a
// esquerda dentro da célula de 33mm, e código de barras encostando na linha de
// corte de baixo. Medido no Chrome com o CSS de impressão ativo, ANTES:
//
//   caixas de texto     esticadas na largura inteira (align-items: stretch)
//   respiro lateral     1mm de cada lado
//   base do código      3,28mm do picote de baixo
//
// DEPOIS: caixas encolhem e ficam centradas, 2mm de lado, 4,67mm embaixo.

describe('EtiquetasPrint — a etiqueta térmica é centrada e respeita o picote', () => {
  const fonte = readFileSync(new URL('./EtiquetasPrint.jsx', import.meta.url), 'utf8')
  const item = regraCss(fonte, '.etq-fileira .etq-item')

  it('a célula centraliza as CAIXAS, não só o texto dentro delas', () => {
    // "text-align: center" sozinho não movia nada: a caixa já ocupava a
    // largura inteira, então centralizar o texto dentro dela era um no-op.
    //
    // Checa a DECLARAÇÃO: o comentário que explica a regra cita
    // "align-items: center" no meio da frase, e um toContain() passava mesmo
    // com a declaração apagada (verificado por mutação).
    expect(declara(item, 'align-items', 'center')).toBe(true)
  })

  it('o respiro sai das constantes compartilhadas com o caminho do QZ', () => {
    // Número solto aqui faria o navegador e o QZ Tray imprimirem diferente —
    // e a etiqueta mudaria de acordo com por onde foi impressa.
    expect(item).toMatch(/^\s*padding: \$\{ETQ_PAD_TOP_MM\}mm \$\{ETQ_PAD_X_MM\}mm \$\{ETQ_PAD_BOTTOM_MM\}mm;$/m)
    expect(fonte).toMatch(/import \{[\s\S]*?ETQ_PAD_X_MM, ETQ_PAD_TOP_MM, ETQ_PAD_BOTTOM_MM,[\s\S]*?\} from '\.\.\/\.\.\/utils\/etiquetasHtml'/)
  })

  it('nome e variação encolhem sem passar da célula', () => {
    expect(declara(regraCss(fonte, '.etq-fileira .etq-nome'), 'max-width', '100%')).toBe(true)
    expect(declara(regraCss(fonte, '.etq-fileira .etq-var'), 'max-width', '100%')).toBe(true)
  })

  it('o código de barras não encolhe junto — a largura é o que o torna legível', () => {
    // Encolher o SVG estreitaria a barra abaixo do piso de ~0,19mm que
    // utils/codigoBarras.js documenta, e aí o leitor recusa a leitura.
    expect(declara(regraCss(fonte, '.etq-fileira .etq-svg'), 'align-self', 'stretch')).toBe(true)
  })

  it('o A4 continua com o respiro dele — nada disso vale lá', () => {
    // Todas as regras acima são filhas de .etq-fileira, que só existe na
    // térmica. O card do A4 mantém o padding em px de sempre.
    const a4 = regraCss(fonte, '.etq-item')
    expect(declara(a4, 'padding', '7px 8px 5px')).toBe(true)
    expect(declara(a4, 'align-items', 'center')).toBe(false)
  })
})
