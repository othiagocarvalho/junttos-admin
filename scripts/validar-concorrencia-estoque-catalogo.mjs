/**
 * Prova de concorrência para criar_pedido_catalogo
 * (supabase/fix_estoque_catalogo_publico.sql).
 *
 * Uso (DEPOIS de rodar o SQL no Supabase Dashboard):
 *   SUPABASE_SERVICE_KEY=<service_role> node scripts/validar-concorrencia-estoque-catalogo.mjs
 *
 * Por que precisa da service key: anon não tem INSERT em lf_produtos nem
 * DELETE em lf_pedidos (grants de tabela, separados de RLS — lf_produtos
 * está com RLS desligada, mas isso não dá INSERT de graça; confirmado nesta
 * sessão: a primeira versão deste script, só com anon, morreu em
 * "permission denied for table lf_produtos"). A service key é usada só para
 * MONTAR o cenário (criar o produto de teste, ler o saldo final, limpar) —
 * as chamadas à RPC sob teste continuam pela ANON key (clienteA/clienteB),
 * porque é exatamente o caminho que a cliente real do catálogo usa
 * (supabasePublico.js fala sem sessão, como anon).
 *
 * O QUE FAZ
 * Cria um produto de teste em "sualoja" com 1 única unidade em estoque (a
 * "última peça"), dispara DUAS chamadas à RPC criar_pedido_catalogo AO MESMO
 * TEMPO (Promise.all — não uma depois da outra) pedindo 1 unidade cada, e
 * confere que só uma consegue. É o cenário descrito na investigação: dois
 * clientes tentando comprar a última unidade do mesmo produto simultaneamente.
 *
 * Também roda um caso sequencial (mais fácil de depurar se o concorrente
 * falhar de um jeito inesperado): compra a última unidade, tenta comprar de
 * novo, confere que a segunda tentativa é rejeitada com a mensagem certa.
 *
 * Limpa os dados de teste ao final (produto e pedidos criados), inclusive se
 * alguma verificação falhar no meio.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

// Mesmo padrão de scripts/resetSenhaDonoTropicale.mjs: aceita a chave por
// env var direta ou por .env na raiz do repo.
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
  console.error('❌ Defina SUPABASE_SERVICE_KEY (variável de ambiente ou .env) — necessária para')
  console.error('   criar/limpar o produto de teste em lf_produtos (anon não tem esse grant).')
  console.error('   Ex.: SUPABASE_SERVICE_KEY=<chave> node scripts/validar-concorrencia-estoque-catalogo.mjs')
  process.exit(1)
}

const LOJA_ID     = 'sualoja'
const TEST_MARKER = '[TESTE-CONCORRENCIA-ESTOQUE]'

let falhas = 0
function ok(desc)        { console.log(`  ✅ ${desc}`) }
function info(desc)      { console.log(`  ℹ️  ${desc}`) }
function fail(desc, det) { console.log(`  ❌ ${desc}${det ? ` — ${det}` : ''}`); falhas++ }

// admin (service_role) monta e desmonta o cenário. Dois "clientes" anon —
// duas conexões independentes, como dois navegadores diferentes — chamam a
// RPC sob teste, exatamente como a cliente real do catálogo faria.
const admin    = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const clienteA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const clienteB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function itemPedido(produtoId, cor, qtd = 1) {
  return [{
    produto_id: produtoId, nome: `${TEST_MARKER} Produto`, cor, tamanho: null, qtd, preco: 10,
  }]
}

function dadosCliente(nome) {
  return { cliente_nome: nome, cliente_whatsapp: '85999990000' }
}

async function criarProdutoUmaUnidade(cor) {
  const { data, error } = await admin.from('lf_produtos').insert({
    loja_id: LOJA_ID,
    nome: `${TEST_MARKER} Produto`,
    preco_venda: 10,
    ativo: true,
    disponivel_catalogo_b2b: true,
    fotos: ['https://example.com/foto.jpg'],
    variacoes: [{ cor, quantidade: 1 }],
  }).select('id').single()
  if (error) throw new Error(`Falha ao criar produto de teste: ${error.message}`)
  return data.id
}

async function limpar(produtoIds, pedidoIds) {
  console.log('\n── Limpeza ───────────────────────────────────────────────')
  if (pedidoIds.length) {
    const { error } = await admin.from('lf_pedidos').delete().in('id', pedidoIds)
    if (error) fail('Erro ao apagar pedidos de teste', error.message)
    else ok(`${pedidoIds.length} pedido(s) de teste removido(s)`)
  }
  if (produtoIds.length) {
    const { error } = await admin.from('lf_produtos').delete().in('id', produtoIds)
    if (error) fail('Erro ao apagar produto(s) de teste', error.message)
    else ok(`${produtoIds.length} produto(s) de teste removido(s)`)
  }
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════')
  console.log('  Concorrência de estoque — criar_pedido_catalogo (Sua Loja)')
  console.log('════════════════════════════════════════════════════════\n')

  const produtosCriados = []

  // ── 0. Pré-requisito: a RPC existe? ───────────────────────────────────
  console.log('── 0. RPC criar_pedido_catalogo está no ar? ─────────────')
  const produtoSonda = await criarProdutoUmaUnidade('SONDA')
  produtosCriados.push(produtoSonda)
  const sonda = await clienteA.rpc('criar_pedido_catalogo', {
    p_loja_id: LOJA_ID,
    p_dados_cliente: dadosCliente('Sonda'),
    p_itens: itemPedido(produtoSonda, 'SONDA', 1),
    p_valor_total: 10,
    p_status: 'aguardando_contato',
  })
  if (sonda.error) {
    fail('RPC não respondeu como esperado — rode fix_estoque_catalogo_publico.sql antes', sonda.error.message)
    await limpar(produtosCriados, [])
    console.log('\n════ ❌ Abortado: pré-requisito não atendido. ════\n')
    process.exit(1)
  }
  ok(`RPC no ar — pedido de sonda criado (id=${sonda.data.pedido_id.slice(0, 8)}…)`)
  const pedidosCriados = [sonda.data.pedido_id]

  // ── 1. Corrida de verdade: duas chamadas SIMULTÂNEAS pela última unidade ──
  console.log('\n── 1. Duas clientes, mesma última unidade, ao mesmo tempo ──')
  const produtoCorrida = await criarProdutoUmaUnidade('CORRIDA')
  produtosCriados.push(produtoCorrida)

  const chamada = cliente => cliente.rpc('criar_pedido_catalogo', {
    p_loja_id: LOJA_ID,
    p_dados_cliente: dadosCliente('Cliente da corrida'),
    p_itens: itemPedido(produtoCorrida, 'CORRIDA', 1),
    p_valor_total: 10,
    p_status: 'aguardando_contato',
  })

  const [resA, resB] = await Promise.all([chamada(clienteA), chamada(clienteB)])

  const sucessos = [resA, resB].filter(r => !r.error)
  const rejeitados = [resA, resB].filter(r => r.error)

  if (sucessos.length === 1 && rejeitados.length === 1) {
    ok('Exatamente UMA das duas chamadas simultâneas conseguiu — a outra foi rejeitada')
    pedidosCriados.push(sucessos[0].data.pedido_id)
  } else {
    fail(
      `Esperado 1 sucesso + 1 rejeição, veio ${sucessos.length} sucesso(s) + ${rejeitados.length} rejeição(ões)`,
      `respostas: ${JSON.stringify({ resA: resA.error?.message ?? resA.data, resB: resB.error?.message ?? resB.data })}`,
    )
    for (const r of sucessos) pedidosCriados.push(r.data.pedido_id)
  }

  if (rejeitados.length === 1) {
    const msg = rejeitados[0].error.message
    if (msg.startsWith('ESTOQUE_INSUFICIENTE:')) {
      const detalhe = JSON.parse(msg.slice('ESTOQUE_INSUFICIENTE:'.length))
      if (detalhe.disponivel === 0) {
        ok(`Rejeição tem o motivo certo — disponivel=0 depois que a outra levou a única unidade (detalhe: ${JSON.stringify(detalhe)})`)
      } else {
        fail(`Rejeição não diz disponivel=0`, JSON.stringify(detalhe))
      }
    } else {
      fail('Rejeição não tem o prefixo ESTOQUE_INSUFICIENTE — outro erro aconteceu', msg)
    }
  }

  // Confere o saldo final no banco: tem que ser exatamente 0, nunca negativo
  // (decremento duplo) nem 1 (nenhuma das duas decrementou). admin porque
  // anon não tem SELECT liberado em lf_produtos.variacoes para este teste.
  const { data: produtoFinal, error: leituraErr } = await admin
    .from('lf_produtos').select('variacoes').eq('id', produtoCorrida).single()
  if (leituraErr) {
    fail('Erro ao ler o saldo final do produto', leituraErr.message)
  } else {
    const saldo = produtoFinal.variacoes?.[0]?.quantidade
    if (saldo === 0) ok('Saldo final da variação é exatamente 0 — nem sobrou, nem foi para negativo')
    else fail(`Saldo final deveria ser 0, veio ${saldo}`)
  }

  // ── 2. Caso sequencial (mais fácil de depurar) ────────────────────────
  console.log('\n── 2. Sequencial: compra a última, tenta comprar de novo ──')
  const produtoSeq = await criarProdutoUmaUnidade('SEQUENCIAL')
  produtosCriados.push(produtoSeq)

  const primeira = await clienteA.rpc('criar_pedido_catalogo', {
    p_loja_id: LOJA_ID,
    p_dados_cliente: dadosCliente('Primeira cliente'),
    p_itens: itemPedido(produtoSeq, 'SEQUENCIAL', 1),
    p_valor_total: 10,
    p_status: 'aguardando_contato',
  })
  if (primeira.error) {
    fail('Primeira compra deveria ter passado', primeira.error.message)
  } else {
    ok(`Primeira compra passou — pedido ${primeira.data.pedido_id.slice(0, 8)}…`)
    pedidosCriados.push(primeira.data.pedido_id)
  }

  const segunda = await clienteB.rpc('criar_pedido_catalogo', {
    p_loja_id: LOJA_ID,
    p_dados_cliente: dadosCliente('Segunda cliente'),
    p_itens: itemPedido(produtoSeq, 'SEQUENCIAL', 1),
    p_valor_total: 10,
    p_status: 'aguardando_contato',
  })
  if (segunda.error?.message?.startsWith('ESTOQUE_INSUFICIENTE:')) {
    ok('Segunda compra foi rejeitada corretamente — "nunca depois", exatamente no finalizar')
  } else {
    fail('Segunda compra deveria ter sido rejeitada com ESTOQUE_INSUFICIENTE', segunda.error?.message ?? 'passou sem erro')
    if (!segunda.error) pedidosCriados.push(segunda.data.pedido_id)
  }

  // ── 3. estoque_baixado gravado certo ───────────────────────────────────
  console.log('\n── 3. estoque_baixado = true nos pedidos criados por esta RPC ──')
  // admin porque a policy de SELECT do anon em lf_pedidos só libera as
  // colunas (id, status) — estoque_baixado não é uma delas, de propósito
  // (migration_rls_pedidos.sql): não é dado que a cliente final precise ler.
  const { data: pedidosGravados, error: pedidosErr } = await admin
    .from('lf_pedidos').select('id, estoque_baixado').in('id', pedidosCriados)
  if (pedidosErr) {
    fail('Erro ao ler pedidos criados', pedidosErr.message)
  } else if (pedidosGravados.every(p => p.estoque_baixado === true)) {
    ok(`Todos os ${pedidosGravados.length} pedidos criados têm estoque_baixado=true`)
  } else {
    fail('Algum pedido criado pela RPC não tem estoque_baixado=true', JSON.stringify(pedidosGravados))
  }

  await limpar(produtosCriados, pedidosCriados)

  console.log('\n─────────────────────────────────────────────────────────')
  if (falhas === 0) {
    console.log('════ ✅ Todas as verificações de concorrência passaram. ════\n')
    process.exit(0)
  } else {
    console.log(`════ ❌ ${falhas} verificação(ões) falharam. ════\n`)
    process.exit(1)
  }
}

main().catch(async e => {
  console.error('\nErro inesperado:', e)
  process.exit(1)
})
