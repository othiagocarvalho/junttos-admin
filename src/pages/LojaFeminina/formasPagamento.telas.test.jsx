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
