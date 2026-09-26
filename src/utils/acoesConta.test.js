import { describe, it, expect } from 'vitest'
import { excluirConta, desfazerQuitacao, OPCOES_RECORRENTE } from './acoesConta'
import { calcularStatusReal, calcularDRE, calcularFluxoCaixa, mesclarContasReceber, contasVisiveis, contaEmAberto } from './financeiro'
import { gerarLancamentosFaltantes, contarLancamentosFuturos } from './recorrencia'
import { contasEmAberto, contasDeAmanha } from './caixa'
import { contasNaJanela, montarAvisos } from './avisosInicio'

// ── Supabase fake: só o que acoesConta.js usa ─────────────────────────────
// from(t).select(cols) | .update(obj) | .delete({count}) → .eq / .in → await
// UPDATE só devolve linhas com .select() — igual ao PostgREST.
function criarSupabaseFake(tabelas) {
  const db = Object.fromEntries(Object.entries(tabelas).map(([k, v]) => [k, v.map(r => ({ ...r }))]))
  function from(tabela) {
    const filtros = []
    let op = 'select', payload = null, comSelect = false
    const casa = r => filtros.every(f => f(r))
    const q = {
      select() { if (op === 'update') comSelect = true; return q },
      update(obj) { op = 'update'; payload = obj; return q },
      delete() { op = 'delete'; return q },
      eq(c, v) { filtros.push(r => r[c] === v); return q },
      in(c, vs) { filtros.push(r => vs.includes(r[c])); return q },
      then(ok, fail) {
        const linhas = db[tabela] || []
        let res
        if (op === 'select') res = { data: linhas.filter(casa).map(r => ({ ...r })), error: null }
        if (op === 'update') {
          const alvo = linhas.filter(casa)
          alvo.forEach(r => Object.assign(r, payload))
          res = { data: comSelect ? alvo.map(r => ({ ...r })) : null, error: null }
        }
        if (op === 'delete') {
          const antes = linhas.length
          db[tabela] = linhas.filter(r => !casa(r))
          // FK lf_contas_pagar.recorrencia_id ON DELETE SET NULL
          if (tabela === 'lf_recorrencias') {
            const vivas = new Set(db.lf_recorrencias.map(r => r.id))
            ;(db.lf_contas_pagar || []).forEach(p => { if (p.recorrencia_id && !vivas.has(p.recorrencia_id)) p.recorrencia_id = null })
          }
          res = { error: null, count: antes - db[tabela].length }
        }
        return Promise.resolve(res).then(ok, fail)
      },
    }
    return q
  }
  return { from, db }
}

const LOJA = 'lojaA'
const REGRA = { id: 'r1', loja_id: LOJA, descricao: 'Aluguel', valor: 1000, frequencia: 'mensal', data_inicio: '2026-10-05', ativa: true }
const parcela = (id, venc, status = 'pendente', extra = {}) =>
  ({ id, loja_id: LOJA, descricao: 'Aluguel', valor: 1000, data_vencimento: venc, status, data_pagamento: status === 'pago' ? '2026-09-26' : null, recorrencia_id: 'r1', ...extra })

function cenarioRecorrente() {
  return criarSupabaseFake({
    lf_recorrencias: [REGRA],
    lf_contas_pagar: [
      parcela('p1', '2026-10-05', 'pago'),
      parcela('p2', '2026-11-05'),
      parcela('p3', '2026-12-05'),
      parcela('p4', '2027-01-05'),
      { id: 'outra', loja_id: 'lojaB', descricao: 'X', valor: 1, data_vencimento: '2026-11-05', status: 'pendente', recorrencia_id: 'r1' },
    ],
  })
}

describe('excluir conta avulsa', () => {
  it('apaga a linha direto', async () => {
    const sb = criarSupabaseFake({ lf_contas_pagar: [{ id: 'a', loja_id: LOJA, status: 'pendente' }, { id: 'b', loja_id: LOJA }] })
    const r = await excluirConta(sb, { tipo: 'pagar', conta: { id: 'a' }, lojaId: LOJA })
    expect(r).toEqual({ ok: true, erro: null })
    expect(sb.db.lf_contas_pagar.map(c => c.id)).toEqual(['b'])
  })

  it('conta a receber manual também', async () => {
    const sb = criarSupabaseFake({ lf_contas_receber: [{ id: 'x', loja_id: LOJA, status: 'recebido' }] })
    const r = await excluirConta(sb, { tipo: 'receber', conta: { id: 'x' }, lojaId: LOJA })
    expect(r.ok).toBe(true)
    expect(sb.db.lf_contas_receber).toHaveLength(0)
  })

  it('não apaga conta de outra loja — e avisa que nada foi excluído (RLS/204 sem linhas)', async () => {
    const sb = criarSupabaseFake({ lf_contas_pagar: [{ id: 'a', loja_id: 'lojaB' }] })
    const r = await excluirConta(sb, { tipo: 'pagar', conta: { id: 'a' }, lojaId: LOJA })
    expect(r.ok).toBe(false)
    expect(sb.db.lf_contas_pagar).toHaveLength(1)
  })
})

describe('excluir conta recorrente — as 3 opções', () => {
  it('oferece exatamente as 3 opções', () => {
    expect(OPCOES_RECORRENTE.map(o => o.id)).toEqual(['so_esta', 'esta_e_proximas', 'toda'])
  })

  it('sem opção escolhida, não faz nada', async () => {
    const sb = cenarioRecorrente()
    const r = await excluirConta(sb, { tipo: 'pagar', conta: parcela('p3', '2026-12-05'), lojaId: LOJA })
    expect(r.ok).toBe(false)
    expect(sb.db.lf_contas_pagar).toHaveLength(5)
  })

  it('"Só esta parcela" marca cancelada — nunca DELETE — e a regra continua ativa', async () => {
    const sb = cenarioRecorrente()
    const r = await excluirConta(sb, { tipo: 'pagar', conta: parcela('p3', '2026-12-05'), lojaId: LOJA, opcao: 'so_esta' })
    expect(r.ok).toBe(true)
    expect(sb.db.lf_contas_pagar).toHaveLength(5)
    expect(sb.db.lf_contas_pagar.find(p => p.id === 'p3')).toMatchObject({ status: 'cancelada', data_pagamento: null })
    expect(sb.db.lf_recorrencias[0].ativa).toBe(true)
  })

  it('"Só esta parcela" numa paga: cancela e limpa a data de pagamento (sai do DRE/Fluxo)', async () => {
    const sb = cenarioRecorrente()
    await excluirConta(sb, { tipo: 'pagar', conta: parcela('p1', '2026-10-05', 'pago'), lojaId: LOJA, opcao: 'so_esta' })
    expect(sb.db.lf_contas_pagar.find(p => p.id === 'p1')).toMatchObject({ status: 'cancelada', data_pagamento: null })
  })

  it('"Esta e as próximas": desativa a regra e apaga só as não pagas a partir desta', async () => {
    const sb = cenarioRecorrente()
    const r = await excluirConta(sb, { tipo: 'pagar', conta: parcela('p3', '2026-12-05'), lojaId: LOJA, opcao: 'esta_e_proximas' })
    expect(r.ok).toBe(true)
    expect(sb.db.lf_recorrencias[0].ativa).toBe(false)
    expect(sb.db.lf_contas_pagar.map(p => p.id).sort()).toEqual(['outra', 'p1', 'p2'])
  })

  it('"Toda a recorrência": apaga regra e não pagas; a paga fica, com recorrencia_id zerado pela FK', async () => {
    const sb = cenarioRecorrente()
    const r = await excluirConta(sb, { tipo: 'pagar', conta: parcela('p3', '2026-12-05'), lojaId: LOJA, opcao: 'toda' })
    expect(r.ok).toBe(true)
    expect(sb.db.lf_recorrencias).toHaveLength(0)
    const daLoja = sb.db.lf_contas_pagar.filter(p => p.loja_id === LOJA)
    expect(daLoja).toHaveLength(1)
    expect(daLoja[0]).toMatchObject({ id: 'p1', status: 'pago', recorrencia_id: null })
  })

  it('"Toda a recorrência" também leva parcela já cancelada e status nulo (não pagas)', async () => {
    const sb = criarSupabaseFake({
      lf_recorrencias: [REGRA],
      lf_contas_pagar: [parcela('c1', '2026-11-05', 'cancelada'), parcela('n1', '2026-12-05', null)],
    })
    await excluirConta(sb, { tipo: 'pagar', conta: parcela('n1', '2026-12-05', null), lojaId: LOJA, opcao: 'toda' })
    expect(sb.db.lf_contas_pagar).toHaveLength(0)
  })

  it('depois de "Esta e as próximas", o gerador não repõe nada (regra inativa)', async () => {
    const sb = cenarioRecorrente()
    await excluirConta(sb, { tipo: 'pagar', conta: parcela('p2', '2026-11-05'), lojaId: LOJA, opcao: 'esta_e_proximas' })
    const regrasAtivas = sb.db.lf_recorrencias.filter(r => r.ativa)
    const novos = regrasAtivas.flatMap(r => gerarLancamentosFaltantes(r, sb.db.lf_contas_pagar, '2026-10-01'))
    expect(novos).toHaveLength(0)
  })
})

describe('desfazer pagamento / recebimento', () => {
  it('conta paga volta para pendente e perde a data de pagamento', async () => {
    const sb = cenarioRecorrente()
    const r = await desfazerQuitacao(sb, { tipo: 'pagar', conta: { id: 'p1' }, lojaId: LOJA })
    expect(r.ok).toBe(true)
    expect(sb.db.lf_contas_pagar.find(p => p.id === 'p1')).toMatchObject({ status: 'pendente', data_pagamento: null })
  })

  it('conta recebida volta para pendente e perde a data de recebimento', async () => {
    const sb = criarSupabaseFake({ lf_contas_receber: [{ id: 'r', loja_id: LOJA, status: 'recebido', data_recebimento: '2026-09-20' }] })
    const r = await desfazerQuitacao(sb, { tipo: 'receber', conta: { id: 'r' }, lojaId: LOJA })
    expect(r.ok).toBe(true)
    expect(sb.db.lf_contas_receber[0]).toMatchObject({ status: 'pendente', data_recebimento: null })
  })

  it('não mexe em conta que não está paga (ex.: cancelada)', async () => {
    const sb = criarSupabaseFake({ lf_contas_pagar: [parcela('c', '2026-11-05', 'cancelada')] })
    const r = await desfazerQuitacao(sb, { tipo: 'pagar', conta: { id: 'c' }, lojaId: LOJA })
    expect(r.ok).toBe(false)
    expect(sb.db.lf_contas_pagar[0].status).toBe('cancelada')
  })
})

describe('status cancelada é ignorado em todos os cálculos', () => {
  const canceladaPaga = { id: 'c', status: 'cancelada', valor: 500, categoria: 'aluguel', data_vencimento: '2026-09-10', data_pagamento: '2026-09-10' }
  const paga = { id: 'p', status: 'pago', valor: 100, categoria: 'aluguel', data_vencimento: '2026-09-10', data_pagamento: '2026-09-10' }

  it('status real: cancelada continua cancelada — nunca vira atrasada/pendente', () => {
    expect(calcularStatusReal({ status: 'cancelada', data_vencimento: '2000-01-01' })).toBe('cancelada')
  })

  it('listas/totais: contasVisiveis e contaEmAberto deixam a cancelada de fora', () => {
    expect(contasVisiveis([paga, canceladaPaga]).map(c => c.id)).toEqual(['p'])
    expect(contaEmAberto({ status: 'cancelada' })).toBe(false)
    expect(contaEmAberto({ status: 'pendente' })).toBe(true)
    expect(contaEmAberto({ status: null })).toBe(true)
  })

  it('DRE: cancelada não entra em despesas nem em outras receitas', () => {
    const dre = calcularDRE([], [paga, canceladaPaga], [{ status: 'cancelada', valor: 900, data_recebimento: '2026-09-10' }], '2026-09-01', '2026-09-30')
    expect(dre.totalDespesas).toBe(100)
    expect(dre.outrasReceitas).toBe(0)
  })

  it('Fluxo de Caixa: cancelada não sai nem entra, mesmo com data preenchida', () => {
    const fluxo = calcularFluxoCaixa([], [paga, canceladaPaga], [{ status: 'cancelada', valor: 900, data_recebimento: '2026-09-10' }], '2026-09-01', '2026-09-30')
    expect(fluxo).toHaveLength(1)
    expect(fluxo[0]).toMatchObject({ entradas: 0, saidas: 100 })
  })

  it('Contas a Receber: cancelada manual some da lista mesclada', () => {
    expect(mesclarContasReceber([{ id: 'x', status: 'cancelada', data_vencimento: '2026-10-01' }], [])).toEqual([])
  })

  it('gerador: cancelada não conta nas 6 futuras, mas a data dela NÃO é recriada', () => {
    const hoje = '2026-10-01'
    const existentes = [
      parcela('a', '2026-10-05'), parcela('b', '2026-11-05', 'cancelada'), parcela('c', '2026-12-05'),
      parcela('d', '2027-01-05'), parcela('e', '2027-02-05'), parcela('f', '2027-03-05'),
    ]
    expect(contarLancamentosFuturos('r1', existentes, hoje)).toBe(5)
    const novos = gerarLancamentosFaltantes(REGRA, existentes, hoje)
    expect(novos.map(n => n.data_vencimento)).toEqual(['2027-04-05'])
  })

  it('Caixa do Mercado: cancelada fora do painel e do "amanhã tem conta"', () => {
    const contas = [{ id: 1, status: 'pendente', data_vencimento: '2026-09-27' }, { id: 2, status: 'cancelada', data_vencimento: '2026-09-27' }, { id: 3, status: 'pago', data_vencimento: '2026-09-27' }]
    expect(contasEmAberto(contas).map(c => c.id)).toEqual([1])
    expect(contasDeAmanha(contas, new Date(2026, 8, 26)).map(c => c.id)).toEqual([1])
  })

  it('Avisos do Início: cancelada não gera aviso de conta', () => {
    const hoje = new Date(2026, 8, 26)
    const contas = [{ id: 'k', status: 'cancelada', valor: 50, descricao: 'X', data_vencimento: '2026-09-26' }]
    expect(contasNaJanela(contas, hoje)).toEqual([])
    const avisos = montarAvisos({ plano: 'business', contasPagar: contas, contasReceber: [], hoje })
    expect(avisos.some(a => a.tipo === 'conta_pagar')).toBe(false)
  })
})
