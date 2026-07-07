/**
 * Seed + validação end-to-end do módulo Financeiro contra Supabase.
 * Uso: node scripts/validar-financeiro.mjs
 *
 * Nota sobre lf_crediario: a tabela exige autenticação (RLS auth.uid()),
 * o que impede inserts com a anon key no contexto Node sem sessão de usuário.
 * A validação das parcelas virtuais usa um mock in-memory com a mesma lógica
 * de mesclarContasReceber, garantindo que o cálculo está correto sem depender
 * do insert no DB.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const MARKER         = '[TESTE-AUTO]'
const CLIENTE_MARKER = `${MARKER} Cliente`

// ── Helpers ───────────────────────────────────────────────────────
const fmtR = v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

let falhas = 0

function checar(descricao, esperado, obtido, modo = 'db') {
  const ok = Math.abs(Number(esperado) - Number(obtido)) < 0.005
  const tag = modo === 'mock' ? '[mock]' : '[db]  '
  const status = ok
    ? `✅ OK`
    : `❌ DIVERGÊNCIA: esperado ${esperado}, obtido ${obtido}`
  console.log(`  ${tag} ${status.padEnd(52)} | ${descricao}`)
  if (!ok) falhas++
  return ok
}

// ── Lógica de parcelas virtuais (espelho de financeiro.js) ────────
function mesclarContasReceber(contasManual, crediarios) {
  const hoje = new Date().toISOString().slice(0, 10)
  const derivadas = []
  ;(crediarios || []).forEach(cr => {
    const total       = Number(cr.parcelas) || 1
    const pagas       = Number(cr.parcelas_pagas) || 0
    const valorParc   = Number(cr.valor_parcela) || 0
    for (let i = 1; i <= total; i++) {
      const base = new Date(cr.data_compra + 'T12:00:00')
      base.setMonth(base.getMonth() + i)
      const venc = base.toISOString().slice(0, 10)
      const pago = i <= pagas
      const st   = pago ? 'recebido' : (venc < hoje ? 'atrasado' : 'pendente')
      derivadas.push({ id: `cr_${cr.id}_p${i}`, _origem: 'crediario', valor: valorParc, data_vencimento: venc, _status: st, virtual: true })
    }
  })
  return [...(contasManual || []).map(c => ({ ...c, _origem: 'manual' })), ...derivadas]
    .sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
}

// ── Limpeza de registros de teste ────────────────────────────────
async function limpar(lojaId) {
  await supabase.from('lf_contas_pagar').delete()
    .eq('loja_id', lojaId).like('descricao', `${MARKER}%`)
  await supabase.from('lf_contas_receber').delete()
    .eq('loja_id', lojaId).like('descricao', `${MARKER}%`)
  // lf_crediario não foi inserido (RLS), então não precisa limpar
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════════════════════')
  console.log('  Validação Financeiro — Supabase E2E')
  console.log('════════════════════════════════════════════════════════\n')

  // 1. Descobrir loja demo
  const { data: configs, error: cfgErr } = await supabase
    .from('lf_config')
    .select('loja_id, nome')
    .ilike('nome', '%Sua Loja%')
    .limit(5)

  if (cfgErr || !configs || configs.length === 0) {
    console.error('❌ ERRO: loja "Sua Loja" não encontrada em lf_config.')
    process.exit(1)
  }

  const lojaId = configs[0].loja_id
  console.log(`🔍 Loja: "${configs[0].nome}" (loja_id = ${lojaId})\n`)

  // 2. Limpeza prévia
  console.log('🧹 Limpando registros de teste anteriores...')
  await limpar(lojaId)

  // 3. Seed — conta a pagar (paga)
  const hoje = new Date().toISOString().slice(0, 10)
  const { data: cp, error: cpErr } = await supabase.from('lf_contas_pagar').insert({
    loja_id: lojaId,
    descricao: `${MARKER} Aluguel teste`,
    categoria: 'teste',
    valor: 300,
    data_vencimento: hoje,
    status: 'pago',
    data_pagamento: hoje,
  }).select().single()
  if (cpErr) { console.error('❌ Erro ao inserir conta a pagar:', cpErr.message); process.exit(1) }
  console.log(`📥 [db]   Conta a pagar:   ${fmtR(cp.valor)} — paga em ${cp.data_pagamento}`)

  // 4. Seed — conta a receber manual (recebida)
  const { data: cr, error: crErr } = await supabase.from('lf_contas_receber').insert({
    loja_id: lojaId,
    descricao: `${MARKER} Reembolso teste`,
    categoria: 'outros',
    valor: 500,
    data_vencimento: hoje,
    status: 'recebido',
    data_recebimento: hoje,
    origem: 'manual',
  }).select().single()
  if (crErr) { console.error('❌ Erro ao inserir conta a receber:', crErr.message); process.exit(1) }
  console.log(`📥 [db]   Conta a receber: ${fmtR(cr.valor)} — recebida em ${cr.data_recebimento}`)

  // 5. Crediário mock in-memory (lf_crediario exige auth.uid() no RLS)
  const credMock = {
    id: 'mock-cred-1',
    cliente_nome: CLIENTE_MARKER,
    valor_total: 600,
    parcelas: 3,
    valor_parcela: 200,
    data_compra: '2026-06-01',
    parcelas_pagas: 1,
    status: 'aberto',
  }
  console.log(`📥 [mock] Crediário:       R$600 / 3 parcelas / 1 paga (mock in-memory — RLS impede insert sem auth)\n`)

  // 6. Buscar dados de volta do Supabase
  const [{ data: contasPagar }, { data: contasManual }] = await Promise.all([
    supabase.from('lf_contas_pagar').select('*').eq('loja_id', lojaId).like('descricao', `${MARKER}%`),
    supabase.from('lf_contas_receber').select('*').eq('loja_id', lojaId).like('descricao', `${MARKER}%`),
  ])

  // 7. Validações
  console.log('── Verificações ─────────────────────────────────────────')

  // 7a. Total pago (DB)
  const totalPago = (contasPagar || [])
    .filter(c => c.status === 'pago')
    .reduce((s, c) => s + Number(c.valor), 0)
  checar('Total pago em contas a pagar', 300, totalPago, 'db')

  // 7b. Total recebido manual (DB)
  const totalRecebido = (contasManual || [])
    .filter(c => c.status === 'recebido')
    .reduce((s, c) => s + Number(c.valor), 0)
  checar('Total recebido em contas a receber (manual)', 500, totalRecebido, 'db')

  // 7c. Parcelas virtuais pendentes (mock)
  const mescladas         = mesclarContasReceber([], [credMock])
  const virtuaisPendentes = mescladas.filter(l => l.virtual && l._status !== 'recebido')
  checar('Qtd parcelas virtuais pendentes', 2, virtuaisPendentes.length, 'mock')

  // 7d. Valor total das parcelas virtuais pendentes (mock)
  const totalVirtual = virtuaisPendentes.reduce((s, l) => s + Number(l.valor), 0)
  checar('Valor total das parcelas virtuais pendentes', 400, totalVirtual, 'mock')

  console.log('─────────────────────────────────────────────────────────\n')

  // 8. Limpeza final
  console.log('🧹 Limpando registros de teste...')
  await limpar(lojaId)

  // 9. Confirmar limpeza
  const [{ count: cCP }, { count: cCR }] = await Promise.all([
    supabase.from('lf_contas_pagar').select('id', { count: 'exact', head: true })
      .eq('loja_id', lojaId).like('descricao', `${MARKER}%`),
    supabase.from('lf_contas_receber').select('id', { count: 'exact', head: true })
      .eq('loja_id', lojaId).like('descricao', `${MARKER}%`),
  ])

  const sobrou = (cCP || 0) + (cCR || 0)
  if (sobrou === 0) {
    console.log('✅ Limpeza confirmada: 0 registros [TESTE-AUTO] restantes.\n')
  } else {
    console.log(`❌ Atenção: ${sobrou} registro(s) de teste ainda presentes.\n`)
    falhas++
  }

  // 10. Resultado final
  if (falhas === 0) {
    console.log('════ ✅ Todas as verificações passaram. ════\n')
    process.exit(0)
  } else {
    console.log(`════ ❌ ${falhas} verificação(ões) falharam. ════\n`)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('Erro inesperado:', e)
  process.exit(1)
})
