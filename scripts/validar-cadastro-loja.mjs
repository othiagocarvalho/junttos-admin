/**
 * Validação E2E do fluxo de cadastro de nova loja.
 * Uso: node scripts/validar-cadastro-loja.mjs
 *
 * Testa: slug duplicado, criação de lf_config com fields corretos, rollback,
 * defaults de features (legado=false, catalogo_b2b=false).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const SLUG = 'teste-auto-cadastro'
const NOME = '[TESTE-AUTO] Loja de Validação'

let falhas = 0

function ok(desc) { console.log(`  ✅ ${desc}`) }
function fail(desc, detail = '') { console.log(`  ❌ ${desc}${detail ? ` — ${detail}` : ''}`); falhas++ }

async function limpar() {
  await supabase.from('lf_config').delete().eq('loja_id', SLUG)
  await supabase.from('jt_cobrancas').delete().eq('loja_id', SLUG)
}

// Mirrors the form's toSlug logic
function toSlug(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function isValidSlug(s) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s) && s.length >= 2 && s.length <= 40
}

// Mirrors the form's handleSave payload
async function criarLoja(slugOverride) {
  const slug = slugOverride || SLUG
  const features = {
    vendas: true, historico: true, metas: true,
    fechamento_caixa: true, relatorios: true,
    clientes: false, estoque: false,
    legado: false, catalogo_b2b: false,
    atacado: false, crm: false,
  }
  return supabase.from('lf_config').insert({
    loja_id:        slug,
    slug:           slug,
    nome:           NOME,
    status:         'Trial',
    plano:          'starter',
    cor_primaria:   '#5E2BD0',
    cor_secundaria: '#F2643C',
    features,
    updated_at:     new Date().toISOString(),
  })
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════')
  console.log('  Validação Cadastro de Loja — E2E')
  console.log('════════════════════════════════════════════════════════\n')

  await limpar()
  console.log('🧹 Limpeza prévia concluída.\n')

  // ── 1. toSlug ────────────────────────────────────────────────────
  console.log('── 1. Validação de toSlug ───────────────────────────────')
  const cases = [
    { in: 'Maria Store',       want: 'maria-store' },
    { in: 'Café & Cia',        want: 'cafe-cia' },
    { in: 'Du Charme Lingerie', want: 'du-charme-lingerie' },
    { in: '--bad--slug--',     want: 'bad-slug' },
    { in: 'AÇÃO',              want: 'acao' },
  ]
  for (const { in: input, want } of cases) {
    const got = toSlug(input)
    got === want ? ok(`toSlug("${input}") → "${got}"`) : fail(`toSlug("${input}") esperado "${want}", obtido "${got}"`)
  }

  // ── 2. isValidSlug ───────────────────────────────────────────────
  console.log('\n── 2. Validação de isValidSlug ──────────────────────────')
  const validCases = [
    { s: 'mariastore',    valid: true },
    { s: 'maria-store',   valid: true },
    { s: 'a',             valid: false, reason: 'muito curto' },
    { s: '-maria',        valid: false, reason: 'começa com hífen' },
    { s: 'maria-',        valid: false, reason: 'termina com hífen' },
    { s: 'Maria Store',   valid: false, reason: 'espaço e maiúscula' },
    { s: 'loja_teste',    valid: false, reason: 'underscore' },
  ]
  for (const { s, valid, reason } of validCases) {
    const got = isValidSlug(s)
    got === valid ? ok(`isValidSlug("${s}") = ${valid}${reason ? ` (${reason})` : ''}`) : fail(`isValidSlug("${s}") esperado ${valid}, obtido ${got}`)
  }

  // ── 3. Slug duplicado bloqueado ──────────────────────────────────
  console.log('\n── 3. Validação de slug duplicado ───────────────────────')
  const SLUG_EXISTENTE = 'estrada'
  const { data: dup } = await supabase
    .from('lf_config')
    .select('nome')
    .or(`loja_id.eq.${SLUG_EXISTENTE},slug.eq.${SLUG_EXISTENTE}`)
    .maybeSingle()
  if (dup) {
    ok(`Slug "${SLUG_EXISTENTE}" encontrado como duplicado → bloquearia com mensagem: "O slug "${SLUG_EXISTENTE}" já está em uso pela loja "${dup.nome}".`)
  } else {
    fail(`Slug "${SLUG_EXISTENTE}" deveria existir em lf_config (loja de teste)`)
  }

  // ── 4. Criar loja de teste ───────────────────────────────────────
  console.log('\n── 4. Criação de loja de teste no DB ────────────────────')
  const { error: insErr } = await criarLoja()
  if (insErr) { fail('Insert em lf_config falhou', insErr.message); process.exit(1) }
  ok(`Loja "${NOME}" (slug: ${SLUG}) inserida em lf_config`)

  // ── 5. Verificar campos no DB ────────────────────────────────────
  console.log('\n── 5. Verificação dos campos gravados ───────────────────')
  const { data: loja } = await supabase.from('lf_config').select('*').eq('loja_id', SLUG).single()
  if (!loja) { fail('Não foi possível ler loja recém-criada'); process.exit(1) }

  loja.plano === 'starter'              ? ok('plano = starter')          : fail('plano incorreto', loja.plano)
  loja.status === 'Trial'               ? ok('status = Trial')           : fail('status incorreto', loja.status)
  loja.features?.legado === false       ? ok('features.legado = false')  : fail('features.legado não é false', JSON.stringify(loja.features?.legado))
  loja.features?.catalogo_b2b === false ? ok('features.catalogo_b2b = false') : fail('features.catalogo_b2b não é false', JSON.stringify(loja.features?.catalogo_b2b))
  loja.features?.vendas === true        ? ok('features.vendas = true')   : fail('features.vendas incorreto')
  !loja.email_acesso && !loja.senha_acesso
    ? ok('email_acesso/senha_acesso não gravados em lf_config (correto)')
    : fail('email_acesso ou senha_acesso encontrado em lf_config (não deveria existir como coluna)')

  // ── 6. Slug duplicado é bloqueado pelo insert ────────────────────
  console.log('\n── 6. Segundo insert com mesmo slug deve falhar ─────────')
  const { error: dupErr } = await criarLoja(SLUG)
  if (dupErr) {
    ok(`DB rejeitou slug duplicado: ${dupErr.message}`)
  } else {
    fail('DB deveria ter rejeitado o slug duplicado (UNIQUE constraint)')
    // Cleanup extra row if it somehow got inserted
    await supabase.from('lf_config').delete().eq('loja_id', SLUG)
  }

  // ── 7. Cobrança ──────────────────────────────────────────────────
  console.log('\n── 7. Criar cobrança inicial ────────────────────────────')
  const venc = new Date()
  venc.setDate(venc.getDate() + 30)
  const { error: cobErr } = await supabase.from('jt_cobrancas').insert({
    loja_id:    SLUG,
    valor:      99.90,
    vencimento: venc.toISOString().split('T')[0],
    status:     'pendente',
  })
  cobErr ? fail('Insert em jt_cobrancas falhou', cobErr.message) : ok('Cobrança inicial criada em jt_cobrancas')

  // ── 8. Limpeza ───────────────────────────────────────────────────
  console.log('\n── 8. Limpeza dos registros de teste ────────────────────')
  await limpar()
  const { data: recheck } = await supabase.from('lf_config').select('id').eq('loja_id', SLUG).maybeSingle()
  !recheck ? ok('lf_config limpo — 0 registros de teste restantes') : fail('Registro de teste ainda presente em lf_config')

  // ── Resultado ────────────────────────────────────────────────────
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
