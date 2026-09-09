import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { revelarBloco } from './revelarVariacoes'

// ─────────────────────────────────────────────────────────────────────────────
// Bug HM Boutique: o bloco de variações do 2º produto em diante nascia fora da
// área visível e não recebia clique. Duas causas, medidas em navegador real:
//
//   1. desktop — o cartão tinha teto (`max-height`) e a lista era o único
//      filho flexível, então ela absorvia sozinha os ~150px da faixa
//      SELECIONADOS. Com 1 produto escolhido a lista media 239px em 1440x900,
//      107px em 1366x768 e 2px em 1024x600.
//   2. mobile — a BarraResumoMobile é `position: fixed` e só existe depois do
//      primeiro produto; o navegador a considera "área visível" e parava a
//      rolagem com o bloco por baixo dela.
//
// Estes testes travam as duas correções. Não há jsdom no projeto (environment
// 'node'), então o comportamento do util é verificado com um elemento falso e
// o layout é verificado no texto-fonte, ancorado em linha inteira para não
// casar com os próprios comentários.
// ─────────────────────────────────────────────────────────────────────────────

const DESKTOP = readFileSync(new URL('../pages/cliente/ClientDashboardDesktop.jsx', import.meta.url), 'utf8')
const MOBILE  = readFileSync(new URL('../pages/LojaFeminina/NovaVenda.jsx', import.meta.url), 'utf8')

/** Descarta comentários de linha para que uma asserção de ausência não seja
 *  derrubada — nem satisfeita — por texto explicativo. */
function semComentarios(src) {
  return src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
}

function elementoFalso() {
  return { style: {}, scrollIntoView: vi.fn() }
}

describe('revelarBloco', () => {
  beforeEach(() => {
    // O util agenda num frame; no node não existe rAF, e ele cai no setTimeout.
    vi.stubGlobal('requestAnimationFrame', fn => { fn(); return 1 })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('rola o bloco com a rolagem mínima que o traz inteiro para dentro', () => {
    const el = elementoFalso()
    revelarBloco(el)
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1)
    // 'nearest' é o que não mexe em nada quando o bloco já está visível —
    // 'center'/'start' dariam um pulo a cada produto aberto no meio da lista.
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
  })

  it('reserva a altura da barra fixa via scroll-margin-bottom', () => {
    const el = elementoFalso()
    revelarBloco(el, { margemInferior: 150 })
    expect(el.style.scrollMarginBottom).toBe('150px')
  })

  it('não mexe em scroll-margin quando não há barra a evitar (desktop)', () => {
    const el = elementoFalso()
    revelarBloco(el)
    expect(el.style.scrollMarginBottom).toBeUndefined()
  })

  it('não quebra quando não há elemento (bloco fechado, ref nula)', () => {
    expect(() => revelarBloco(null)).not.toThrow()
    expect(() => revelarBloco({})).not.toThrow()
  })

  it('cai no scrollIntoView antigo quando o motor recusa o objeto de opções', () => {
    // Motor antigo — exatamente o caso do notebook Windows 8 do relato.
    const el = { style: {}, scrollIntoView: vi.fn(arg => { if (typeof arg === 'object') throw new TypeError('sem suporte') }) }
    expect(() => revelarBloco(el)).not.toThrow()
    expect(el.scrollIntoView).toHaveBeenLastCalledWith(false)
  })
})

describe('Nova Venda desktop — a lista de resultados não pode virar uma fresta', () => {
  const src = semComentarios(DESKTOP)

  it('o cartão de produtos não tem mais teto de altura', () => {
    // Era `maxHeight: 'max(420px, calc(100dvh - 140px))'`. Com o cartão preso,
    // toda a variação de altura sobrava para a lista.
    expect(src).not.toMatch(/max\(420px,\s*calc\(100dvh - 140px\)\)/)
  })

  it('a lista tem piso próprio, que cabe um bloco de variações inteiro', () => {
    expect(src).toMatch(/^\s*minHeight: 220,$/m)
    // O bloco de variações mede ~123px; o piso precisa comportá-lo com folga.
    const piso = Number(src.match(/^\s*minHeight: (\d+),$/m)[1])
    expect(piso).toBeGreaterThanOrEqual(180)
  })

  it('o teto da lista usa vh, não dvh — dvh não existe em motor antigo', () => {
    expect(src).toMatch(/maxHeight: 'calc\(100vh - 340px\)'/)
    // Onde dvh não é suportado a declaração inteira é descartada, e o layout
    // muda de comportamento justamente na máquina em que ninguém está olhando.
    expect(src).not.toMatch(/dvh/)
  })

  it('a lista continua rolando sozinha, sem cortar o item do fim', () => {
    expect(src).toMatch(/^\s*overflowY: 'auto',$/m)
    expect(src).toMatch(/^\s*paddingBottom: 10,$/m)
    expect(src).toMatch(/^\s*scrollPaddingBottom: 10,$/m)
  })

  it('os dois pickers de variação são revelados ao abrir', () => {
    expect(src).toMatch(/ref=\{isOpen \? refVariacoes : null\}/)
    expect(src).toMatch(/ref=\{isOpen \? refVariacoesTroca : null\}/)
    // Dependência só no produto aberto: mexer na quantidade de uma variação
    // não pode re-disparar a rolagem debaixo do dedo de quem clica em "+".
    expect(src).toMatch(/revelarBloco\(refVariacoes\.current\)\s*\},\s*\[varModal\]\)/)
    expect(src).toMatch(/revelarBloco\(refVariacoesTroca\.current\)\s*\},\s*\[varModalTroca\]\)/)
  })
})

describe('Nova Venda mobile — a barra fixa não pode cobrir o que abriu', () => {
  const src = semComentarios(MOBILE)

  it('o espaçador reserva a faixa inteira que a barra fixa ocupa', () => {
    // A barra tem 65px e fica 68px acima do fim da tela (sobre a
    // BottomTabBar): 133px tapados. Os 72px de antes deixavam ~61px de
    // conteúdo impossíveis de trazer para a área visível.
    const altura = Number(src.match(/aria-hidden style=\{\{ height: (\d+) \}\}/)[1])
    expect(altura).toBeGreaterThanOrEqual(133)
  })

  it('revela o picker reservando a altura da barra fixa', () => {
    expect(src).toMatch(/ref=\{isOpen \? refVariacoes : null\}/)
    expect(src).toMatch(/ref=\{isOpen \? refVariacoesTroca : null\}/)
    expect(src).toMatch(/revelarBloco\(refVariacoes\.current,\s*\{ margemInferior: 150 \}\)\s*\},\s*\[expandedProd\]\)/)
    expect(src).toMatch(/revelarBloco\(refVariacoesTroca\.current,\s*\{ margemInferior: 150 \}\)\s*\},\s*\[expandedTroca\]\)/)
  })

  it('a lista do mobile segue sem teto de altura — quem rola é a página', () => {
    // Confirma que a correção do desktop não foi copiada para cá por engano:
    // no mobile não existe cartão com teto, e criar um segundo scroll dentro
    // de uma tela de 640px seria trocar um corte por outro.
    expect(src).not.toMatch(/maxHeight: 'calc\(100vh/)
  })
})
