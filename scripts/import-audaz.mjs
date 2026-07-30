/**
 * Import histórico Linx/Microvix → Junttos (loja 'audazwear')
 *
 * Etapas, nesta ordem:  clientes → produtos → vendas
 *
 * Uso:
 *   node scripts/import-audaz.mjs                 # dry-run (padrão, não grava nada)
 *   node scripts/import-audaz.mjs --apply         # grava de verdade
 *   node scripts/import-audaz.mjs --apply --force # grava mesmo se já houver dados da loja
 *
 * Chave: SUPABASE_SERVICE_KEY no ambiente (fallback: VITE_SUPABASE_SERVICE_KEY do .env)
 *
 * NOTA IMPORTANTE SOBRE OS ARQUIVOS DE ORIGEM
 * Os três arquivos são HTML disfarçado (inclusive o .txt, que tem cabeçalho HTML
 * antes do CSV). Os .xls NÃO podem ser lidos com a lib `xlsx`: ela corrompe os
 * dados silenciosamente — "-21.210,00" vira -21.21 e a data 02/07/24 vira 2/6/24.
 * Por isso o parse é feito direto no HTML, lendo o texto literal de cada <td>.
 *
 * As vendas são inseridas via INSERT direto — nunca pela função de registrar
 * venda do app — para não descontar estoque nem gerar comissão retroativa.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// ── Config ────────────────────────────────────────────────────
const LOJA_ID  = 'audazwear'
const SRC_DIR  = '/Users/thiagocarvalho/Downloads/import-audaz:'
const ARQUIVOS = {
  clientes: 'clientes.txt',
  produtos: 'produtos.xls.xls',
  vendas:   'vendas.xls.xls',
}

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')
const CHUNK = 500

// ── Helpers de formatação ─────────────────────────────────────

/** "-21.210,00" → -21210.00 · "-" / "" → 0 */
function numBR(s) {
  if (s == null) return 0
  const t = String(s).trim()
  if (!t || t === '-') return 0
  const v = parseFloat(t.replace(/\./g, '').replace(',', '.'))
  return Number.isNaN(v) ? 0 : v
}

/**
 * Data do Linx → 'YYYY-MM-DD'.
 * Aceita DD/MM/AA (vendas) e DD/MM/AAAA (nascimento, que pode vir com hora junto).
 * Nunca usa toISOString(): a string é montada à mão para não sofrer shift de fuso.
 */
function dataBR(s) {
  if (!s) return null
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/)
  if (!m) return null
  const [, d, mo, y] = m
  const ano  = y.length === 2 ? 2000 + Number(y) : Number(y)
  const mes  = Number(mo)
  const dia  = Number(d)
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Acrescenta T12:00:00 — meio-dia, nunca meia-noite nem toISOString().
 * Serve para os dois tipos: em coluna `date` o Postgres trunca a hora e sobra a
 * data certa; em `timestamptz` cai no meio do dia, então nenhum fuso empurra o
 * registro para o dia anterior.
 */
function comHora(ymd) {
  if (!ymd) return null
  return `${ymd}T12:00:00`
}

/** Normaliza nome p/ comparação: sem acento, maiúsculo, espaços colapsados. */
function normNome(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
}

/** Colapsa espaços duplos mantendo o texto original ("DANIEL  - X" → "DANIEL - X"). */
function limpaEspacos(s) {
  return String(s || '').replace(/\s+/g, ' ').trim()
}

// ── Parse de tabela HTML (os .xls e o .txt) ───────────────────
function lerLinhasHTML(arquivo) {
  const html = fs.readFileSync(arquivo, 'utf8')
  const trs  = html.match(/<tr[\s\S]*?<\/tr>/gi) || []
  return trs.map(tr =>
    [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m =>
      m[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim()
    )
  )
}

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
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_SERVICE_KEY

/**
 * Descobre as colunas reais de cada tabela pelo schema OpenAPI do PostgREST.
 * As migrations do repo estão defasadas (lf_clientes nem existe em SQL aqui),
 * então o mapeamento de campos é resolvido em runtime — assim um campo que não
 * existe é reportado e descartado, em vez de derrubar 1.192 inserts.
 */
const TABELAS = ['lf_clientes', 'lf_produtos', 'lf_vendas']

async function lerSchema(sb) {
  const saida = {}

  // Caminho 1: spec OpenAPI do PostgREST (exige service key).
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (res.ok) {
    const spec = await res.json()
    const defs = spec.definitions || spec.components?.schemas || {}
    for (const t of TABELAS) saida[t] = defs[t]?.properties || null
    if (TABELAS.some(t => saida[t])) return saida
  }

  // Caminho 2 (fallback): lê 1 linha de cada tabela. `select=*` devolve TODAS as
  // colunas, inclusive as nulas — então as chaves da linha são o schema completo.
  // Serve para a chave anon, que não tem acesso ao spec mas lê as tabelas.
  for (const t of TABELAS) {
    const { data, error } = await sb.from(t).select('*').limit(1)
    saida[t] = (!error && data?.[0])
      ? Object.fromEntries(Object.keys(data[0]).map(k => [k, {}]))
      : null
  }
  return saida
}

/** Escolhe o 1º alias que existe de fato na tabela. */
function escolherColuna(props, aliases) {
  if (!props) return aliases[0]
  return aliases.find(a => a in props) || null
}

/**
 * Igual à anterior, mas para colunas cuja existência não dá pra presumir:
 * offline (props === null) devolve undefined = "não sei", em vez de chutar.
 */
function escolherColunaOpcional(props, aliases) {
  if (!props) return undefined
  return aliases.find(a => a in props) || null
}

/** Colunas candidatas a "código sequencial do produto" no padrão da tabela. */
const COLS_CODIGO = ['codigo', 'codigo_interno', 'cod', 'sku', 'numero']

// ═══════════════════════════════════════════════════════════════
// ETAPA 1 — Clientes
// ═══════════════════════════════════════════════════════════════
function parseClientes(props) {
  const bruto = fs.readFileSync(path.join(SRC_DIR, ARQUIVOS.clientes))
  // Encoding windows-1252 (o arquivo tem acentos: GRAÇAS, BELÉM…)
  const txt   = new TextDecoder('windows-1252').decode(bruto)
  const linhas = txt.split(/\r?\n/)

  // O arquivo começa com cabeçalho HTML; o CSV real começa na linha do header.
  const iHeader = linhas.findIndex(l => /^C[oó]digo;\s*Nome;/i.test(l))
  if (iHeader === -1) throw new Error('Cabeçalho de clientes.txt não encontrado')

  const cols = linhas[iHeader].split(';').map(c => normNome(c))
  const idx  = nome => cols.indexOf(normNome(nome))

  const iNome  = idx('Nome')
  const iEnd   = idx('Endereco')
  const iNum   = cols.findIndex(c => c === 'NUMERO')
  const iCompl = idx('Complemento')
  const iBairro= idx('Bairro')
  const iCidade= idx('Cidade')
  const iEstado= idx('Estado')
  const iCep   = idx('Cep')
  const iTel1  = idx('Telefone1')
  const iNasc  = idx('Nascimento')
  const iCpf   = cols.findIndex(c => c === 'CPF/CNPJ' || c === 'CPFCNPJ')
  const iCel   = idx('Celular')

  // Mapeamento lógico → coluna real da tabela
  const mapa = {
    nome:        escolherColuna(props, ['nome']),
    telefone:    escolherColuna(props, ['telefone', 'celular', 'tel']),
    cpf_cnpj:    escolherColuna(props, ['cpf_cnpj', 'cpf', 'cnpj', 'documento']),
    aniversario: escolherColuna(props, ['aniversario', 'data_nascimento', 'nascimento']),
    endereco:    escolherColuna(props, ['endereco', 'logradouro', 'rua']),
    numero:      escolherColuna(props, ['numero', 'num']),
    complemento: escolherColuna(props, ['complemento']),
    bairro:      escolherColuna(props, ['bairro']),
    cidade:      escolherColuna(props, ['cidade', 'municipio']),
    estado:      escolherColuna(props, ['estado', 'uf']),
    cep:         escolherColuna(props, ['cep']),
  }

  const registros = []
  const ignorados = []
  for (const linha of linhas.slice(iHeader + 1)) {
    if (!linha.includes(';')) continue
    if (/^\s*</.test(linha)) continue              // rodapé HTML (</body>, </html>)
    const f = linha.split(';')
    const nome = limpaEspacos(f[iNome])
    if (!nome) { ignorados.push(linha); continue } // pula linhas sem nome

    const celular = limpaEspacos(f[iCel])
    const tel1    = limpaEspacos(f[iTel1])

    const valores = {
      nome,
      telefone:    celular || tel1 || null,        // Celular; se vazio, Telefone1
      cpf_cnpj:    limpaEspacos(f[iCpf]) || null,
      aniversario: comHora(dataBR(f[iNasc])),
      endereco:    limpaEspacos(f[iEnd]) || null,
      numero:      limpaEspacos(f[iNum]) || null,
      complemento: limpaEspacos(f[iCompl]) || null,
      bairro:      limpaEspacos(f[iBairro]) || null,
      cidade:      limpaEspacos(f[iCidade]) || null,
      estado:      limpaEspacos(f[iEstado]) || null,
      cep:         limpaEspacos(f[iCep]) || null,
    }

    const row = { loja_id: LOJA_ID }
    for (const [logico, coluna] of Object.entries(mapa)) {
      if (coluna && valores[logico] != null) row[coluna] = valores[logico]
    }
    registros.push({ row, nome, telefone: valores.telefone })
  }

  const descartados = Object.entries(mapa).filter(([, c]) => !c).map(([l]) => l)
  return { registros, ignorados, mapa, descartados }
}

// ═══════════════════════════════════════════════════════════════
// ETAPA 2 — Produtos (agrupados por Ref.)
// ═══════════════════════════════════════════════════════════════
const RE_TAMANHO = /\s+(PP|P|M|G|GG|XG|XGG|U|UN|UNICO|ÚNICO)\s*$/i

function parseProdutos(props, codigoCol, seqInicio = 1) {
  const linhas = lerLinhasHTML(path.join(SRC_DIR, ARQUIVOS.produtos))

  const itens = []
  for (const c of linhas) {
    if (c.length < 11) continue                        // "Setor - 01- MASCULINO"
    if (c[0] === 'Código') continue                    // cabeçalho repetido
    if (c.join(' ').includes('Total Grupo')) continue  // totalizador de grupo
    if (!/^\d+$/.test(c[0])) continue                  // linha sem código numérico
    itens.push({
      codigo:   c[0],
      descricao: limpaEspacos(c[1]),
      ref:      limpaEspacos(c[2]),
      preco:    numBR(c[8]),                           // Pr.Venda (Líq.)
    })
  }

  const mapa = {
    preco:     escolherColuna(props, ['preco_venda', 'preco']),
    variacoes: escolherColuna(props, ['variacoes']),
    quantidade:escolherColuna(props, ['quantidade']),
    ativo:     escolherColuna(props, ['ativo']),
    // Ref. do Linx entra só como referência histórica — nunca como identificador.
    referencia: escolherColuna(props, ['referencia', 'observacoes', 'obs']),
  }
  // Se caiu num campo de texto livre, rotula; em `referencia` guarda o valor cru.
  const refRotulada = mapa.referencia !== 'referencia'

  // Agrupa por Ref. + nome-base (descrição sem o sufixo de tamanho).
  // Só a Ref. não basta: 4 Refs do arquivo reúnem produtos diferentes — a Ref
  // 2180, por exemplo, tem 7 peças distintas, todas tamanho "U". Agrupar só por
  // Ref. colapsaria as 7 em uma, perdendo 6 produtos e deixando "U" repetido.
  const grupos = new Map()
  for (const it of itens) {
    const m    = it.descricao.match(RE_TAMANHO)
    const tam  = m ? m[1].toUpperCase() : 'U'          // sem sufixo → tamanho único
    const base = m ? it.descricao.replace(RE_TAMANHO, '').trim() : it.descricao
    const chave = `${it.ref}||${normNome(base)}`
    if (!grupos.has(chave)) grupos.set(chave, { ref: it.ref, itens: [] })
    grupos.get(chave).itens.push({ ...it, tamanho: tam, base })
  }

  const registros    = []
  const refsNomes    = []   // Refs com mais de um nome-base (nomes que se perdem)
  const refsTamDup   = []   // Refs com tamanho repetido (variação deduplicada)
  const refsPrecoVar = []   // Refs com preço divergente entre tamanhos

  for (const g of grupos.values()) {
    const bases = [...new Set(g.itens.map(i => i.base))]
    if (bases.length > 1) refsNomes.push({ ref: g.ref, bases })

    const tamanhos = g.itens.map(i => i.tamanho)
    if (new Set(tamanhos).size !== tamanhos.length) {
      refsTamDup.push({ ref: g.ref, descricoes: g.itens.map(i => i.descricao) })
    }

    const precos = [...new Set(g.itens.map(i => i.preco))]
    if (precos.length > 1) refsPrecoVar.push({ ref: g.ref, precos })

    // Estoque de TODAS as variações = 0 (a contagem real vem do Balanço depois)
    const variacoes = []
    const vistos    = new Set()
    for (const i of g.itens) {
      if (vistos.has(i.tamanho)) continue
      vistos.add(i.tamanho)
      variacoes.push({ tamanho: i.tamanho, quantidade: 0 })
    }

    const row = { loja_id: LOJA_ID, nome: g.itens[0].base }
    if (mapa.preco)      row[mapa.preco]      = g.itens[0].preco   // preço da 1ª linha do grupo
    if (mapa.variacoes)  row[mapa.variacoes]  = variacoes
    if (mapa.quantidade) row[mapa.quantidade] = 0
    if (mapa.ativo)      row[mapa.ativo]      = true
    if (mapa.referencia) {
      row[mapa.referencia] = refRotulada ? `Ref. Linx: ${g.ref}` : g.ref
    }
    // Código próprio do Junttos, sequencial — só se a tabela tiver a coluna.
    // O `id` (uuid gen_random_uuid()) continua sendo gerado pelo banco.
    if (codigoCol) row[codigoCol] = seqInicio + registros.length

    registros.push({ row, ref: g.ref, variacoes })
  }

  return { registros, itens, refsNomes, refsTamDup, refsPrecoVar, mapa, refRotulada }
}

// ═══════════════════════════════════════════════════════════════
// ETAPA 3 — Vendas
// ═══════════════════════════════════════════════════════════════
const COLS_PGTO = [
  { idx: 8,  forma: 'Dinheiro' },
  { idx: 9,  forma: 'Ch.Vista' },
  { idx: 10, forma: 'Ch.Prazo' },
  { idx: 11, forma: 'Crediário' },
  { idx: 12, forma: 'Cartão' },
  { idx: 13, forma: 'Convênio' },
  { idx: 14, forma: 'Pix' },
  { idx: 15, forma: 'Outras Moedas' },
]

function parseVendas(clientes, props) {
  const linhas = lerLinhasHTML(path.join(SRC_DIR, ARQUIVOS.vendas))

  // Índice nome-normalizado → telefone (1ª ocorrência vence)
  const porNome = new Map()
  for (const c of clientes) {
    const k = normNome(c.nome)
    if (!porNome.has(k)) porNome.set(k, c)
  }


  const registros   = []
  const semCliente  = new Map()
  let comTel = 0, casados = 0, semData = 0

  for (const c of linhas) {
    if (c.length < 16) continue                       // inclui a linha "Totais" (10 células)
    if (c[0] === 'Data') continue                     // cabeçalho
    if (c[0] === 'Totais') continue                   // totalizador — descartado
    const ymd = dataBR(c[0])
    if (!ymd) { semData++; continue }                 // linha sem Data válida

    const nome = limpaEspacos(c[3])                   // remove espaços duplos
    const match = porNome.get(normNome(nome))
    if (match) {
      casados++
      if (match.telefone) comTel++
    } else if (nome) {
      semCliente.set(nome, (semCliente.get(nome) || 0) + 1)
    }

    // Formas de pagamento com valor ≠ 0. Usamos ≠ 0 (e não > 0) para preservar
    // as 3 devoluções/estornos, que têm valor negativo e ficariam sem forma.
    const formas = COLS_PGTO
      .map(p => ({ forma: p.forma, valor: numBR(c[p.idx]) }))
      .filter(p => p.valor !== 0)

    registros.push({
      loja_id:      LOJA_ID,
      data:         comHora(ymd),
      cliente_nome: nome || null,
      cliente_tel:  match?.telefone || null,
      valor:        numBR(c[7]),                      // Valor do Documento
      forma_pgto:   JSON.stringify(formas),           // mesmo formato das vendas nativas
      produtos:     [],                               // histórico sem detalhe de item
    })
  }

  return { registros, casados, comTel, semCliente, semData }
}

// ═══════════════════════════════════════════════════════════════
// Inserção
// ═══════════════════════════════════════════════════════════════
async function inserir(sb, tabela, rows, rotulo) {
  let ok = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const lote = rows.slice(i, i + CHUNK)
    const { error } = await sb.from(tabela).insert(lote)
    if (error) {
      console.error(`\n❌ ${rotulo}: erro no lote ${i}–${i + lote.length}: ${error.message}`)
      if (error.details) console.error(`   detalhes: ${error.details}`)
      throw new Error(`Falha ao inserir em ${tabela}`)
    }
    ok += lote.length
    process.stdout.write(`\r   ${rotulo}: ${ok}/${rows.length} inseridos…`)
  }
  process.stdout.write('\n')
  return ok
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log(`║  Import Linx → Junttos · loja '${LOJA_ID}'`.padEnd(59) + '║')
  console.log(`║  Modo: ${APPLY ? 'APLICAR (grava no banco)' : 'DRY-RUN (não grava nada)'}`.padEnd(59) + '║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // Sem chave o dry-run ainda roda (offline): dá pra conferir os números do
  // parse. Só o --apply exige a chave de verdade.
  if (!SERVICE_KEY && APPLY) {
    console.error('❌ Service key ausente — necessária para gravar.')
    console.error('   Rode:  SUPABASE_SERVICE_KEY=<chave> node scripts/import-audaz.mjs --apply')
    console.error('   (ou preencha VITE_SUPABASE_SERVICE_KEY no .env)')
    process.exit(1)
  }
  for (const [k, f] of Object.entries(ARQUIVOS)) {
    const p = path.join(SRC_DIR, f)
    if (!fs.existsSync(p)) { console.error(`❌ Arquivo de ${k} não encontrado: ${p}`); process.exit(1) }
  }

  const sb = SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null

  let schema = { lf_clientes: null, lf_produtos: null, lf_vendas: null }

  if (!sb) {
    console.log('⚠️  Sem service key — rodando DRY-RUN OFFLINE.')
    console.log('    NÃO foi possível validar a loja em lf_config nem checar as')
    console.log('    colunas reais das tabelas. Os números do parse abaixo são reais;')
    console.log('    o mapeamento de colunas é o esperado, ainda não confirmado.\n')
  } else {
    // ── Pré-checagem: a loja precisa existir (não criamos a loja aqui) ──
    const { data: loja, error: errLoja } = await sb
      .from('lf_config').select('loja_id, nome').eq('loja_id', LOJA_ID).maybeSingle()
    if (errLoja) { console.error(`❌ Erro ao consultar lf_config: ${errLoja.message}`); process.exit(1) }
    if (!loja) {
      console.error(`❌ Loja '${LOJA_ID}' não existe em lf_config. Import abortado.`)
      console.error('   Cadastre a loja antes de rodar este script.')
      process.exit(1)
    }
    console.log(`✅ Loja encontrada em lf_config: '${loja.loja_id}' — ${loja.nome}\n`)

    schema = await lerSchema(sb)

    // ── Dados já existentes (proteção contra rodar duas vezes) ──
    const existentes = {}
    for (const t of ['lf_clientes', 'lf_produtos', 'lf_vendas']) {
      const { count } = await sb.from(t).select('*', { count: 'exact', head: true }).eq('loja_id', LOJA_ID)
      existentes[t] = count || 0
    }
    if (Object.values(existentes).some(n => n > 0)) {
      console.log('⚠️  A loja JÁ possui dados:')
      for (const [t, n] of Object.entries(existentes)) console.log(`     ${t}: ${n} registro(s)`)
      if (APPLY && !FORCE) {
        console.log('   → use --force para inserir mesmo assim (pode duplicar).\n')
        process.exit(1)
      }
      console.log()
    }
  }

  // ── ETAPA 1 ──────────────────────────────────────────────────
  console.log('── ETAPA 1 · Clientes ────────────────────────────────────')
  const c = parseClientes(schema.lf_clientes)
  console.log(`   Linhas válidas:        ${c.registros.length}`)
  console.log(`   Puladas (sem nome):    ${c.ignorados.length}`)
  console.log(`   Com telefone:          ${c.registros.filter(r => r.telefone).length}`)
  if (c.descartados.length) {
    console.log(`   ⚠️  Campos SEM coluna em lf_clientes (serão descartados):`)
    console.log(`      ${c.descartados.join(', ')}`)
  }
  console.log(`   Mapeamento: ${Object.entries(c.mapa).filter(([, v]) => v).map(([k, v]) => k === v ? k : `${k}→${v}`).join(', ')}`)
  console.log(`   Exemplo: ${JSON.stringify(c.registros[0]?.row)}\n`)

  // ── ETAPA 2 ──────────────────────────────────────────────────
  console.log('── ETAPA 2 · Produtos ────────────────────────────────────')

  // Código sequencial próprio: só existe se a tabela tiver uma coluna para isso.
  // Se não tiver, o identificador do produto é o `id` uuid que o banco gera —
  // que é o padrão atual da lf_produtos para cadastros novos.
  const codigoCol = escolherColunaOpcional(schema.lf_produtos, COLS_CODIGO)
  let seqInicio = 1
  if (codigoCol && sb) {
    const { data: ultimo } = await sb.from('lf_produtos')
      .select(codigoCol).eq('loja_id', LOJA_ID)
      .order(codigoCol, { ascending: false }).limit(1)
    const max = Number(ultimo?.[0]?.[codigoCol])
    if (Number.isFinite(max)) seqInicio = max + 1
  }

  const p = parseProdutos(schema.lf_produtos, codigoCol, seqInicio)
  console.log(`   Linhas de produto lidas: ${p.itens.length}`)
  console.log(`   Produtos (Ref. + nome):  ${p.registros.length}`)
  if (codigoCol) {
    console.log(`   Código sequencial:       coluna '${codigoCol}', de ${seqInicio} a ${seqInicio + p.registros.length - 1}`)
  } else if (codigoCol === null) {
    console.log(`   Código sequencial:       lf_produtos não tem coluna de código —`)
    console.log(`                            identificador fica o 'id' uuid gerado pelo banco.`)
  } else {
    console.log(`   Código sequencial:       indeterminado offline (precisa da service key).`)
  }
  console.log(`   Ref. do Linx guardada em: ${p.mapa.referencia || '(sem coluna disponível)'}`)
  console.log(`   Variações totais:        ${p.registros.reduce((a, r) => a + r.variacoes.length, 0)} (todas com quantidade 0)`)
  console.log(`   Exemplo: ${JSON.stringify(p.registros[0]?.row)}`)
  if (p.refsNomes.length) {
    console.log(`\n   ⚠️  ${p.refsNomes.length} Ref(s) com MAIS DE UM nome de produto.`)
    console.log('      Agrupar por Ref. mantém só o 1º nome — os demais se perdem:')
    for (const r of p.refsNomes) console.log(`      Ref ${r.ref}: ${r.bases.join(' | ')}`)
  }
  if (p.refsTamDup.length) {
    console.log(`\n   ⚠️  ${p.refsTamDup.length} Ref(s) com tamanho repetido (variação deduplicada):`)
    for (const r of p.refsTamDup) console.log(`      Ref ${r.ref}: ${r.descricoes.join(' | ')}`)
  }
  if (p.refsPrecoVar.length) {
    console.log(`\n   ℹ️  ${p.refsPrecoVar.length} Ref(s) com Pr.Venda diferente entre tamanhos — usado o preço da 1ª linha.`)
  }
  console.log()

  // ── ETAPA 3 ──────────────────────────────────────────────────
  console.log('── ETAPA 3 · Vendas ──────────────────────────────────────')
  const v = parseVendas(c.registros, schema.lf_vendas)
  const N = v.registros.length
  const pct = n => `${((100 * n) / N).toFixed(1)}%`
  console.log(`   Vendas válidas:        ${N}  (linha "Totais" descartada)`)
  if (v.semData) console.log(`   Puladas (sem data):    ${v.semData}`)
  console.log(`   Casaram com cliente:   ${v.casados} (${pct(v.casados)})`)
  console.log(`   Com cliente_tel:       ${v.comTel} (${pct(v.comTel)})`)
  console.log(`   Sem cliente_tel:       ${N - v.comTel} (${pct(N - v.comTel)})`)
  console.log(`   Soma dos valores:      R$ ${v.registros.reduce((a, r) => a + r.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  if (v.semCliente.size) {
    console.log(`\n   Clientes não encontrados (venda entra mesmo assim, sem telefone):`)
    for (const [nome, n] of [...v.semCliente].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${String(n).padStart(4)}×  ${nome}`)
    }
  }
  console.log(`\n   Exemplo: ${JSON.stringify(v.registros[0])}\n`)

  // ── Grava ou encerra ─────────────────────────────────────────
  if (!APPLY) {
    console.log('══════════════════════════════════════════════════════════')
    console.log('DRY-RUN — nada foi gravado no banco.')
    console.log('Para aplicar:  node scripts/import-audaz.mjs --apply')
    console.log('══════════════════════════════════════════════════════════')
    return
  }

  console.log('── Gravando ──────────────────────────────────────────────')
  const nCli = await inserir(sb, 'lf_clientes', c.registros.map(r => r.row), 'clientes')
  const nPro = await inserir(sb, 'lf_produtos', p.registros.map(r => r.row), 'produtos')
  const nVen = await inserir(sb, 'lf_vendas',   v.registros,                 'vendas')

  // ── Validação final: reconta no banco ────────────────────────
  console.log('\n── Validação final (contagem no banco) ───────────────────')
  const final = {}
  for (const t of ['lf_clientes', 'lf_produtos', 'lf_vendas']) {
    const { count } = await sb.from(t).select('*', { count: 'exact', head: true }).eq('loja_id', LOJA_ID)
    final[t] = count || 0
  }
  const { count: comTelDB } = await sb.from('lf_vendas')
    .select('*', { count: 'exact', head: true })
    .eq('loja_id', LOJA_ID).not('cliente_tel', 'is', null)

  console.log(`   Clientes inseridos:  ${nCli}  · total na loja: ${final.lf_clientes}`)
  console.log(`   Produtos inseridos:  ${nPro}  · total na loja: ${final.lf_produtos}`)
  console.log(`   Vendas inseridas:    ${nVen}  · total na loja: ${final.lf_vendas}`)
  console.log(`   Vendas com cliente_tel:  ${comTelDB} (${((100 * comTelDB) / final.lf_vendas).toFixed(1)}%)`)
  console.log(`   Vendas sem cliente_tel:  ${final.lf_vendas - comTelDB}`)
  console.log('\n✅ Import concluído.')
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1) })
