/**
 * Semeia um produto de demonstração com preço progressivo (atacarejo) na
 * loja 'mercadodemo', pra dar pra ver o desconto por faixa funcionando de
 * verdade em CadastrarProduto.jsx / NovaVenda.jsx.
 *
 * lf_produtos e merc_precos_faixas rodam com RLS desabilitado (ver
 * supabase/loja_feminina.sql:80 e supabase/migration_merc_precos_faixas_rls.sql)
 * — não precisa de service_role, a chave anon do app já grava.
 *
 * IDEMPOTENTE COM REFRESH: apaga e recria APENAS o produto com o nome abaixo
 * (prefixo "Demo -") e suas faixas. Nenhum outro produto da loja é tocado.
 *
 * Uso:
 *   SUPABASE_ANON_KEY=<anon> node scripts/seed-mercadodemo-atacarejo.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dbfxigylileupucnuhmb.supabase.co'
const ANON_KEY      = process.env.SUPABASE_ANON_KEY
const LOJA_ID       = 'mercadodemo'

if (!ANON_KEY) {
  console.error('❌ Defina SUPABASE_ANON_KEY antes de rodar.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PRODUTO = {
  nome:         'Demo - Detergente Atacado',
  preco_venda:  32.00,
  quantidade:   50,
}

// A mesma progressão usada na validação: normal R$32, cai pra R$28 a partir
// de 6 un. e pra R$24 a partir de 12 — dá pra ver as duas faixas na prática.
const FAIXAS = [
  { qtd_minima: 6,  preco_faixa: 28.00 },
  { qtd_minima: 12, preco_faixa: 24.00 },
]

async function main() {
  console.log(`Semeando produto de atacarejo em '${LOJA_ID}'...\n`)

  // ── 1. Limpa só o produto deste script (e suas faixas, via FK) ──────
  const { data: existentes, error: errBusca } = await supabase
    .from('lf_produtos').select('id').eq('loja_id', LOJA_ID).eq('nome', PRODUTO.nome)
  if (errBusca) { console.error('❌ Erro ao buscar produto anterior:', errBusca.message); process.exit(1) }

  for (const p of existentes || []) {
    const { error: errDelFaixas } = await supabase.from('merc_precos_faixas').delete().eq('produto_id', p.id)
    if (errDelFaixas) { console.error('❌ Erro ao limpar faixas anteriores:', errDelFaixas.message); process.exit(1) }
  }
  if (existentes?.length) {
    const { error: errDelProd } = await supabase.from('lf_produtos').delete().eq('loja_id', LOJA_ID).eq('nome', PRODUTO.nome)
    if (errDelProd) { console.error('❌ Erro ao limpar produto anterior:', errDelProd.message); process.exit(1) }
    console.log(`♻️  Produto e faixas anteriores deste script removidos, pra recriar do zero.`)
  }

  // ── 2. Cria o produto ────────────────────────────────────────────────
  const { data: produto, error: errProd } = await supabase
    .from('lf_produtos')
    .insert({
      loja_id:     LOJA_ID,
      nome:        PRODUTO.nome,
      preco_custo: 0,
      preco_venda: PRODUTO.preco_venda,
      variacoes:   [{ cor: 'Único', quantidade: PRODUTO.quantidade }],
      ativo:       true,
    })
    .select().single()
  if (errProd) { console.error('❌ Erro ao inserir produto:', errProd.message); process.exit(1) }
  console.log(`✅ Produto "${PRODUTO.nome}" cadastrado (preço normal ${fmtR(PRODUTO.preco_venda)}).`)

  // ── 3. Cria as faixas ────────────────────────────────────────────────
  const linhasFaixas = FAIXAS.map(f => ({
    loja_id:     LOJA_ID,
    produto_id:  produto.id,
    qtd_minima:  f.qtd_minima,
    preco_faixa: f.preco_faixa,
  }))
  const { error: errFaixas } = await supabase.from('merc_precos_faixas').insert(linhasFaixas)
  if (errFaixas) { console.error('❌ Erro ao inserir faixas:', errFaixas.message); process.exit(1) }

  console.log('\n── Faixas cadastradas ─────────────────────')
  for (const f of FAIXAS) console.log(`   A partir de ${String(f.qtd_minima).padStart(2)} un. → ${fmtR(f.preco_faixa)}`)
  console.log(`\nPra ver funcionando: Vender → bipe/digite "${PRODUTO.nome}" 6x (cai pra ${fmtR(28)}) ou 12x (cai pra ${fmtR(24)}).`)
}

function fmtR(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ',') }

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
