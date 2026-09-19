import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Dois ajustes de UX aprovados por Thiago em cima da correção de estoque do
// catálogo (fix_estoque_catalogo_publico.sql):
//   1. cor selecionada ganha anel + check sobreposto no seletor do modal;
//   2. bater o teto do "+" avisa (antes travava calado).
//
// Os dois só se manifestam depois de uma INTERAÇÃO real (clicar numa cor,
// clicar no "+" até passar do teto) — coisa que renderToStaticMarkup não
// alcança, porque não há jsdom neste projeto (vitest roda em environment
// 'node' — ver o comentário no topo de CatalogoPublicoV2.test.jsx). Os casos
// que NASCEM prontos no primeiro render (produto de cor única, produto já
// esgotado) estão testados de verdade em CatalogoPublicoV2.test.jsx, describe
// 'teto de estoque no seletor de quantidade'. O que só existe depois de um
// clique — o check da cor ativa em produto MULTICOR (corSel nasce null nesse
// caso) e a mensagem avisoEstoque em si — é travado aqui por inspeção da
// FORMA do código, mesmo padrão já usado em
// src/pages/LojaFeminina/excluirPedido.ordem.test.js para o mesmo tipo de
// limitação.

const fonte = readFileSync(new URL('./CatalogoPublicoV2.jsx', import.meta.url), 'utf8')

describe('ModalProduto — destaque visual da cor selecionada', () => {
  it('o check só é desenhado quando a cor está ativa (selecionada)', () => {
    expect(fonte).toContain('{ativo && (')
  })

  it('o anel de destaque usa a cor de tinta do tema (accent do catálogo) quando ativo', () => {
    // Mesma cor usada em todo o resto do catálogo para "selecionado/ativo"
    // (filtro de categoria, chip de tamanho, botão principal) — não é uma
    // cor nova inventada para este caso.
    expect(fonte).toContain('0 0 0 4px ${C.tinta}')
  })

  it('o check é um overlay absoluto — não altera o tamanho do círculo', () => {
    const inicio = fonte.indexOf('{ativo && (')
    expect(inicio).toBeGreaterThan(-1)
    const bloco = fonte.slice(inicio, inicio + 500)
    expect(bloco).toContain("position: 'absolute'")
    expect(bloco).toContain('pointerEvents: \'none\'') // não rouba o clique do botão por baixo
  })

  it('o botão do chip ganhou position:relative — âncora do check sobreposto', () => {
    const inicioChip = fonte.indexOf("width: 42, height: 42, borderRadius: 99, padding: 0,")
    expect(inicioChip).toBeGreaterThan(-1)
    const bloco = fonte.slice(inicioChip, inicioChip + 200)
    expect(bloco).toContain("position: 'relative'")
  })

  it('continua anunciado para leitor de tela (aria-pressed) — o check é reforço visual, não substitui', () => {
    expect(fonte).toContain('aria-pressed={ativo}')
  })
})

describe('ModalProduto — aviso ao bater o teto de estoque', () => {
  it('o "+" principal avisa com mensagemLimiteEstoque ao bater o teto — não trava calado', () => {
    expect(fonte).toContain(
      'setAvisoEstoque(mensagemLimiteEstoque(corSel?.nome ?? null, limiteAtual))',
    )
  })

  it('o "+" da lista compacta também avisa — era o botão que travava 100% calado antes deste ajuste', () => {
    expect(fonte).toContain(
      'setAvisoEstoque(mensagemLimiteEstoque(item.cor?.nome ?? null, limite))',
    )
  })

  it('o "+" do carrinho (drawer) mostra a mesma mensagem, com a mesma função', () => {
    expect(fonte).toContain('mensagemLimiteEstoque(linha.cor || null, limiteLinha)')
  })

  it('o aviso do modal some sozinho depois de um tempo (useEffect + setTimeout)', () => {
    const inicio = fonte.indexOf('avisoEstoque some sozinho')
    expect(inicio).toBeGreaterThan(-1)
    const bloco = fonte.slice(inicio, inicio + 600)
    expect(bloco).toContain("setTimeout(() => setAvisoEstoque(''), 3200)")
    expect(bloco).toContain('clearTimeout(timer)')
    // Dependência em [avisoEstoque]: reinicia o timer a cada aviso novo, e
    // NÃO dispara de novo só porque qtd/corSel mudaram sem gerar aviso novo.
    const efeitoInicio = fonte.indexOf('useEffect(() => {\n    if (!avisoEstoque) return')
    expect(efeitoInicio).toBeGreaterThan(-1)
    expect(fonte.slice(efeitoInicio, efeitoInicio + 250)).toContain('}, [avisoEstoque])')
  })

  it('o aviso também some na hora ao trocar de cor ou diminuir a quantidade — não fica só no timer', () => {
    // Comportamento herdado da correção de estoque anterior; este ajuste não
    // pode ter tirado isso, só ACRESCENTOU o desaparecimento por tempo.
    expect(fonte).toMatch(/setCorSel\(cor\)\s*\n\s*setErroEscolha\(''\)\s*\n\s*setAvisoEstoque\(''\)/)
    expect(fonte).toContain("setAvisoEstoque(''); setQtd(n => Math.max(1, n - 1))")
  })
})
