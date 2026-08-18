/**
 * Validação E2E do seletor de modelo de venda (Varejo / Atacado).
 * Uso: node scripts/validar-modelo-venda.mjs
 *
 * Testa contra o banco de verdade, com o MESMO payload que a tela monta:
 *   - criação Varejo   → features.catalogo_b2b false, sem colunas de pedido mínimo
 *   - criação Atacado  → features.catalogo_b2b 'pro' + pedido mínimo gravado
 *   - edição           → troca Varejo↔Atacado preservando as outras features
 *   - valor legado     → catalogo_b2b true normalizado para 'pro'
 *
 * Mesma convenção de scripts/validar-cadastro-loja.mjs: usa um slug de teste
 * próprio e limpa tudo no fim, inclusive se falhar no meio. NÃO cria cobrança
 * nem usuário Auth — só lf_config, que é o que este recurso grava.
 */

import { createClient } from '@supabase/supabase-js'
import {
  MODELO_VAREJO, MODELO_ATACADO,
  modeloDeFeatures, featuresComModelo, rotuloNivel, precisaGravar,
} from '../src/utils/modeloVenda.js'

const SUPABASE_URL      = 'https://dbfxigylileupucnuhmb.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnhpZ3lsaWxldXB1Y251aG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg5NzksImV4cCI6MjA5NjA5NDk3OX0.Km3kkNsu86_i1JarusXwaZmuwnRm0FiBeKK_kR_4EKo'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const SLUG = 'teste-auto-modelo-venda'
const NOME = '[TESTE-AUTO] Modelo de venda'

let falhas = 0
function ok(desc)                 { console.log(`  ✅ ${desc}`) }
function fail(desc, detail = '')  { console.log(`  ❌ ${desc}${detail ? ` — ${detail}` : ''}`); falhas++ }
function eq(desc, atual, esperado) {
  JSON.stringify(atual) === JSON.stringify(esperado)
    ? ok(desc)
    : fail(desc, `esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(atual)}`)
}

async function limpar() {
  await supabase.from('lf_config').delete().eq('loja_id', SLUG)
}

/** Payload mínimo de lf_config — só o que este recurso precisa exercitar. */
function payload(features, pedidoMinimo = null) {
  return {
    loja_id: SLUG, slug: SLUG, nome: NOME,
    status: 'Trial', plano: 'business', segmento: 'moda',
    features,
    // Sem vencimento_dia a loja fica fora da geração automática de cobrança.
    vencimento_dia: null,
    ...(pedidoMinimo || {}),
  }
}

async function lerFeatures() {
  const { data } = await supabase
    .from('lf_config').select('features, pedido_minimo_tipo, pedido_minimo_valor, pedido_minimo_qtd')
    .eq('loja_id', SLUG).maybeSingle()
  return data
}

async function main() {
  console.log(`\nValidação do modelo de venda · loja de teste '${SLUG}'\n`)
  await limpar()

  try {
    // ── 1. Criação Varejo ────────────────────────────────────
    console.log('1. Criação como Varejo')
    const featVarejo = featuresComModelo({ crm: false, vendas: true }, MODELO_VAREJO)
    let { error } = await supabase.from('lf_config').insert(payload(featVarejo))
    if (error) { fail('insert varejo', error.message); return }
    let row = await lerFeatures()
    eq('features.catalogo_b2b é false', row.features.catalogo_b2b, false)
    eq('as outras features sobrevivem', row.features.vendas, true)
    if (!row.pedido_minimo_tipo || row.pedido_minimo_tipo === 'nenhum') ok('sem pedido mínimo')
    else fail('varejo não deveria ter pedido mínimo', row.pedido_minimo_tipo)
    eq('seletor abre em Varejo', modeloDeFeatures(row.features), MODELO_VAREJO)

    // ── 2. Edição: Varejo → Atacado ──────────────────────────
    console.log('\n2. Edição — Varejo → Atacado')
    const featAtacado = featuresComModelo(row.features, MODELO_ATACADO)
    ;({ error } = await supabase.from('lf_config').update({ features: featAtacado }).eq('loja_id', SLUG))
    if (error) { fail('update atacado', error.message); return }
    row = await lerFeatures()
    eq("catalogo_b2b vira 'pro' (liga pedido mínimo e grade)", row.features.catalogo_b2b, 'pro')
    eq('crm intacto', row.features.crm, false)
    eq('vendas intacto', row.features.vendas, true)
    eq('seletor abre em Atacado', modeloDeFeatures(row.features), MODELO_ATACADO)

    // ── 3. Edição: Atacado → Varejo (volta ao original) ──────
    console.log('\n3. Edição — Atacado → Varejo')
    const featVolta = featuresComModelo(row.features, MODELO_VAREJO)
    ;({ error } = await supabase.from('lf_config').update({ features: featVolta }).eq('loja_id', SLUG))
    if (error) { fail('update varejo', error.message); return }
    row = await lerFeatures()
    eq('volta exatamente ao features original', row.features, featVarejo)

    // ── 4. Criação Atacado com pedido mínimo ─────────────────
    console.log('\n4. Criação como Atacado, com pedido mínimo por valor')
    await limpar()
    ;({ error } = await supabase.from('lf_config').insert(payload(
      featuresComModelo({ crm: false }, MODELO_ATACADO),
      { pedido_minimo_tipo: 'valor', pedido_minimo_valor: 500, pedido_minimo_qtd: null },
    )))
    if (error) { fail('insert atacado', error.message); return }
    row = await lerFeatures()
    eq("catalogo_b2b 'pro'", row.features.catalogo_b2b, 'pro')
    eq('pedido_minimo_tipo', row.pedido_minimo_tipo, 'valor')
    eq('pedido_minimo_valor', Number(row.pedido_minimo_valor), 500)
    eq('pedido_minimo_qtd fica nulo', row.pedido_minimo_qtd, null)

    // ── 5. Valor legado true ─────────────────────────────────
    console.log('\n5. Valor legado catalogo_b2b: true (existe em produção)')
    ;({ error } = await supabase.from('lf_config')
      .update({ features: { crm: false, vendas: true, catalogo_b2b: true } }).eq('loja_id', SLUG))
    if (error) { fail('update legado', error.message); return }
    row = await lerFeatures()
    eq('seletor mostra Atacado, não Varejo', modeloDeFeatures(row.features), MODELO_ATACADO)
    eq('rótulo avisa do estado legado', /legado/.test(rotuloNivel(row.features.catalogo_b2b)), true)
    eq('botão oferece a normalização', precisaGravar(MODELO_ATACADO, row.features.catalogo_b2b), true)
    const normalizado = featuresComModelo(row.features, MODELO_ATACADO)
    ;({ error } = await supabase.from('lf_config').update({ features: normalizado }).eq('loja_id', SLUG))
    if (error) { fail('update normalizacao', error.message); return }
    row = await lerFeatures()
    eq("normaliza para 'pro'", row.features.catalogo_b2b, 'pro')
    eq('sem perder as outras flags', row.features.vendas, true)
  } finally {
    await limpar()
    const { data: sobrou } = await supabase.from('lf_config').select('loja_id').eq('loja_id', SLUG).maybeSingle()
    sobrou ? fail('LIMPEZA FALHOU — remova a loja de teste à mão', SLUG) : ok('\nloja de teste removida')
  }

  console.log(falhas === 0 ? '\n✅ Tudo certo.\n' : `\n❌ ${falhas} falha(s).\n`)
  if (falhas) process.exitCode = 1
}

main()
