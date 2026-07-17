/**
 * Validação e seed de dados de Meta por Produto para "Sua Loja".
 * Uso: node scripts/validar-meta-produto-sualoja.mjs
 *
 * Verifica: lf_meta_produto (existência, constraint ativa única).
 * Faz seed de 1 meta de exemplo se não houver nenhuma ativa.
 * Remove dados de teste ao final (dados com escopo_valor iniciando com "[TESTE]").
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const LOJA_ID    = 'sualoja'
const TEST_MARKER = '[TESTE]'

let falhas = 0
function ok(desc)         { console.log(`  ✅ ${desc}`) }
function info(desc)       { console.log(`  ℹ️  ${desc}`) }
function fail(desc, det)  { console.log(`  ❌ ${desc}${det ? ` — ${det}` : ''}`); falhas++ }

function ymAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════')
  console.log('  Validação Meta por Produto — Sua Loja')
  console.log('════════════════════════════════════════════════════════\n')

  // ── 1. Tabela acessível ────────────────────────────────────────
  console.log('── 1. Acesso à tabela lf_meta_produto ───────────────────')
  const { data: todos, error: todosErr } = await supabase
    .from('lf_meta_produto')
    .select('*')
    .eq('loja_id', LOJA_ID)
    .order('created_at', { ascending: false })

  if (todosErr) {
    fail('Erro ao acessar lf_meta_produto', todosErr.message)
    console.log('\n─────────────────────────────────────────────────────────')
    console.log('════ ❌ 1 verificação falhou. ════\n')
    process.exit(1)
  }
  ok(`lf_meta_produto acessível — ${todos.length} registro(s) total para sualoja`)
  todos.forEach(m => info(
    `  id=${m.id.slice(0, 8)}…  ativa=${m.ativa}  mes=${m.mes}  tipo=${m.tipo_medicao}  escopo=${m.escopo_tipo}:${m.escopo_valor}  meta=${m.valor_meta}`
  ))

  // ── 2. Verificar "apenas 1 ativa" ─────────────────────────────
  console.log('\n── 2. Invariante: no máximo 1 meta ativa ────────────────')
  const { data: ativas, error: ativasErr } = await supabase
    .from('lf_meta_produto')
    .select('*')
    .eq('loja_id', LOJA_ID)
    .eq('ativa', true)

  if (ativasErr) {
    fail('Erro ao filtrar metas ativas', ativasErr.message)
  } else if (ativas.length > 1) {
    fail(`Mais de 1 meta ativa encontrada (${ativas.length})`, 'execute UPDATE lf_meta_produto SET ativa=false WHERE loja_id=\'sualoja\' para corrigir')
  } else {
    ok(`Metas ativas: ${ativas.length} (correto — máximo 1)`)
    if (ativas.length === 1) info(`  Meta ativa: escopo_tipo=${ativas[0].escopo_tipo}  escopo_valor=${ativas[0].escopo_valor}  mes=${ativas[0].mes}  tipo_medicao=${ativas[0].tipo_medicao}  valor_meta=${ativas[0].valor_meta}`)
  }

  // ── 3. Seed de exemplo se não houver meta ativa ───────────────
  console.log('\n── 3. Seed de meta de teste (se não houver meta ativa) ──')
  if (!ativasErr && ativas.length === 0) {
    const mes = ymAtual()
    const escopo_valor = `${TEST_MARKER} Produto Exemplo`
    const { data: inserted, error: insertErr } = await supabase
      .from('lf_meta_produto')
      .insert({
        loja_id: LOJA_ID,
        mes,
        tipo_medicao: 'quantidade',
        escopo_tipo:  'produto',
        escopo_valor,
        valor_meta:   50,
        ativa:        true,
      })
      .select()
      .single()

    if (insertErr) {
      fail('Falha ao inserir meta de teste', insertErr.message)
    } else {
      ok(`Meta de teste inserida — id=${inserted.id.slice(0, 8)}…  escopo_valor="${escopo_valor}"`)

      // Verificar que é a única ativa
      const { data: check, error: checkErr } = await supabase
        .from('lf_meta_produto')
        .select('id')
        .eq('loja_id', LOJA_ID)
        .eq('ativa', true)
      if (!checkErr && check.length === 1) {
        ok('Confirmado: exatamente 1 meta ativa após insert')
      } else if (!checkErr) {
        fail(`Estado inconsistente: ${check.length} metas ativas após insert`)
      }
    }
  } else {
    info('Meta ativa já existe — seed de teste ignorado')
  }

  // ── 4. Testar deactivate + insert (fluxo de troca) ────────────
  console.log('\n── 4. Fluxo de troca de meta ativa ─────────────────────')
  {
    const mes = ymAtual()
    const escopo_valor = `${TEST_MARKER} Meta Substituição`

    // Deactivate
    const { error: deErr } = await supabase
      .from('lf_meta_produto')
      .update({ ativa: false })
      .eq('loja_id', LOJA_ID)
      .eq('ativa', true)

    if (deErr) {
      fail('Erro ao desativar metas ativas', deErr.message)
    } else {
      ok('Deactivate (SET ativa=false WHERE ativa=true) executado sem erro')
    }

    // Insert nova
    const { data: nova, error: novaErr } = await supabase
      .from('lf_meta_produto')
      .insert({
        loja_id: LOJA_ID,
        mes,
        tipo_medicao: 'faturamento',
        escopo_tipo:  'categoria',
        escopo_valor,
        valor_meta:   2500,
        ativa:        true,
      })
      .select()
      .single()

    if (novaErr) {
      fail('Erro ao inserir nova meta após deactivate', novaErr.message)
    } else {
      ok(`Nova meta inserida — tipo=faturamento  escopo_valor="${escopo_valor}"`)
    }

    // Confirm apenas 1 ativa
    const { data: postCheck } = await supabase
      .from('lf_meta_produto')
      .select('id')
      .eq('loja_id', LOJA_ID)
      .eq('ativa', true)
    if (postCheck?.length === 1) {
      ok('Após troca: exatamente 1 meta ativa')
    } else {
      fail(`Após troca: ${postCheck?.length ?? '?'} metas ativas (esperado 1)`)
    }
  }

  // ── 5. Limpeza dos dados de teste ─────────────────────────────
  console.log('\n── 5. Limpeza de dados de teste ─────────────────────────')
  const { data: testRows, error: testFetchErr } = await supabase
    .from('lf_meta_produto')
    .select('id, escopo_valor')
    .eq('loja_id', LOJA_ID)
    .like('escopo_valor', `${TEST_MARKER}%`)

  if (testFetchErr) {
    fail('Erro ao buscar dados de teste para limpeza', testFetchErr.message)
  } else if (testRows.length === 0) {
    info('Nenhum dado de teste para remover')
  } else {
    const ids = testRows.map(r => r.id)
    const { error: delErr } = await supabase
      .from('lf_meta_produto')
      .delete()
      .in('id', ids)
    if (delErr) {
      fail(`Erro ao remover ${ids.length} registro(s) de teste`, delErr.message)
    } else {
      ok(`${ids.length} registro(s) de teste removido(s)`)
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
