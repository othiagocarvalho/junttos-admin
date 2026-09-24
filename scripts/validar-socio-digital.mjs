/**
 * Validação do Sócio Digital (supabase/fix_socio_digital.sql) contra a
 * "Sua Loja" (sualoja, loja demo).
 *
 * Uso (DEPOIS de rodar o SQL no Supabase Dashboard):
 *   SUPABASE_SERVICE_KEY=<service_role> node scripts/validar-socio-digital.mjs
 *
 * ⚠️  EFEITOS NO BANCO — por isso o script NÃO roda sem confirmação:
 *   1. Se a sualoja não estiver em Pro/Business, o plano é trocado para 'pro'
 *      durante o teste e DEVOLVIDO ao valor original no final (inclusive se
 *      alguma verificação falhar — bloco finally).
 *   2. Grava UM relatório em lf_socio_relatorios para a sualoja, do último
 *      período fechado (se ainda não existir). Ele fica: é exatamente o que o
 *      cron gravaria, e o histórico é fixo por desenho. Nenhuma outra loja é
 *      tocada — a chamada passa p_loja = 'sualoja'.
 *
 * Por que precisa da service key: gerar_relatorios_socio só é executável por
 * service_role (REVOKE de anon/authenticated no SQL), e ler lf_vendas da
 * sualoja inteira sem o limite de RLS/paginação exige o papel admin.
 *
 * O QUE CONFERE
 *   · anon NÃO consegue chamar a função (o REVOKE está valendo)
 *   · a função grava o relatório do período certo (mesma regra de
 *     periodoFechado em src/utils/socioDigital.js)
 *   · rodar de novo não duplica nem sobrescreve (UNIQUE + ON CONFLICT)
 *   · faturamento, nº de vendas, trocas e ticket médio batem com uma soma
 *     manual das vendas do período, feita aqui em JS, paginada
 *   · anon lê o relatório da sualoja (policy _demo), como o Painel Demo faz
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

// Mesmo padrão dos outros scripts: chave por env var ou por .env na raiz.
function lerEnv(arquivo) {
  const out = {}
  if (!fs.existsSync(arquivo)) return out
  for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}
const envArquivo = lerEnv(path.join(path.resolve(import.meta.dirname, '..'), '.env'))
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || envArquivo.SUPABASE_SERVICE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_KEY (variável de ambiente ou .env).')
  console.error('   Ex.: SUPABASE_SERVICE_KEY=<chave> node scripts/validar-socio-digital.mjs')
  process.exit(1)
}

const LOJA_ID = 'sualoja'
const FUSO    = 'America/Sao_Paulo'

let falhas = 0
function ok(desc)        { console.log(`  ✅ ${desc}`) }
function info(desc)      { console.log(`  ℹ️  ${desc}`) }
function fail(desc, det) { console.log(`  ❌ ${desc}${det ? ` — ${det}` : ''}`); falhas++ }

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const anon  = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Datas em Brasília (o banco usa o mesmo fuso para o "dia" da venda) ─────
function hojeBrasilia() {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date())
}
function diaBrasilia(timestamptz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(timestamptz))
}
// Espelho de periodoFechado (src/utils/socioDigital.js) — reescrito aqui de
// propósito: o script confere o SQL de forma independente do código do app.
function periodoFechado(hojeIso) {
  const [a, m, d] = hojeIso.split('-').map(Number)
  const pad = n => String(n).padStart(2, '0')
  if (d >= 16) return { inicio: `${a}-${pad(m)}-01`, fim: `${a}-${pad(m)}-15` }
  const am = m === 1 ? a - 1 : a
  const mm = m === 1 ? 12 : m - 1
  const ult = new Date(am, mm, 0).getDate()
  return { inicio: `${am}-${pad(mm)}-16`, fim: `${am}-${pad(mm)}-${pad(ult)}` }
}

// Lê TODAS as vendas do intervalo, em páginas de 1000 (limite da API REST).
// A janela UTC é folgada em 1 dia de cada lado; o corte exato é pelo dia em
// Brasília, logo abaixo.
async function vendasDoPeriodo(periodo) {
  const de  = new Date(`${periodo.inicio}T00:00:00Z`); de.setUTCDate(de.getUTCDate() - 1)
  const ate = new Date(`${periodo.fim}T23:59:59Z`);    ate.setUTCDate(ate.getUTCDate() + 1)
  const todas = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('lf_vendas')
      .select('id, valor, status, tipo_venda, data')
      .eq('loja_id', LOJA_ID)
      .gte('data', de.toISOString()).lte('data', ate.toISOString())
      .order('data').range(from, from + 999)
    if (error) throw new Error(`lf_vendas: ${error.message}`)
    todas.push(...data)
    if (data.length < 1000) break
  }
  return todas.filter(v => {
    const dia = diaBrasilia(v.data)
    return dia >= periodo.inicio && dia <= periodo.fim && (v.status ?? 'completa') === 'completa'
  })
}

const arred = n => Math.round(Number(n) * 100) / 100

async function main() {
  console.log('\n🔎 Validação do Sócio Digital — sualoja\n')

  // 0. Tabela existe?
  const { error: erroTabela } = await admin.from('lf_socio_relatorios').select('id').limit(1)
  if (erroTabela) {
    fail('lf_socio_relatorios não acessível — o SQL foi rodado?', erroTabela.message)
    return
  }
  ok('lf_socio_relatorios existe')

  // 1. anon não pode chamar a função
  const hoje = hojeBrasilia()
  const { error: erroAnon } = await anon.rpc('gerar_relatorios_socio', { p_data: hoje, p_loja: LOJA_ID })
  if (erroAnon) ok(`anon bloqueado na RPC (${erroAnon.code || erroAnon.message})`)
  else fail('anon CONSEGUIU chamar gerar_relatorios_socio — REVOKE não aplicado')

  // 2. Plano da sualoja (troca temporária se precisar)
  const { data: cfg, error: erroCfg } = await admin.from('lf_config')
    .select('plano').eq('loja_id', LOJA_ID).single()
  if (erroCfg) { fail('não li lf_config da sualoja', erroCfg.message); return }
  const planoOriginal = cfg.plano
  const precisaTrocar = !['pro', 'business'].includes(String(planoOriginal || '').toLowerCase())

  try {
    if (precisaTrocar) {
      const { error } = await admin.from('lf_config').update({ plano: 'pro' }).eq('loja_id', LOJA_ID)
      if (error) { fail('não consegui trocar o plano para pro', error.message); return }
      info(`plano trocado temporariamente: ${planoOriginal} → pro`)
    } else {
      info(`plano já é ${planoOriginal} — sem troca`)
    }

    // 3. Gera o último período fechado, só para a sualoja
    const periodo = periodoFechado(hoje)
    const { data: jaExistia } = await admin.from('lf_socio_relatorios')
      .select('id').eq('loja_id', LOJA_ID).eq('periodo_inicio', periodo.inicio).maybeSingle()

    const { data: n1, error: erroGerar } = await admin.rpc('gerar_relatorios_socio', { p_data: hoje, p_loja: LOJA_ID })
    if (erroGerar) { fail('gerar_relatorios_socio falhou', erroGerar.message); return }
    if (jaExistia) info(`relatório de ${periodo.inicio} já existia — comparando com o congelado (n=${n1})`)
    else if (n1 === 1) ok(`relatório gravado para ${periodo.inicio} a ${periodo.fim}`)
    else fail(`esperava 1 relatório novo, veio ${n1}`)

    // 4. Idempotência
    const { data: n2, error: erroNovamente } = await admin.rpc('gerar_relatorios_socio', { p_data: hoje, p_loja: LOJA_ID })
    if (erroNovamente) fail('segunda chamada falhou', erroNovamente.message)
    else if (n2 === 0) ok('segunda chamada não duplicou (0 novos)')
    else fail(`segunda chamada gravou ${n2} — deveria ser 0`)

    const { data: linhas } = await admin.from('lf_socio_relatorios')
      .select('periodo_inicio, periodo_fim, dados').eq('loja_id', LOJA_ID).eq('periodo_inicio', periodo.inicio)
    if (linhas?.length === 1) ok('exatamente 1 linha para (sualoja, período)')
    else fail(`esperava 1 linha, há ${linhas?.length}`)
    const rel = linhas?.[0]
    if (!rel) return

    if (rel.periodo_fim === periodo.fim) ok(`período confere: ${rel.periodo_inicio} a ${rel.periodo_fim}`)
    else fail('periodo_fim diferente', `${rel.periodo_fim} ≠ ${periodo.fim}`)

    // 5. Números contra a soma manual
    const vendas = await vendasDoPeriodo(periodo)
    const soma   = vendas.reduce((s, v) => s + Number(v.valor || 0), 0)
    const fat    = arred(soma)
    const qtd    = vendas.length
    const trocas = vendas.filter(v => v.tipo_venda === 'troca').length
    // Mesmo arredondamento do SQL: round(sum / count, 2), sobre a soma crua.
    const ticket = qtd > 0 ? arred(soma / qtd) : 0
    const met    = rel.dados?.metricas || {}

    const comparar = (rot, gravado, manual) => {
      if (arred(gravado) === arred(manual)) ok(`${rot}: ${manual}`)
      else fail(`${rot} diverge`, `relatório ${gravado} · soma manual ${manual}${jaExistia ? ' (relatório pré-existente: vendas podem ter sido editadas depois)' : ''}`)
    }
    comparar('faturamento', met.faturamento, fat)
    comparar('nº de vendas', met.vendas, qtd)
    comparar('trocas', met.trocas, trocas)
    comparar('ticket médio', met.ticket_medio, ticket)

    // 6. anon lê o relatório da sualoja (policy _demo)
    const { data: viaAnon, error: erroLeitura } = await anon.from('lf_socio_relatorios')
      .select('periodo_inicio').eq('loja_id', LOJA_ID).eq('periodo_inicio', periodo.inicio)
    if (erroLeitura) fail('anon não leu o relatório da sualoja', erroLeitura.message)
    else if (viaAnon?.length === 1) ok('anon lê o relatório da sualoja (policy _demo)')
    else fail('anon não enxergou o relatório da sualoja')
  } finally {
    if (precisaTrocar) {
      const { error } = await admin.from('lf_config').update({ plano: planoOriginal }).eq('loja_id', LOJA_ID)
      if (error) fail(`⚠️ NÃO consegui devolver o plano para ${planoOriginal} — faça à mão!`, error.message)
      else info(`plano devolvido: pro → ${planoOriginal}`)
    }
  }
}

main()
  .catch(e => { fail('erro inesperado', e.message) })
  .finally(() => {
    console.log(falhas === 0 ? '\n✅ Tudo certo.\n' : `\n❌ ${falhas} verificação(ões) falharam.\n`)
    process.exit(falhas === 0 ? 0 : 1)
  })
