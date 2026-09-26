import { describe, it, expect, vi } from 'vitest'
import { sincronizarClienteDaVenda } from './clienteVenda'
import { finalizarPreVenda } from './prevenda'

// Banco em memória com a mesma interface que useLojaData.js injeta. A busca
// imita o ilike do PostgREST (sem caixa, SEM trim, "_" e "%" como curinga) —
// é exatamente o que o banco devolve, e o helper precisa se virar com isso.
function criarBancoFake(inicial = []) {
  const linhas = inicial.map(c => ({ ...c }))
  let seq = linhas.length
  const ilike = (valor, padrao) => {
    const re = new RegExp('^' + padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i')
    return re.test(valor || '')
  }
  const db = {
    linhas,
    buscarPorNome: vi.fn(async nome => linhas.filter(c => ilike(c.nome, nome)).map(c => ({ ...c }))),
    inserir: vi.fn(async row => { const novo = { id: `c${++seq}`, ...row }; linhas.push(novo); return { ...novo } }),
    atualizar: vi.fn(async (id, campos) => { const c = linhas.find(x => x.id === id); Object.assign(c, campos); return { ...c } }),
  }
  return db
}

describe('sincronizarClienteDaVenda', () => {
  it('sem nome, não faz nada — nem consulta o banco', async () => {
    const db = criarBancoFake()
    const r = await sincronizarClienteDaVenda(db, { nome: '   ', telefone: '123', aniversario: '1990-01-01' })
    expect(r.acao).toBe('ignorado')
    expect(db.buscarPorNome).not.toHaveBeenCalled()
    expect(db.inserir).not.toHaveBeenCalled()
  })

  it('cliente novo + aniversário: cria UMA vez, já com o aniversário (o bug de 16/09)', async () => {
    const db = criarBancoFake([{ id: 'c0', nome: 'Ana', telefone: null, data_nascimento: null }])
    const r = await sincronizarClienteDaVenda(db, { nome: ' Maria Silva ', telefone: '(11) 99999-0000', aniversario: '1990-05-20' })

    expect(r.acao).toBe('criado')
    expect(db.inserir).toHaveBeenCalledTimes(1)
    expect(db.inserir).toHaveBeenCalledWith({
      nome: 'Maria Silva', telefone: '(11) 99999-0000', email: null, data_nascimento: '1990-05-20', observacoes: null,
    })
    expect(db.atualizar).not.toHaveBeenCalled()
    const marias = db.linhas.filter(c => c.nome.toLowerCase() === 'maria silva')
    expect(marias).toHaveLength(1)
    expect(marias[0].data_nascimento).toBe('1990-05-20')
    // devolve o registro gravado, com id — é o que addVenda repassa
    expect(r.cliente).toMatchObject({ id: expect.any(String), nome: 'Maria Silva', data_nascimento: '1990-05-20' })
  })

  it('duas vendas seguidas da mesma cliente nova não duplicam', async () => {
    const db = criarBancoFake()
    await sincronizarClienteDaVenda(db, { nome: 'Maria Silva', telefone: '11999990000', aniversario: '1990-05-20' })
    await sincronizarClienteDaVenda(db, { nome: 'maria silva', telefone: '(11) 99999-0000', aniversario: '1990-05-20' })
    expect(db.linhas).toHaveLength(1)
    expect(db.inserir).toHaveBeenCalledTimes(1)
  })

  it('cliente já existe sem aniversário: atualiza o aniversário, não cria outro', async () => {
    const db = criarBancoFake([{ id: '42', nome: 'MARIA SILVA', telefone: '123', data_nascimento: null }])
    const r = await sincronizarClienteDaVenda(db, { nome: 'Maria Silva', telefone: '123', aniversario: '1990-05-20' })

    expect(r.acao).toBe('atualizado')
    expect(db.atualizar).toHaveBeenCalledWith('42', { data_nascimento: '1990-05-20' })
    expect(db.inserir).not.toHaveBeenCalled()
    expect(db.linhas).toHaveLength(1)
    expect(db.linhas[0].data_nascimento).toBe('1990-05-20')
  })

  it('cliente já existe COM aniversário: não sobrescreve', async () => {
    const db = criarBancoFake([{ id: '42', nome: 'Maria Silva', telefone: '123', data_nascimento: '1985-01-01' }])
    const r = await sincronizarClienteDaVenda(db, { nome: 'Maria Silva', telefone: '123', aniversario: '1990-05-20' })
    expect(r.acao).toBe('existente')
    expect(db.atualizar).not.toHaveBeenCalled()
    expect(db.inserir).not.toHaveBeenCalled()
    expect(db.linhas[0].data_nascimento).toBe('1985-01-01')
  })

  it('cliente existente sem telefone: completa telefone e aniversário numa atualização só', async () => {
    const db = criarBancoFake([{ id: '7', nome: 'Joana', telefone: null, data_nascimento: null }])
    await sincronizarClienteDaVenda(db, { nome: 'Joana', telefone: '85 9999', aniversario: '2000-02-02' })
    expect(db.atualizar).toHaveBeenCalledTimes(1)
    expect(db.atualizar).toHaveBeenCalledWith('7', { telefone: '85 9999', data_nascimento: '2000-02-02' })
  })

  it('mesmo nome, telefone diferente: é outra pessoa — cria (regra que addVenda já tinha)', async () => {
    const db = criarBancoFake([{ id: '1', nome: 'Ana Paula', telefone: '1111', data_nascimento: null }])
    const r = await sincronizarClienteDaVenda(db, { nome: 'Ana Paula', telefone: '2222' })
    expect(r.acao).toBe('criado')
    expect(db.linhas).toHaveLength(2)
  })

  it('"_" no nome não vira curinga: Ana_Maria não casa com AnaXMaria', async () => {
    const db = criarBancoFake([{ id: '1', nome: 'AnaXMaria', telefone: null, data_nascimento: null }])
    const r = await sincronizarClienteDaVenda(db, { nome: 'Ana_Maria' })
    expect(r.acao).toBe('criado')
    expect(db.atualizar).not.toHaveBeenCalled()
  })

  it('sem aniversário: cria com data_nascimento null (caso da Pré-venda)', async () => {
    const db = criarBancoFake()
    await sincronizarClienteDaVenda(db, { nome: 'Bia', telefone: '' })
    expect(db.linhas[0]).toMatchObject({ nome: 'Bia', telefone: null, data_nascimento: null })
  })

  it('erro no banco não propaga — a venda já foi salva e não pode ser derrubada', async () => {
    const db = criarBancoFake()
    db.inserir.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sincronizarClienteDaVenda(db, { nome: 'Nova', aniversario: '2000-01-01' }))
      .resolves.toEqual({ acao: 'erro', cliente: null })
    expect(spy).toHaveBeenCalledWith('[auto-cliente]', expect.any(Error))
    spy.mockRestore()
  })
})

describe('finalizarPreVenda — cliente da pré-venda entra em lf_clientes', () => {
  const preVenda = { id: 'pv1', cliente_nome: 'Carla Souza', cliente_tel: '(85) 98888-7777', status: 'aguardando_pagamento' }

  it('pré-venda com cliente nova: finaliza e cria a cliente uma vez', async () => {
    const db = criarBancoFake()
    const updateVenda = vi.fn().mockResolvedValue(null)
    const sincronizarClienteVenda = dados => sincronizarClienteDaVenda(db, dados)

    const erro = await finalizarPreVenda({ updateVenda, sincronizarClienteVenda }, preVenda, '[{"forma":"Pix","valor":100}]')

    expect(erro).toBeNull()
    expect(updateVenda).toHaveBeenCalledWith('pv1', { status: 'completa', forma_pgto: '[{"forma":"Pix","valor":100}]' })
    expect(db.linhas).toHaveLength(1)
    expect(db.linhas[0]).toMatchObject({ nome: 'Carla Souza', telefone: '(85) 98888-7777', data_nascimento: null })
  })

  it('pré-venda de cliente que já existe: não duplica', async () => {
    const db = criarBancoFake([{ id: 'c9', nome: 'carla souza', telefone: '85988887777', data_nascimento: '1992-03-03' }])
    const sincronizarClienteVenda = dados => sincronizarClienteDaVenda(db, dados)
    await finalizarPreVenda({ updateVenda: vi.fn().mockResolvedValue(null), sincronizarClienteVenda }, preVenda, '[]')
    expect(db.linhas).toHaveLength(1)
    expect(db.inserir).not.toHaveBeenCalled()
  })

  it('se a finalização falha, não cadastra ninguém', async () => {
    const sincronizarClienteVenda = vi.fn()
    const erro = await finalizarPreVenda({ updateVenda: vi.fn().mockResolvedValue({ message: 'rls' }), sincronizarClienteVenda }, preVenda, '[]')
    expect(erro).toEqual({ message: 'rls' })
    expect(sincronizarClienteVenda).not.toHaveBeenCalled()
  })

  it('pré-venda sem cliente identificada: finaliza sem criar nada', async () => {
    const db = criarBancoFake()
    const sincronizarClienteVenda = dados => sincronizarClienteDaVenda(db, dados)
    await finalizarPreVenda({ updateVenda: vi.fn().mockResolvedValue(null), sincronizarClienteVenda }, { id: 'pv2', cliente_nome: null }, '[]')
    expect(db.linhas).toHaveLength(0)
  })
})
