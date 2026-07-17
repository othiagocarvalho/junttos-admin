/**
 * Validação e seed de dados de Metas & Resultados para "Sua Loja".
 * Uso: node scripts/validar-metas-sualoja.mjs
 *
 * Verifica: lf_metas (meta geral), lf_metas_vendedora (meta individual).
 * Faz seed de dados de exemplo se as tabelas estiverem vazias.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const LOJA_ID = 'sualoja'

let falhas = 0
function ok(desc)         { console.log(`  ✅ ${desc}`) }
function info(desc)       { console.log(`  ℹ️  ${desc}`) }
function fail(desc, det) { console.log(`  ❌ ${desc}${det ? ` — ${det}` : ''}`); falhas++ }

function ym(offsetMeses = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMeses)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════')
  console.log('  Validação Metas & Resultados — Sua Loja')
  console.log('════════════════════════════════════════════════════════\n')

  // ── 1. Verificar tabela lf_metas ─────────────────────────────
  console.log('── 1. lf_metas (meta geral) ─────────────────────────────')
  const { data: metas, error: metasErr } = await supabase
    .from('lf_metas')
    .select('*')
    .eq('loja_id', LOJA_ID)
    .order('mes', { ascending: false })

  if (metasErr) {
    fail('Erro ao acessar lf_metas', metasErr.message)
  } else {
    ok(`lf_metas acessível — ${metas.length} registro(s) encontrado(s)`)
    metas.forEach(m => info(`  mes=${m.mes}  valor=${m.valor}`))
  }

  // Seed meta geral se não houver registro para o mês atual
  const mesAtual = ym(0)
  const temMetaAtual = metas?.some(m => m.mes === mesAtual)
  if (!metasErr && !temMetaAtual) {
    console.log('\n  Fazendo seed de meta geral para os últimos 3 meses…')
    for (let i = -2; i <= 0; i++) {
      const mes = ym(i)
      const valor = 15000 + Math.round(Math.random() * 10000)
      const { error } = await supabase
        .from('lf_metas')
        .upsert({ loja_id: LOJA_ID, mes, valor }, { onConflict: 'loja_id,mes' })
      error ? fail(`Seed lf_metas mes=${mes}`, error.message) : ok(`Seed: mes=${mes} valor=${valor}`)
    }
  }

  // ── 2. Verificar tabela lf_metas_vendedora ───────────────────
  console.log('\n── 2. lf_metas_vendedora (meta individual) ──────────────')
  const { data: metasVend, error: metasVendErr } = await supabase
    .from('lf_metas_vendedora')
    .select('*')
    .eq('loja_id', LOJA_ID)
    .order('mes', { ascending: false })

  if (metasVendErr) {
    fail('Erro ao acessar lf_metas_vendedora', metasVendErr.message)
  } else {
    ok(`lf_metas_vendedora acessível — ${metasVend.length} registro(s) encontrado(s)`)
    metasVend.forEach(m => info(`  mes=${m.mes}  vendedora=${m.vendedora}  valor=${m.valor}`))
  }

  // Seed metas por vendedora se vazio
  if (!metasVendErr && metasVend.length === 0) {
    console.log('\n  Fazendo seed de metas por vendedora…')
    const seedRows = [
      { mes: ym(0),  vendedora: 'Ana',    valor: 8000 },
      { mes: ym(0),  vendedora: 'Beatriz', valor: 6000 },
      { mes: ym(-1), vendedora: 'Ana',    valor: 7500 },
      { mes: ym(-1), vendedora: 'Beatriz', valor: 5500 },
    ]
    for (const row of seedRows) {
      const { error } = await supabase
        .from('lf_metas_vendedora')
        .upsert({ loja_id: LOJA_ID, ...row }, { onConflict: 'loja_id,mes,vendedora' })
      error
        ? fail(`Seed lf_metas_vendedora mes=${row.mes} vendedora=${row.vendedora}`, error.message)
        : ok(`Seed: mes=${row.mes} vendedora=${row.vendedora} valor=${row.valor}`)
    }
  }

  // ── 3. Verificar campo vendedora em lf_vendas ────────────────
  console.log('\n── 3. lf_vendas.vendedora ───────────────────────────────')
  const { data: vendas, error: vendasErr } = await supabase
    .from('lf_vendas')
    .select('vendedora')
    .eq('loja_id', LOJA_ID)
    .not('vendedora', 'is', null)
    .limit(10)

  if (vendasErr) {
    fail('Erro ao acessar lf_vendas', vendasErr.message)
  } else {
    const vendedoras = [...new Set(vendas.map(v => v.vendedora))]
    ok(`Vendedoras encontradas em lf_vendas: ${vendedoras.length > 0 ? vendedoras.join(', ') : '(nenhuma ainda)'}`)
  }

  // ── Resultado ────────────────────────────────────────────────
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
