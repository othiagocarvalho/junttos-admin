/**
 * Semeia dados de demonstração para a tela de Caixa (T10-T13) na loja
 * 'mercadodemo'.
 *
 * A tela lê só o dia de hoje (utils/caixa.js:doDia), então sem vendas e
 * saídas de hoje ela cai no estado vazio (R$ 0,00 em tudo) e não dá pra ver
 * o card "De onde veio o dinheiro" nem as contas a pagar coloridas por
 * urgência. Os dados cobrem:
 *   · vendas de hoje nas 3 formas (Dinheiro, Pix, Cartão) — alimenta os
 *     cards "Entrou" e a barra de participação por forma
 *   · duas saídas de hoje (troco, despesa) — alimenta o card "Saiu"
 *   · três contas a pagar — uma vencida, uma vencendo amanhã (também
 *     aparece no aviso da T13) e uma normal, cobrindo as 3 cores de
 *     urgência (COR_URGENCIA)
 *
 * IDEMPOTENTE COM REFRESH: "hoje" muda a cada execução, então o script
 * apaga e recria APENAS os registros que ele mesmo cria — vendas com
 * cliente_nome 'Demo - Caixa', saídas e contas com descrição começando em
 * "Demo - ". Nenhum outro registro da loja é tocado.
 *
 * lf_vendas e lf_contas_pagar rodam com RLS desabilitado, igual merc_saidas
 * (ver supabase/migration_merc_saidas.sql) — não precisa de service_role,
 * a própria chave anon do app já grava.
 *
 * Uso:
 *   SUPABASE_ANON_KEY=<anon> node scripts/seed-mercadodemo-caixa.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dbfxigylileupucnuhmb.supabase.co'
const ANON_KEY      = process.env.SUPABASE_ANON_KEY
const LOJA_ID       = 'mercadodemo'
const MARCA_VENDA   = 'Demo - Caixa'

if (!ANON_KEY) {
  console.error('❌ Defina SUPABASE_ANON_KEY antes de rodar.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Data relativa a hoje em 'YYYY-MM-DD' — montada à mão, sem toISOString(). */
function emDias(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const HOJE = emDias(0)

// Vendas de hoje. produtos e horário só para o recibo/WhatsApp fazerem sentido.
const VENDAS = [
  { hora: '09:15', forma: 'Dinheiro', valor: 120.00, produtos: [{ nome: 'Arroz 5kg', quantidade: 2 }, { nome: 'Feijão 1kg', quantidade: 3 }] },
  { hora: '10:40', forma: 'Pix',      valor: 32.50,  produtos: [{ nome: 'Leite integral', quantidade: 4 }] },
  { hora: '13:05', forma: 'Cartão',   valor: 78.90,  produtos: [{ nome: 'Detergente', quantidade: 6 }, { nome: 'Sabão em pó', quantidade: 1 }] },
]

// Saídas de hoje (merc_saidas).
const SAIDAS = [
  { valor: 10.00, descricao: 'Demo - Troco pro cliente', categoria: 'troco' },
  { valor: 35.00, descricao: 'Demo - Compra de gás',      categoria: 'despesa' },
]

// Contas a pagar — uma de cada cor (COR_URGENCIA em utils/caixa.js).
const CONTAS = [
  { descricao: 'Demo - Fornecedor de hortifruti', valor: 340.00,  dias: -3  }, // vencido
  { descricao: 'Demo - Conta de luz',             valor: 210.00,  dias: 1   }, // vence amanhã (breve + aviso na T13)
  { descricao: 'Demo - Aluguel do ponto',         valor: 1200.00, dias: 10  }, // normal
]

async function main() {
  console.log(`Semeando Caixa de demonstração em '${LOJA_ID}' para o dia ${HOJE}...\n`)

  // ── 1. Vendas ───────────────────────────────────────────────
  const { data: apagadasVendas, error: errDelV } = await supabase
    .from('lf_vendas').delete()
    .eq('loja_id', LOJA_ID).eq('cliente_nome', MARCA_VENDA)
    .select('id')
  if (errDelV) { console.error('❌ Erro ao limpar vendas anteriores:', errDelV.message); process.exit(1) }
  if (apagadasVendas?.length) console.log(`♻️  ${apagadasVendas.length} venda(s) anterior(es) deste script removida(s) para recriar com data de hoje.`)

  const linhasVendas = VENDAS.map(v => ({
    loja_id:      LOJA_ID,
    data:         new Date(`${HOJE}T${v.hora}:00`).toISOString(),
    valor:        v.valor,
    cliente_nome: MARCA_VENDA,
    cliente_tel:  null,
    produtos:     v.produtos,
    forma_pgto:   JSON.stringify([{ forma: v.forma, valor: v.valor }]),
    obs:          null,
    vendedora:    null,
    ajuste_valor: 0,
  }))

  const { error: errV } = await supabase.from('lf_vendas').insert(linhasVendas)
  if (errV) { console.error('❌ Erro ao inserir vendas:', errV.message); process.exit(1) }
  console.log(`✅ ${linhasVendas.length} venda(s) de hoje inserida(s) (Dinheiro, Pix, Cartão).`)

  // ── 2. Saídas ───────────────────────────────────────────────
  const { data: apagadasSaidas, error: errDelS } = await supabase
    .from('merc_saidas').delete()
    .eq('loja_id', LOJA_ID).like('descricao', 'Demo - %')
    .select('id')
  if (errDelS) { console.error('❌ Erro ao limpar saídas anteriores:', errDelS.message); process.exit(1) }
  if (apagadasSaidas?.length) console.log(`♻️  ${apagadasSaidas.length} saída(s) anterior(es) deste script removida(s) para recriar com data de hoje.`)

  const linhasSaidas = SAIDAS.map(s => ({
    loja_id:   LOJA_ID,
    valor:     s.valor,
    descricao: s.descricao,
    categoria: s.categoria,
    data:      HOJE,
  }))

  const { error: errS } = await supabase.from('merc_saidas').insert(linhasSaidas)
  if (errS) { console.error('❌ Erro ao inserir saídas:', errS.message); process.exit(1) }
  console.log(`✅ ${linhasSaidas.length} saída(s) de hoje inserida(s).`)

  // ── 3. Contas a pagar ───────────────────────────────────────
  const { data: apagadasContas, error: errDelC } = await supabase
    .from('lf_contas_pagar').delete()
    .eq('loja_id', LOJA_ID).like('descricao', 'Demo - %')
    .select('id')
  if (errDelC) { console.error('❌ Erro ao limpar contas anteriores:', errDelC.message); process.exit(1) }
  if (apagadasContas?.length) console.log(`♻️  ${apagadasContas.length} conta(s) anterior(es) deste script removida(s) para recriar com vencimentos atuais.`)

  const linhasContas = CONTAS.map(c => ({
    loja_id:         LOJA_ID,
    descricao:       c.descricao,
    categoria:       'outros',
    valor:            c.valor,
    data_vencimento: emDias(c.dias),
    status:          'pendente',
    observacoes:     null,
  }))

  const { error: errC } = await supabase.from('lf_contas_pagar').insert(linhasContas)
  if (errC) { console.error('❌ Erro ao inserir contas a pagar:', errC.message); process.exit(1) }
  console.log(`✅ ${linhasContas.length} conta(s) a pagar inserida(s) (vencida, vencendo amanhã, normal).`)

  // ── 4. Resumo esperado ──────────────────────────────────────
  const entrou = VENDAS.reduce((s, v) => s + v.valor, 0)
  const saiu   = SAIDAS.reduce((s, x) => s + x.valor, 0)
  const dinheiro = VENDAS.filter(v => v.forma === 'Dinheiro').reduce((s, v) => s + v.valor, 0)
  console.log('\n── Resumo esperado na tela de Caixa ──────')
  console.log(`   Entrou:            R$ ${entrou.toFixed(2)}`)
  console.log(`   Saiu:              R$ ${saiu.toFixed(2)}`)
  console.log(`   Sobrou:            R$ ${(entrou - saiu).toFixed(2)}`)
  console.log(`   Dinheiro esperado: R$ ${(dinheiro - saiu).toFixed(2)} (pra contagem na T11/T12)`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
