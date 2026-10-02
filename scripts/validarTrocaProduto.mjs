/**
 * Validação da Troca de Produto (Nova Venda, mobile e desktop) na "Sua Loja".
 *
 * Roda os três cenários da troca pelo MESMO código que a tela usa:
 *   montarGravacaoVenda  (src/utils/venda.js)       → o que vai para lf_vendas
 *   salvarVendaComEstoque + aplicarEstoqueItens
 *                        (src/utils/baixaEstoque.js) → insert da venda, depois
 *                          devolve o produto trocado e baixa o produto novo
 *
 *   1. crédito IGUAL ao produto novo    → troca zerada, forma "Troca" R$ 0
 *   2. crédito MENOR que o produto novo → cliente paga só a diferença
 *   3. crédito MAIOR que o produto novo → saldo a favor (não reembolsável),
 *                                         gravada como zerada
 * Em cada cenário: uma venda original do produto que depois volta, e a troca.
 *
 * DOIS MODOS
 *
 *   node scripts/validarTrocaProduto.mjs
 *     LEITURA (padrão). Não grava NADA no banco. Lê os produtos da sualoja
 *     (só para confirmar acesso) e roda os três cenários com produtos e
 *     estoque em memória, passando pelo pipeline real com a gravação
 *     substituída por fakes. Valida a linha que iria para lf_vendas e o
 *     estoque resultante.
 *
 *   SUPABASE_SERVICE_KEY=<service_role> node scripts/validarTrocaProduto.mjs --executar
 *     GRAVA na sualoja e DESFAZ no fim. Cria 4 produtos "[TESTE-TROCA] …",
 *     faz as vendas e trocas de verdade (lf_vendas + lf_set_variacoes, o
 *     mesmo RPC da tela, que alimenta lf_estoque_mov pelo trigger) e confere
 *     no banco: a linha da venda, o estoque de cada produto e o histórico de
 *     movimentação (devolução +1 e venda −1 com origem na troca).
 *     O "rollback" é limpeza compensatória, não transação — a API REST não
 *     abre transação. Ela roda num finally (inclusive se algo falhar no meio)
 *     e apaga: as vendas criadas, as pendências de estoque delas e os
 *     produtos de teste (lf_estoque_mov cai junto, ON DELETE CASCADE). Restos
 *     de uma execução interrompida são apagados no começo da próxima, pelo
 *     prefixo "[TESTE-TROCA]". Nenhuma outra loja nem produto real é tocado.
 *     Precisa da service key porque o app só deixa o anon LER lf_produtos.
 *     Não passa pela trava de balanço (é do addVenda, não da troca).
 *
 * Os imports de src/ usam caminho sem extensão (padrão do Vite), que o Node
 * puro não resolve — por isso eles entram via jiti (já vem no node_modules
 * com o Tailwind e o ESLint).
 */

import fs from 'node:fs'
import path from 'node:path'
import { createJiti } from 'jiti'
import { createClient } from '@supabase/supabase-js'

const jiti = createJiti(import.meta.url)
const { montarGravacaoVenda, calcularTotalVenda, calcularResumoTroca } = await jiti.import('../src/utils/venda.js')
const { salvarVendaComEstoque, aplicarEstoqueItens, criarBuscaPorId, criarBuscaPorNome } = await jiti.import('../src/utils/baixaEstoque.js')

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

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

const EXECUTAR = process.argv.includes('--executar')
const LOJA_ID  = 'sualoja'
const MARCA    = '[TESTE-TROCA]'

let falhas = 0
const ok   = desc => console.log(`  ✅ ${desc}`)
const fail = (desc, det = '') => { console.log(`  ❌ ${desc}${det ? ` — ${det}` : ''}`); falhas++ }
const eq   = (desc, atual, esperado) => JSON.stringify(atual) === JSON.stringify(esperado)
  ? ok(desc)
  : fail(desc, `esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(atual)}`)
const perto = (desc, atual, esperado) => Math.abs(Number(atual) - esperado) < 0.005
  ? ok(desc)
  : fail(desc, `esperado ${esperado}, veio ${atual}`)

// ── Os produtos e os cenários ────────────────────────────────────────────
// Estoque inicial 5 em cada; uma variação só ("M"), como uma peça de verdade.
const PRODUTOS = [
  { chave: 'blusa',   nome: `${MARCA} Blusa 80`,    preco: 80 },
  { chave: 'vestido', nome: `${MARCA} Vestido 80`,  preco: 80 },
  { chave: 'calca',   nome: `${MARCA} Calça 120`,   preco: 120 },
  { chave: 'saia',    nome: `${MARCA} Saia 60`,     preco: 60 },
]
const ESTOQUE_INICIAL = 5

const CENARIOS = [
  { nome: '1 · crédito igual (Blusa 80 → Vestido 80)',   devolve: 'blusa', leva: 'vestido',
    esperado: { valor: 0,  ajuste: -80,  forma: [{ forma: 'Troca', valor: 0 }],  rotulo: 'Troca zerada' } },
  { nome: '2 · crédito menor (Blusa 80 → Calça 120)',    devolve: 'blusa', leva: 'calca', formaPgto: 'Pix',
    esperado: { valor: 40, ajuste: -80,  forma: [{ forma: 'Pix', valor: 40 }],  rotulo: 'A cobrar' } },
  { nome: '3 · crédito maior (Calça 120 → Saia 60)',     devolve: 'calca', leva: 'saia',
    esperado: { valor: 0,  ajuste: -120, forma: [{ forma: 'Troca', valor: 0 }],  rotulo: 'Saldo a favor' } },
]

// Variação de produto como o cadastro grava: { cor: 'M', quantidade, custo }.
const variacoesIniciais = () => [{ cor: 'M', quantidade: ESTOQUE_INICIAL, custo: 0 }]
const qtdM = variacoes => Number((variacoes || []).find(v => v.cor === 'M')?.quantidade ?? NaN)

/** Payload da tela para uma venda comum de 1 peça. */
function telaVenda(produto) {
  const item = { produto_id: produto.id, nome: produto.nome, variacao: 'M', obs: 'M', quantidade: 1 }
  const valor = produto.preco_venda.toFixed(2).replace('.', ',')
  return {
    item,
    gravacao: montarGravacaoVenda({
      isTroca: false, produtos: [item], produtosData: [produto], valor,
      pagamentos: [{ forma: 'Pix', valor }], ajusteTipo: 'desconto', ajusteModo: 'valor', ajusteInput: '',
    }),
  }
}

/** Payload da tela para a troca — o "Valor Total" sai do resumo, como na tela. */
function telaTroca(devolvido, novo, formaPgto = 'Pix', produtosData) {
  const itemDev  = { produto_id: devolvido.id, nome: devolvido.nome, variacao: 'M', obs: 'M', quantidade: 1 }
  const itemNovo = { produto_id: novo.id,      nome: novo.nome,      variacao: 'M', obs: 'M', quantidade: 1 }
  const resumo = calcularResumoTroca(calcularTotalVenda([itemNovo], produtosData), calcularTotalVenda([itemDev], produtosData))
  const valor = resumo.valorCobrado.toFixed(2).replace('.', ',')
  return {
    resumo, itemDev, itemNovo,
    gravacao: montarGravacaoVenda({
      isTroca: true, produtos: [itemNovo], produtoTroca: [itemDev], produtosData, valor,
      pagamentos: [{ forma: formaPgto, valor }], trocaDesconto: '', trocaAcrescimo: '',
    }),
  }
}

function venda(gravacao, produtos) {
  return {
    cliente_nome: `${MARCA} Cliente`, cliente_tel: null, obs: MARCA, vendedora: null,
    data: new Date().toISOString(), produtos,
    valor: gravacao.valor, ajuste_valor: gravacao.ajuste_valor, forma_pgto: gravacao.forma_pgto,
    tipo_venda: gravacao.tipo_venda, produto_devolvido: gravacao.produto_devolvido,
  }
}

function conferirLinha(cen, linha, resumo) {
  eq('resumo da tela', resumo.rotulo, cen.esperado.rotulo)
  eq('tipo_venda', linha.tipo_venda, 'troca')
  perto('valor (o que a cliente pagou)', linha.valor, cen.esperado.valor)
  perto('ajuste_valor (−crédito)', linha.ajuste_valor, cen.esperado.ajuste)
  eq('forma_pgto', JSON.parse(linha.forma_pgto), cen.esperado.forma)
  eq('produtos = só o produto novo', (linha.produtos || []).map(p => p.nome), [PRODUTOS.find(p => p.chave === cen.leva).nome])
  eq('produto_devolvido não vira coluna', 'produto_devolvido' in linha, false)
}

// ── Modo leitura: pipeline real, gravação em memória ──────────────────────
async function modoLeitura() {
  console.log('\nModo LEITURA — nada é gravado. Use --executar para validar no banco.\n')

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: reais, error } = await anon.from('lf_produtos').select('id').eq('loja_id', LOJA_ID).limit(1000)
  if (error) fail('ler produtos da sualoja (anon)', error.message)
  else ok(`acesso de leitura à sualoja (${reais.length} produtos, nenhum é usado aqui)`)

  for (const cen of CENARIOS) {
    console.log(`\n▶ Cenário ${cen.nome}`)
    // Banco em memória
    const db = new Map(PRODUTOS.map((p, i) => [`mem-${i}`, { id: `mem-${i}`, nome: p.nome, preco_venda: p.preco, chave: p.chave, variacoes: variacoesIniciais() }]))
    const produtosData = [...db.values()]
    const porChave = k => produtosData.find(p => p.chave === k)
    const movs = []
    let linhaGravada = null
    let seq = 0
    const deps = {
      buscarPorId: async id => ({ data: db.has(id) ? [db.get(id)] : [], error: null }),
      buscarPorNome: async nome => ({ data: produtosData.filter(p => p.nome === nome), error: null }),
      gravarVariacoes: async (id, vars, ctx) => {
        movs.push({ produto_id: id, tipo: ctx.tipo, delta: qtdM(vars) - qtdM(db.get(id).variacoes), origem_id: ctx.origemId })
        db.get(id).variacoes = vars
        return null
      },
      registrarPendencia: async () => {},
    }
    const salvar = v => salvarVendaComEstoque({
      inserir: async payload => { linhaGravada = { id: `venda-${++seq}`, ...payload }; return { data: linhaGravada, error: null } },
      aplicar: (itens, opts) => aplicarEstoqueItens(deps, itens, opts),
    }, v)

    const dev = porChave(cen.devolve), novo = porChave(cen.leva)
    const original = telaVenda(dev)
    const r1 = await salvar(venda(original.gravacao, [original.item]))
    eq('venda original sem falha de estoque', r1.falhasEstoque, [])

    const t = telaTroca(dev, novo, cen.formaPgto, produtosData)
    const r2 = await salvar(venda(t.gravacao, [t.itemNovo]))
    eq('troca sem falha de estoque', r2.falhasEstoque, [])
    conferirLinha(cen, linhaGravada, t.resumo)

    eq(`estoque de ${dev.nome}: vendeu 1 e voltou 1`, qtdM(dev.variacoes), ESTOQUE_INICIAL)
    eq(`estoque de ${novo.nome}: saiu 1 na troca`, qtdM(novo.variacoes), ESTOQUE_INICIAL - 1)
    const daTroca = movs.filter(m => m.origem_id === linhaGravada.id)
    eq('movimentação da troca: devolução +1, depois venda −1',
      daTroca.map(m => [m.tipo, m.delta]), [['devolucao', 1], ['venda', -1]])
  }
}

// ── Modo executar: banco de verdade, com limpeza ──────────────────────────
async function modoExecutar() {
  const chave = process.env.SUPABASE_SERVICE_KEY || envArquivo.SUPABASE_SERVICE_KEY
  if (!chave) {
    console.error('❌ --executar precisa de SUPABASE_SERVICE_KEY (variável de ambiente ou .env).')
    process.exit(1)
  }
  console.log('\nModo EXECUTAR — grava na sualoja e apaga tudo no fim.\n')
  const admin = createClient(SUPABASE_URL, chave, { auth: { persistSession: false } })

  const vendaIds = []
  let produtoIds = []

  async function limpar(motivo) {
    const { data: restos } = await admin.from('lf_produtos').select('id').eq('loja_id', LOJA_ID).like('nome', `${MARCA}%`)
    const ids = [...new Set([...produtoIds, ...(restos || []).map(p => p.id)])]
    const { data: vendasRestos } = await admin.from('lf_vendas').select('id').eq('loja_id', LOJA_ID).eq('obs', MARCA)
    const vIds = [...new Set([...vendaIds, ...(vendasRestos || []).map(v => v.id)])]
    if (vIds.length) {
      await admin.from('lf_estoque_pendencias').delete().in('venda_id', vIds)
      const { error } = await admin.from('lf_vendas').delete().in('id', vIds)
      if (error) console.log(`  ⚠️  limpeza de vendas (${motivo}): ${error.message}`)
    }
    if (ids.length) {
      const { error } = await admin.from('lf_produtos').delete().in('id', ids)
      if (error) console.log(`  ⚠️  limpeza de produtos (${motivo}): ${error.message}`)
    }
    return { vendas: vIds.length, produtos: ids.length }
  }

  const antes = await limpar('restos de execução anterior')
  if (antes.vendas || antes.produtos) console.log(`  (apagados restos anteriores: ${antes.vendas} vendas, ${antes.produtos} produtos)`)

  // Mesma gravação de estoque da tela (useLojaData.gravarVariacoes → RPC).
  const deps = {
    buscarPorId:   criarBuscaPorId(admin, LOJA_ID),
    buscarPorNome: criarBuscaPorNome(admin, LOJA_ID),
    gravarVariacoes: async (id, variacoes, ctx = {}) => {
      const { error } = await admin.rpc('lf_set_variacoes', {
        p_produto_id: id, p_variacoes: variacoes, p_loja_id: LOJA_ID,
        p_tipo: ctx.tipo || 'ajuste', p_origem_tipo: ctx.origemTipo || 'manual',
        p_origem_id: ctx.origemId || null, p_motivo: ctx.motivo || null, p_usuario: MARCA,
      })
      return error
    },
    registrarPendencia: async () => {},
  }
  const salvar = v => salvarVendaComEstoque({
    inserir: payload => admin.from('lf_vendas').insert({ ...payload, loja_id: LOJA_ID }).select().single(),
    aplicar: (itens, opts) => aplicarEstoqueItens(deps, itens, opts),
  }, v)
  const lerProduto = async id => (await admin.from('lf_produtos').select('id, nome, preco_venda, variacoes').eq('id', id).single()).data

  try {
    for (const cen of CENARIOS) {
      console.log(`\n▶ Cenário ${cen.nome}`)
      // Produtos novos a cada cenário: o estoque de um não contamina o outro.
      const { data: criados, error } = await admin.from('lf_produtos').insert(PRODUTOS.map(p => ({
        loja_id: LOJA_ID, nome: p.nome, preco_venda: p.preco, variacoes: variacoesIniciais(), ativo: true,
      }))).select('id, nome, preco_venda, variacoes')
      if (error) { fail('criar produtos de teste', error.message); continue }
      produtoIds.push(...criados.map(p => p.id))
      const porChave = k => criados.find(p => p.nome === PRODUTOS.find(x => x.chave === k).nome)
      const dev = porChave(cen.devolve), novo = porChave(cen.leva)

      const original = telaVenda(dev)
      const r1 = await salvar(venda(original.gravacao, [original.item]))
      if (r1.error) { fail('gravar venda original', r1.error.message); continue }
      vendaIds.push(r1.venda.id)
      eq('venda original sem falha de estoque', r1.falhasEstoque, [])
      eq(`estoque de ${dev.nome} depois da venda`, qtdM((await lerProduto(dev.id)).variacoes), ESTOQUE_INICIAL - 1)

      const t = telaTroca(dev, novo, cen.formaPgto, criados)
      const r2 = await salvar(venda(t.gravacao, [t.itemNovo]))
      if (r2.error) { fail('gravar troca', r2.error.message); continue }
      vendaIds.push(r2.venda.id)
      eq('troca sem falha de estoque', r2.falhasEstoque, [])

      const { data: linha } = await admin.from('lf_vendas').select('*').eq('id', r2.venda.id).single()
      conferirLinha(cen, linha, t.resumo)

      eq(`estoque de ${dev.nome}: voltou para ${ESTOQUE_INICIAL}`, qtdM((await lerProduto(dev.id)).variacoes), ESTOQUE_INICIAL)
      eq(`estoque de ${novo.nome}: ${ESTOQUE_INICIAL - 1}`, qtdM((await lerProduto(novo.id)).variacoes), ESTOQUE_INICIAL - 1)

      const { data: movs, error: em } = await admin.from('lf_estoque_mov')
        .select('produto_id, tipo, delta, origem_id').eq('origem_id', r2.venda.id).order('created_at')
      if (em) fail('ler lf_estoque_mov', em.message)
      else eq('lf_estoque_mov da troca: devolução +1 no devolvido, venda −1 no novo',
        movs.map(m => [m.produto_id === dev.id ? 'devolvido' : m.produto_id === novo.id ? 'novo' : '?', m.tipo, Number(m.delta)]),
        [['devolvido', 'devolucao', 1], ['novo', 'venda', -1]])
    }
  } finally {
    const r = await limpar('fim')
    console.log(`\n🧹 Limpeza: ${r.vendas} vendas e ${r.produtos} produtos de teste apagados (movimentações junto).`)
    const { count: sobra } = await admin.from('lf_produtos').select('id', { count: 'exact', head: true }).eq('loja_id', LOJA_ID).like('nome', `${MARCA}%`)
    sobra === 0 ? ok('nada de teste ficou na sualoja') : fail('sobrou produto de teste', `${sobra}`)
  }
}

;(EXECUTAR ? modoExecutar() : modoLeitura())
  .catch(e => { console.error('\n💥 erro inesperado:', e); falhas++ })
  .finally(() => {
    console.log(falhas === 0 ? '\n✅ Tudo certo.' : `\n❌ ${falhas} verificação(ões) falharam.`)
    process.exit(falhas === 0 ? 0 : 1)
  })
