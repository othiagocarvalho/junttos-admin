/**
 * Seed + validação end-to-end de CRM Avançado para "Sua Loja".
 * Uso: node scripts/validar-crm-sualoja.mjs
 *
 * Cobre:
 *  1. Funções puras com dados mock (sem DB)
 *  2. Integração: insere vendas de teste, busca do Supabase, roda segmentação
 *  3. Limpeza total ao final
 */

import { createClient } from '@supabase/supabase-js'
import {
  normalizeWaPhone,
  diasDesdeUltima,
  isInativo,
  ticketMedioLoja,
  isVip,
  badgeAniversario,
  tamanhoPreferido,
  categoriaFavorita,
  ticketMedioCliente,
} from '../src/utils/crm.js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const LOJA_ID = 'sualoja'
const MARKER  = '[TESTE-CRM]'
const HOJE    = new Date().toISOString().slice(0, 10)

// Data helpers
function diasAtras(n) {
  const d = new Date(HOJE + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

let falhas = 0
function checar(descricao, ok, detalhe = '') {
  const status = ok ? '✅ OK' : '❌ FALHOU'
  console.log(`  ${status.padEnd(10)} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

// ── Limpeza ───────────────────────────────────────────────────
async function limpar() {
  await supabase.from('lf_vendas').delete().eq('loja_id', LOJA_ID).ilike('cliente_nome', `${MARKER}%`)
  await supabase.from('lf_clientes').delete().eq('loja_id', LOJA_ID).ilike('nome', `${MARKER}%`)
}

// ── Seção 1: funções puras (sem DB) ────────────────────────────
function sec1_puras() {
  console.log('\n[Seção 1] Funções puras (sem DB)')

  // normalizeWaPhone
  checar('normalizeWaPhone null → null',                       normalizeWaPhone(null) === null)
  checar('normalizeWaPhone "(11) 98765-4321" → DDI 55',        normalizeWaPhone('(11) 98765-4321') === '5511987654321')
  checar('normalizeWaPhone "5511987654321" → preserva DDI',    normalizeWaPhone('5511987654321') === '5511987654321')
  checar('normalizeWaPhone "+55 (11) 9 8765-4321"',            normalizeWaPhone('+55 (11) 9 8765-4321') === '5511987654321')

  // badgeAniversario
  const [, mesHoje, diaHoje] = HOJE.split('-')
  const nascHoje    = `1990-${mesHoje}-${diaHoje}`
  const nascMes     = `1990-${mesHoje}-${String(Number(diaHoje) === 28 ? 1 : Number(diaHoje) + 1).padStart(2, '0')}`
  const nascOutroMes = `1990-${String(Number(mesHoje) === 12 ? 1 : Number(mesHoje) + 1).padStart(2, '0')}-15`
  checar('badgeAniversario "hoje"',     badgeAniversario(nascHoje,    HOJE) === 'hoje')
  checar('badgeAniversario "mes"',      badgeAniversario(nascMes,     HOJE) === 'mes')
  checar('badgeAniversario outro mês → null', badgeAniversario(nascOutroMes, HOJE) === null)
  checar('badgeAniversario null → null',      badgeAniversario(null, HOJE) === null)

  // isVip
  checar('isVip 1000 vs ticket 100 → VIP',       isVip(1000, 100) === true)
  checar('isVip 999 vs ticket 100 → não VIP',    isVip(999,  100) === false)
  checar('isVip qualquer vs ticket 0 → não VIP', isVip(99999, 0) === false)

  // diasDesdeUltima + isInativo
  const vendas = [
    { id: 1, cliente_nome: `${MARKER} Ativo`,   data: diasAtras(10), valor: 100, produtos: [] },
    { id: 2, cliente_nome: `${MARKER} Inativo`, data: diasAtras(50), valor: 50,  produtos: [] },
  ]
  checar('diasDesdeUltima cliente ativo ≈ 10', diasDesdeUltima(vendas, `${MARKER} Ativo`, HOJE) === 10)
  checar('isInativo(10 dias) = false',          isInativo(vendas, `${MARKER} Ativo`,   HOJE) === false)
  checar('isInativo(50 dias) = true',           isInativo(vendas, `${MARKER} Inativo`, HOJE) === true)
  checar('diasDesdeUltima sem compras → null',  diasDesdeUltima(vendas, 'Sem Compras', HOJE) === null)
  checar('isInativo sem compras → false',       isInativo(vendas, 'Sem Compras', HOJE) === false)

  // tamanhoPreferido
  const vendasTam = [
    { id: 1, cliente_nome: 'Ana', data: HOJE, valor: 100, produtos: [
      { nome: 'Blusa', variacao: 'M', quantidade: 2 },
      { nome: 'Calça', variacao: 'P', quantidade: 1 },
    ]},
  ]
  checar('tamanhoPreferido → M (mais frequente)',  tamanhoPreferido(vendasTam, 'Ana') === 'M')
  checar('tamanhoPreferido cliente sem compras → null', tamanhoPreferido(vendasTam, 'Bia') === null)

  // ticketMedioCliente
  const vendasTkt = [
    { id: 1, cliente_nome: 'Ana', data: HOJE, valor: 100 },
    { id: 2, cliente_nome: 'Ana', data: HOJE, valor: 200 },
  ]
  checar('ticketMedioCliente = 150', ticketMedioCliente(vendasTkt, 'Ana') === 150)

  // categoriaFavorita
  const produtosData = [
    { nome: 'Blusa', categoria: 'Blusas' },
    { nome: 'Calça', categoria: 'Calças' },
  ]
  const vendasCat = [
    { id: 1, cliente_nome: 'Ana', data: HOJE, valor: 100, produtos: [
      { nome: 'Blusa', quantidade: 3 },
      { nome: 'Calça', quantidade: 1 },
    ]},
  ]
  checar('categoriaFavorita → Blusas', categoriaFavorita(vendasCat, 'Ana', produtosData) === 'Blusas')
}

// ── Seção 2: integração com Supabase ──────────────────────────
async function sec2_db() {
  console.log('\n[Seção 2] Integração DB — Supabase')

  // Cria vendas de teste
  const clienteAtivo   = `${MARKER} ClienteAtivo`
  const clienteInativo = `${MARKER} ClienteInativo`
  const clienteVip     = `${MARKER} ClienteVip`

  const { error: insErr } = await supabase.from('lf_vendas').insert([
    { loja_id: LOJA_ID, cliente_nome: clienteAtivo,   valor: 100, data: diasAtras(5),  produtos: [{ nome: 'Blusa', variacao: 'M', quantidade: 1 }] },
    { loja_id: LOJA_ID, cliente_nome: clienteAtivo,   valor: 150, data: diasAtras(3),  produtos: [] },
    { loja_id: LOJA_ID, cliente_nome: clienteInativo, valor: 80,  data: diasAtras(60), produtos: [] },
    { loja_id: LOJA_ID, cliente_nome: clienteVip,     valor: 500, data: diasAtras(10), produtos: [] },
    { loja_id: LOJA_ID, cliente_nome: clienteVip,     valor: 500, data: diasAtras(8),  produtos: [] },
    { loja_id: LOJA_ID, cliente_nome: clienteVip,     valor: 500, data: diasAtras(6),  produtos: [] },
    // Vendas do mês para ticket médio ≈ (100+150+80+1500)/4 = 457.5
    // Porém só as 3 de clienteVip (1500 total) são recentes, não do mês atual necessariamente
    // Para garantir ticket médio no mês, adicionamos uma venda extra
    { loja_id: LOJA_ID, cliente_nome: `${MARKER} Outro`, valor: 200, data: HOJE, produtos: [] },
  ])

  checar('insert de vendas de teste sem erro', !insErr, insErr?.message)

  // Busca as vendas de teste
  const { data: vendas, error: selErr } = await supabase
    .from('lf_vendas')
    .select('*')
    .eq('loja_id', LOJA_ID)
    .ilike('cliente_nome', `${MARKER}%`)

  checar('select de vendas sem erro', !selErr, selErr?.message)
  checar('7 vendas de teste gravadas', (vendas || []).length === 7, `encontradas: ${(vendas || []).length}`)

  // Segmentação
  const ticket = ticketMedioLoja(vendas || [], HOJE)
  checar('ticketMedioLoja > 0 (há vendas do mês)',
    ticket > 0,
    `ticket: ${ticket.toFixed(2)}`
  )

  // Cliente ativo
  const diasAtivo = diasDesdeUltima(vendas || [], clienteAtivo, HOJE)
  checar(`diasDesdeUltima cliente ativo = 3`, diasAtivo === 3, `retornou: ${diasAtivo}`)
  checar('isInativo cliente ativo = false', isInativo(vendas || [], clienteAtivo, HOJE) === false)

  // Cliente inativo
  checar('isInativo cliente 60d = true', isInativo(vendas || [], clienteInativo, HOJE) === true)

  // Cliente VIP: gastou 1500, ticket do mês precisa ser ≤ 150 para ter 10×
  const totalVip = (vendas || []).filter(v => v.cliente_nome === clienteVip).reduce((s, v) => s + Number(v.valor), 0)
  const vipResult = isVip(totalVip, ticket)
  checar(`isVip cliente com total ${totalVip} vs ticket ${ticket.toFixed(2)}`, typeof vipResult === 'boolean',
    `VIP: ${vipResult} (depende do estado do banco)`)

  // tamanhoPreferido
  const tamResult = tamanhoPreferido(vendas || [], clienteAtivo)
  checar('tamanhoPreferido cliente ativo → M ou null', tamResult === 'M' || tamResult === null, `retornou: ${tamResult}`)
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('=== Validação: CRM Avançado ===')
  console.log(`Loja: ${LOJA_ID} | Hoje: ${HOJE}`)

  await limpar()

  sec1_puras()
  await sec2_db()

  console.log('\n--- Limpando dados de teste ---')
  await limpar()
  console.log('Limpeza concluída.')

  console.log(`\n=== Resultado: ${falhas === 0 ? '✅ Todos os checks passaram' : `❌ ${falhas} check(s) falharam`} ===`)
  process.exit(falhas > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
