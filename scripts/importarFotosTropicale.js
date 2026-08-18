/**
 * Importa as fotos da loja TropicaleAtacado e vincula cada uma ao seu produto.
 *
 * Uso:
 *   node scripts/importarFotosTropicale.js              # dry-run (padrão, não grava nada)
 *   node scripts/importarFotosTropicale.js --apply      # faz upload e grava no banco
 *   node scripts/importarFotosTropicale.js --apply --force
 *       # sobrescreve produto que JÁ tem outra foto (por padrão esse produto é pulado)
 *
 * Chave: SUPABASE_SERVICE_KEY no ambiente (fallback: VITE_SUPABASE_SERVICE_KEY,
 * depois VITE_SUPABASE_ANON_KEY do .env — lf_produtos está com RLS desligada,
 * então a anon consegue gravar; o Storage pode exigir a service key).
 *
 * ─── POR QUE EXISTE UM MANIFESTO ───────────────────────────────────────────
 * O vínculo foto↔produto é POSICIONAL: 01.jpg é o 1º produto, 02.jpg o 2º, etc.
 * O critério combinado era `ORDER BY created_at ASC`, mas os 37 produtos foram
 * importados na mesma transação e têm o MESMO created_at (verificado: 1 valor
 * distinto para 37 linhas). Com o campo de ordenação empatado o Postgres não
 * garante ordem nenhuma — ele devolve a ordem física da heap, que muda quando
 * uma linha é reescrita (e este script reescreve todas elas).
 *
 * Então: na primeira execução o script congela a ordem observada num manifesto
 * JSON (posição → id do produto) e, daí em diante, usa SEMPRE o manifesto.
 * Isso torna o script idempotente de verdade e impede que uma segunda rodada
 * mande a foto 07 para o produto errado. O manifesto fica versionado junto do
 * script para o vínculo ficar auditável.
 *
 * O `id` NÃO é usado como desempate na ordenação de propósito: são UUID v4,
 * sem relação com a ordem de importação — ordenar por id embaralharia tudo.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ── Config ────────────────────────────────────────────────────
const LOJA_ID   = 'tropicaleatacado'
const BUCKET    = 'produtos-fotos'   // bucket já usado pelo app (ProdutosB2BPro.jsx)
const PASTA_FOTOS = process.env.FOTOS_DIR || path.join(os.homedir(), 'Desktop', 'fotos-tropicale')
const TOTAL_ESPERADO = 37
const MANIFESTO = path.join(import.meta.dirname, 'importarFotosTropicale.manifesto.json')

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

// ── Ambiente / Supabase ───────────────────────────────────────
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
const CHAVE = process.env.SUPABASE_SERVICE_KEY
  || (env.VITE_SUPABASE_SERVICE_KEY || '')
  || process.env.VITE_SUPABASE_ANON_KEY
  || env.VITE_SUPABASE_ANON_KEY

// ── Helpers ───────────────────────────────────────────────────
function morrer(msg, ...extras) {
  console.error(`\n❌ ${msg}`)
  extras.forEach(l => console.error(`   ${l}`))
  process.exit(1)
}

/** Lista 01.jpg..37.jpg em ordem NUMÉRICA (não alfabética). */
function lerFotos(dir) {
  if (!fs.existsSync(dir)) return null
  return fs.readdirSync(dir)
    .filter(f => /^\d+\.(jpe?g|png|webp)$/i.test(f))
    .map(f => ({ arquivo: f, n: parseInt(f, 10) }))
    .sort((a, b) => a.n - b.n)
}

function carregarManifesto() {
  if (!fs.existsSync(MANIFESTO)) return null
  return JSON.parse(fs.readFileSync(MANIFESTO, 'utf8'))
}

function gravarManifesto(mapa) {
  fs.writeFileSync(MANIFESTO, JSON.stringify(mapa, null, 2) + '\n')
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log(`║  Fotos → produtos · loja '${LOJA_ID}'`.padEnd(59) + '║')
  console.log(`║  Modo: ${APPLY ? 'APLICAR (grava no banco)' : 'DRY-RUN (não grava nada)'}`.padEnd(59) + '║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // 1. Fotos ---------------------------------------------------
  const fotos = lerFotos(PASTA_FOTOS)
  if (fotos === null) {
    morrer(`Pasta de fotos não encontrada: ${PASTA_FOTOS}`,
      'Crie a pasta com os 37 arquivos renomeados 01.jpg … 37.jpg,',
      'ou aponte outra pasta com FOTOS_DIR=/caminho node scripts/importarFotosTropicale.js')
  }
  console.log(`📁 ${PASTA_FOTOS}`)
  console.log(`   ${fotos.length} foto(s) encontrada(s)\n`)

  if (fotos.length !== TOTAL_ESPERADO) {
    const achados = new Set(fotos.map(f => f.n))
    const faltando = []
    for (let i = 1; i <= TOTAL_ESPERADO; i++) if (!achados.has(i)) faltando.push(String(i).padStart(2, '0'))
    morrer(`Esperava ${TOTAL_ESPERADO} fotos, encontrei ${fotos.length}.`,
      faltando.length ? `Faltando: ${faltando.join(', ')}` : 'Há arquivos numerados fora da faixa 01–37.',
      'Nada foi enviado. Corrija a pasta e rode de novo.')
  }

  // 2. Supabase ------------------------------------------------
  if (!SUPABASE_URL || !CHAVE) morrer('VITE_SUPABASE_URL / chave ausentes no .env.')
  const sb = createClient(SUPABASE_URL, CHAVE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 3. Produtos, na ordem congelada ----------------------------
  const { data: produtos, error: erroProd } = await sb
    .from('lf_produtos')
    .select('id, nome, fotos, variacoes')
    .eq('loja_id', LOJA_ID)
    .order('created_at', { ascending: true })
  if (erroProd) morrer(`Erro ao ler lf_produtos: ${erroProd.message}`)

  if (produtos.length !== TOTAL_ESPERADO) {
    morrer(`Esperava ${TOTAL_ESPERADO} produtos na loja, encontrei ${produtos.length}.`,
      'A contagem tem que bater com as fotos — não dá pra adivinhar o vínculo.',
      'Nada foi enviado.')
  }

  let manifesto = carregarManifesto()
  let ordenados

  if (manifesto) {
    if (manifesto.loja_id !== LOJA_ID) morrer(`Manifesto é de outra loja (${manifesto.loja_id}).`)
    const porId = Object.fromEntries(produtos.map(p => [p.id, p]))
    const sumiram = manifesto.itens.filter(it => !porId[it.produto_id])
    if (sumiram.length) {
      morrer(`${sumiram.length} produto(s) do manifesto não existem mais no banco.`,
        sumiram.map(it => `${it.posicao} — ${it.nome}`).join(' | '),
        'O vínculo foto↔produto ficou inválido. Regenere apagando:',
        MANIFESTO)
    }
    ordenados = manifesto.itens.map(it => porId[it.produto_id])
    console.log(`🔒 Ordem lida do manifesto (${path.basename(MANIFESTO)}) — ${ordenados.length} produtos.\n`)
  } else {
    ordenados = produtos
    console.log('🆕 Sem manifesto ainda — a ordem abaixo vem do banco e será congelada.')
    console.log('   ⚠️  Os 37 produtos têm o MESMO created_at. Confira o pareamento')
    console.log('       nome ↔ arquivo abaixo ANTES de rodar com --apply.\n')
  }

  // 4. Pareamento ----------------------------------------------
  console.log('  #  arquivo    produto                                     var  status')
  console.log('  ─────────────────────────────────────────────────────────────────────')
  const plano = ordenados.map((p, i) => {
    const foto = fotos[i]
    const ext  = foto.arquivo.split('.').pop().toLowerCase()
    const destino = `${LOJA_ID}/${String(foto.n).padStart(2, '0')}.${ext}`
    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(destino)
    const atuais = Array.isArray(p.fotos) ? p.fotos : []
    let acao = 'enviar'
    if (atuais.includes(publicUrl)) acao = 'ja-vinculado'
    else if (atuais.length > 0) acao = FORCE ? 'sobrescrever' : 'pular-tem-outra-foto'
    return { p, foto, destino, publicUrl, atuais, acao }
  })

  plano.forEach((it, i) => {
    const marca = { 'ja-vinculado': '=', 'pular-tem-outra-foto': '!', 'sobrescrever': '~', 'enviar': '+' }[it.acao]
    console.log(`  ${String(i + 1).padStart(2, '0')} ${marca} ${it.foto.arquivo.padEnd(9)} ${it.p.nome.slice(0, 42).padEnd(43)} ${String((it.p.variacoes || []).length).padStart(2)}   ${it.acao}`)
  })

  const bloqueados = plano.filter(it => it.acao === 'pular-tem-outra-foto')
  if (bloqueados.length) {
    console.log(`\n  ⚠️  ${bloqueados.length} produto(s) já têm outra foto e serão PULADOS.`)
    console.log('      Rode com --force se a intenção for substituir.')
  }

  if (!APPLY) {
    console.log('\n🔎 DRY-RUN — nada foi enviado nem gravado.')
    console.log('   Confira o pareamento acima e rode de novo com --apply.')
    return
  }

  // 5. Congela a ordem ANTES de gravar (o UPDATE muda a heap order) ----
  if (!manifesto) {
    gravarManifesto({
      loja_id: LOJA_ID,
      gerado_em: new Date().toISOString(),
      observacao: 'Ordem congelada da 1a execucao. created_at empata nos 37 produtos, entao a ordem do banco nao e reproduzivel apos updates.',
      itens: ordenados.map((p, i) => ({
        posicao: String(i + 1).padStart(2, '0'),
        produto_id: p.id,
        nome: p.nome,
        arquivo: fotos[i].arquivo,
      })),
    })
    console.log(`\n🔒 Ordem congelada em ${MANIFESTO}`)
  }

  // 6. Upload + vínculo ----------------------------------------
  console.log('\n── Enviando ────────────────────────────────────────────────\n')
  let ok = 0, pulados = 0, erros = 0

  for (const it of plano) {
    const rotulo = `${it.p.nome} -> ${it.foto.arquivo}`

    if (it.acao === 'ja-vinculado') {
      console.log(`= ${rotulo} -> já vinculado (pulado)`)
      pulados++
      continue
    }
    if (it.acao === 'pular-tem-outra-foto') {
      console.log(`! ${rotulo} -> já tem outra foto, pulado (use --force)`)
      pulados++
      continue
    }

    try {
      const ext = it.foto.arquivo.split('.').pop().toLowerCase()
      const buf = fs.readFileSync(path.join(PASTA_FOTOS, it.foto.arquivo))
      // upsert: mesmo caminho a cada rodada, então reenviar não duplica objeto
      const { error: erroUp } = await sb.storage.from(BUCKET).upload(it.destino, buf, {
        upsert: true,
        contentType: MIME[ext] || 'image/jpeg',
      })
      if (erroUp) throw new Error(`upload: ${erroUp.message}`)

      const novas = FORCE || it.atuais.length === 0 ? [it.publicUrl] : [...it.atuais, it.publicUrl]
      const { error: erroUpd } = await sb
        .from('lf_produtos')
        .update({ fotos: novas })
        .eq('id', it.p.id)
        .eq('loja_id', LOJA_ID)
      if (erroUpd) throw new Error(`update: ${erroUpd.message}`)

      console.log(`✅ ${rotulo} -> sucesso`)
      ok++
    } catch (e) {
      console.log(`❌ ${rotulo} -> erro: ${e.message}`)
      erros++
    }
  }

  console.log('\n── Resumo ──────────────────────────────────────────────────')
  console.log(`   sucesso: ${ok}   pulados: ${pulados}   erros: ${erros}   total: ${plano.length}`)
  if (erros) process.exitCode = 1
}

main().catch(e => morrer(`Erro inesperado: ${e.message}`))
