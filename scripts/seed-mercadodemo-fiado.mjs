/**
 * Semeia contas de fiado de demonstração na loja 'mercadodemo' (telas T8/T9).
 *
 * merc_fiado estava vazia, então a tela caía no estado vazio e não dava para
 * ver os três estados. Os dados cobrem:
 *   · atrasado                  — compra antiga com pagamento parcial
 *   · devendo dentro do prazo   — compra recente (vinculada e não vinculada)
 *   · em dia                    — conta quitada
 *
 * Também cobre os dois caminhos de vínculo com lf_clientes: cliente cadastrado
 * (grava cliente_id, habilita o lembrete no WhatsApp) e nome livre
 * (cliente_id null), que é como o balcão costuma anotar.
 *
 * lf_clientes da mercadodemo estava vazia, então o script cadastra os clientes
 * de demonstração antes — sem eles não há telefone e o botão de WhatsApp
 * ficaria desabilitado, deixando metade do fluxo sem demonstrar.
 *
 * IDEMPOTENTE COM REFRESH: as datas são absolutas e envelhecem — em um mês o
 * "devendo dentro do prazo" viraria atrasado e a demo perderia sentido. Por
 * isso o script apaga e recria APENAS os lançamentos dos clientes que ele
 * mesmo cria (prefixo "Demo - " e nomes da lista abaixo). Nenhum lançamento
 * de outro cliente é tocado.
 *
 * Uso:
 *   SUPABASE_SERVICE_KEY=<service_role> node scripts/seed-mercadodemo-fiado.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dbfxigylileupucnuhmb.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY
const LOJA_ID      = 'mercadodemo'

if (!SERVICE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_KEY antes de rodar.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Data relativa a hoje em 'YYYY-MM-DD' — montada à mão, sem toISOString(). */
function emDias(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Clientes de demonstração. `vincular: false` fica de fora de lf_clientes de
// propósito, para exercitar o caminho de nome livre na tela.
const CLIENTES = [
  { nome: 'Demo - Maria Aparecida', telefone: '(91) 98123-4567', vincular: true },
  { nome: 'Demo - João Pedro',      telefone: '(91) 99876-5432', vincular: true },
  { nome: 'Demo - Seu Antônio',     telefone: null,              vincular: true },
  { nome: 'Demo - Dona Cleusa',     telefone: null,              vincular: false },
]

// PRAZO_PADRAO_DIAS é 30 (src/utils/fiado.js) — os dias abaixo foram escolhidos
// em função dele: -45 cai atrasado, -5 e -2 ficam dentro do prazo.
const LANCAMENTOS = [
  { cliente: 'Demo - Maria Aparecida', tipo: 'compra',    valor: 85.50, dias: -45, descricao: 'Levou 3 itens' },
  { cliente: 'Demo - Maria Aparecida', tipo: 'pagamento', valor: 30.00, dias: -20, descricao: 'Pagou parte' },
  { cliente: 'Demo - Maria Aparecida', tipo: 'compra',    valor: 24.90, dias: -12, descricao: 'Pão e leite' },
  { cliente: 'Demo - João Pedro',      tipo: 'compra',    valor: 42.00, dias:  -5, descricao: 'Feira da semana' },
  { cliente: 'Demo - Dona Cleusa',     tipo: 'compra',    valor: 18.00, dias:  -2, descricao: null },
  { cliente: 'Demo - Seu Antônio',     tipo: 'compra',    valor: 60.00, dias: -30, descricao: 'Ração e arroz' },
  { cliente: 'Demo - Seu Antônio',     tipo: 'pagamento', valor: 60.00, dias:  -1, descricao: 'Quitou a conta' },
]

const NOMES = CLIENTES.map(c => c.nome)

async function main() {
  console.log(`Semeando fiado de demonstração em '${LOJA_ID}'...\n`)

  // ── 1. Clientes ────────────────────────────────────────────
  const { data: jaClientes, error: errCli } = await supabase
    .from('lf_clientes').select('id, nome, telefone').eq('loja_id', LOJA_ID)
  if (errCli) { console.error('❌ Erro ao listar clientes:', errCli.message); process.exit(1) }

  const outros = jaClientes.filter(c => !NOMES.includes(c.nome))
  console.log(`Clientes que NÃO serão tocados (${outros.length}):`)
  for (const c of outros) console.log(`   · ${c.nome}`)
  if (!outros.length) console.log('   (nenhum)')
  console.log()

  const mapaCliente = new Map(jaClientes.map(c => [c.nome, c]))
  const novosClientes = CLIENTES
    .filter(c => c.vincular && !mapaCliente.has(c.nome))
    .map(c => ({ loja_id: LOJA_ID, nome: c.nome, telefone: c.telefone }))

  if (novosClientes.length) {
    const { data, error } = await supabase.from('lf_clientes').insert(novosClientes).select('id, nome')
    if (error) { console.error('❌ Erro ao inserir clientes:', error.message); process.exit(1) }
    for (const c of data) mapaCliente.set(c.nome, c)
    console.log(`✅ ${data.length} cliente(s) de demonstração cadastrado(s) em lf_clientes.`)
  } else {
    console.log('ℹ️  Clientes de demonstração já cadastrados.')
  }

  // ── 2. Limpa só os lançamentos deste script ────────────────
  const { data: apagados, error: errDel } = await supabase
    .from('merc_fiado').delete()
    .eq('loja_id', LOJA_ID).in('cliente_nome', NOMES)
    .select('id')
  if (errDel) { console.error('❌ Erro ao limpar lançamentos:', errDel.message); process.exit(1) }
  if (apagados?.length) console.log(`♻️  ${apagados.length} lançamento(s) anterior(es) deste script removido(s) para recriar com datas atuais.`)

  // ── 3. Insere os lançamentos ───────────────────────────────
  const linhas = LANCAMENTOS.map(l => {
    const cli = CLIENTES.find(c => c.nome === l.cliente)
    return {
      loja_id:      LOJA_ID,
      cliente_id:   cli.vincular ? (mapaCliente.get(l.cliente)?.id || null) : null,
      cliente_nome: l.cliente,
      tipo:         l.tipo,
      valor:        l.valor,
      descricao:    l.descricao,
      data:         emDias(l.dias),
    }
  })

  const { error } = await supabase.from('merc_fiado').insert(linhas)
  if (error) { console.error('❌ Erro ao inserir lançamentos:', error.message); process.exit(1) }

  console.log(`\n✅ ${linhas.length} lançamento(s) inserido(s).\n`)

  // ── 4. Resumo dos saldos ───────────────────────────────────
  const saldos = new Map()
  for (const l of LANCAMENTOS) {
    const s = saldos.get(l.cliente) || 0
    saldos.set(l.cliente, s + (l.tipo === 'pagamento' ? -l.valor : l.valor))
  }
  console.log('   saldo     cliente                       → estado esperado')
  for (const c of CLIENTES) {
    const s = Math.round((saldos.get(c.nome) || 0) * 100) / 100
    const prim = LANCAMENTOS.find(l => l.cliente === c.nome)
    const estado = s <= 0 ? 'em dia' : (prim.dias < -30 ? 'ATRASADO' : 'devendo, dentro do prazo')
    const vinc = c.vincular ? (c.telefone ? 'vinculado c/ telefone' : 'vinculado s/ telefone') : 'nome livre'
    console.log(`   ${('R$ ' + s.toFixed(2)).padStart(9)}  ${c.nome.padEnd(28)} → ${estado} · ${vinc}`)
  }

  const { count } = await supabase
    .from('merc_fiado').select('*', { count: 'exact', head: true }).eq('loja_id', LOJA_ID)
  console.log(`\nTotal de lançamentos na loja agora: ${count}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
