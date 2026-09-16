#!/usr/bin/env node
/**
 * Remove os produtos fake/teste da Loja Estrada (loja_id = 'estrada').
 *
 * Critério de "fake": variacoes vazio/nulo E soma de quantidade = 0. Produto
 * com qualquer variação preenchida ou quantidade > 0 é IGNORADO (fica de fora
 * da exclusão) e listado à parte como "não removido, tinha dado real" — a
 * varredura roda de novo aqui em vez de reusar uma lista fixa, então mesmo
 * que algo tenha mudado no banco desde a investigação, o script não apaga
 * dado real por engano.
 *
 * Uso: node scripts/limparProdutosFakeEstrada.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function lerEnv(arquivo) {
  const out = {}
  if (!fs.existsSync(arquivo)) return out
  for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const raiz = path.resolve(import.meta.dirname, '..')
const env  = lerEnv(path.join(raiz, '.env'))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
// Sem SUPABASE_SERVICE_KEY disponível em .env local (só a Vercel tem o valor
// real). lf_produtos está com RLS desabilitado (supabase/loja_feminina.sql
// linha 80) e o próprio app já apaga produtos com a anon key
// (EstoqueMobile.jsx → handleDeleteProduto) — mesmo nível de acesso, então
// a anon key basta e evita depender de um segredo que não está disponível
// neste ambiente.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_KEY/VITE_SUPABASE_ANON_KEY (.env ou ambiente).')
  process.exit(1)
}

const LOJA_ID = 'estrada'
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

const { data: produtos, error: errFetch } = await sb
  .from('lf_produtos')
  .select('id, nome, variacoes, preco_custo, preco_venda')
  .eq('loja_id', LOJA_ID)
  .order('nome')

if (errFetch) {
  console.error('❌ Erro ao buscar produtos:', errFetch.message)
  process.exit(1)
}

const fakes = []
const reais = []
for (const p of produtos) {
  const variacoes = p.variacoes || []
  const somaQtd = variacoes.reduce((s, v) => s + Number(v.quantidade || 0), 0)
  if (variacoes.length === 0 && somaQtd === 0) fakes.push(p)
  else reais.push({ ...p, somaQtd })
}

console.log(`Loja: ${LOJA_ID}`)
console.log(`Total de produtos: ${produtos.length}`)
console.log(`\n=== Produtos FAKE a apagar (${fakes.length}) ===`)
for (const p of fakes) console.log(`  - ${p.nome}  [${p.id}]`)

if (reais.length > 0) {
  console.log(`\n=== NÃO removidos — tinham dado real (${reais.length}) ===`)
  for (const p of reais) {
    console.log(`  - ${p.nome}  [${p.id}]  variacoes=${JSON.stringify(p.variacoes)} somaQtd=${p.somaQtd} custo=${p.preco_custo} venda=${p.preco_venda}`)
  }
}

if (fakes.length === 0) {
  console.log('\nNada para apagar.')
  process.exit(0)
}

const ids = fakes.map(p => p.id)
const { error: errDelete, count } = await sb
  .from('lf_produtos')
  .delete({ count: 'exact' })
  .eq('loja_id', LOJA_ID)
  .in('id', ids)

if (errDelete) {
  console.error('\n❌ Erro ao apagar:', errDelete.message)
  process.exit(1)
}

console.log(`\n✅ ${count ?? ids.length} produto(s) fake removido(s) da Loja Estrada.`)
