/**
 * Replica o catálogo de produtos ativos de 'tropicaleatacado' para
 * 'atacadaodosvestidos' — mesmo dono (Daniel), duas lojas da mesma rede.
 *
 * Uso:
 *   node scripts/replicarCatalogoTropicaleAtacadao.mjs           # dry-run (padrão, não grava nada)
 *   node scripts/replicarCatalogoTropicaleAtacadao.mjs --apply   # grava de verdade
 *
 * Chave: SUPABASE_SERVICE_KEY no ambiente (fallback: .env na raiz). A leitura
 * de lf_produtos funciona com a anon key (RLS desligada nessa tabela), mas o
 * upload de fotos para o Storage EXIGE a service key — as policies de
 * storage.objects deste projeto autorizam escrita por
 *   (storage.foldername(name))[1] = auth.jwt() -> 'app_metadata' ->> 'loja_id'
 * (ver src/utils/uploadMidiaProduto.js:caminhoMidia), e este script não roda
 * autenticado como lojista nenhuma — só a service key (que ignora RLS) escreve
 * fora dessa regra. Sem ela, --apply falha nas fotos e para.
 * A service key NÃO leva prefixo VITE_ (ver docs/SEGREDOS_E_VARIAVEIS.md).
 *
 * ─── DECISÃO: FOTOS SÃO REENVIADAS, NÃO REFERENCIADAS ───────────────────────
 * O bucket 'produtos-fotos' é público — uma URL da pasta tropicaleatacado/
 * carrega normalmente em qualquer loja, então "só copiar a URL" funcionaria
 * tecnicamente. Mesmo assim este script BAIXA cada foto da Tropicale e
 * REENVIA para a pasta atacadaodosvestidos/, criando um objeto próprio no
 * Storage. Dois motivos:
 *
 *   1. Isolamento por loja é a convenção do projeto (toda foto enviada pela
 *      UI cai na pasta {loja_id}/, e a policy de escrita é desenhada em cima
 *      disso). Apontar produto da Atacadão para dentro da pasta da Tropicale
 *      quebra essa convenção mesmo que funcione hoje.
 *   2. Acoplamento invisível: se um dia alguém trocar ou apagar aquela foto
 *      pela tela da Tropicale, a peça da Atacadão perderia a foto em
 *      silêncio, sem nenhum erro — e ninguém saberia olhando só a Atacadão.
 *
 * Custo aceito: --apply faz 1 download + 1 upload por foto (31 hoje). O
 * dry-run NÃO baixa nada — só confere com HEAD que cada URL responde 200,
 * pra pegar link quebrado antes de aprovar.
 *
 * ─── DECISÃO: disponivel_catalogo_b2b NÃO É COPIADO ─────────────────────────
 * 105 dos 108 produtos da Tropicale estão com disponivel_catalogo_b2b = true
 * (visíveis no catálogo público/B2B). Copiar isso faria 105 produtos com
 * QUANTIDADE PROVISÓRIA (a própria tarefa deste script — Daniel disse que vai
 * ajustar a quantidade real depois, à medida que a reposição chegar) ficarem
 * à venda pro público na hora que o script rodar. Este campo é simplesmente
 * OMITIDO do insert, então cai no default da coluna (false) — produto nasce
 * cadastrado mas invisível na vitrine, e o Daniel liga um por um quando a
 * quantidade real estiver certa.
 *
 * ─── CAMPOS NÃO COPIADOS (fora do pedido explícito) ─────────────────────────
 * referencia, fornecedor, fornecedor_id, valor_lote, data_vencimento,
 * status_pgto, video_url, categoria, cores, tamanhos, selo, ean, ncm, cfop.
 * O pedido foi: nome, preco_custo, preco_venda, fotos, variacoes (com
 * código). Esses outros campos são de compra/fiscal/apresentação — ligados à
 * Tropicale especificamente (fornecedor, lote, vencimento) ou a decisões de
 * catálogo que fazem mais sentido o Daniel tomar direto na Atacadão do que
 * herdar por cópia. Ficam no default da coluna.
 *
 * ─── CRITÉRIO DE DUPLICATA ───────────────────────────────────────────────────
 * Nome normalizado (trim + minúsculo) contra TODOS os produtos que já existem
 * em atacadaodosvestidos hoje (ativos ou não — um produto inativo com o mesmo
 * nome ainda conta como "já existe", pra não criar um gêmeo). lf_produtos não
 * tem constraint de unicidade em nome, mas é o único identificador de negócio
 * disponível aqui, e os 108 nomes da Tropicale não têm duplicata entre si
 * (conferido antes de escrever este script).
 *
 * ─── CÓDIGO DE BARRAS MANUAL ─────────────────────────────────────────────────
 * A chave `codigo` de cada item de `variacoes` é copiada tal como está — sem
 * gerar, sem forçar, sem apagar. Se a Tropicale não tiver nenhum código manual
 * preenchido (é o caso hoje, conferido em produção antes de escrever este
 * script), nenhuma variação ganha `codigo` na cópia, e o automático de cada
 * loja segue agindo — exatamente o comportamento de sempre. Só quando o
 * Daniel preencher um código manual na Tropicale antes de rodar este script é
 * que ele viaja igual para a Atacadão, o que resulta no MESMO código de
 * barras nas duas lojas: codigoEfetivo(lojaId, produtoId, v) usa `v.codigo`
 * quando presente e IGNORA lojaId/produtoId nesse caso (src/utils/codigoBarras.js).
 *
 * ─── FORA DO ALCANCE DESTE SCRIPT ───────────────────────────────────────────
 * lf_config.features.estoque está `false` para atacadaodosvestidos hoje. Os
 * produtos serão gravados em lf_produtos normalmente, mas a aba Estoque não
 * aparece pro Daniel enquanto essa flag não for ligada — isso é decisão de
 * outra camada (plano/feature flag), não deste script.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// ── Config ────────────────────────────────────────────────────
const LOJA_ORIGEM  = 'tropicaleatacado'
const LOJA_DESTINO = 'atacadaodosvestidos'
const BUCKET       = 'produtos-fotos'

const APPLY = process.argv.includes('--apply')

const EXT_POR_CONTENT_TYPE = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif',
}

// ── Ambiente / Supabase (mesmo padrão de importarFotosTropicale.js) ────────
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
  || env.SUPABASE_SERVICE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || env.VITE_SUPABASE_ANON_KEY
const TEM_SERVICE_KEY = !!(process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY)

if (!process.env.SUPABASE_SERVICE_KEY && !env.SUPABASE_SERVICE_KEY
    && (process.env.VITE_SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_SERVICE_KEY)) {
  console.error('⚠️  Achei VITE_SUPABASE_SERVICE_KEY — nome aposentado por risco de vazamento.')
  console.error('   Renomeie para SUPABASE_SERVICE_KEY (na Vercel e no .env local).')
  console.error('   Seguindo com a chave anon, que basta para ler/gravar lf_produtos mas NÃO')
  console.error('   basta para o Storage. Detalhes: docs/SEGREDOS_E_VARIAVEIS.md\n')
}

// ── Helpers ───────────────────────────────────────────────────
function morrer(msg, ...extras) {
  console.error(`\n❌ ${msg}`)
  extras.forEach(l => console.error(`   ${l}`))
  process.exit(1)
}

/** "cor" ou "tamanho" ou qualquer outra chave livre — a mesma regra do app. */
function rotuloVariacao(v) {
  if (!v || typeof v !== 'object') return null
  const k = Object.keys(v).find(k => !['quantidade', 'custo', 'codigo'].includes(k))
  return k ? String(v[k]) : null
}

function normalizarNome(nome) {
  return String(nome ?? '').trim().toLowerCase()
}

/** `codigo` conta como manual só quando é string não-vazia. */
function temCodigoManual(v) {
  return typeof v?.codigo === 'string' && v.codigo.trim().length > 0
}

/** Extensão a partir do Content-Type da resposta, com fallback pela URL. */
function extensaoDe(contentType, url) {
  const porTipo = EXT_POR_CONTENT_TYPE[String(contentType ?? '').toLowerCase().split(';')[0]]
  if (porTipo) return porTipo
  const daUrl = url.split('?')[0].split('.').pop()
  return /^[a-z0-9]{2,5}$/i.test(daUrl) ? daUrl.toLowerCase() : 'jpg'
}

/** HEAD na URL de origem — só para o dry-run confirmar que a foto existe. */
async function checarFoto(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, status: 0, erro: e.message }
  }
}

/** Baixa a foto de origem e reenvia para a pasta da loja destino. */
async function copiarFoto(sb, url, prefixo, indice) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download falhou (HTTP ${res.status})`)
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buf = Buffer.from(await res.arrayBuffer())
  const ext = extensaoDe(contentType, url)
  const destino = `${LOJA_DESTINO}/${prefixo}_${indice}_${Date.now()}.${ext}`

  const { error } = await sb.storage.from(BUCKET).upload(destino, buf, {
    upsert: true,
    contentType,
  })
  if (error) throw new Error(`upload falhou: ${error.message}`)

  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(destino)
  return publicUrl
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log(`║  Replicar catálogo: ${LOJA_ORIGEM} → ${LOJA_DESTINO}`.padEnd(59) + '║')
  console.log(`║  Modo: ${APPLY ? 'APLICAR (grava no banco e no storage)' : 'DRY-RUN (não grava nada)'}`.padEnd(59) + '║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  if (!SUPABASE_URL || !CHAVE) morrer('VITE_SUPABASE_URL / SUPABASE_SERVICE_KEY ausentes no .env.')
  if (APPLY && !TEM_SERVICE_KEY) {
    morrer('--apply precisa da SUPABASE_SERVICE_KEY (o upload de fotos exige ela).',
      'Rode:  SUPABASE_SERVICE_KEY=<chave> node scripts/replicarCatalogoTropicaleAtacadao.mjs --apply')
  }

  const sb = createClient(SUPABASE_URL, CHAVE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Produtos ativos da origem -------------------------------
  const { data: origem, error: erroOrigem } = await sb
    .from('lf_produtos')
    .select('id, nome, preco_custo, preco_venda, variacoes, fotos')
    .eq('loja_id', LOJA_ORIGEM)
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (erroOrigem) morrer(`Erro ao ler produtos de ${LOJA_ORIGEM}: ${erroOrigem.message}`)

  // 2. Produtos já existentes no destino (ativos ou não) -------
  const { data: destinoAtual, error: erroDestino } = await sb
    .from('lf_produtos')
    .select('id, nome, ativo')
    .eq('loja_id', LOJA_DESTINO)
  if (erroDestino) morrer(`Erro ao ler produtos de ${LOJA_DESTINO}: ${erroDestino.message}`)

  const nomesExistentes = new Set(destinoAtual.map(p => normalizarNome(p.nome)))

  console.log(`📦 ${LOJA_ORIGEM}: ${origem.length} produto(s) ativo(s)`)
  console.log(`📦 ${LOJA_DESTINO}: ${destinoAtual.length} produto(s) já cadastrado(s) hoje\n`)

  // 3. Plano -----------------------------------------------------
  const plano = origem.map(p => {
    const jaExiste = nomesExistentes.has(normalizarNome(p.nome))
    const variacoes = Array.isArray(p.variacoes) ? p.variacoes : []
    const fotos = Array.isArray(p.fotos) ? p.fotos.filter(Boolean) : []
    return {
      produto: p,
      acao: jaExiste ? 'pular-duplicata' : 'criar',
      variacoes,
      fotos,
      qtdVariacoes: variacoes.length,
      qtdPecas: variacoes.reduce((s, v) => s + (Number(v.quantidade) || 0), 0),
      variacoesComCodigo: variacoes.filter(temCodigoManual),
    }
  })

  const aCriar = plano.filter(it => it.acao === 'criar')
  const pulados = plano.filter(it => it.acao === 'pular-duplicata')
  const totalFotos = aCriar.reduce((s, it) => s + it.fotos.length, 0)
  const produtosComCodigoManual = aCriar.filter(it => it.variacoesComCodigo.length > 0)

  // 4. Tabela ------------------------------------------------------
  console.log('  status   produto                                       var  peças  fotos  cód.manual')
  console.log('  ────────────────────────────────────────────────────────────────────────────────────')
  plano.forEach(it => {
    const marca = it.acao === 'criar' ? '+' : '='
    const nome = it.produto.nome.slice(0, 44).padEnd(45)
    const cod = it.variacoesComCodigo.length > 0 ? `${it.variacoesComCodigo.length}` : '-'
    console.log(`  ${marca} ${it.acao === 'criar' ? 'criar  ' : 'pular  '} ${nome} ${String(it.qtdVariacoes).padStart(3)}  ${String(it.qtdPecas).padStart(5)}  ${String(it.fotos.length).padStart(5)}  ${cod}`)
  })

  if (pulados.length) {
    console.log(`\n  ⚠️  ${pulados.length} produto(s) já existem em ${LOJA_DESTINO} (nome igual) e serão PULADOS:`)
    pulados.forEach(it => console.log(`      - ${it.produto.nome}`))
  }

  if (produtosComCodigoManual.length) {
    console.log(`\n  🏷️  ${produtosComCodigoManual.length} produto(s) têm código de barras manual e serão copiados IGUAIS:`)
    produtosComCodigoManual.forEach(it => {
      it.variacoesComCodigo.forEach(v => console.log(`      - ${it.produto.nome} / ${rotuloVariacao(v)}: ${v.codigo}`))
    })
  } else {
    console.log('\n  🏷️  Nenhum produto da origem tem código de barras manual hoje — todas as variações copiadas ficam sem `codigo` (automático de cada loja continua valendo).')
  }

  // 5. Checagem de fotos (só leitura — HEAD) ------------------------
  if (totalFotos > 0) {
    console.log(`\n🖼️  Conferindo ${totalFotos} foto(s) de origem (HEAD, sem baixar)...`)
    let quebradas = 0
    for (const it of aCriar) {
      for (const url of it.fotos) {
        const chk = await checarFoto(url)
        if (!chk.ok) {
          quebradas++
          console.log(`   ❌ ${it.produto.nome} -> ${url} (HTTP ${chk.status}${chk.erro ? ' — ' + chk.erro : ''})`)
        }
      }
    }
    console.log(quebradas === 0
      ? `   ✅ todas as ${totalFotos} fotos respondem normalmente.`
      : `   ⚠️  ${quebradas} de ${totalFotos} foto(s) não respondem — serão puladas (produto é criado sem foto) se rodar --apply assim.`)
  }

  // 6. Resumo do plano ------------------------------------------
  console.log('\n── Resumo do plano ─────────────────────────────────────────')
  console.log(`   produtos a criar:              ${aCriar.length}`)
  console.log(`   produtos pulados (duplicata):   ${pulados.length}`)
  console.log(`   fotos a copiar (download+upload): ${totalFotos}`)
  console.log(`   produtos com código manual:     ${produtosComCodigoManual.length}`)
  console.log(`   disponivel_catalogo_b2b:        NÃO copiado (fica false — invisível até o Daniel ativar)`)

  if (!APPLY) {
    console.log('\n🔎 DRY-RUN — nada foi gravado no banco nem no Storage.')
    console.log(`   Para aplicar de verdade:  SUPABASE_SERVICE_KEY=<chave> node scripts/replicarCatalogoTropicaleAtacadao.mjs --apply`)
    return
  }

  // 7. Aplicar -----------------------------------------------------
  console.log('\n── Gravando ─────────────────────────────────────────────────\n')
  let ok = 0, erros = 0

  for (const it of aCriar) {
    const p = it.produto
    try {
      const novasFotos = []
      for (let i = 0; i < it.fotos.length; i++) {
        try {
          const url = await copiarFoto(sb, it.fotos[i], `copia_${p.id.slice(0, 8)}`, i)
          novasFotos.push(url)
        } catch (e) {
          console.log(`   ⚠️  ${p.nome}: foto ${i + 1} falhou (${e.message}) — seguindo sem ela`)
        }
      }

      const variacoesCopia = it.variacoes.map(v => ({ ...v }))

      const { error: erroInsert } = await sb.from('lf_produtos').insert({
        loja_id: LOJA_DESTINO,
        nome: p.nome,
        preco_custo: Number(p.preco_custo) || 0,
        preco_venda: Number(p.preco_venda) || 0,
        variacoes: variacoesCopia,
        fotos: novasFotos,
      })
      if (erroInsert) throw new Error(erroInsert.message)

      console.log(`✅ ${p.nome} -> criado (${it.qtdVariacoes} variações, ${novasFotos.length}/${it.fotos.length} fotos)`)
      ok++
    } catch (e) {
      console.log(`❌ ${p.nome} -> erro: ${e.message}`)
      erros++
    }
  }

  console.log('\n── Resumo ──────────────────────────────────────────────────')
  console.log(`   criados: ${ok}   pulados: ${pulados.length}   erros: ${erros}   total origem: ${origem.length}`)
  if (erros) process.exitCode = 1
}

main().catch(e => morrer(`Erro inesperado: ${e.message}`))
