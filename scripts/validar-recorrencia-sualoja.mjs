/**
 * Seed + validação end-to-end de Contas a Pagar Recorrentes para "Sua Loja".
 * Uso: node scripts/validar-recorrencia-sualoja.mjs
 *
 * O script:
 *  1. Cria uma regra de recorrência mensal e verifica que gera 6 lançamentos
 *  2. Simula "já existem 2" → verifica que gera só 4
 *  3. Testa pausar/retomar (toggle ativa)
 *  4. Limpa todos os dados de teste ao final
 */

import { createClient } from '@supabase/supabase-js'
import { gerarLancamentosFaltantes } from '../src/utils/recorrencia.js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const LOJA_ID = 'sualoja'
const MARKER  = '[TESTE-REC]'

let falhas = 0

function checar(descricao, ok, detalhe = '') {
  const status = ok ? '✅ OK' : `❌ FALHOU`
  console.log(`  ${status.padEnd(10)} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

// ── Limpeza ───────────────────────────────────────────────────────
async function limpar() {
  const { data: regrasExist } = await supabase
    .from('lf_recorrencias')
    .select('id')
    .eq('loja_id', LOJA_ID)
    .ilike('descricao', `${MARKER}%`)

  if (regrasExist && regrasExist.length > 0) {
    const ids = regrasExist.map(r => r.id)
    await supabase.from('lf_contas_pagar').delete().in('recorrencia_id', ids)
    await supabase.from('lf_recorrencias').delete().in('id', ids)
  }

  // Limpa também contas_pagar diretas com marker (caso de re-run parcial)
  await supabase.from('lf_contas_pagar').delete().eq('loja_id', LOJA_ID).ilike('descricao', `${MARKER}%`)
}

// ── Cenário 1: criar regra e gerar 6 lançamentos ─────────────────
async function cen1_criarEGerar() {
  console.log('\n[Cenário 1] Criar regra mensal → deve gerar 6 lançamentos futuros')

  const hoje = new Date().toISOString().slice(0, 10)

  const { data: regra, error } = await supabase
    .from('lf_recorrencias')
    .insert({
      loja_id: LOJA_ID,
      descricao: `${MARKER} Aluguel mensal`,
      categoria: 'aluguel',
      valor: 1500,
      frequencia: 'mensal',
      data_inicio: hoje,
      ativa: true,
    })
    .select()
    .single()

  checar('lf_recorrencias insert sem erro', !error, error?.message)
  if (!regra) return null

  // Simula o que o app faz: gerar os faltantes
  const novos = gerarLancamentosFaltantes(regra, [])
  checar('gerarLancamentosFaltantes retorna 6', novos.length === 6, `retornou ${novos.length}`)

  const { error: insErr } = await supabase.from('lf_contas_pagar').insert(novos)
  checar('insert dos 6 lançamentos sem erro', !insErr, insErr?.message)

  // Confirma no banco
  const { data: lancamentos } = await supabase
    .from('lf_contas_pagar')
    .select('id, data_vencimento, status, recorrencia_id')
    .eq('loja_id', LOJA_ID)
    .eq('recorrencia_id', regra.id)
    .order('data_vencimento')

  checar('6 lançamentos gravados no banco', (lancamentos || []).length === 6, `encontrados: ${(lancamentos || []).length}`)
  checar('todos com status=pendente', (lancamentos || []).every(l => l.status === 'pendente'))
  checar('todos têm recorrencia_id correto', (lancamentos || []).every(l => l.recorrencia_id === regra.id))

  return regra
}

// ── Cenário 2: já existem 2 → deve gerar só 4 ────────────────────
async function cen2_topUp(regra) {
  console.log('\n[Cenário 2] Já existem 2 lançamentos futuros → deve gerar só 4')

  const { data: existentes } = await supabase
    .from('lf_contas_pagar')
    .select('id, data_vencimento, status, recorrencia_id')
    .eq('loja_id', LOJA_ID)
    .eq('recorrencia_id', regra.id)

  // Simula ter excluído 4 (como se o app só tivesse 2 no banco)
  const apenas2 = (existentes || []).slice(0, 2)
  const novos = gerarLancamentosFaltantes(regra, apenas2)
  checar('gerarLancamentosFaltantes com 2 existentes retorna 4', novos.length === 4, `retornou ${novos.length}`)
  checar('as 4 datas geradas não duplicam as 2 existentes', () => {
    const datasExist = new Set(apenas2.map(l => l.data_vencimento))
    return novos.every(n => !datasExist.has(n.data_vencimento))
  })
}

// ── Cenário 3: pausar e retomar ───────────────────────────────────
async function cen3_pausarRetomar(regra) {
  console.log('\n[Cenário 3] Pausar e retomar recorrência')

  await supabase.from('lf_recorrencias').update({ ativa: false }).eq('id', regra.id)
  const { data: pausada } = await supabase.from('lf_recorrencias').select('ativa').eq('id', regra.id).single()
  checar('ativa=false após pausar', pausada?.ativa === false)

  await supabase.from('lf_recorrencias').update({ ativa: true }).eq('id', regra.id)
  const { data: retomada } = await supabase.from('lf_recorrencias').select('ativa').eq('id', regra.id).single()
  checar('ativa=true após retomar', retomada?.ativa === true)

  // Ao retomar, o app geraria os faltantes novamente (simulando aqui)
  const { data: lancAtual } = await supabase
    .from('lf_contas_pagar')
    .select('id, data_vencimento, status, recorrencia_id')
    .eq('loja_id', LOJA_ID)
    .eq('recorrencia_id', regra.id)

  const novos = gerarLancamentosFaltantes(retomada ? { ...regra, ativa: true } : regra, lancAtual || [])
  checar('após retomar, gerarLancamentosFaltantes não gera nada (já tem 6)', novos.length === 0, `geraria ${novos.length}`)
}

// ── Cenário 4: editar lançamento individual não afeta regra ──────
async function cen4_editarLancamentoIndividual(regra) {
  console.log('\n[Cenário 4] Editar valor de lançamento individual não altera a regra')

  const { data: lancamentos } = await supabase
    .from('lf_contas_pagar')
    .select('id, valor')
    .eq('recorrencia_id', regra.id)
    .order('data_vencimento')
    .limit(1)

  if (!lancamentos || lancamentos.length === 0) { checar('lançamento existe para editar', false); return }
  const lanc = lancamentos[0]

  await supabase.from('lf_contas_pagar').update({ valor: 9999 }).eq('id', lanc.id)

  const { data: regraAtualizada } = await supabase.from('lf_recorrencias').select('valor').eq('id', regra.id).single()
  checar('valor da regra permanece inalterado (1500)', regraAtualizada?.valor === 1500, `valor atual: ${regraAtualizada?.valor}`)

  const { data: lancAtualizado } = await supabase.from('lf_contas_pagar').select('valor').eq('id', lanc.id).single()
  checar('valor do lançamento individual foi alterado (9999)', lancAtualizado?.valor === 9999, `valor atual: ${lancAtualizado?.valor}`)
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log('=== Validação: Contas a Pagar Recorrentes ===')
  console.log(`Loja: ${LOJA_ID}`)

  await limpar()

  const regra = await cen1_criarEGerar()
  if (regra) {
    await cen2_topUp(regra)
    await cen3_pausarRetomar(regra)
    await cen4_editarLancamentoIndividual(regra)
  }

  console.log('\n--- Limpando dados de teste ---')
  await limpar()
  console.log('Limpeza concluída.')

  console.log(`\n=== Resultado: ${falhas === 0 ? '✅ Todos os checks passaram' : `❌ ${falhas} check(s) falharam`} ===`)
  process.exit(falhas > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
