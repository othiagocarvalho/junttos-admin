import { describe, it, expect, vi } from 'vitest'
import { encerrarBalancoSemAjuste, STATUS_ENCERRADA_SEM_AJUSTE, STATUS_ENCERRADA_SEM_AJUSTE_RESERVA } from './balanco'

/**
 * Supabase falso para UPDATE em bal_sessoes. `respostas` é a fila do que cada
 * .select() devolve; `chamadas` guarda o que foi gravado e com quais filtros.
 */
function fake(respostas) {
  const chamadas = []
  const client = {
    from: tabela => {
      const c = { tabela, filtros: {} }
      const api = {
        update: v => { c.update = v; return api },
        eq: (k, v) => { c.filtros[k] = v; return api },
        select: () => { chamadas.push(c); return Promise.resolve(respostas.shift()) },
      }
      return api
    },
  }
  return { client, chamadas }
}

describe('encerrarBalancoSemAjuste — botão "Encerrar balanço" do Estoque', () => {
  it('grava "cancelada" quando o banco aceita, só na sessão aberta da própria loja', async () => {
    const { client, chamadas } = fake([{ data: [{ id: 's1' }], error: null }])
    const r = await encerrarBalancoSemAjuste(client, { sessaoId: 's1', lojaId: 'tropicaleatacado' })
    expect(r).toEqual({ ok: true, status: STATUS_ENCERRADA_SEM_AJUSTE, erro: null })
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].tabela).toBe('bal_sessoes')
    expect(chamadas[0].update.status).toBe('cancelada')
    expect(chamadas[0].update.finalizado_em).toEqual(expect.any(String))
    expect(chamadas[0].filtros).toEqual({ id: 's1', loja_id: 'tropicaleatacado', status: 'aberta' })
  })

  it('restrição ainda sem "cancelada" (23514): cai em "finalizada" — nunca em "concluida"', async () => {
    const { client, chamadas } = fake([
      { data: null, error: { code: '23514', message: 'violates check constraint "bal_sessoes_status_check"' } },
      { data: [{ id: 's1' }], error: null },
    ])
    const r = await encerrarBalancoSemAjuste(client, { sessaoId: 's1', lojaId: 'l1' })
    expect(r).toEqual({ ok: true, status: STATUS_ENCERRADA_SEM_AJUSTE_RESERVA, erro: null })
    expect(chamadas.map(c => c.update.status)).toEqual(['cancelada', 'finalizada'])
    expect(STATUS_ENCERRADA_SEM_AJUSTE_RESERVA).not.toBe('concluida')
  })

  it('outro erro (rede, permissão): devolve a falha em vez de engolir', async () => {
    const erro = { code: '42501', message: 'permission denied' }
    const { client, chamadas } = fake([{ data: null, error: erro }])
    const r = await encerrarBalancoSemAjuste(client, { sessaoId: 's1', lojaId: 'l1' })
    expect(r).toEqual({ ok: false, status: null, erro })
    expect(chamadas).toHaveLength(1) // não tenta o reserva para erro que não é da restrição
  })

  it('UPDATE sem nenhuma linha (já encerrada / outra loja / RLS): é falha, com mensagem', async () => {
    const { client } = fake([{ data: [], error: null }])
    const r = await encerrarBalancoSemAjuste(client, { sessaoId: 's1', lojaId: 'l1' })
    expect(r.ok).toBe(false)
    expect(r.erro.message).toMatch(/Nenhum balanço aberto/)
  })

  it('o reserva também falhando devolve o erro dele', async () => {
    const { client } = fake([
      { data: null, error: { code: '23514', message: 'check' } },
      { data: null, error: { code: '500', message: 'timeout' } },
    ])
    const r = await encerrarBalancoSemAjuste(client, { sessaoId: 's1', lojaId: 'l1' })
    expect(r).toEqual({ ok: false, status: null, erro: { code: '500', message: 'timeout' } })
  })

  it('sem .select() a função não saberia se gravou: garante que pede o retorno', async () => {
    const select = vi.fn(() => Promise.resolve({ data: [{ id: 's1' }], error: null }))
    const api = { update: () => api, eq: () => api, select }
    await encerrarBalancoSemAjuste({ from: () => api }, { sessaoId: 's1', lojaId: 'l1' })
    expect(select).toHaveBeenCalledWith('id')
  })
})
