#!/usr/bin/env node
/**
 * Remove os 122 produtos da Loja Estrada (loja_id = 'estrada') corrompidos
 * pela importação feita pela tela antiga (ImportarPlanilha.jsx) com uma
 * planilha no layout novo (Produto|Cor|Tamanho|Quantidade|Custo|Venda) — ver
 * relatório da investigação anterior. O parser antigo lê por posição fixa de
 * coluna, então cada linha da planilha virou um produto isolado, com Custo
 * zerado e quantidade/código vindos das colunas erradas.
 *
 * Só apaga se a contagem bater com o que a investigação encontrou: a loja
 * estava zerada antes dessa importação, então TODOS os produtos hoje
 * cadastrados vieram dela. Se a contagem não for exatamente a esperada, o
 * script para sem apagar nada — não confia cegamente no que foi dito, confere
 * de novo antes de uma exclusão em massa.
 *
 * Uso: SUPABASE_SERVICE_KEY=<chave> node scripts/limparProdutosCorrompidosEstrada.mjs
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
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY

// lf_produtos tem RLS: DELETE exige um usuário `authenticated` com claim
// loja_id correto (migration_rls_catalogo_publico_parte1.sql) — a anon key já
// provou não servir para isso na limpeza anterior (permission denied). Este
// script precisa mesmo da service key real; não há fallback aqui de propósito.
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_KEY (variável de ambiente ou .env).')
  console.error('   Ex.: SUPABASE_SERVICE_KEY=<chave> node scripts/limparProdutosCorrompidosEstrada.mjs')
  process.exit(1)
}

const LOJA_ID = 'estrada'
const ESPERADO = 122
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

const { data: produtos, error: errFetch } = await sb
  .from('lf_produtos')
  .select('id, nome')
  .eq('loja_id', LOJA_ID)
  .order('nome')

if (errFetch) {
  console.error('❌ Erro ao buscar produtos:', errFetch.message)
  process.exit(1)
}

console.log(`Loja: ${LOJA_ID}`)
console.log(`Total de produtos encontrados: ${produtos.length}`)
console.log(`Amostra (5 primeiros nomes): ${produtos.slice(0, 5).map(p => p.nome).join(', ')}`)

if (produtos.length !== ESPERADO) {
  console.error(`\n❌ Contagem (${produtos.length}) não bate com o esperado (${ESPERADO}) — a loja pode ter produtos além da importação corrompida.`)
  console.error('   Nada foi apagado. Confira manualmente antes de rodar de novo.')
  process.exit(1)
}

const ids = produtos.map(p => p.id)
const { error: errDelete, count } = await sb
  .from('lf_produtos')
  .delete({ count: 'exact' })
  .eq('loja_id', LOJA_ID)
  .in('id', ids)

if (errDelete) {
  console.error('\n❌ Erro ao apagar:', errDelete.message)
  process.exit(1)
}

console.log(`\n✅ ${count ?? ids.length} produto(s) corrompido(s) removido(s) da Loja Estrada.`)
console.log('   A loja está zerada de novo — pronta para reimportar pelo botão "Importar Estoque".')
