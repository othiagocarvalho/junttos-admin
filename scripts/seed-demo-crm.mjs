/**
 * Seed de demonstração para CRM (Follow-ups) — "Sua Loja"
 * Uso: node scripts/seed-demo-crm.mjs
 *
 * O que faz:
 *  1. Insere dados de demonstração PERMANENTES (clientes, vendas, lembretes) para exibir o feed
 *     de follow-ups com todos os cenários: aniversário hoje/em breve, VIP, inativo, lembretes manuais.
 *  2. Executa checks de validação das funções puras do CRM.
 *  3. Dados de teste técnico (prefixo [TESTE-CRM]) são limpos ao final.
 *  4. Os dados de demo NÃO são removidos — são permanentes para uso comercial.
 *
 * Para limpar APENAS os dados de teste técnico (não os de demo):
 *   node scripts/seed-demo-crm.mjs --only-clean
 */

import { createClient } from '@supabase/supabase-js'
import {
  normalizeWaPhone,
  diasDesdeUltima,
  isInativo,
  ticketMedioLoja,
  isVip,
  badgeAniversario,
  diasParaAniversario,
  gerarSugestoesAuto,
  isDispensado,
  combinarFeed,
} from '../src/utils/crm.js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const LOJA_ID = 'sualoja'
const MARKER  = '[TESTE-CRM]'
const HOJE    = new Date().toISOString().slice(0, 10)

const onlyClean = process.argv.includes('--only-clean')

function diasAtras(n) {
  const d = new Date(HOJE + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function diasFrente(n) {
  const d = new Date(HOJE + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function nascimentoOffset(offsetDias, anoNasc) {
  const d = new Date(HOJE + 'T12:00:00')
  d.setDate(d.getDate() + offsetDias)
  return `${anoNasc}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

let falhas = 0
function checar(descricao, ok, detalhe = '') {
  const status = ok ? '✅ OK' : '❌ FALHOU'
  console.log(`  ${status.padEnd(10)} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

// ── Limpeza de dados de teste técnico ─────────────────────────────
async function limparTeste() {
  await supabase.from('lf_vendas').delete().eq('loja_id', LOJA_ID).ilike('cliente_nome', `${MARKER}%`)
  await supabase.from('lf_clientes').delete().eq('loja_id', LOJA_ID).ilike('nome', `${MARKER}%`)
  await supabase.from('lf_lembretes').delete().eq('loja_id', LOJA_ID).ilike('cliente_nome', `${MARKER}%`)
  await supabase.from('lf_followup_dispensado').delete().eq('loja_id', LOJA_ID).ilike('cliente_nome', `${MARKER}%`)
}

// ── Dados de demonstração permanentes ─────────────────────────────
const DEMO_CLIENTES = [
  // aniversário hoje (gerado em runtime)
  { loja_id: LOJA_ID, nome: 'Ana Carolina Silva', telefone: '(85) 99821-4530', data_nascimento: nascimentoOffset(0, 1995) },
  // aniversário em 3 dias
  { loja_id: LOJA_ID, nome: 'Fernanda Rocha',     telefone: '(85) 98765-3210', data_nascimento: nascimentoOffset(3, 1993) },
  // aniversário em 6 dias
  { loja_id: LOJA_ID, nome: 'Mariana Costa',      telefone: '(85) 99123-4567', data_nascimento: nascimentoOffset(6, 1991) },
  { loja_id: LOJA_ID, nome: 'Juliana Matos',      telefone: '(85) 99234-5678', data_nascimento: '1990-03-22' },
  { loja_id: LOJA_ID, nome: 'Beatriz Oliveira',   telefone: '(85) 99876-1122', data_nascimento: '1988-11-15' },
  { loja_id: LOJA_ID, nome: 'Larissa Mendes',     telefone: '(85) 98901-6677', data_nascimento: '1996-08-07' },
  // Rafaela Souza → VIP (alta conta, > 30 dias sem compra)
  { loja_id: LOJA_ID, nome: 'Rafaela Souza',      telefone: '(85) 97654-3210', data_nascimento: '1994-05-30' },
  // Camila Torres → inativo (> 45 dias sem compra)
  { loja_id: LOJA_ID, nome: 'Camila Torres',      telefone: '(85) 99345-7890', data_nascimento: '1992-09-18' },
]

function gerarVendasDemo() {
  const base = [
    { loja_id: LOJA_ID, data: `${HOJE}T14:00:00+00:00`,         valor: 127, cliente_nome: 'Ana Carolina Silva', produtos: [{ nome: 'Blusa Listrada', quantidade: 1 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(1)}T10:00:00+00:00`, valor: 98,  cliente_nome: 'Fernanda Rocha',     produtos: [{ nome: 'Calça Skinny', quantidade: 1 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(2)}T11:00:00+00:00`, valor: 145, cliente_nome: 'Juliana Matos',      produtos: [{ nome: 'Saia Midi', quantidade: 1 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(3)}T09:00:00+00:00`, valor: 89,  cliente_nome: 'Beatriz Oliveira',   produtos: [{ nome: 'Cropped Básico', quantidade: 2 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(4)}T15:00:00+00:00`, valor: 161, cliente_nome: 'Larissa Mendes',     produtos: [{ nome: 'Vestido Floral', quantidade: 1 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(5)}T16:00:00+00:00`, valor: 210, cliente_nome: null,                 produtos: [{ nome: 'Conjunto Tie Dye', quantidade: 1 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(6)}T13:00:00+00:00`, valor: 76,  cliente_nome: null,                 produtos: [{ nome: 'Blusa Listrada', quantidade: 1 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(7)}T10:00:00+00:00`, valor: 139, cliente_nome: 'Ana Carolina Silva', produtos: [{ nome: 'Calça Skinny', quantidade: 1 }] },
  ]

  // Rafaela Souza — VIP: total R$1540 >= 10 × ticket médio (~R$121)
  // Última compra 38 dias atrás → feed VIP ativado
  const vip = [
    { loja_id: LOJA_ID, data: `${diasAtras(38)}T11:00:00+00:00`, valor: 290, cliente_nome: 'Rafaela Souza', produtos: [{ nome: 'Calça Skinny', quantidade: 1 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(55)}T14:00:00+00:00`, valor: 280, cliente_nome: 'Rafaela Souza', produtos: [{ nome: 'Vestido Floral', quantidade: 1 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(62)}T10:00:00+00:00`, valor: 320, cliente_nome: 'Rafaela Souza', produtos: [{ nome: 'Conjunto Tie Dye', quantidade: 2 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(70)}T15:00:00+00:00`, valor: 350, cliente_nome: 'Rafaela Souza', produtos: [{ nome: 'Saia Midi', quantidade: 1 }] },
    { loja_id: LOJA_ID, data: `${diasAtras(80)}T09:00:00+00:00`, valor: 300, cliente_nome: 'Rafaela Souza', produtos: [{ nome: 'Cropped Básico', quantidade: 3 }] },
  ]

  // Camila Torres — inativo: última compra 55 dias atrás
  const inativo = [
    { loja_id: LOJA_ID, data: `${diasAtras(55)}T09:00:00+00:00`, valor: 120, cliente_nome: 'Camila Torres', produtos: [{ nome: 'Blusa Listrada', quantidade: 1 }] },
  ]

  const forma_pgto = JSON.stringify([{ forma: 'Pix', valor: '' }])
  return [...base, ...vip, ...inativo].map(v => ({
    forma_pgto,
    obs: null,
    vendedora: null,
    ajuste_valor: null,
    cliente_tel: null,
    ...v,
  }))
}

const DEMO_LEMBRETES = [
  { loja_id: LOJA_ID, cliente_nome: 'Fernanda Rocha',   nota: 'Ligar sobre encomenda do vestido florido',   data_lembrete: diasFrente(1), concluido: false },
  { loja_id: LOJA_ID, cliente_nome: 'Beatriz Oliveira', nota: 'Avisar que chegou o tamanho M da blusa',     data_lembrete: diasFrente(2), concluido: false },
  { loja_id: LOJA_ID, cliente_nome: 'Juliana Matos',    nota: 'Confirmar pedido de calça jeans azul',       data_lembrete: diasAtras(1),  concluido: false },
  { loja_id: LOJA_ID, cliente_nome: 'Larissa Mendes',   nota: 'Apresentar nova coleção de verão',           data_lembrete: diasFrente(5), concluido: false },
]

// ── Seed de demonstração ───────────────────────────────────────────
async function seedDemo() {
  console.log('\n[Demo] Inserindo dados de demonstração permanentes…')

  // Clientes — upsert por nome (ignora se já existir)
  for (const c of DEMO_CLIENTES) {
    const { data: exist } = await supabase
      .from('lf_clientes').select('id').eq('loja_id', LOJA_ID).ilike('nome', c.nome).maybeSingle()
    if (!exist) {
      const { error } = await supabase.from('lf_clientes').insert(c)
      if (error) console.warn(`  [AVISO] lf_clientes "${c.nome}": ${error.message}`)
      else console.log(`  + Cliente: ${c.nome}`)
    } else {
      // Atualiza birthday para ser relativa a hoje
      await supabase.from('lf_clientes').update({ data_nascimento: c.data_nascimento }).eq('id', exist.id)
      console.log(`  ~ Cliente (atualizado): ${c.nome}`)
    }
  }

  // Vendas — apenas insere se não existir (verifica pela data+cliente+valor)
  const vendasDemo = gerarVendasDemo()
  let vendasInseridas = 0
  for (const v of vendasDemo) {
    if (!v.cliente_nome) {
      const { error } = await supabase.from('lf_vendas').insert(v)
      if (!error) vendasInseridas++
      continue
    }
    const dataSlice = v.data.slice(0, 10)
    const { data: exist } = await supabase
      .from('lf_vendas').select('id')
      .eq('loja_id', LOJA_ID).eq('cliente_nome', v.cliente_nome).eq('valor', v.valor)
      .gte('data', dataSlice + 'T00:00:00').lte('data', dataSlice + 'T23:59:59')
      .maybeSingle()
    if (!exist) {
      const { error } = await supabase.from('lf_vendas').insert(v)
      if (!error) vendasInseridas++
    }
  }
  console.log(`  + ${vendasInseridas} vendas inseridas (demo)`)

  // Lembretes — insere se não existir para o mesmo cliente+data+nota
  let lemInserted = 0
  for (const l of DEMO_LEMBRETES) {
    const { data: exist } = await supabase
      .from('lf_lembretes').select('id')
      .eq('loja_id', LOJA_ID).eq('cliente_nome', l.cliente_nome).eq('data_lembrete', l.data_lembrete)
      .maybeSingle()
    if (!exist) {
      const { error } = await supabase.from('lf_lembretes').insert(l)
      if (!error) lemInserted++
    }
  }
  console.log(`  + ${lemInserted} lembretes inseridos (demo)`)
}

// ── Seção 1: funções puras (sem DB) ───────────────────────────────
function sec1_puras() {
  console.log('\n[Seção 1] Funções puras — sem DB')

  checar('normalizeWaPhone null → null',     normalizeWaPhone(null) === null)
  checar('normalizeWaPhone "(85) 99821-4530" → DDI 55', normalizeWaPhone('(85) 99821-4530') === '558599821-4530'.replace('-',''))

  // diasParaAniversario
  checar('diasParaAniversario hoje → 0',      diasParaAniversario(nascimentoOffset(0, 1990), HOJE) === 0)
  checar('diasParaAniversario em 5 dias → 5', diasParaAniversario(nascimentoOffset(5, 1990), HOJE) === 5)
  checar('diasParaAniversario null → null',   diasParaAniversario(null, HOJE) === null)

  // gerarSugestoesAuto puras
  const clientesTest = [
    { nome: `${MARKER} Aniv`, telefone: null, data_nascimento: nascimentoOffset(0, 1990) }, // hoje
    { nome: `${MARKER} Inativo`, telefone: null, data_nascimento: null },
  ]
  const vendasTest = [
    { cliente_nome: `${MARKER} Inativo`, data: diasAtras(50), valor: 100 }, // 50 dias
  ]
  const sugs = gerarSugestoesAuto(clientesTest, vendasTest, HOJE)

  const anivSug = sugs.find(s => s.subtipo === 'aniversario')
  checar('gerarSugestoesAuto: sugestão aniversário gerada', !!anivSug)
  checar('gerarSugestoesAuto: nota de aniversário hoje', anivSug?.nota === 'Aniversário hoje!')

  const inativoSug = sugs.find(s => s.subtipo === 'inativo')
  checar('gerarSugestoesAuto: sugestão inativo gerada (50 dias)', !!inativoSug)
  checar('gerarSugestoesAuto: data_referencia = última compra', inativoSug?.data_referencia === diasAtras(50))

  // isDispensado
  const disp = [{ cliente_nome: `${MARKER} Aniv`, tipo: 'aniversario', data_referencia: HOJE }]
  checar('isDispensado: match exato → true',        isDispensado(disp, `${MARKER} Aniv`, 'aniversario', HOJE) === true)
  checar('isDispensado: data diferente → false',    isDispensado(disp, `${MARKER} Aniv`, 'aniversario', diasAtras(1)) === false)

  // combinarFeed
  const feed = combinarFeed(sugs, [], [], HOJE)
  checar('combinarFeed: retorna ao menos 2 itens',  feed.length >= 2)
  const hojeItems = feed.filter(f => f.data <= HOJE)
  checar('combinarFeed: itens de hoje vêm primeiro', hojeItems.length > 0 && feed.indexOf(hojeItems[0]) === 0)

  // combinarFeed filtra dispensado
  const feedDisp = combinarFeed(sugs, [], disp, HOJE)
  checar('combinarFeed: dispensado é filtrado', !feedDisp.find(f => f.cliente_nome === `${MARKER} Aniv`))
}

// ── Seção 2: integração DB ────────────────────────────────────────
async function sec2_db() {
  console.log('\n[Seção 2] Integração DB — Supabase')

  // Insere clientes e vendas de teste
  const nomeAniv   = `${MARKER} AnivHoje`
  const nomeInativ = `${MARKER} Inativo`
  const nomeVip    = `${MARKER} VIPCliente`

  const hoje7 = new Date()
  hoje7.setFullYear(hoje7.getFullYear() - 30)
  const nascAnivHoje = `${hoje7.getFullYear()}-${String(hoje7.getMonth()+1).padStart(2,'0')}-${String(hoje7.getDate()).padStart(2,'0')}`

  await supabase.from('lf_clientes').insert([
    { loja_id: LOJA_ID, nome: nomeAniv,   telefone: null, data_nascimento: nascAnivHoje },
    { loja_id: LOJA_ID, nome: nomeInativ, telefone: null, data_nascimento: null },
    { loja_id: LOJA_ID, nome: nomeVip,    telefone: null, data_nascimento: null },
  ])

  // Vendas do mês corrente para estabelecer ticket médio ~ R$100
  const vendasBase = Array.from({ length: 5 }, (_, i) => ({
    loja_id: LOJA_ID, cliente_nome: null,
    data: `${HOJE}T${String(9+i).padStart(2,'0')}:00:00+00:00`,
    valor: 100, produtos: [], forma_pgto: JSON.stringify([{ forma: 'Pix', valor: '' }]),
    obs: null, vendedora: null, ajuste_valor: null,
  }))
  // VIP: 1200 >= 10×100 = 1000; última compra 40 dias atrás
  const vendasCRM = [
    { loja_id: LOJA_ID, cliente_nome: nomeInativ, data: `${diasAtras(50)}T10:00:00+00:00`, valor: 80, produtos: [], forma_pgto: JSON.stringify([{ forma: 'Pix', valor: '' }]), obs: null, vendedora: null, ajuste_valor: null },
    { loja_id: LOJA_ID, cliente_nome: nomeVip,    data: `${diasAtras(40)}T10:00:00+00:00`, valor: 1200, produtos: [], forma_pgto: JSON.stringify([{ forma: 'Pix', valor: '' }]), obs: null, vendedora: null, ajuste_valor: null },
  ]

  const { error: insErr } = await supabase.from('lf_vendas').insert([...vendasBase, ...vendasCRM])
  checar('insert de vendas de teste sem erro', !insErr, insErr?.message)

  const { data: cliDB } = await supabase.from('lf_clientes').select('*').eq('loja_id', LOJA_ID).ilike('nome', `${MARKER}%`)
  const { data: vendasDB } = await supabase.from('lf_vendas').select('*').eq('loja_id', LOJA_ID)
  checar('3 clientes de teste inseridos', (cliDB || []).length === 3, `encontrados: ${(cliDB||[]).length}`)

  const ticket = ticketMedioLoja(vendasDB || [], HOJE)
  checar('ticketMedioLoja > 0', ticket > 0, `ticket: ${ticket.toFixed(2)}`)

  // Verifica inativo
  checar('isInativo (50 dias) = true', isInativo(vendasDB || [], nomeInativ, HOJE) === true)

  // Verifica VIP
  const totalVip = (vendasDB || []).filter(v => v.cliente_nome === nomeVip).reduce((s, v) => s + Number(v.valor), 0)
  checar(`isVip (total ${totalVip} vs ticket ${ticket.toFixed(2)})`, isVip(totalVip, ticket) === true)

  // Verifica aniversário no feed
  const sugs = gerarSugestoesAuto(cliDB || [], vendasDB || [], HOJE)
  checar('feed contém aniversariante de hoje', !!sugs.find(s => s.subtipo === 'aniversario' && s.cliente_nome === nomeAniv))
  checar('feed contém inativo',                !!sugs.find(s => s.subtipo === 'inativo'     && s.cliente_nome === nomeInativ))
  checar('feed contém VIP',                    !!sugs.find(s => s.subtipo === 'vip'          && s.cliente_nome === nomeVip))

  // Lembrete de teste
  const { data: lemData, error: lemErr2 } = await supabase.from('lf_lembretes').insert({
    loja_id: LOJA_ID, cliente_nome: nomeAniv, nota: `${MARKER} nota test`, data_lembrete: HOJE, concluido: false,
  }).select().single()
  checar('insert lembrete sem erro', !lemErr2, lemErr2?.message)

  const feed = combinarFeed(sugs, lemData ? [lemData] : [], [], HOJE)
  checar('feed combina sugestão + lembrete', feed.length >= 4)
  checar('lembrete do teste está no feed', !!feed.find(f => f.lembrete_id === lemData?.id))
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log('=== seed-demo-crm | Follow-ups + CRM ===')
  console.log(`Loja: ${LOJA_ID} | Hoje: ${HOJE}`)

  if (onlyClean) {
    console.log('\n[Limpeza] Removendo apenas dados de teste técnico…')
    await limparTeste()
    console.log('Limpeza concluída.')
    return
  }

  // Limpa dados de teste anteriores antes de rodar
  await limparTeste()

  // Insere dados de demonstração permanentes
  await seedDemo()

  // Validação
  sec1_puras()
  await sec2_db()

  // Limpa dados de teste (mantém demonstração)
  console.log('\n[Limpeza] Removendo dados de teste técnico (mantendo demonstração)…')
  await limparTeste()
  console.log('Limpeza concluída.')

  console.log(`\n=== Resultado: ${falhas === 0 ? '✅ Todos os checks passaram' : `❌ ${falhas} check(s) falharam`} ===`)
  if (falhas === 0) {
    console.log('\nDados de demo inseridos em "Sua Loja":')
    console.log('  → Clientes com aniversário hoje, em 3 e 6 dias')
    console.log('  → Rafaela Souza: VIP (R$1540 em compras, última 38 dias atrás)')
    console.log('  → Camila Torres: inativo (55 dias sem compra)')
    console.log('  → 4 lembretes manuais (vencido ontem, hoje+1, hoje+2, hoje+5)')
  }
  process.exit(falhas > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
