import { describe, it, expect, vi } from 'vitest'
import { salvarAniversarioCliente } from './clienteVenda'

describe('salvarAniversarioCliente', () => {
  it('sem aniversário, não faz nada', async () => {
    const addCliente = vi.fn()
    const updateCliente = vi.fn()
    await salvarAniversarioCliente({ clientes: [], addCliente, updateCliente, nome: 'Maria', telefone: '123', aniversario: '' })
    expect(addCliente).not.toHaveBeenCalled()
    expect(updateCliente).not.toHaveBeenCalled()
  })

  it('sem nome, não faz nada mesmo com aniversário preenchido', async () => {
    const addCliente = vi.fn()
    const updateCliente = vi.fn()
    await salvarAniversarioCliente({ clientes: [], addCliente, updateCliente, nome: '  ', telefone: '', aniversario: '1990-01-01' })
    expect(addCliente).not.toHaveBeenCalled()
    expect(updateCliente).not.toHaveBeenCalled()
  })

  it('cliente novo (nome não existe na lista) -> cria com addCliente', async () => {
    const addCliente = vi.fn().mockResolvedValue({})
    const updateCliente = vi.fn()
    await salvarAniversarioCliente({
      clientes: [{ id: '1', nome: 'Ana' }],
      addCliente, updateCliente,
      nome: 'Maria Silva', telefone: '(11) 99999-0000', aniversario: '1990-05-20',
    })
    expect(addCliente).toHaveBeenCalledWith({ nome: 'Maria Silva', telefone: '(11) 99999-0000', data_nascimento: '1990-05-20' })
    expect(updateCliente).not.toHaveBeenCalled()
  })

  it('cliente já existe (mesmo nome, case/trim insensitive) e não tinha aniversário -> atualiza', async () => {
    const addCliente = vi.fn()
    const updateCliente = vi.fn().mockResolvedValue({})
    await salvarAniversarioCliente({
      clientes: [{ id: '42', nome: '  maria silva  ', data_nascimento: null }],
      addCliente, updateCliente,
      nome: 'Maria Silva', telefone: '123', aniversario: '1990-05-20',
    })
    expect(updateCliente).toHaveBeenCalledWith('42', { data_nascimento: '1990-05-20' })
    expect(addCliente).not.toHaveBeenCalled()
  })

  it('cliente já existe e já tinha aniversário -> não sobrescreve', async () => {
    const addCliente = vi.fn()
    const updateCliente = vi.fn()
    await salvarAniversarioCliente({
      clientes: [{ id: '42', nome: 'Maria Silva', data_nascimento: '1985-01-01' }],
      addCliente, updateCliente,
      nome: 'Maria Silva', telefone: '123', aniversario: '1990-05-20',
    })
    expect(updateCliente).not.toHaveBeenCalled()
    expect(addCliente).not.toHaveBeenCalled()
  })

  it('erro no addCliente/updateCliente não propaga (a venda não pode ser derrubada)', async () => {
    const addCliente = vi.fn().mockRejectedValue(new Error('boom'))
    const updateCliente = vi.fn()
    await expect(salvarAniversarioCliente({
      clientes: [], addCliente, updateCliente,
      nome: 'Nova Cliente', telefone: '', aniversario: '2000-01-01',
    })).resolves.toBeUndefined()
  })
})
