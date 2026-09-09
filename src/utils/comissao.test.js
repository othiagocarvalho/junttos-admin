import { describe, it, expect } from 'vitest'
import {
  normalizarPercentual, validarPercentual, calcularComissoes, totalComissoes,
} from './comissao'

const vendedores = [
  { nome: 'Ana Lívia', ativo: true,  comissao_percentual: 5 },
  { nome: 'Brenda',    ativo: true,  comissao_percentual: 10 },
  { nome: 'Eduarda',   ativo: false, comissao_percentual: 7 },
  { nome: 'Laiane',    ativo: true,  comissao_percentual: 0 },
]

describe('normalizarPercentual', () => {
  it('aceita número e string, com vírgula', () => {
    expect(normalizarPercentual(5)).toBe(5)
    expect(normalizarPercentual('7')).toBe(7)
    expect(normalizarPercentual('2,5')).toBe(2.5)
  })

  it('limita à faixa 0–100 em vez de propagar valor absurdo', () => {
    // A migration não põe CHECK de propósito, então o cálculo é a trava.
    expect(normalizarPercentual(150)).toBe(100)
    expect(normalizarPercentual(-4)).toBe(0)
  })

  it('lixo vira 0', () => {
    expect(normalizarPercentual('abc')).toBe(0)
    expect(normalizarPercentual(null)).toBe(0)
    expect(normalizarPercentual(undefined)).toBe(0)
    expect(normalizarPercentual('')).toBe(0)
  })
})

describe('validarPercentual', () => {
  it('vazio é válido — vendedor sem comissão é caso real', () => {
    expect(validarPercentual('')).toBeNull()
    expect(validarPercentual('   ')).toBeNull()
  })

  it('0 a 100 passa, inclusive com vírgula', () => {
    expect(validarPercentual('0')).toBeNull()
    expect(validarPercentual('5,5')).toBeNull()
    expect(validarPercentual('100')).toBeNull()
  })

  it('recusa fora da faixa e não-número', () => {
    expect(validarPercentual('-1')).toBeTruthy()
    expect(validarPercentual('101')).toBeTruthy()
    expect(validarPercentual('abc')).toBeTruthy()
  })
})

describe('calcularComissoes', () => {
  it('cada vendedor usa o PRÓPRIO percentual', () => {
    const vendas = [
      { vendedora: 'Ana Lívia', valor: 1000 },   // 5%  → 50
      { vendedora: 'Brenda',    valor: 1000 },   // 10% → 100
    ]
    const r = calcularComissoes(vendas, vendedores)
    expect(r.find(l => l.nome === 'Ana Lívia')).toMatchObject({ total: 1000, pct: 5,  comissao: 50 })
    expect(r.find(l => l.nome === 'Brenda')).toMatchObject({ total: 1000, pct: 10, comissao: 100 })
  })

  it('soma várias vendas da mesma pessoa antes de aplicar o percentual', () => {
    const vendas = [
      { vendedora: 'Brenda', valor: 300 },
      { vendedora: 'Brenda', valor: 200 },
    ]
    expect(calcularComissoes(vendas, vendedores)[0]).toMatchObject({ total: 500, comissao: 50 })
  })

  it('venda SEM vendedor fica de fora — não há quem receber', () => {
    const vendas = [
      { vendedora: null, valor: 900 },
      { vendedora: '',   valor: 900 },
      { vendedora: '  ', valor: 900 },
      { vendedora: 'Ana Lívia', valor: 100 },
    ]
    const r = calcularComissoes(vendas, vendedores)
    expect(r).toHaveLength(1)
    expect(r[0].nome).toBe('Ana Lívia')
    expect(r.some(l => /sem vendedor/i.test(l.nome))).toBe(false)
  })

  it('agrupa ignorando caixa e espaço — junta a sujeira do texto livre antigo', () => {
    // Antes eram três linhas com igualdade exata de string.
    const vendas = [
      { vendedora: 'Ana Lívia',   valor: 100 },
      { vendedora: 'ana lívia',   valor: 100 },
      { vendedora: '  Ana  Lívia ', valor: 100 },
    ]
    const r = calcularComissoes(vendas, vendedores)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ nome: 'Ana Lívia', total: 300, comissao: 15 })
  })

  it('usa a grafia do cadastro, não a digitada na venda', () => {
    const r = calcularComissoes([{ vendedora: 'BRENDA', valor: 100 }], vendedores)
    expect(r[0].nome).toBe('Brenda')
  })

  it('vendedor inativo que vendeu no período continua recebendo', () => {
    // Saiu da loja, mas a comissão do que vendeu é dele.
    const r = calcularComissoes([{ vendedora: 'Eduarda', valor: 1000 }], vendedores)
    expect(r[0]).toMatchObject({ nome: 'Eduarda', pct: 7, comissao: 70, cadastrado: true })
  })

  it('nome que não está no cadastro aparece com 0% e marcado', () => {
    // Texto livre da época anterior ao cadastro. Esconder o faturamento dele
    // seria pior do que mostrar que falta cadastrar.
    const r = calcularComissoes([{ vendedora: 'Fulana Antiga', valor: 500 }], vendedores)
    expect(r[0]).toMatchObject({ nome: 'Fulana Antiga', total: 500, pct: 0, comissao: 0, cadastrado: false })
  })

  it('vendedor com 0% aparece com faturamento e comissão zero', () => {
    const r = calcularComissoes([{ vendedora: 'Laiane', valor: 800 }], vendedores)
    expect(r[0]).toMatchObject({ total: 800, pct: 0, comissao: 0, cadastrado: true })
  })

  it('ordena pela maior comissão, não pelo maior faturamento', () => {
    // Quem vendeu menos pode receber mais, e o que a lojista paga é a comissão.
    const vendas = [
      { vendedora: 'Ana Lívia', valor: 1000 },  // 5%  → 50
      { vendedora: 'Brenda',    valor: 800 },   // 10% → 80
    ]
    expect(calcularComissoes(vendas, vendedores).map(l => l.nome)).toEqual(['Brenda', 'Ana Lívia'])
  })

  it('percentual fora da faixa no banco não vira comissão absurda', () => {
    const r = calcularComissoes(
      [{ vendedora: 'X', valor: 100 }],
      [{ nome: 'X', comissao_percentual: 900 }],
    )
    expect(r[0].comissao).toBe(100)   // limitado a 100%
  })

  it('valor de venda inválido conta como zero, sem NaN', () => {
    const r = calcularComissoes(
      [{ vendedora: 'Brenda', valor: 'abc' }, { vendedora: 'Brenda', valor: 100 }],
      vendedores,
    )
    expect(r[0].total).toBe(100)
    expect(Number.isNaN(r[0].comissao)).toBe(false)
  })

  it('entradas vazias não quebram', () => {
    expect(calcularComissoes()).toEqual([])
    expect(calcularComissoes([], [])).toEqual([])
    expect(calcularComissoes([{ vendedora: 'A', valor: 1 }], null)).toHaveLength(1)
  })
})

describe('totalComissoes', () => {
  it('soma o que a loja vai pagar no período', () => {
    const linhas = calcularComissoes(
      [{ vendedora: 'Ana Lívia', valor: 1000 }, { vendedora: 'Brenda', valor: 1000 }],
      vendedores,
    )
    expect(totalComissoes(linhas)).toBe(150)
  })

  it('lista vazia soma zero', () => {
    expect(totalComissoes([])).toBe(0)
    expect(totalComissoes()).toBe(0)
  })
})
