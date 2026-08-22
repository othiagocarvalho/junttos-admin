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
