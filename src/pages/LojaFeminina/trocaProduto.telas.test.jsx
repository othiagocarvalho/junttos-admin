import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Troca de Produto nas duas telas de Nova Venda — mobile (NovaVenda.jsx) e
// desktop (DesktopNovaVenda em cliente/ClientDashboardDesktop.jsx).
// Renderização estática, sem DOM (como formasPagamento.telas.test.jsx): o
// estado da troca entra pelo rascunho, que é como a tela restaura uma venda
// em andamento. Efeitos não rodam no SSR — o que se confere aqui é o que
// depende só do estado: resumo da troca, rótulos e ausência de gate.

let rascunho = null
vi.mock('../../utils/rascunhoVenda', async importOriginal => ({
  ...(await importOriginal()),
  lerRascunho: () => rascunho,
  salvarRascunho: () => {},
}))
vi.mock('../../context/ClientAuthContext', () => ({ useClientAuth: () => ({ user: null }) }))

const { default: NovaVenda } = await import('./NovaVenda')
const { DesktopNovaVenda } = await import('../cliente/ClientDashboardDesktop')
const { LinhasResumo } = await import('../../components/venda/ResumoVenda')
const { calcularResumoTroca } = await import('../../utils/venda')

const produtosData = [
  { id: 'p-blusa', nome: 'Blusa Rosa',   preco_venda: 80,  variacoes: [{ cor: 'M', quantidade: 3 }] },
  { id: 'p-calca', nome: 'Calça Branca', preco_venda: 120, variacoes: [{ cor: 'G', quantidade: 2 }] },
  { id: 'p-vest',  nome: 'Vestido Azul', preco_venda: 80,  variacoes: [{ cor: 'P', quantidade: 1 }] },
  { id: 'p-saia',  nome: 'Saia Preta',   preco_venda: 60,  variacoes: [{ cor: 'P', quantidade: 4 }] },
]
const produtos = produtosData.map(p => p.nome)
const item = (id, nome, variacao) => ({ produto_id: id, nome, variacao, obs: variacao, quantidade: 1 })
const BLUSA = item('p-blusa', 'Blusa Rosa', 'M')
const CALCA = item('p-calca', 'Calça Branca', 'G')
const VEST  = item('p-vest', 'Vestido Azul', 'P')
const SAIA  = item('p-saia', 'Saia Preta', 'P')

function rascunhoTroca(devolvido, novo, extras = {}) {
  return {
    nome: 'Cliente Teste', tel: '', aniversario: '', vendedora: '', obs: '',
    produtos: novo, pagamentos: [{ forma: 'Pix', valor: '' }],
    ajusteTipo: 'desconto', ajusteModo: 'valor', ajusteInput: '',
    isTroca: true, produtoTroca: devolvido, trocaDesconto: '', trocaAcrescimo: '',
    ...extras,
  }
}

const CENARIOS = [
  // [nome, devolvido, novo, rótulo, valor exibido]
  ['crédito igual ao produto novo', [BLUSA], [VEST], 'Troca zerada', /R\$\s?0,00/],
  ['crédito menor que o produto novo', [BLUSA], [CALCA], 'A cobrar', /R\$\s?40,00/],
  ['crédito maior que o produto novo', [CALCA], [SAIA], 'Saldo a favor', /R\$\s?60,00/],
]

const props = (config) => ({
  produtos, produtosData, addVenda: async () => ({}), addProduto: async () => {}, fetchAll: () => {},
  theme: { primary: '#5E2BD0' }, LOJA_ID: 'sualoja', config,
})

beforeEach(() => { rascunho = null })

describe('LinhasResumo (o resumo que mobile e desktop mostram)', () => {
  for (const [nome, dev, novo, rotulo, valor] of CENARIOS) {
    it(nome, () => {
      const sub = novo.reduce((s, i) => s + produtosData.find(p => p.id === i.produto_id).preco_venda, 0)
      const cred = dev.reduce((s, i) => s + produtosData.find(p => p.id === i.produto_id).preco_venda, 0)
      const html = renderToStaticMarkup(
        <LinhasResumo isTroca subtotal={sub} creditoTroca={cred} troca={calcularResumoTroca(sub, cred)} primary="#5E2BD0" />,
      )
      expect(html).toContain(rotulo)
      expect(html).toMatch(valor)
      expect(html).toContain('Produto devolvido (crédito)')
    })
  }

  it('saldo a favor avisa que não é reembolsável e sugere outro produto', () => {
    const html = renderToStaticMarkup(
      <LinhasResumo isTroca subtotal={60} creditoTroca={120} troca={calcularResumoTroca(60, 120)} primary="#5E2BD0" />,
    )
    expect(html).toContain('não reembolsável em dinheiro')
    expect(html).toContain('Adicione outro produto')
  })
})

describe('Desktop — DesktopNovaVenda com troca em andamento', () => {
  for (const [nome, dev, novo, rotulo, valor] of CENARIOS) {
    it(`${nome}: painel "Resumo da troca" com o cenário certo`, () => {
      rascunho = rascunhoTroca(dev, novo)
      const html = renderToStaticMarkup(<DesktopNovaVenda {...props({ plano: 'starter' })} />)
      expect(html).toContain('Resumo da troca')
      expect(html).toContain(rotulo)
      expect(html).toMatch(valor)
    })
  }

  it('sem gate: Starter, Pro, Business e loja sem plano mostram a troca igual', () => {
    rascunho = rascunhoTroca([BLUSA], [CALCA])
    for (const config of [null, { plano: 'starter' }, { plano: 'pro' }, { plano: 'business' }]) {
      const html = renderToStaticMarkup(<DesktopNovaVenda {...props(config)} />)
      expect(html).toContain('Resumo da troca')
      expect(html).toContain('A cobrar')
      expect(html).not.toContain('Upgrade')
    }
  })

  it('venda comum continua com "Resumo da venda"', () => {
    rascunho = rascunhoTroca([], [CALCA], { isTroca: false })
    const html = renderToStaticMarkup(<DesktopNovaVenda {...props({ plano: 'starter' })} />)
    expect(html).toContain('Resumo da venda')
    expect(html).not.toContain('Resumo da troca')
  })
})

describe('Mobile — NovaVenda com troca', () => {
  // O passo a passo do mobile lê window.innerWidth no render (esconde o nome
  // do passo em tela < 360px); no SSR não existe window.
  beforeEach(() => { vi.stubGlobal('window', { innerWidth: 400 }) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('troca iniciada pelo menu ("Troca") abre com "Cancelar troca"', () => {
    const html = renderToStaticMarkup(<NovaVenda {...props({ plano: 'starter' })} initialIsTroca />)
    expect(html).toContain('Cancelar troca')
  })

  it('troca restaurada do rascunho continua troca', () => {
    rascunho = rascunhoTroca([BLUSA], [CALCA])
    const html = renderToStaticMarkup(<NovaVenda {...props({ plano: 'starter' })} />)
    expect(html).toContain('Cancelar troca')
  })

  it('sem gate: a troca abre em qualquer plano', () => {
    for (const config of [null, { plano: 'starter' }, { plano: 'pro' }, { plano: 'business' }]) {
      const html = renderToStaticMarkup(<NovaVenda {...props(config)} initialIsTroca />)
      expect(html).toContain('Cancelar troca')
    }
  })

  it('venda comum não mostra nada de troca', () => {
    const html = renderToStaticMarkup(<NovaVenda {...props({ plano: 'starter' })} />)
    expect(html).not.toContain('Cancelar troca')
  })
})
