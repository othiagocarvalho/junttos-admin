import { describe, it, expect } from 'vitest'
import { vendasCompletas } from './useLojaData'

// Base segura da Pré-venda (fix_prevenda_schema.sql, etapa 1) — o filtro que
// TODO consumidor de `vendas` para indicador financeiro/quantitativo precisa
// usar antes de somar/contar. Testado isolado, sem montar o hook inteiro
// (que depende de Supabase): é uma função pura, não precisa de mais que isso.
describe('vendasCompletas', () => {
  it('conta venda com status ausente — é o estado de toda venda gravada antes desta coluna existir', () => {
    const vendas = [{ id: 'v1', valor: 100, status: undefined }]
    expect(vendasCompletas(vendas)).toEqual(vendas)
  })

  it('conta venda com status null, do mesmo jeito que status ausente', () => {
    const vendas = [{ id: 'v1', valor: 100, status: null }]
    expect(vendasCompletas(vendas)).toEqual(vendas)
  })

  it('conta venda com status "completa" explícito', () => {
    const vendas = [{ id: 'v1', valor: 100, status: 'completa' }]
    expect(vendasCompletas(vendas)).toEqual(vendas)
  })

  it('NÃO conta venda com status "aguardando_pagamento" — é uma pré-venda', () => {
    const vendas = [{ id: 'v1', valor: 100, status: 'aguardando_pagamento' }]
    expect(vendasCompletas(vendas)).toEqual([])
  })

  it('NÃO conta venda com status "cancelada" — pré-venda cancelada nunca virou dinheiro', () => {
    const vendas = [{ id: 'v1', valor: 100, status: 'cancelada' }]
    expect(vendasCompletas(vendas)).toEqual([])
  })

  it('NÃO conta status desconhecido — a regra é lista de permissão, não de exclusão', () => {
    const vendas = [{ id: 'v1', valor: 100, status: 'estornada' }]
    expect(vendasCompletas(vendas)).toEqual([])
  })

  it('soma de faturamento ignora pendente e cancelada', () => {
    const vendas = [
      { id: 'v1', valor: 100, status: 'completa' },
      { id: 'v2', valor: 200, status: 'aguardando_pagamento' },
      { id: 'v3', valor: 300, status: 'cancelada' },
      { id: 'v4', valor: 400 },
    ]
    const total = vendasCompletas(vendas).reduce((s, v) => s + v.valor, 0)
    expect(total).toBe(500)
  })

  it('array vazio devolve array vazio', () => {
    expect(vendasCompletas([])).toEqual([])
  })

  it('vendas undefined/null não explode — devolve array vazio', () => {
    expect(vendasCompletas(undefined)).toEqual([])
    expect(vendasCompletas(null)).toEqual([])
  })

  it('mistura de status filtra pendentes e canceladas, preservando a ordem das demais', () => {
    const vendas = [
      { id: 'v1', valor: 100, status: 'completa' },
      { id: 'v2', valor: 200, status: 'aguardando_pagamento' },
      { id: 'v3', valor: 300, status: undefined },
      { id: 'v4', valor: 400, status: 'cancelada' },
      { id: 'v5', valor: 500, status: null },
    ]
    expect(vendasCompletas(vendas).map(v => v.id)).toEqual(['v1', 'v3', 'v5'])
  })

  it('não muta o array recebido', () => {
    const vendas = [{ id: 'v1', status: 'aguardando_pagamento' }, { id: 'v2', status: 'completa' }]
    const copia = [...vendas]
    vendasCompletas(vendas)
    expect(vendas).toEqual(copia)
  })
})
