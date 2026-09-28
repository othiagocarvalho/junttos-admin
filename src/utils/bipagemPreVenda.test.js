import { describe, it, expect } from 'vitest'
import { criarBipagemPreVenda, TEXTO_BALANCO } from './bipagemPreVenda'
import { criarTravaPorChave } from './travaPorChave'
import { rotuloVariacao } from './codigoBarras'
import { aplicarReservas, chaveReserva } from './prevenda'

const dormir = ms => new Promise(r => setTimeout(r, ms))

const catalogo = () => [
  { id: 'p-vestido', nome: 'VESTIDO', preco_venda: 100, variacoes: [{ cor: 'Rosa', quantidade: 20 }, { cor: 'Nude', quantidade: 1 }] },
  { id: 'p-bolsa',   nome: 'BOLSA',   preco_venda: 50,  variacoes: [], quantidade: 3 },
  // Dois produtos de MESMO NOME, preços diferentes — o caso do Short Listrado.
  { id: 'p-short-a', nome: 'SHORT LISTRADO', preco_venda: 40, variacoes: [{ cor: 'Azul', quantidade: 5 }] },
  { id: 'p-short-b', nome: 'SHORT LISTRADO', preco_venda: 60, variacoes: [{ cor: 'Azul', quantidade: 5 }] },
]

/**
 * Banco falso: estoque em memória com as mesmas regras das RPCs (decremento
 * de 1, erro ESTOQUE_INSUFICIENTE, restauro de 1), lf_vendas em memória e um
 * contador de operações em voo — se a fila deixasse duas tarefas rodarem
 * juntas, maxEmVoo passaria de 1.
 */
function criarCenario({ falharInsert = false, falharUpdate = false, travado = false } = {}) {
  const produtos = catalogo()
  const vendas = []
  const log = []
  let emVoo = 0
  let maxEmVoo = 0
  async function operacao(registro, fn) {
    emVoo++; maxEmVoo = Math.max(maxEmVoo, emVoo)
    log.push(registro)
    try { await dormir(2); return fn() } finally { emVoo-- }
  }
  const alvo = (args) => {
    const p = produtos.find(x => x.id === args.p_produto_id)
    const rotulo = Object.values(args.p_variacao || {})[0] ?? null
    return { p, rotulo, v: rotulo ? p.variacoes.find(v => rotuloVariacao(v) === rotulo) : null }
  }
  const supabase = {
    rpc: (nome, args) => operacao({ tipo: nome, args }, () => {
      const { p, rotulo, v } = alvo(args)
      if (nome === 'bipar_item_prevenda') {
        const disponivel = v ? v.quantidade : p.quantidade
        if (disponivel < 1) {
          return { data: null, error: { message: 'ESTOQUE_INSUFICIENTE:' + JSON.stringify({ produto_id: p.id, cor: rotulo, disponivel, pedido: 1 }) } }
        }
        if (v) v.quantidade -= 1; else p.quantidade -= 1
        return { data: { ok: true }, error: null }
      }
      if (nome === 'restaurar_item_prevenda') {
        if (v) v.quantidade += 1; else p.quantidade += 1
        return { data: { ok: true }, error: null }
      }
      throw new Error('rpc desconhecida ' + nome)
    }),
  }
  const addVendaRaw = (payload, opts) => operacao({ tipo: 'insert', payload, opts }, () => {
    if (falharInsert) return { error: { message: 'falhou' }, venda: null }
    const venda = { id: `venda-${vendas.length + 1}`, ...payload }
    vendas.push(venda)
    return { error: null, venda }
  })
  const updateVenda = (id, updates, opts) => operacao({ tipo: 'update', id, updates, opts }, () => {
    if (falharUpdate) return { message: 'falhou' }
    Object.assign(vendas.find(v => v.id === id), updates)
    return null
  })
  const contexto = {
    clienteNome: 'Maria', clienteTel: '85999990000', vendedora: 'Ana',
    produtosData: catalogo(), // snapshot "da abertura da tela", como na vida real
    travado,
    addVendaRaw, updateVenda,
  }
  const estados = []
  const bip = criarBipagemPreVenda({
    supabase, lojaId: 'sualoja',
    lerContexto: () => contexto,
    aoMudar: e => estados.push(e),
  })
  const prod = id => contexto.produtosData.find(p => p.id === id)
  const estoqueDe = (id, rotulo) => {
    const p = produtos.find(x => x.id === id)
    return rotulo ? p.variacoes.find(v => rotuloVariacao(v) === rotulo).quantidade : p.quantidade
  }
  return { bip, vendas, log, prod, estoqueDe, estados, contexto, maxEmVoo: () => maxEmVoo }
}

describe('bipagem da pré-venda — fila', () => {
  it('10 bipes seguidos rápido: todos processados, em ordem, um por vez, sem perder nenhum', async () => {
    const c = criarCenario()
    const vestido = c.prod('p-vestido')
    // Dispara os 10 sem esperar nenhum — como o leitor em rajada.
    const resultados = await Promise.all(Array.from({ length: 10 }, () => c.bip.registrarItem(vestido, 'Rosa')))

    expect(resultados.every(r => r.ok)).toBe(true)
    expect(c.maxEmVoo()).toBe(1)
    expect(c.estoqueDe('p-vestido', 'Rosa')).toBe(10)
    expect(c.vendas).toHaveLength(1)
    expect(c.vendas[0].produtos).toEqual([{ produto_id: 'p-vestido', nome: 'VESTIDO', variacao: 'Rosa', obs: '', quantidade: 10 }])
    expect(c.vendas[0].valor).toBe(1000)
    // Ordem: bipe, insert, depois (bipe, update) x9 — nunca duas RPCs sem a gravação entre elas.
    expect(c.log.map(l => l.tipo)).toEqual([
      'bipar_item_prevenda', 'insert',
      ...Array.from({ length: 9 }, () => ['bipar_item_prevenda', 'update']).flat(),
    ])
    expect(c.bip.estado().itens[0].quantidade).toBe(10)
  })

  it('segundo bipe rápido NÃO cria uma segunda venda — vira UPDATE na primeira', async () => {
    const c = criarCenario()
    const p1 = c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    const p2 = c.bip.registrarItem(c.prod('p-vestido'), 'Nude') // antes de p1 terminar
    await Promise.all([p1, p2])
    expect(c.log.filter(l => l.tipo === 'insert')).toHaveLength(1)
    expect(c.vendas).toHaveLength(1)
    // A RPC do segundo bipe já leva o id da venda criada pelo primeiro.
    expect(c.log.filter(l => l.tipo === 'bipar_item_prevenda')[1].args.p_origem_id).toBe('venda-1')
    expect(c.vendas[0].produtos.map(p => p.variacao)).toEqual(['Rosa', 'Nude'])
  })

  it('nenhuma gravação da bipagem pede fetchAll (recarregar: false)', async () => {
    const c = criarCenario()
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    await c.bip.removerItem(c.bip.estado().itens[0])
    const gravacoes = c.log.filter(l => l.tipo === 'insert' || l.tipo === 'update')
    expect(gravacoes.length).toBeGreaterThan(0)
    expect(gravacoes.every(g => g.opts?.recarregar === false)).toBe(true)
  })

  it('sair com fila pendente: aguardarVazia só resolve quando tudo foi gravado', async () => {
    const c = criarCenario()
    const vestido = c.prod('p-vestido')
    c.bip.registrarItem(vestido, 'Rosa')
    c.bip.registrarItem(vestido, 'Rosa')
    c.bip.registrarItem(c.prod('p-bolsa'), null)
    expect(c.bip.pendentes()).toBe(3)
    // Enquanto há fila, os dados da cliente ficam travados.
    expect(c.bip.estado().dadosTravados).toBe(true)

    await c.bip.aguardarVazia()
    expect(c.bip.pendentes()).toBe(0)
    expect(c.vendas[0].produtos).toHaveLength(2)
    expect(c.vendas[0].produtos.reduce((s, p) => s + p.quantidade, 0)).toBe(3)
    expect(c.estados.at(-1).pendentes).toBe(0)
  })
})

describe('bipagem da pré-venda — busca por nome', () => {
  it('toque duplo na busca não baixa duas vezes', async () => {
    const c = criarCenario()
    const trava = criarTravaPorChave()
    const vestido = c.prod('p-vestido')
    const tocar = () => trava.executar(chaveReserva(vestido.id, 'Nude'), () => c.bip.registrarItem(vestido, 'Nude'))
    await Promise.all([tocar(), tocar()])
    expect(c.log.filter(l => l.tipo === 'bipar_item_prevenda')).toHaveLength(1)
    expect(c.estoqueDe('p-vestido', 'Nude')).toBe(0)
    expect(c.vendas[0].produtos[0].quantidade).toBe(1)
  })

  it('produto sem variação: RPC recebe variação vazia e baixa a quantidade direto', async () => {
    const c = criarCenario()
    const bolsa = c.prod('p-bolsa')
    const r = await c.bip.registrarItem(bolsa, null)
    expect(r).toEqual({ ok: true, texto: 'BOLSA' })
    expect(c.log[0].args.p_variacao).toEqual({})
    expect(c.estoqueDe('p-bolsa', null)).toBe(2)
    expect(c.vendas[0].produtos).toEqual([{ produto_id: 'p-bolsa', nome: 'BOLSA', variacao: null, obs: '', quantidade: 1 }])

    // E a remoção devolve pelo mesmo caminho (variação vazia).
    await c.bip.removerItem(c.bip.estado().itens[0])
    expect(c.estoqueDe('p-bolsa', null)).toBe(3)
    expect(c.log.at(-2).args.p_variacao).toEqual({})
  })

  it('produto sem variação esgotado: a RPC recusa e nada é gravado', async () => {
    const c = criarCenario()
    const bolsa = c.prod('p-bolsa')
    for (let i = 0; i < 3; i++) await c.bip.registrarItem(bolsa, null)
    const r = await c.bip.registrarItem(bolsa, null)
    expect(r.ok).toBe(false)
    expect(r.texto).toBe('Só temos 0 unidade(s) de BOLSA disponível agora.')
    expect(c.vendas[0].produtos[0].quantidade).toBe(3)
  })

  it('dois produtos de mesmo nome: cada um é identificado pelo id', async () => {
    const c = criarCenario()
    await c.bip.registrarItem(c.prod('p-short-a'), 'Azul')
    await c.bip.registrarItem(c.prod('p-short-b'), 'Azul')

    const itens = c.bip.estado().itens
    expect(itens.map(i => i.produto_id)).toEqual(['p-short-a', 'p-short-b'])
    expect(c.estoqueDe('p-short-a', 'Azul')).toBe(4)
    expect(c.estoqueDe('p-short-b', 'Azul')).toBe(4)
    expect(c.vendas[0].valor).toBe(100) // 40 + 60 — preço de cada um, não do primeiro de mesmo nome

    // Remover o B devolve ao B, não ao A.
    await c.bip.removerItem(itens[1])
    expect(c.estoqueDe('p-short-a', 'Azul')).toBe(4)
    expect(c.estoqueDe('p-short-b', 'Azul')).toBe(5)
    expect(c.bip.estado().itens.map(i => i.produto_id)).toEqual(['p-short-a'])
  })
})

describe('bipagem da pré-venda — falhas e remoção', () => {
  it('INSERT falhou: devolve a peça, não guarda venda, e o próximo bipe tenta INSERT de novo', async () => {
    const c = criarCenario({ falharInsert: true })
    const r = await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    expect(r).toEqual({ ok: false, texto: 'Não foi possível salvar a pré-venda. Tente de novo.' })
    expect(c.estoqueDe('p-vestido', 'Rosa')).toBe(20)
    expect(c.log.map(l => l.tipo)).toEqual(['bipar_item_prevenda', 'insert', 'restaurar_item_prevenda'])
    expect(c.bip.estado().vendaId).toBeNull()
    expect(c.bip.estado().dadosTravados).toBe(false)
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    expect(c.log.filter(l => l.tipo === 'insert')).toHaveLength(2)
  })

  it('UPDATE falhou: devolve a peça e a lista local não muda', async () => {
    const c = criarCenario()
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    c.contexto.updateVenda = async () => ({ message: 'falhou' })
    const r = await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    expect(r.ok).toBe(false)
    expect(c.estoqueDe('p-vestido', 'Rosa')).toBe(19)
    expect(c.bip.estado().itens[0].quantidade).toBe(1)
  })

  it('balanço em andamento: recusa sem chamar a RPC', async () => {
    const c = criarCenario({ travado: true })
    const r = await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    expect(r).toEqual({ ok: false, texto: TEXTO_BALANCO })
    expect(c.log).toHaveLength(0)
  })

  it('remover linha entra na fila e acha a linha na hora (não pelo índice antigo)', async () => {
    const c = criarCenario()
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    const linhaRosa = c.bip.estado().itens[0]
    // Bipe e remoção disparados juntos: a remoção roda depois do bipe da Nude.
    await Promise.all([
      c.bip.registrarItem(c.prod('p-vestido'), 'Nude'),
      c.bip.removerItem(linhaRosa),
    ])
    expect(c.maxEmVoo()).toBe(1)
    // Duas unidades de Rosa → duas chamadas de restaurar (uma por unidade).
    expect(c.log.filter(l => l.tipo === 'restaurar_item_prevenda')).toHaveLength(2)
    expect(c.estoqueDe('p-vestido', 'Rosa')).toBe(20)
    expect(c.vendas[0].produtos.map(p => p.variacao)).toEqual(['Nude'])
    expect(c.vendas[0].valor).toBe(100)
  })

  it('remover a última linha cancela a pré-venda; o próximo bipe cria outra', async () => {
    const c = criarCenario()
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    await c.bip.removerItem(c.bip.estado().itens[0])
    expect(c.vendas[0].status).toBe('cancelada')
    expect(c.bip.estado()).toMatchObject({ vendaId: null, itens: [], dadosTravados: false })
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    expect(c.vendas).toHaveLength(2)
    expect(c.vendas[1].status).toBe('aguardando_pagamento')
  })
})

describe('bipagem da pré-venda — estoque de exibição', () => {
  it('desconta localmente ao bipar e devolve ao remover, sem tocar em produtosData', async () => {
    const c = criarCenario()
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    await c.bip.registrarItem(c.prod('p-vestido'), 'Rosa')
    await c.bip.registrarItem(c.prod('p-bolsa'), null)

    let exibido = aplicarReservas(c.contexto.produtosData, c.bip.estado().reservas)
    expect(exibido.find(p => p.id === 'p-vestido').variacoes[0].quantidade).toBe(18)
    expect(exibido.find(p => p.id === 'p-bolsa').quantidade).toBe(2)
    expect(c.contexto.produtosData.find(p => p.id === 'p-vestido').variacoes[0].quantidade).toBe(20)

    await c.bip.removerItem(c.bip.estado().itens[0])
    exibido = aplicarReservas(c.contexto.produtosData, c.bip.estado().reservas)
    expect(exibido.find(p => p.id === 'p-vestido').variacoes[0].quantidade).toBe(20)

    c.bip.zerarReservas()
    expect(c.bip.estado().reservas).toEqual({})
  })
})
