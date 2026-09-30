import { describe, it, expect, vi } from 'vitest'

// O hook não usa estado do React — é uma fábrica de funções —, então dá para
// chamá-lo direto no teste. O client real das lojas é trocado por um marcador
// para provar QUAL client cada chamada usa.
vi.mock('../../lib/supabase', () => ({ supabase: { __nome: 'client-das-lojas' } }))

const { useBalanco } = await import('./useBalanco')

/** Client falso que registra tabela/rpc e devolve o que o teste mandar. */
function clientFake({ rpc = () => ({ data: 1, error: null }), produto = { variacoes: [{ cor: 'G', quantidade: 5 }] } } = {}) {
  const log = []
  const builder = tabela => {
    const api = {
      insert: v => { log.push({ tabela, op: 'insert', v }); return api },
      update: v => { log.push({ tabela, op: 'update', v }); return api },
      select: () => api,
      eq: () => api,
      order: () => api,
      single: () => Promise.resolve({ data: { id: 'nova' }, error: null }),
      maybeSingle: () => Promise.resolve({ data: produto, error: null }),
      then: (ok, err) => Promise.resolve({ data: null, error: null }).then(ok, err),
    }
    return api
  }
  return {
    log,
    from: tabela => { log.push({ tabela, op: 'from' }); return builder(tabela) },
    rpc: vi.fn(async (nome, args) => { log.push({ rpc: nome, args }); return rpc(nome, args) }),
  }
}

describe('useBalanco — client parametrizável', () => {
  it('usa o client recebido (supabaseAdmin no /balanco), não o das lojas', async () => {
    const admin = clientFake()
    const balanco = useBalanco(admin)
    await balanco.criarSessao({ loja_id: 'tropicaleatacado', status: 'aberta' })
    await balanco.fecharSessao('s1')
    expect(admin.log.filter(l => l.op === 'from').map(l => l.tabela)).toEqual(['bal_sessoes', 'bal_sessoes'])
  })

  it('sem parâmetro, continua no client das lojas (padrão de antes, para o Mercado)', async () => {
    const { supabase } = await import('../../lib/supabase')
    supabase.from = vi.fn(() => ({ insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }))
    await useBalanco().criarSessao({})
    expect(supabase.from).toHaveBeenCalledWith('bal_sessoes')
  })
})

describe('aplicarAjustes — falha de estoque não vira "Estoque atualizado!"', () => {
  const ajuste = [{ produto_id: 'p1', variacao_label: 'G', qtd_anterior: 5, qtd_nova: 4 }]

  it('grava em bal_ajustes e chama lf_set_variacoes com a quantidade nova', async () => {
    const c = clientFake()
    const err = await useBalanco(c).aplicarAjustes('s1', ajuste, 'Thiago Admin')
    expect(err).toBeNull()
    expect(c.log.find(l => l.tabela === 'bal_ajustes' && l.op === 'insert')).toBeTruthy()
    const chamada = c.log.find(l => l.rpc === 'lf_set_variacoes')
    expect(chamada.args.p_variacoes).toEqual([{ cor: 'G', quantidade: 4 }])
    expect(chamada.args.p_origem_id).toBe('s1')
  })

  it('lf_set_variacoes negado (o caso do admin rodando como anon): devolve o erro', async () => {
    const negado = { code: '42501', message: 'permission denied for table lf_produtos' }
    const c = clientFake({ rpc: () => ({ data: null, error: negado }) })
    const err = await useBalanco(c).aplicarAjustes('s1', ajuste, 'x')
    expect(err).toBe(negado)
  })

  it('lf_set_variacoes sem erro mas com 0 linhas atualizadas: também é falha', async () => {
    const c = clientFake({ rpc: () => ({ data: 0, error: null }) })
    const err = await useBalanco(c).aplicarAjustes('s1', ajuste, 'x')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/não foi atualizado/)
  })

  it('RPC ausente (migration antiga): mantém o update direto de antes, sem erro', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = clientFake({ rpc: () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.lf_set_variacoes' } }) })
    const err = await useBalanco(c).aplicarAjustes('s1', ajuste, 'x')
    expect(err).toBeNull()
    expect(c.log.find(l => l.tabela === 'lf_produtos' && l.op === 'update')).toBeTruthy()
    warn.mockRestore()
  })
})
