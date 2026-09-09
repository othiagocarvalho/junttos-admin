import { describe, it, expect } from 'vitest'
import { initProdForm, buildProdPayload, calcularTotais } from './EstoqueMobile.jsx'

// ── calcularTotais ──────────────────────────────────────────────
// Regra desde a correção do "estoque paralelo": os cards de Custo/Venda somam
// TODOS os produtos. Marcar disponivel_catalogo_b2b não tira o item da conta —
// antes o filtro semB2b escondia esses produtos e subestimava os totais.
describe('calcularTotais', () => {
  const base = [
    { preco_custo: 10, preco_venda: 25, variacoes: [{ quantidade: 2 }, { quantidade: 3 }] }, // 5 pç
    { preco_custo: 4,  preco_venda: 9,  variacoes: [{ quantidade: 10 }], disponivel_catalogo_b2b: true }, // 10 pç
  ]

  it('soma peças, custo e venda de todos os produtos', () => {
    expect(calcularTotais(base)).toEqual({
      totalPecas: 15,
      totalCusto: 5 * 10 + 10 * 4,   // 90
      totalVenda: 5 * 25 + 10 * 9,   // 265
    })
  })

  it('inclui produtos marcados como disponíveis no Catálogo B2B', () => {
    const comFlag = calcularTotais(base)
    const semFlag = calcularTotais(base.map(p => ({ ...p, disponivel_catalogo_b2b: false })))
    expect(comFlag).toEqual(semFlag)
  })

  it('não muda o total só porque a flag de B2B foi ligada', () => {
    const antes  = calcularTotais(base)
    const depois = calcularTotais(base.map(p => ({ ...p, disponivel_catalogo_b2b: true })))
    expect(depois).toEqual(antes)
  })

  it('tolera lista vazia, variações ausentes e preços nulos', () => {
    expect(calcularTotais([])).toEqual({ totalPecas: 0, totalCusto: 0, totalVenda: 0 })
    expect(calcularTotais([{ variacoes: null }])).toEqual({ totalPecas: 0, totalCusto: 0, totalVenda: 0 })
    expect(calcularTotais([{ preco_custo: null, preco_venda: null, variacoes: [{ quantidade: 3 }] }]))
      .toEqual({ totalPecas: 3, totalCusto: 0, totalVenda: 0 })
  })
})

// ── initProdForm ────────────────────────────────────────────────
describe('initProdForm', () => {
  it('preenche todos os campos a partir de um produto completo', () => {
    const produto = {
      nome: 'Vestido Floral',
      preco_custo: 50,
      preco_venda: 120,
      referencia: 'VF-001',
      fornecedor: 'Moda Sul',
      valor_lote: 1500,
      data_vencimento: '2026-08-15',
      status_pgto: 'a_pagar',
    }
    expect(initProdForm(produto)).toEqual({
      nome: 'Vestido Floral',
      preco_custo: '50',
      preco_venda: '120',
      referencia: 'VF-001',
      valor_lote: '1500',
      data_vencimento: '2026-08-15',
      status_pgto: 'a_pagar',
    })
  })

  it('usa string vazia e defaults quando campos opcionais estão ausentes', () => {
    const produto = { nome: 'Blusa Básica', preco_venda: 80 }
    const form = initProdForm(produto)
    expect(form.nome).toBe('Blusa Básica')
    expect(form.preco_custo).toBe('')
    expect(form.preco_venda).toBe('80')
    expect(form.referencia).toBe('')
    expect(form.valor_lote).toBe('')
    expect(form.data_vencimento).toBe('')
    expect(form.status_pgto).toBe('a_pagar')
  })

  it('trata preco_custo e preco_venda zero como "0", não string vazia', () => {
    const form = initProdForm({ nome: 'Calça', preco_custo: 0, preco_venda: 0 })
    expect(form.preco_custo).toBe('0')
    expect(form.preco_venda).toBe('0')
  })

  it('não falha com produto vazio ({})', () => {
    const form = initProdForm({})
    expect(form.nome).toBe('')
    expect(form.status_pgto).toBe('a_pagar')
  })
})

// ── buildProdPayload ────────────────────────────────────────────
describe('buildProdPayload', () => {
  const formBase = {
    nome: '  Vestido Canelado  ',
    preco_custo: '45,50',
    preco_venda: '99',
    referencia: 'VC-002',
    fornecedor: '',
    valor_lote: '2000',
    data_vencimento: '2026-09-01',
    status_pgto: 'pago',
  }

  it('retorna payload base correto', () => {
    const payload = buildProdPayload(formBase, false)
    expect(payload).toEqual({
      nome: 'Vestido Canelado',
      preco_custo: 45.5,
      preco_venda: 99,
      referencia: 'VC-002',
    })
    expect(payload).not.toHaveProperty('valor_lote')
    expect(payload).not.toHaveProperty('data_vencimento')
    expect(payload).not.toHaveProperty('status_pgto')
  })

  it('faz trim no nome', () => {
    const payload = buildProdPayload(formBase, false)
    expect(payload.nome).toBe('Vestido Canelado')
  })

  it('converte preço com vírgula decimal', () => {
    const payload = buildProdPayload({ ...formBase, preco_custo: '123,99', preco_venda: '250,00' }, false)
    expect(payload.preco_custo).toBe(123.99)
    expect(payload.preco_venda).toBe(250)
  })

  it('converte preço vazio para zero', () => {
    const payload = buildProdPayload({ ...formBase, preco_custo: '', preco_venda: '' }, false)
    expect(payload.preco_custo).toBe(0)
    expect(payload.preco_venda).toBe(0)
  })

  it('referencia vazia se torna null', () => {
    const payload = buildProdPayload({ ...formBase, referencia: '   ' }, false)
    expect(payload.referencia).toBeNull()
  })

  // O campo saiu da tela. Como updateProduto faz update parcial, a ausência da
  // chave no payload é o que preserva o valor já gravado em lf_produtos —
  // mandar null aqui apagaria o dado histórico de quem já tinha fornecedor.
  it('não envia fornecedor, nem quando o form ainda carrega o valor', () => {
    const payload = buildProdPayload({ ...formBase, fornecedor: 'Ateliê Norte' }, false)
    expect(payload).not.toHaveProperty('fornecedor')
  })

  it('initProdForm também não expõe mais fornecedor', () => {
    expect(initProdForm({ nome: 'X', fornecedor: 'Moda Sul' })).not.toHaveProperty('fornecedor')
  })

})
