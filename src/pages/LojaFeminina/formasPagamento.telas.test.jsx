import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Renderização estática (sem DOM, como StoreCard.test.jsx): garante que as
// telas tocadas pelas formas de pagamento da loja não quebram com nenhum
// formato de lf_config — nulo, sem a coluna, lixo no JSON — e mostram o que
// devem mostrar.

vi.mock('../../context/ClientAuthContext', () => ({ useClientAuth: () => ({ user: null }) }))

const { default: LojaConfig } = await import('./LojaConfig')
const { default: Fechamento } = await import('./Fechamento')
const { default: Caixa } = await import('../LojaMercado/Caixa')
const { default: Menu } = await import('../LojaMercado/Menu')
const { FORMAS_PADRAO_MERCADO } = await import('../../utils/formasPagamento')

const theme = { primary: '#5E2BD0' }
const agora = new Date()
const vendaHoje = (pgtos) => ({
  id: Math.random().toString(36), data: agora.toISOString(), status: 'completa',
  valor: pgtos.reduce((s, p) => s + p.valor, 0), forma_pgto: JSON.stringify(pgtos),
})

const CONFIGS = {
  nulo: null,
  'sem a coluna': { loja_id: 'x', nome: 'Loja' },
  'coluna vazia': { loja_id: 'x', formas_pagamento: [] },
  'lixo no JSON': { loja_id: 'x', formas_pagamento: 'quebrado' },
  'itens inválidos': { loja_id: 'x', formas_pagamento: [null, 1, { nome: '' }, { nome: 'Pix', conta_como: 'Pix' }] },
}

describe('LojaConfig — seção Formas de Pagamento', () => {
  for (const [nome, config] of Object.entries(CONFIGS)) {
    it(`renderiza com config ${nome}`, () => {
      const html = renderToStaticMarkup(<LojaConfig config={config} features={{}} saveConfig={async () => null} theme={theme} />)
      expect(html).toContain('Formas de Pagamento')
      expect(html).toContain('Cartão de Débito · padrão')
      expect(html).toContain('Adicionar forma')
    })
  }

  it('lista só as ativas, com a linha do caixa', () => {
    const config = { formas_pagamento: [
      { nome: 'Link de pagamento', conta_como: 'Cartão de Crédito', ativo: true },
      { nome: 'Cheque', conta_como: 'Dinheiro', ativo: false },
    ] }
    const html = renderToStaticMarkup(<LojaConfig config={config} features={{}} saveConfig={async () => null} theme={theme} />)
    expect(html).toContain('Link de pagamento')
    expect(html).toContain('No caixa: Cartão de Crédito')
    expect(html).not.toContain('Cheque')
  })

  it('no Mercado mostra as padrão do PDV do Mercado', () => {
    const html = renderToStaticMarkup(<LojaConfig config={null} features={{}} saveConfig={async () => null} theme={theme} hideFeatureToggles formasPadrao={FORMAS_PADRAO_MERCADO} />)
    expect(html).toContain('Fiado · padrão')
    expect(html).not.toContain('Cartão de Débito · padrão')
  })
})

describe('Fechamento (Moda) — formas que não entram no caixa', () => {
  const config = { formas_pagamento: [{ nome: 'Vale', conta_como: 'nenhum' }] }

  it('mostra o aviso de valor fora do caixa', () => {
    const html = renderToStaticMarkup(
      <Fechamento caixas={[]} vendas={[vendaHoje([{ forma: 'Vale', valor: 40 }])]} config={config} fecharCaixa={async () => null} deleteCaixa={async () => null} />,
    )
    expect(html).toMatch(/Mais R\$\s?40,00 em formas de pagamento que não entram no caixa/)
  })

  for (const [nome, cfg] of Object.entries(CONFIGS)) {
    it(`renderiza com config ${nome}`, () => {
      const html = renderToStaticMarkup(
        <Fechamento caixas={[]} vendas={[vendaHoje([{ forma: 'Vale', valor: 40 }, { forma: 'Pix', valor: 10 }])]} config={cfg} fecharCaixa={async () => null} deleteCaixa={async () => null} />,
      )
      expect(html).toContain('Recebimentos')
      expect(html).not.toContain('não entram no caixa')
    })
  }
})

// Simula a "Sua Loja" com uma forma cadastrada em Configurações ("PIX
// Online", conta como Pix) e vendas do dia gravadas como a Nova Venda grava
// (forma_pgto = JSON [{forma, valor}]).
describe('Fechamento (Moda) — campo próprio para cada forma cadastrada', () => {
  const props = { caixas: [], fecharCaixa: async () => null, deleteCaixa: async () => null }
  const config = { loja_id: 'sualoja', formas_pagamento: [
    { nome: 'PIX Online', conta_como: 'Pix', ativo: true },
    { nome: 'Vale-presente', conta_como: 'nenhum', ativo: true },
    { nome: 'Cheque', conta_como: 'Dinheiro', ativo: false },
  ] }
  const vendas = [
    vendaHoje([{ forma: 'PIX Online', valor: 120 }]),
    vendaHoje([{ forma: 'PIX Online', valor: 30.5 }, { forma: 'Dinheiro', valor: 50 }]),
    vendaHoje([{ forma: 'Pix', valor: 80 }]),
    vendaHoje([{ forma: 'Cartão de Crédito', valor: 200 }]),
  ]
  // Valor do <input> que vem logo depois do <label> com esse texto.
  const valorDoCampo = (html, label) => {
    const m = html.match(new RegExp(`>${label}</label>[\\s\\S]*?<input[^>]*value="([^"]*)"`))
    return m ? m[1] : null
  }
  // Campo de forma cadastrada: o input da forma vem com a dica embaixo.
  const temCampo = (html, label) => new RegExp(`>${label}</label>[\\s\\S]*?<input`).test(html)

  it('mostra um campo para a forma cadastrada, com o valor só das vendas nela', () => {
    const html = renderToStaticMarkup(<Fechamento {...props} vendas={vendas} config={config} />)
    expect(temCampo(html, 'PIX Online')).toBe(true)
    expect(valorDoCampo(html, 'PIX Online')).toBe('150.50')
    expect(html).toContain('Soma em Pix')
    // O Pix padrão não recebe o PIX Online (antes, os 150,50 caíam aqui).
    expect(valorDoCampo(html, 'Pix')).toBe('80.00')
    expect(valorDoCampo(html, 'Dinheiro')).toBe('50.00')
    expect(valorDoCampo(html, 'Crédito')).toBe('200.00')
  })

  it('forma ativa sem venda no dia também tem campo (vazio); removida sem venda não', () => {
    const html = renderToStaticMarkup(<Fechamento {...props} vendas={vendas} config={config} />)
    expect(temCampo(html, 'Vale-presente')).toBe(true)
    expect(valorDoCampo(html, 'Vale-presente')).toBe('')
    expect(html).toContain('Fora do total do caixa')
    expect(html).not.toContain('Cheque')
  })

  it('forma removida que teve venda no dia continua aparecendo com o valor', () => {
    const html = renderToStaticMarkup(<Fechamento {...props} vendas={[...vendas, vendaHoje([{ forma: 'Cheque', valor: 15 }])]} config={config} />)
    expect(valorDoCampo(html, 'Cheque')).toBe('15.00')
    expect(html).toContain('Soma em Dinheiro')
  })

  it('o Total de Vendas soma a forma cadastrada pelo conta_como', () => {
    const html = renderToStaticMarkup(<Fechamento {...props} vendas={vendas} config={config} />)
    // 150,50 (PIX Online) + 50 + 80 + 200
    expect(html).toMatch(/Total de Vendas<\/p><p[^>]*>R\$\s?480,50</)
  })

  it('forma "não entra no caixa" tem campo mas fica fora do Total de Vendas', () => {
    const html = renderToStaticMarkup(
      <Fechamento {...props} vendas={[...vendas, vendaHoje([{ forma: 'Vale-presente', valor: 40 }])]} config={config} />,
    )
    expect(valorDoCampo(html, 'Vale-presente')).toBe('40.00')
    expect(html).toMatch(/Total de Vendas<\/p><p[^>]*>R\$\s?480,50</)
    expect(html).toMatch(/Mais R\$\s?40,00 em formas de pagamento que não entram no caixa/)
  })

  it('forma cadastrada como Dinheiro entra no dinheiro esperado da conferência', () => {
    const cfg = { formas_pagamento: [{ nome: 'Dinheiro motoboy', conta_como: 'Dinheiro', ativo: true }] }
    const html = renderToStaticMarkup(
      <Fechamento {...props} vendas={[vendaHoje([{ forma: 'Dinheiro motoboy', valor: 25 }, { forma: 'Dinheiro', valor: 10 }])]} config={cfg} />,
    )
    expect(html).toMatch(/Dinheiro esperado em caixa:[\s\S]*?R\$\s?35,00/)
  })

  it('loja sem forma cadastrada: os mesmos quatro campos e o mesmo total de antes', () => {
    for (const cfg of Object.values(CONFIGS)) {
      const html = renderToStaticMarkup(<Fechamento {...props} vendas={vendas} config={cfg} />)
      expect((html.match(/<input[^>]*type="number"/g) || []).length).toBe(9) // 4 recebimentos + saldo, sangria, suprimento, contado, despesas
      expect(html).not.toContain('Soma em')
      expect(valorDoCampo(html, 'Pix')).toBe('80.00')
      // PIX Online não é forma cadastrada aqui: continua ignorado, como antes.
      expect(html).toMatch(/Total de Vendas<\/p><p[^>]*>R\$\s?330,00</)
    }
  })

  it('fechamento salvo mostra cada forma salva nele, mesmo que o cadastro tenha mudado', () => {
    const hoje = new Date()
    const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    const salvo = {
      id: 'c1', data: dia, dinheiro: 50, pix: 230.5, debito: 0, credito: 200, total: 480.5,
      formas_extras: [{ nome: 'PIX Online', conta_como: 'Pix', valor: 150.5 }],
    }
    const html = renderToStaticMarkup(<Fechamento {...props} caixas={[salvo]} vendas={vendas} config={null} />)
    expect(html).toContain('Fechamento salvo')
    expect(valorDoCampo(html, 'PIX Online')).toBe('150.5')
    expect(valorDoCampo(html, 'Pix')).toBe('80')
    expect(html).toMatch(/Total de Vendas<\/p><p[^>]*>R\$\s?480,50</)
    // Histórico com o detalhe por forma
    expect(html).toMatch(/Pix R\$\s?80,00 · Déb\. R\$\s?0,00 · Créd\. R\$\s?200,00 · PIX Online R\$\s?150,50/)
  })
})

describe('Mercado — Caixa e Menu', () => {
  const config = { formas_pagamento: [
    { nome: 'Vale', conta_como: 'nenhum' },
    { nome: 'Dinheiro do motoboy', conta_como: 'Dinheiro' },
  ] }
  const vendas = [
    vendaHoje([{ forma: 'Vale', valor: 25 }]),
    vendaHoje([{ forma: 'Dinheiro do motoboy', valor: 30 }]),
    vendaHoje([{ forma: 'Dinheiro', valor: 20 }]),
  ]

  it('Caixa mostra o que ficou fora do caixa', () => {
    const html = renderToStaticMarkup(<Caixa vendas={vendas} config={config} setTab={() => {}} />)
    expect(html).toMatch(/Mais R\$\s?25,00 em formas que não entram no caixa/)
  })

  for (const [nome, cfg] of Object.entries(CONFIGS)) {
    it(`Caixa e Menu renderizam com config ${nome}`, () => {
      expect(() => renderToStaticMarkup(<Caixa vendas={vendas} config={cfg ?? undefined} setTab={() => {}} />)).not.toThrow()
      expect(() => renderToStaticMarkup(<Menu vendas={vendas} config={cfg ?? undefined} setTab={() => {}} />)).not.toThrow()
    })
  }

  it('Menu soma no dinheiro do dia a forma cadastrada como Dinheiro', () => {
    const html = renderToStaticMarkup(<Menu vendas={vendas} config={config} setTab={() => {}} />)
    // 30 (cadastrada como Dinheiro) + 20 (Dinheiro); os 25 em Vale ficam fora.
    expect(html).toMatch(/No caixa<\/p><p[^>]*>R\$\s?50</)
  })
})
