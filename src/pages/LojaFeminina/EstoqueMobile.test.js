import { describe, it, expect } from 'vitest'
import { initProdForm, buildProdPayload } from './EstoqueMobile.jsx'

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
      fornecedor: 'Moda Sul',
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
    expect(form.fornecedor).toBe('')
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
      fornecedor: null,
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

  it('fornecedor preenchido é preservado', () => {
    const payload = buildProdPayload({ ...formBase, fornecedor: 'Ateliê Norte' }, false)
    expect(payload.fornecedor).toBe('Ateliê Norte')
  })

})
