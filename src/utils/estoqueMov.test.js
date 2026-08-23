import { describe, it, expect } from 'vitest'
import {
  rotuloTipo, toneTipo, fmtDelta, labelVariacao, labelsDeVariacoes,
  normalizarItensEstoque, agruparPorNome, filtrarPorVariacao,
  precisaDevolverEstoque,
} from './estoqueMov.js'
import { getVarLabel } from './balanco.js'
import { decrementarVariacoes, restaurarVariacoes } from './venda.js'

describe('rotuloTipo / toneTipo', () => {
  it('traduz os tipos conhecidos', () => {
    expect(rotuloTipo('venda')).toBe('Venda')
    expect(rotuloTipo('importacao')).toBe('Importação')
    expect(toneTipo('venda')).toBe('info')
  })

  it('não quebra com tipo desconhecido vindo do banco', () => {
    expect(rotuloTipo('coisa_nova')).toBe('coisa_nova')
    expect(rotuloTipo(null)).toBe('—')
    expect(toneTipo('coisa_nova')).toBe('info')
  })
})

describe('fmtDelta', () => {
  it('prefixa o sinal e usa menos tipográfico', () => {
    expect(fmtDelta(5)).toBe('+5')
    expect(fmtDelta(-3)).toBe('−3')
    expect(fmtDelta(0)).toBe('0')
  })

  it('aceita string vinda do banco e valor ausente', () => {
    expect(fmtDelta('-2')).toBe('−2')
    expect(fmtDelta(null)).toBe('0')
    expect(fmtDelta(undefined)).toBe('0')
  })
})

describe('labelVariacao', () => {
  it('usa a mesma regra do getVarLabel do Balanço', () => {
    const casos = [
      { cor: 'Preto', quantidade: 3 },
      { tamanho: 'M', quantidade: 1, custo: 20 },
      { modelo: 'Modelo 1', quantidade: 0 },
      { quantidade: 5 },
      null,
    ]
    for (const v of casos) {
      expect(labelVariacao(v)).toBe(getVarLabel(v))
    }
  })

  it('ignora quantidade e custo na escolha da chave', () => {
    expect(labelVariacao({ quantidade: 2, custo: 10, cor: 'Rosa' })).toBe('Rosa')
  })
})

describe('labelsDeVariacoes', () => {
  it('lista os rótulos únicos do produto', () => {
    const produto = { variacoes: [{ cor: 'P', quantidade: 1 }, { cor: 'M', quantidade: 2 }, { cor: 'P', quantidade: 3 }] }
    expect(labelsDeVariacoes(produto)).toEqual(['P', 'M'])
  })

  it('devolve lista vazia para produto sem variação', () => {
    expect(labelsDeVariacoes({ variacoes: [] })).toEqual([])
    expect(labelsDeVariacoes(null)).toEqual([])
  })
})

describe('normalizarItensEstoque', () => {
  it('aceita o formato de lf_vendas.produtos (quantidade)', () => {
    const itens = [{ nome: 'Vestido', variacao: 'P', quantidade: 2, obs: '' }]
    expect(normalizarItensEstoque(itens)).toEqual([{ nome: 'Vestido', variacao: 'P', quantidade: 2 }])
  })

  it('aceita o formato de lf_pedidos.produtos (qtd)', () => {
    const itens = [{ nome: 'Blusa', variacao: 'Preta', qtd: 3, preco: 49.9 }]
    expect(normalizarItensEstoque(itens)).toEqual([{ nome: 'Blusa', variacao: 'Preta', quantidade: 3 }])
  })

  it('descarta itens sem variação — eles nunca mexeram em estoque', () => {
    const itens = [{ nome: 'Bolsa', quantidade: 1 }, { nome: 'Saia', variacao: 'G', quantidade: 1 }]
    expect(normalizarItensEstoque(itens)).toEqual([{ nome: 'Saia', variacao: 'G', quantidade: 1 }])
  })

  it('assume 1 quando a quantidade não vem', () => {
    expect(normalizarItensEstoque([{ nome: 'X', variacao: 'U' }])[0].quantidade).toBe(1)
  })

  it('não quebra com entrada nula', () => {
    expect(normalizarItensEstoque(null)).toEqual([])
    expect(normalizarItensEstoque([null, undefined])).toEqual([])
  })
})

describe('agruparPorNome', () => {
  it('junta as variações do mesmo produto num grupo só', () => {
    const itens = [
      { nome: 'Vestido', variacao: 'P', quantidade: 1 },
      { nome: 'Blusa',   variacao: 'M', quantidade: 2 },
      { nome: 'Vestido', variacao: 'G', quantidade: 1 },
    ]
    expect(agruparPorNome(itens)).toEqual([
      { nome: 'Vestido', itens: [itens[0], itens[2]] },
      { nome: 'Blusa',   itens: [itens[1]] },
    ])
  })

  it('devolve lista vazia sem itens', () => {
    expect(agruparPorNome([])).toEqual([])
  })
})

describe('filtrarPorVariacao', () => {
  const movs = [
    { variacao_label: 'P', delta: -1 },
    { variacao_label: 'M', delta: 4 },
    { variacao_label: null, delta: 2 },
  ]

  it('sem filtro devolve tudo', () => {
    expect(filtrarPorVariacao(movs, '')).toHaveLength(3)
    expect(filtrarPorVariacao(movs, null)).toHaveLength(3)
  })

  it('filtra pela variação escolhida', () => {
    expect(filtrarPorVariacao(movs, 'M')).toEqual([{ variacao_label: 'M', delta: 4 }])
  })
})

// O delta e o saldo são calculados pelo trigger no Postgres, a partir do
// OLD.variacoes vs NEW.variacoes. Estes testes fixam o outro lado do contrato:
// as quantidades que o client grava, e que o trigger vai ler como qtd_nova.
describe('saldo resultante — o que o trigger vai ver', () => {
  it('venda: normalizar + decrementar produz o saldo esperado', () => {
    const variacoes = [{ cor: 'P', quantidade: 5 }, { cor: 'M', quantidade: 2 }]
    const itens = normalizarItensEstoque([{ nome: 'Vestido', variacao: 'P', qtd: 2 }])
    expect(decrementarVariacoes(variacoes, itens)).toEqual([
      { cor: 'P', quantidade: 3 },
      { cor: 'M', quantidade: 2 },
    ])
  })

  it('devolução: restaurar volta ao saldo anterior', () => {
    const variacoes = [{ cor: 'P', quantidade: 3 }]
    const itens = normalizarItensEstoque([{ nome: 'Vestido', variacao: 'P', quantidade: 2 }])
    expect(restaurarVariacoes(variacoes, itens)).toEqual([{ cor: 'P', quantidade: 5 }])
  })

  it('cancelamento de pedido: devolve exatamente o que o checkout baixou', () => {
    // lf_pedidos.produtos usa `qtd`. O checkout baixou 3 de "Preta"; o
    // cancelamento tem que repor os mesmos 3, e nada além disso.
    const itensPedido = [{ nome: 'Blusa', variacao: 'Preta', qtd: 3, preco: 49.9 }]
    const aposCheckout = decrementarVariacoes(
      [{ cor: 'Preta', quantidade: 10 }, { cor: 'Branca', quantidade: 4 }],
      normalizarItensEstoque(itensPedido))
    expect(aposCheckout).toEqual([{ cor: 'Preta', quantidade: 7 }, { cor: 'Branca', quantidade: 4 }])

    const aposCancelar = restaurarVariacoes(aposCheckout, normalizarItensEstoque(itensPedido))
    expect(aposCancelar).toEqual([{ cor: 'Preta', quantidade: 10 }, { cor: 'Branca', quantidade: 4 }])
  })

  it('pedido do catálogo simples não mexe em estoque nos dois sentidos', () => {
    // Sem variação o checkout não baixa nada — o cancelamento também não pode repor.
    const itens = normalizarItensEstoque([{ nome: 'Bolsa', qtd: 2, preco: 79.9 }])
    expect(itens).toEqual([])
    expect(restaurarVariacoes([{ cor: 'Único', quantidade: 5 }], itens))
      .toEqual([{ cor: 'Único', quantidade: 5 }])
  })

  it('venda maior que o saldo trava em 0 — delta nunca leva a negativo', () => {
    const variacoes = [{ cor: 'P', quantidade: 1 }]
    const itens = normalizarItensEstoque([{ nome: 'Vestido', variacao: 'P', qtd: 4 }])
    expect(decrementarVariacoes(variacoes, itens)).toEqual([{ cor: 'P', quantidade: 0 }])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Excluir pedido devolve estoque — menos quando ele já foi devolvido
//
// A baixa acontece na CRIAÇÃO do pedido, não no pagamento. Apagar um pedido
// vivo sem devolver abre furo de estoque; devolver de novo num pedido já
// cancelado duplica peça. Os dois erros custam caro e são opostos.
// ─────────────────────────────────────────────────────────────────────────────
describe('precisaDevolverEstoque', () => {
  it('pedido vivo precisa devolver', () => {
    expect(precisaDevolverEstoque('aguardando_pagamento')).toBe(true)
    expect(precisaDevolverEstoque('aguardando_contato')).toBe(true)
    expect(precisaDevolverEstoque('pago')).toBe(true)
  })

  it('pedido JÁ cancelado NÃO devolve de novo', () => {
    // cancelarPedido já devolveu no momento do cancelamento.
    expect(precisaDevolverEstoque('cancelado')).toBe(false)
  })

  it('espaço em volta não engana a comparação', () => {
    expect(precisaDevolverEstoque('  cancelado  ')).toBe(false)
  })

  it('status ausente ou estranho devolve — o erro barato é o de sobrar pedido', () => {
    // Sem saber o status, devolver e falhar no DELETE deixa o pedido na lista.
    // Não devolver e apagar deixaria a peça sumida para sempre.
    expect(precisaDevolverEstoque(null)).toBe(true)
    expect(precisaDevolverEstoque(undefined)).toBe(true)
    expect(precisaDevolverEstoque('')).toBe(true)
    expect(precisaDevolverEstoque('rascunho')).toBe(true)
  })

  it('só o valor exato "cancelado" dispensa a devolução', () => {
    expect(precisaDevolverEstoque('Cancelado')).toBe(true)
    expect(precisaDevolverEstoque('cancelado_pelo_cliente')).toBe(true)
  })
})
