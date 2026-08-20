import { describe, it, expect } from 'vitest'
import {
  executarCriacaoLoja, desfazerCriacao, mensagemFalha, ETAPA,
} from './criarLojaFluxo'

// ── Fake do Supabase ─────────────────────────────────────────────────────────
//
// O fluxo só usa quatro formatos de chamada. O fake reproduz exatamente esses
// quatro e registra tudo, para o teste afirmar o que foi gravado E o que foi
// desfeito — que é o ponto desta suíte.

function thenable(valor, extra = {}) {
  return { ...extra, then: (res, rej) => Promise.resolve(valor).then(res, rej) }
}

/**
 * falhas: { config, cobrancas, contratante, createUser, rollback, deleteConfig }
 *   string        → erro devolvido em { error: { message } }
 *   Error/throw:X → invoke estoura (simula queda de rede)
 */
function fakeSupabase(falhas = {}, opts = {}) {
  const log = { inserts: [], deletes: [], invokes: [], ordem: [] }

  const supabase = {
    from(tabela) {
      return {
        select: () => ({
          or: () => ({
            maybeSingle: async () => ({ data: opts.slugEmUso ? { nome: 'Loja Existente' } : null }),
          }),
        }),
        insert(payload) {
          log.inserts.push({ tabela, payload })
          log.ordem.push(`insert:${tabela}`)
          if (tabela === 'lf_config') {
            return thenable({ error: falhas.config ? { message: falhas.config } : null })
          }
          if (tabela === 'jt_cobrancas') {
            return thenable({ error: null }, {
              select: async () => falhas.cobrancas
                ? { data: null, error: { message: falhas.cobrancas } }
                : { data: [{ id: 'c1', loja_id: payload[0].loja_id, tipo: payload[0].tipo, valor: payload[0].valor, vencimento: payload[0].vencimento }], error: null },
            })
          }
          return thenable({ error: null })
        },
        delete() {
          return {
            eq: (col, val) => {
              log.deletes.push({ tabela, col, val })
              log.ordem.push(`delete:${tabela}`)
              return thenable({ error: falhas.deleteConfig ? { message: falhas.deleteConfig } : null })
            },
          }
        },
      }
    },
    functions: {
      async invoke(nome, { body }) {
        const acao = body?.action === 'rollback' ? 'rollback' : nome
        log.invokes.push({ nome, body, acao })
        log.ordem.push(`invoke:${acao}`)

        if (acao === 'rollback') {
          if (falhas.rollback === 'throw') throw new Error('rede caiu no rollback')
          if (falhas.rollback) return { data: { error: falhas.rollback }, error: null }
          return { data: { rolledBack: true }, error: null }
        }
        if (nome === 'gerar-contrato') {
          return falhas.contratante
            ? { data: { error: falhas.contratante }, error: null }
            : { data: { ok: true }, error: null }
        }
        if (nome === 'create-user') {
          if (falhas.createUser === 'throw') throw new Error('Failed to fetch')
          if (falhas.createUser) return { data: { error: falhas.createUser }, error: null }
          return { data: { user: { id: 'u1' } }, error: null }
        }
        return { data: null, error: null }
      },
    },
  }

  return { supabase, log }
}

const historico = []
const deps = (supabase) => ({
  supabase,
  origin: 'https://admin.junttos.test',
  registrarHistorico: async (e) => { historico.push(e) },
})

const PARAMS = {
  nome: 'Loja Teste',
  slug: 'loja-teste',
  cor_primaria: '#5E2BD0',
  cor_secundaria: '#FF6F5E',
  valor_mensal: '100',
  email_acesso: 'loja@teste.com',
  senha_acesso: 'senha123',
}

// ── Caminho feliz ────────────────────────────────────────────────────────────

describe('executarCriacaoLoja — sucesso', () => {
  it('cria a loja e devolve o link, sem aviso e sem desfazer nada', async () => {
    const { supabase, log } = fakeSupabase()
    const r = await executarCriacaoLoja(PARAMS, deps(supabase))

    expect(r.link).toBe('https://admin.junttos.test/loja-teste/')
    expect(r.aviso).toBe('')
    expect(log.deletes).toHaveLength(0)
    expect(log.invokes.some(i => i.acao === 'rollback')).toBe(false)
    expect(log.inserts.map(i => i.tabela)).toEqual(['lf_config', 'jt_cobrancas'])
  })

  it('não chama create-user quando não há credenciais', async () => {
    const { supabase, log } = fakeSupabase()
    await executarCriacaoLoja({ ...PARAMS, email_acesso: '', senha_acesso: '' }, deps(supabase))
    expect(log.invokes.some(i => i.nome === 'create-user')).toBe(false)
  })
})

// ── Falha na etapa lf_config ─────────────────────────────────────────────────

describe('falha ao inserir lf_config', () => {
  it('lança sem rollback — nada tinha sido gravado ainda', async () => {
    const { supabase, log } = fakeSupabase({ config: 'coluna x não existe' })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase))).rejects.toThrow('coluna x não existe')

    expect(log.deletes).toHaveLength(0)
    expect(log.invokes).toHaveLength(0)
  })

  it('slug já em uso nem chega a inserir', async () => {
    const { supabase, log } = fakeSupabase({}, { slugEmUso: true })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase))).rejects.toThrow(/já está em uso/)
    expect(log.inserts).toHaveLength(0)
  })
})

// ── Falha na etapa contratante (não fatal) ───────────────────────────────────

describe('falha ao salvar contratante', () => {
  it('vira aviso e a loja sobrevive — sem rollback', async () => {
    const { supabase, log } = fakeSupabase({ contratante: 'RLS negou' })
    const r = await executarCriacaoLoja(
      { ...PARAMS, contratante: { razao_social: 'ACME' } },
      deps(supabase),
    )

    expect(r.link).toContain('loja-teste')
    expect(r.aviso).toMatch(/contratante não foram salvos: RLS negou/)
    expect(log.deletes).toHaveLength(0)
    expect(log.invokes.some(i => i.acao === 'rollback')).toBe(false)
  })
})

// ── Falha na etapa create-user — o bug que originou tudo ─────────────────────

describe('falha ao criar usuário — rollback completo', () => {
  it('remove lf_config E o usuário do Auth quando a function devolve erro', async () => {
    const { supabase, log } = fakeSupabase({ createUser: 'email já cadastrado' })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase))).rejects.toThrow(/rollback completo/)

    expect(log.deletes).toEqual([{ tabela: 'lf_config', col: 'loja_id', val: 'loja-teste' }])
    const rb = log.invokes.find(i => i.acao === 'rollback')
    expect(rb).toBeTruthy()
    expect(rb.body).toMatchObject({ action: 'rollback', loja_id: 'loja-teste', email: 'loja@teste.com' })
  })

  it('rollback também dispara quando o invoke ESTOURA por rede', async () => {
    // Caso mais perigoso: a function pode ter criado o usuário e a resposta
    // se perdeu. Antes, isto deixava login órfão.
    const { supabase, log } = fakeSupabase({ createUser: 'throw' })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase))).rejects.toThrow(/Failed to fetch/)

    expect(log.deletes).toHaveLength(1)
    expect(log.invokes.some(i => i.acao === 'rollback')).toBe(true)
  })

  it('apaga a lf_config ANTES de pedir a remoção do usuário', async () => {
    // A Edge Function só aceita remover usuário de loja inexistente — se a
    // ordem inverter, o rollback é recusado com 409.
    const { supabase, log } = fakeSupabase({ createUser: 'boom' })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase))).rejects.toThrow()

    expect(log.ordem.indexOf('delete:lf_config'))
      .toBeLessThan(log.ordem.indexOf('invoke:rollback'))
  })

  it('não gera cobranças quando o usuário falhou', async () => {
    const { supabase, log } = fakeSupabase({ createUser: 'boom' })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase))).rejects.toThrow()
    expect(log.inserts.some(i => i.tabela === 'jt_cobrancas')).toBe(false)
  })
})

// ── Rollback que falha pela metade ───────────────────────────────────────────

describe('rollback incompleto — o admin precisa saber', () => {
  it('avisa qual usuário sobrou quando a remoção do Auth falha', async () => {
    const { supabase } = fakeSupabase({ createUser: 'boom', rollback: 'service key inválida' })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase)))
      .rejects.toThrow(/não conseguiu remover o usuário de acesso "loja@teste\.com"/)
  })

  it('avisa também quando o rollback estoura por exceção', async () => {
    const { supabase } = fakeSupabase({ createUser: 'boom', rollback: 'throw' })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase)))
      .rejects.toThrow(/rede caiu no rollback/)
  })

  it('avisa quando nem a lf_config saiu', async () => {
    const { supabase } = fakeSupabase({ createUser: 'boom', deleteConfig: 'sem permissão' })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase)))
      .rejects.toThrow(/configuração da loja/)
  })

  it('manda remover manualmente quando sobrou pendência', async () => {
    const { supabase } = fakeSupabase({ createUser: 'boom', rollback: 'falhou' })
    await expect(executarCriacaoLoja(PARAMS, deps(supabase)))
      .rejects.toThrow(/Remova manualmente antes de tentar de novo/)
  })
})

// ── Falha na etapa cobranças (não fatal, por decisão) ────────────────────────

describe('falha ao gerar cobranças', () => {
  it('mantém a loja e o usuário — só avisa', async () => {
    const { supabase, log } = fakeSupabase({ cobrancas: 'constraint violada' })
    const r = await executarCriacaoLoja(PARAMS, deps(supabase))

    expect(r.link).toContain('loja-teste')
    expect(r.aviso).toMatch(/cobranças iniciais não foram geradas/)
    // Loja válida não é desfeita por causa de cobrança.
    expect(log.deletes).toHaveLength(0)
    expect(log.invokes.some(i => i.acao === 'rollback')).toBe(false)
  })
})

// ── desfazerCriacao isolado ──────────────────────────────────────────────────

describe('desfazerCriacao', () => {
  it('não toca no Auth quando nenhum usuário foi criado', async () => {
    const { supabase, log } = fakeSupabase()
    const r = await desfazerCriacao({ supabase, slug: 'x', email: 'a@b.c', criouUsuario: false })

    expect(r.desfeito).toEqual(['config'])
    expect(r.pendencias).toEqual([])
    expect(log.invokes).toHaveLength(0)
  })

  it('desfaz config e usuário quando o usuário foi criado', async () => {
    const { supabase } = fakeSupabase()
    const r = await desfazerCriacao({ supabase, slug: 'x', email: 'a@b.c', criouUsuario: true })
    expect(r.desfeito).toEqual(['config', 'usuario'])
    expect(r.pendencias).toEqual([])
  })

  it('nunca lança — devolve a pendência', async () => {
    const { supabase } = fakeSupabase({ rollback: 'throw' })
    const r = await desfazerCriacao({ supabase, slug: 'x', email: 'a@b.c', criouUsuario: true })
    expect(r.pendencias).toHaveLength(1)
    expect(r.pendencias[0]).toMatch(/a@b\.c/)
  })
})

// ── mensagemFalha ────────────────────────────────────────────────────────────

describe('mensagemFalha', () => {
  it('rollback completo menciona config e usuário', () => {
    const m = mensagemFalha({
      etapa: ETAPA.USUARIO, motivo: 'x',
      desfeito: ['config', 'usuario'], pendencias: [],
    })
    expect(m).toMatch(/config e usuário removidos \(rollback completo\)/)
  })

  it('sem usuário removido fala só de config', () => {
    const m = mensagemFalha({
      etapa: ETAPA.CONFIG, motivo: 'x', desfeito: ['config'], pendencias: [],
    })
    expect(m).toMatch(/config removida \(rollback\)/)
  })

  it('lista as pendências e pede limpeza manual', () => {
    const m = mensagemFalha({
      etapa: ETAPA.USUARIO, motivo: 'x',
      desfeito: [], pendencias: ['a config', 'o usuário'],
    })
    expect(m).toMatch(/a config e o usuário/)
    expect(m).toMatch(/Remova manualmente/)
  })
})
