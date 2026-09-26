import { describe, it, expect } from 'vitest'
import {
  encontrarProdutoDoItem,
  parseErroEstoquePrevenda, mensagemErroEstoquePrevenda, variacaoParaRpc,
  montarInsertPrimeiroBipe, acrescentarBipe, removerLinha,
  itensParaRestaurar, encontrarProdutoPorNome,
} from './prevenda'

const produtosData = [
  { nome: 'VESTIDO CURTO', preco_venda: 89.9 },
  { nome: 'MACAQUINHO',    preco_venda: 129.9 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Erro de estoque — bipar_item_prevenda usa o mesmo prefixo de
// criar_pedido_catalogo, mas o payload não carrega `nome` (a RPC só conhece
// produto_id) — quem chama completa o nome a partir do que já tinha em mãos.
// ─────────────────────────────────────────────────────────────────────────────
describe('parseErroEstoquePrevenda', () => {
  it('desembrulha o JSON sem nome — só produto_id, cor, disponivel, pedido', () => {
    const msg = 'ESTOQUE_INSUFICIENTE:' + JSON.stringify({
      produto_id: 'abc-123', cor: 'AZUL', disponivel: 2, pedido: 1,
    })
    expect(parseErroEstoquePrevenda(msg)).toEqual({
      produtoId: 'abc-123', cor: 'AZUL', disponivel: 2, pedido: 1,
    })
  })

  it('produto sem variação vem com cor vazia', () => {
    const msg = 'ESTOQUE_INSUFICIENTE:' + JSON.stringify({ produto_id: 'x', cor: null, disponivel: 0, pedido: 1 })
    expect(parseErroEstoquePrevenda(msg)).toEqual({ produtoId: 'x', cor: '', disponivel: 0, pedido: 1 })
  })

  it('mensagem sem o prefixo devolve null', () => {
    expect(parseErroEstoquePrevenda('permission denied')).toBeNull()
    expect(parseErroEstoquePrevenda('')).toBeNull()
    expect(parseErroEstoquePrevenda(undefined)).toBeNull()
  })

  it('JSON quebrado depois do prefixo não derruba a tela — devolve null', () => {
    expect(parseErroEstoquePrevenda('ESTOQUE_INSUFICIENTE:{quebrado')).toBeNull()
  })
})

describe('mensagemErroEstoquePrevenda', () => {
  it('sem info (erro que não é de estoque) devolve texto genérico', () => {
    expect(mensagemErroEstoquePrevenda('VESTIDO', null)).toBe('Não foi possível bipar este item agora. Tente de novo.')
  })

  it('com cor, o nome vem de quem chama (não do payload da RPC)', () => {
    const info = { produtoId: 'x', cor: 'AZUL', disponivel: 2, pedido: 1 }
    expect(mensagemErroEstoquePrevenda('VESTIDO CURTO', info))
      .toBe('Só temos 2 unidade(s) de VESTIDO CURTO (AZUL) disponível agora.')
  })

  it('sem cor (produto sem variação), o nome não ganha sufixo de variação', () => {
    const info = { produtoId: 'x', cor: '', disponivel: 0, pedido: 1 }
    const msg = mensagemErroEstoquePrevenda('BOLSA', info)
    expect(msg).toBe('Só temos 0 unidade(s) de BOLSA disponível agora.')
    expect(msg).not.toContain('BOLSA (')
  })
})

describe('variacaoParaRpc', () => {
  it('com rótulo, devolve {cor: rótulo}', () => {
    expect(variacaoParaRpc('AZUL')).toEqual({ cor: 'AZUL' })
  })
  it('sem rótulo (produto sem variação), devolve objeto vazio', () => {
    expect(variacaoParaRpc(null)).toEqual({})
    expect(variacaoParaRpc(undefined)).toEqual({})
    expect(variacaoParaRpc('')).toEqual({})
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Montagem do payload de INSERT no primeiro bipe — o coração da arquitetura
// da etapa 2 (decremento e persistência sempre juntos).
// ─────────────────────────────────────────────────────────────────────────────
describe('montarInsertPrimeiroBipe', () => {
  it('monta o payload completo com status/estoque_baixado explícitos', () => {
    const payload = montarInsertPrimeiroBipe({
      lojaId: 'tropicaleatacado', nome: 'VESTIDO CURTO', rotulo: 'AZUL',
      clienteNome: 'Ana', clienteTel: '85999990000', vendedora: 'Carla',
      produtosData,
    })
    expect(payload.loja_id).toBe('tropicaleatacado')
    expect(payload.cliente_nome).toBe('Ana')
    expect(payload.cliente_tel).toBe('85999990000')
    expect(payload.vendedora).toBe('Carla')
    expect(payload.produtos).toEqual([{ nome: 'VESTIDO CURTO', variacao: 'AZUL', obs: '', quantidade: 1 }])
    expect(payload.valor).toBeCloseTo(89.9, 2)
    expect(payload.status).toBe('aguardando_pagamento')
    expect(payload.estoque_baixado).toBe(true)
    expect(typeof payload.data).toBe('string')
  })

  it('cliente/vendedora vazios viram null, não string vazia', () => {
    const payload = montarInsertPrimeiroBipe({
      lojaId: 'x', nome: 'VESTIDO CURTO', rotulo: null,
      clienteNome: '', clienteTel: '  ', vendedora: '',
      produtosData,
    })
    expect(payload.cliente_nome).toBeNull()
    expect(payload.cliente_tel).toBeNull()
    expect(payload.vendedora).toBeNull()
  })

  it('produto sem variação (rotulo null) grava variacao null no item', () => {
    const payload = montarInsertPrimeiroBipe({
      lojaId: 'x', nome: 'MACAQUINHO', rotulo: null, produtosData,
    })
    expect(payload.produtos[0].variacao).toBeNull()
    expect(payload.valor).toBeCloseTo(129.9, 2)
  })

  it('produto não encontrado em produtosData grava preço 0, não quebra', () => {
    const payload = montarInsertPrimeiroBipe({
      lojaId: 'x', nome: 'PRODUTO FANTASMA', rotulo: null, produtosData,
    })
    expect(payload.valor).toBe(0)
  })
})

describe('acrescentarBipe', () => {
  it('primeiro bipe de um item novo entra como quantidade 1', () => {
    const { produtos, valor } = acrescentarBipe([], { nome: 'VESTIDO CURTO', variacao: 'AZUL' }, produtosData)
    expect(produtos).toEqual([{ nome: 'VESTIDO CURTO', variacao: 'AZUL', obs: '', quantidade: 1 }])
    expect(valor).toBeCloseTo(89.9, 2)
  })

  it('bipar a MESMA combinação de novo soma quantidade, não duplica linha', () => {
    const primeiro = acrescentarBipe([], { nome: 'VESTIDO CURTO', variacao: 'AZUL' }, produtosData)
    const { produtos, valor } = acrescentarBipe(primeiro.produtos, { nome: 'VESTIDO CURTO', variacao: 'AZUL' }, produtosData)
    expect(produtos).toEqual([{ nome: 'VESTIDO CURTO', variacao: 'AZUL', obs: '', quantidade: 2 }])
    expect(valor).toBeCloseTo(179.8, 2)
  })

  it('cor diferente do mesmo produto vira linha separada', () => {
    const primeiro = acrescentarBipe([], { nome: 'VESTIDO CURTO', variacao: 'AZUL' }, produtosData)
    const { produtos, valor } = acrescentarBipe(primeiro.produtos, { nome: 'VESTIDO CURTO', variacao: 'ROSA' }, produtosData)
    expect(produtos).toHaveLength(2)
    expect(valor).toBeCloseTo(179.8, 2)
  })

  it('acrescentar produto diferente soma o valor certo', () => {
    const primeiro = acrescentarBipe([], { nome: 'VESTIDO CURTO', variacao: 'AZUL' }, produtosData)
    const { produtos, valor } = acrescentarBipe(primeiro.produtos, { nome: 'MACAQUINHO', variacao: null }, produtosData)
    expect(produtos).toHaveLength(2)
    expect(valor).toBeCloseTo(89.9 + 129.9, 2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Remoção de linha — o caso que precisa acertar a transição pra 'cancelada'
// quando sobra zero item.
// ─────────────────────────────────────────────────────────────────────────────
describe('removerLinha', () => {
  const doisItens = [
    { nome: 'VESTIDO CURTO', variacao: 'AZUL', obs: '', quantidade: 3 },
    { nome: 'MACAQUINHO', variacao: null, obs: '', quantidade: 1 },
  ]

  it('remove a linha inteira (todas as unidades), não decrementa por 1', () => {
    const { produtos, valor, item, ficouVazia } = removerLinha(doisItens, 0, produtosData)
    expect(produtos).toEqual([{ nome: 'MACAQUINHO', variacao: null, obs: '', quantidade: 1 }])
    expect(item).toEqual({ nome: 'VESTIDO CURTO', variacao: 'AZUL', obs: '', quantidade: 3 })
    expect(valor).toBeCloseTo(129.9, 2)
    expect(ficouVazia).toBe(false)
  })

  it('remover a ÚLTIMA linha marca ficouVazia=true — quem chama cancela a pré-venda inteira', () => {
    const umItem = [{ nome: 'MACAQUINHO', variacao: null, obs: '', quantidade: 1 }]
    const { produtos, valor, item, ficouVazia } = removerLinha(umItem, 0, produtosData)
    expect(produtos).toEqual([])
    expect(valor).toBe(0)
    expect(item.nome).toBe('MACAQUINHO')
    expect(ficouVazia).toBe(true)
  })

  it('índice inexistente não quebra — devolve item null, nada muda', () => {
    const { produtos, item, ficouVazia } = removerLinha(doisItens, 9, produtosData)
    expect(item).toBeNull()
    expect(produtos).toEqual(doisItens)
    expect(ficouVazia).toBe(false)
  })

  it('array vazio: remover não quebra e já é "vazia"', () => {
    const { produtos, item, ficouVazia } = removerLinha([], 0, produtosData)
    expect(item).toBeNull()
    expect(produtos).toEqual([])
    expect(ficouVazia).toBe(true)
  })
})

describe('itensParaRestaurar', () => {
  it('uma entrada por item, com "vezes" = quantidade (mínimo 1)', () => {
    const produtos = [
      { nome: 'VESTIDO CURTO', variacao: 'AZUL', quantidade: 3 },
      { nome: 'MACAQUINHO', variacao: null, quantidade: 1 },
    ]
    expect(itensParaRestaurar(produtos)).toEqual([
      { nome: 'VESTIDO CURTO', variacao: 'AZUL', vezes: 3 },
      { nome: 'MACAQUINHO', variacao: null, vezes: 1 },
    ])
  })

  it('quantidade ausente ou zero vira "vezes"=1, nunca 0', () => {
    expect(itensParaRestaurar([{ nome: 'X', variacao: null, quantidade: 0 }])).toEqual([{ nome: 'X', variacao: null, vezes: 1 }])
    expect(itensParaRestaurar([{ nome: 'X', variacao: null }])).toEqual([{ nome: 'X', variacao: null, vezes: 1 }])
  })

  it('item sem nome é ignorado; array vazio/null devolve lista vazia', () => {
    expect(itensParaRestaurar([{ variacao: 'AZUL', quantidade: 1 }])).toEqual([])
    expect(itensParaRestaurar([])).toEqual([])
    expect(itensParaRestaurar(null)).toEqual([])
    expect(itensParaRestaurar(undefined)).toEqual([])
  })
})

describe('encontrarProdutoPorNome', () => {
  it('acha por nome exato', () => {
    expect(encontrarProdutoPorNome(produtosData, 'MACAQUINHO')).toEqual({ nome: 'MACAQUINHO', preco_venda: 129.9 })
  })
  it('não acha: devolve null, não undefined', () => {
    expect(encontrarProdutoPorNome(produtosData, 'NÃO EXISTE')).toBeNull()
  })
  it('produtosData vazio/null não quebra', () => {
    expect(encontrarProdutoPorNome([], 'X')).toBeNull()
    expect(encontrarProdutoPorNome(null, 'X')).toBeNull()
  })
})

// ── Etapa 2: produto_id na pré-venda ───────────────────────────────────────
describe('pré-venda com produto_id', () => {
  const produtosData = [{ id: 'a', nome: 'SHORT', preco_venda: 40 }, { id: 'b', nome: 'SHORT', preco_venda: 60 }]
  it('primeiro bipe grava produto_id no item', () => {
    const r = montarInsertPrimeiroBipe({ lojaId: 'l', produtoId: 'b', nome: 'SHORT', rotulo: 'M', produtosData })
    expect(r.produtos).toEqual([{ produto_id: 'b', nome: 'SHORT', variacao: 'M', obs: '', quantidade: 1 }])
    expect(r.valor).toBe(60)   // preço do produto CERTO, não o primeiro de mesmo nome
  })
  it('bipe seguinte do mesmo id soma; outro id de mesmo nome vira linha nova', () => {
    const base = [{ produto_id: 'b', nome: 'SHORT', variacao: 'M', obs: '', quantidade: 1 }]
    expect(acrescentarBipe(base, { produto_id: 'b', nome: 'SHORT', variacao: 'M' }, produtosData).produtos).toHaveLength(1)
    expect(acrescentarBipe(base, { produto_id: 'a', nome: 'SHORT', variacao: 'M' }, produtosData).produtos).toHaveLength(2)
  })
  it('itensParaRestaurar leva o produto_id adiante', () => {
    expect(itensParaRestaurar([{ produto_id: 'b', nome: 'SHORT', variacao: 'M', quantidade: 2 }]))
      .toEqual([{ produto_id: 'b', nome: 'SHORT', variacao: 'M', vezes: 2 }])
  })
  it('encontrarProdutoDoItem: pelo id; sem id, pelo nome', () => {
    expect(encontrarProdutoDoItem(produtosData, { produto_id: 'b', nome: 'SHORT' }).id).toBe('b')
    expect(encontrarProdutoDoItem(produtosData, { nome: 'SHORT' }).id).toBe('a')
    expect(encontrarProdutoDoItem(produtosData, { produto_id: 'zz', nome: 'SHORT' })).toBeNull()
  })
})
