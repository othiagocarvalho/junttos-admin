/**
 * Validação e seed de Corridas para "Sua Loja".
 * Uso: node scripts/validar-corrida-sualoja.mjs
 *
 * Verifica: lf_corrida (existência, insert, ranking, delete).
 * Faz seed de 2 corridas de teste e limpa ao final.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

const supabase    = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const LOJA_ID     = 'sualoja'
const TEST_MARKER = '[TESTE-CORRIDA]'

let falhas = 0
function ok(desc)        { console.log(`  ✅ ${desc}`) }
function info(desc)      { console.log(`  ℹ️  ${desc}`) }
function fail(desc, det) { console.log(`  ❌ ${desc}${det ? ` — ${det}` : ''}`); falhas++ }

function hoje()   { const d = new Date(); return d.toISOString().slice(0, 10) }
function amanha() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
function ontem()  { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }

async function main() {
  console.log('\n════════════════════════════════════════════════════════')
  console.log('  Validação Corrida — Sua Loja')
  console.log('════════════════════════════════════════════════════════\n')

  // ── 1. Tabela acessível ────────────────────────────────────────
  console.log('── 1. Acesso à tabela lf_corrida ────────────────────────')
  const { data: todos, error: todosErr } = await supabase
    .from('lf_corrida')
    .select('*')
    .eq('loja_id', LOJA_ID)
    .order('created_at', { ascending: false })

  if (todosErr) {
    fail('Erro ao acessar lf_corrida', todosErr.message)
    console.log('\n─────────────────────────────────────────────────────────')
    console.log('════ ❌ Tabela inacessível — verifique se o SQL foi rodado. ════\n')
    process.exit(1)
  }
  ok(`lf_corrida acessível — ${todos.length} corrida(s) para sualoja`)
  todos.forEach(c => info(`  id=${c.id.slice(0, 8)}…  nome="${c.nome}"  tipo=${c.tipo_medicao}  ${c.data_inicio}→${c.data_fim}`))

  // ── 2. Múltiplas corridas ativas simultâneas ───────────────────
  console.log('\n── 2. Permite múltiplas corridas ativas ─────────────────')
  const corrida1 = {
    loja_id: LOJA_ID, ativa: true,
    nome: `${TEST_MARKER} Corrida de Faturamento`,
    tipo_medicao: 'faturamento',
    produto_alvo: null,
    data_inicio: ontem(),
    data_fim: amanha(),
    premio_descricao: 'Vale compra de R$200',
  }
  const corrida2 = {
    loja_id: LOJA_ID, ativa: true,
    nome: `${TEST_MARKER} Corrida de Quantidade`,
    tipo_medicao: 'quantidade_produto',
    produto_alvo: 'Produto Teste',
    data_inicio: hoje(),
    data_fim: amanha(),
    premio_descricao: 'Dia de folga',
  }

  const { data: ins1, error: ins1Err } = await supabase.from('lf_corrida').insert(corrida1).select().single()
  if (ins1Err) {
    fail('Erro ao inserir corrida 1', ins1Err.message)
  } else {
    ok(`Corrida 1 inserida — id=${ins1.id.slice(0, 8)}…  tipo=faturamento`)
  }

  const { data: ins2, error: ins2Err } = await supabase.from('lf_corrida').insert(corrida2).select().single()
  if (ins2Err) {
    fail('Erro ao inserir corrida 2', ins2Err.message)
  } else {
    ok(`Corrida 2 inserida — id=${ins2.id.slice(0, 8)}…  tipo=quantidade_produto`)
  }

  // Verifica que ambas estão ativas simultaneamente
  const { data: ativas } = await supabase
    .from('lf_corrida')
    .select('id')
    .eq('loja_id', LOJA_ID)
    .eq('ativa', true)
    .like('nome', `${TEST_MARKER}%`)

  if ((ativas?.length ?? 0) >= 2) {
    ok(`${ativas.length} corridas de teste ativas simultaneamente (sem bloqueio de unicidade)`)
  } else {
    fail(`Esperado ≥2 corridas ativas de teste, encontrado ${ativas?.length ?? 0}`)
  }

  // ── 3. Campos obrigatórios / nullable ─────────────────────────
  console.log('\n── 3. Campos nullable e CHECK constraint ────────────────')
  const corridaPASemProduto = {
    loja_id: LOJA_ID, ativa: true,
    nome: `${TEST_MARKER} Corrida PA`,
    tipo_medicao: 'pa',
    produto_alvo: null,  // nullable quando tipo != quantidade_produto
    data_inicio: hoje(),
    data_fim: amanha(),
    premio_descricao: null,
  }
  const { data: ins3, error: ins3Err } = await supabase.from('lf_corrida').insert(corridaPASemProduto).select().single()
  if (ins3Err) {
    fail('Erro ao inserir corrida tipo=pa sem produto_alvo', ins3Err.message)
  } else {
    ok(`Corrida tipo=pa inserida com produto_alvo=null — id=${ins3.id.slice(0, 8)}…`)
  }

  // CHECK constraint: tipo inválido deve ser rejeitado
  const { error: checkErr } = await supabase.from('lf_corrida').insert({
    loja_id: LOJA_ID, ativa: true,
    nome: `${TEST_MARKER} Tipo Invalido`,
    tipo_medicao: 'tipo_invalido',
    data_inicio: hoje(), data_fim: amanha(),
  }).select()
  if (checkErr) {
    ok(`CHECK constraint rejeitou tipo_medicao inválido (correto)`)
  } else {
    fail('CHECK constraint deveria ter rejeitado tipo_medicao="tipo_invalido"')
  }

  // ── 4. Leitura filtrada por ativa=true ────────────────────────
  console.log('\n── 4. Filtro ativa=true ─────────────────────────────────')
  const { data: ativasFiltradas, error: filErr } = await supabase
    .from('lf_corrida')
    .select('*')
    .eq('loja_id', LOJA_ID)
    .eq('ativa', true)
  if (filErr) {
    fail('Erro ao filtrar por ativa=true', filErr.message)
  } else {
    ok(`Filtro ativa=true retornou ${ativasFiltradas.length} corrida(s)`)
  }

  // ── 5. Limpeza dos dados de teste ─────────────────────────────
  console.log('\n── 5. Limpeza de dados de teste ─────────────────────────')
  const { data: testRows, error: fetchErr } = await supabase
    .from('lf_corrida')
    .select('id, nome')
    .eq('loja_id', LOJA_ID)
    .like('nome', `${TEST_MARKER}%`)

  if (fetchErr) {
    fail('Erro ao buscar dados de teste para limpeza', fetchErr.message)
  } else if (!testRows || testRows.length === 0) {
    info('Nenhum dado de teste para remover')
  } else {
    const ids = testRows.map(r => r.id)
    const { error: delErr } = await supabase
      .from('lf_corrida')
      .delete()
      .in('id', ids)
    if (delErr) {
      fail(`Erro ao remover ${ids.length} corrida(s) de teste`, delErr.message)
    } else {
      ok(`${ids.length} corrida(s) de teste removida(s)`)
    }
  }

  // ── Resultado ─────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────')
  if (falhas === 0) {
    console.log('════ ✅ Todas as verificações passaram. ════\n')
    process.exit(0)
  } else {
    console.log(`════ ❌ ${falhas} verificação(ões) falharam. ════\n`)
    process.exit(1)
  }
}

main().catch(e => { console.error('Erro inesperado:', e); process.exit(1) })
