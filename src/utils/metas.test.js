import { describe, it, expect } from 'vitest'
import { calcularPA, calcularProgressoMeta, calcularProgressoMetaProduto } from './metas.js'

describe('calcularPA', () => {
  it('retorna 0 quando não há vendas', () => {
    expect(calcularPA([])).toBe(0)
  })

  it('1 venda com 1 produto → PA = 1', () => {
    const vendas = [{ produtos: [{ quantidade: 1 }], valor: 50 }]
    expect(calcularPA(vendas)).toBe(1)
  })

  it('2 vendas com 3 itens cada → PA = 3', () => {
    const mk = qtd => ({ produtos: [{ quantidade: qtd }], valor: 100 })
    expect(calcularPA([mk(3), mk(3)])).toBe(3)
  })

  it('itens desiguais: calcula média correta (4+2)/2 = 3', () => {
    const v1 = { produtos: [{ quantidade: 2 }, { quantidade: 2 }], valor: 100 }
    const v2 = { produtos: [{ quantidade: 1 }, { quantidade: 1 }], valor: 80 }
    expect(calcularPA([v1, v2])).toBe(3)
  })

  it('venda sem campo produtos conta como 0 itens', () => {
    const vendas = [{ valor: 50 }, { produtos: [{ quantidade: 2 }], valor: 80 }]
    // 0 + 2 = 2 itens / 2 vendas = 1
    expect(calcularPA(vendas)).toBe(1)
  })

  it('produto sem quantidade usa 1 como padrão', () => {
    const vendas = [{ produtos: [{ nome: 'Blusa' }], valor: 80 }]
    expect(calcularPA(vendas)).toBe(1)
  })
})

describe('calcularProgressoMeta', () => {
  // Mês fechado — todos os dias já passaram, diaAtual = diasNoMes
  const mesFechado = '2026-01'
  const vendas = [
    { data: '2026-01-05T10:00:00', valor: 500, produtos: [] },
    { data: '2026-01-15T14:00:00', valor: 300, produtos: [] },
    { data: '2026-02-10T10:00:00', valor: 200, produtos: [] }, // outro mês, deve ser ignorado
  ]

  it('realizado = soma das vendas do mês', () => {
    const { realizado } = calcularProgressoMeta(vendas, 1000, mesFechado)
    expect(realizado).toBe(800)
  })

  it('pct correto quando meta definida', () => {
    const { pct } = calcularProgressoMeta(vendas, 1000, mesFechado)
    expect(pct).toBeCloseTo(80)
  })

  it('atingida = true quando realizado >= meta', () => {
    const { atingida } = calcularProgressoMeta(vendas, 800, mesFechado)
    expect(atingida).toBe(true)
  })

  it('faltam = 0 quando meta atingida', () => {
    const { faltam } = calcularProgressoMeta(vendas, 800, mesFechado)
    expect(faltam).toBe(0)
  })

  it('faltam > 0 quando meta não atingida', () => {
    const { faltam } = calcularProgressoMeta(vendas, 1000, mesFechado)
    expect(faltam).toBe(200)
  })

  it('pct = 0 quando meta não definida (0)', () => {
    const { pct } = calcularProgressoMeta(vendas, 0, mesFechado)
    expect(pct).toBe(0)
  })

  it('vendas de outros meses não contam', () => {
    const { realizado } = calcularProgressoMeta(vendas, 1000, '2026-02')
    expect(realizado).toBe(200)
  })
})

describe('calcularProgressoMetaProduto', () => {
  const produtosData = [
    { nome: 'Vestido Rosa',   preco_venda: 200, categoria: 'Vestido' },
    { nome: 'Blusa Branca',   preco_venda: 80,  categoria: 'Blusa'   },
    { nome: 'Calça Jeans',    preco_venda: 150, categoria: 'Calça'   },
    { nome: 'Blusa Listrada', preco_venda: 90,  categoria: 'Blusa'   },
  ]
  const vendas = [
    { data: '2026-01-05T10:00:00', valor: 200, produtos: [{ nome: 'Vestido Rosa',   quantidade: 1 }] },
    { data: '2026-01-10T14:00:00', valor: 160, produtos: [{ nome: 'Blusa Branca',   quantidade: 2 }] },
    { data: '2026-01-20T09:00:00', valor: 90,  produtos: [{ nome: 'Blusa Listrada', quantidade: 1 }] },
    { data: '2026-02-05T10:00:00', valor: 150, produtos: [{ nome: 'Calça Jeans',    quantidade: 1 }] },
  ]

  it('retorna zeros quando metaProduto é null', () => {
    const r = calcularProgressoMetaProduto(vendas, produtosData, null)
    expect(r).toEqual({ realizado: 0, pct: 0, atingida: false, faltam: 0 })
  })

  it('escopo produto + tipo quantidade: conta unidades do produto', () => {
    const meta = { mes: '2026-01', tipo_medicao: 'quantidade', escopo_tipo: 'produto', escopo_valor: 'Blusa Branca', valor_meta: 5 }
    const { realizado } = calcularProgressoMetaProduto(vendas, produtosData, meta)
    expect(realizado).toBe(2)
  })

  it('escopo produto + tipo faturamento: qtd × preco_venda', () => {
    const meta = { mes: '2026-01', tipo_medicao: 'faturamento', escopo_tipo: 'produto', escopo_valor: 'Blusa Branca', valor_meta: 200 }
    const { realizado } = calcularProgressoMetaProduto(vendas, produtosData, meta)
    expect(realizado).toBe(160) // 2 × 80
  })

  it('escopo categoria + tipo quantidade: soma unidades de todos produtos da categoria', () => {
    const meta = { mes: '2026-01', tipo_medicao: 'quantidade', escopo_tipo: 'categoria', escopo_valor: 'Blusa', valor_meta: 10 }
    const { realizado } = calcularProgressoMetaProduto(vendas, produtosData, meta)
    expect(realizado).toBe(3) // Blusa Branca(2) + Blusa Listrada(1)
  })

  it('escopo categoria + tipo faturamento: soma qtd × preco de cada produto da categoria', () => {
    const meta = { mes: '2026-01', tipo_medicao: 'faturamento', escopo_tipo: 'categoria', escopo_valor: 'Blusa', valor_meta: 300 }
    const { realizado } = calcularProgressoMetaProduto(vendas, produtosData, meta)
    expect(realizado).toBe(250) // 2×80 + 1×90
  })

  it('vendas de outro mês são ignoradas', () => {
    const meta = { mes: '2026-01', tipo_medicao: 'quantidade', escopo_tipo: 'produto', escopo_valor: 'Calça Jeans', valor_meta: 5 }
    const { realizado } = calcularProgressoMetaProduto(vendas, produtosData, meta)
    expect(realizado).toBe(0) // a venda de Calça Jeans é em fevereiro
  })

  it('pct correto', () => {
    const meta = { mes: '2026-01', tipo_medicao: 'quantidade', escopo_tipo: 'categoria', escopo_valor: 'Blusa', valor_meta: 6 }
    const { pct } = calcularProgressoMetaProduto(vendas, produtosData, meta)
    expect(pct).toBeCloseTo(50) // 3 / 6
  })

  it('atingida = true quando realizado >= meta', () => {
    const meta = { mes: '2026-01', tipo_medicao: 'quantidade', escopo_tipo: 'categoria', escopo_valor: 'Blusa', valor_meta: 3 }
    const { atingida } = calcularProgressoMetaProduto(vendas, produtosData, meta)
    expect(atingida).toBe(true)
  })

  it('faltam correto quando não atingida', () => {
    const meta = { mes: '2026-01', tipo_medicao: 'faturamento', escopo_tipo: 'produto', escopo_valor: 'Vestido Rosa', valor_meta: 500 }
    const { faltam } = calcularProgressoMetaProduto(vendas, produtosData, meta)
    expect(faltam).toBe(300) // 500 - 200
  })
})
