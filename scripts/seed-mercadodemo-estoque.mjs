/**
 * Semeia produtos de demonstração na loja 'mercadodemo' para a tela de Estoque.
 *
 * Motivo: a loja tinha só 2 produtos, ambos com estoque folgado, então a tela
 * T6 aparecia toda verde e sem a barra de alerta — não dava para ver os estados
 * crítico e baixo. Estes produtos existem para demonstrar as três cores.
 *
 * - Só INSERE produtos novos; nunca altera os já existentes (Arroz, Feijão).
 * - Todos os nomes levam o prefixo "Demo - " para distinguir do catálogo real.
 * - Idempotente: se o produto já existe na loja (mesmo nome), é pulado.
 *
 * O estoque vai em variacoes[{cor:'Único', quantidade}], que é onde o Mercado
 * guarda o estoque de verdade — a coluna `quantidade` fica em 0, igual ao que
 * o CadastrarProduto grava.
 *
 * Com estes produtos sem histórico de venda, o mínimo de todos é 10
 * (MINIMO_PADRAO em src/utils/estoque.js), então a quantidade define o estado:
 *   < 4  → crítico   ·   4 a 9 → baixo   ·   >= 10 → ok
 *
 * Uso:
 *   SUPABASE_SERVICE_KEY=<service_role> node scripts/seed-mercadodemo-estoque.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dbfxigylileupucnuhmb.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY
const LOJA_ID      = 'mercadodemo'
const PREFIXO      = 'Demo - '

if (!SERVICE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_KEY antes de rodar.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// quantidade escolhida para cobrir os 3 estados da tela
const PRODUTOS = [
  { nome: 'Café Torrado 500g',      qtd: 0,  preco_venda: 18.90, preco_custo: 13.50, ean: '7891000900010', estado: 'crítico' },
  { nome: 'Açúcar Refinado 1kg',    qtd: 2,  preco_venda: 5.20,  preco_custo: 3.60,  ean: '7891000900027', estado: 'crítico' },
  { nome: 'Macarrão Espaguete 500g',qtd: 4,  preco_venda: 4.30,  preco_custo: 2.90,  ean: '7891000900034', estado: 'baixo'   },
  { nome: 'Óleo de Soja 900ml',     qtd: 6,  preco_venda: 7.50,  preco_custo: 5.40,  ean: '7891000900041', estado: 'baixo'   },
  { nome: 'Leite Integral 1L',      qtd: 9,  preco_venda: 5.90,  preco_custo: 4.20,  ean: '7891000900058', estado: 'baixo'   },
  { nome: 'Sabão em Pó 1kg',        qtd: 12, preco_venda: 14.90, preco_custo: 10.80, ean: '7891000900065', estado: 'ok'      },
]

async function main() {
  console.log(`Semeando produtos de demonstração em '${LOJA_ID}'...\n`)

  const { data: existentes, error: errLista } = await supabase
    .from('lf_produtos').select('id, nome, variacoes').eq('loja_id', LOJA_ID)
  if (errLista) { console.error('❌ Erro ao listar produtos:', errLista.message); process.exit(1) }

  console.log(`Produtos já na loja (${existentes.length}) — nenhum será alterado:`)
  for (const p of existentes) {
    const qtd = (p.variacoes || []).reduce((s, v) => s + (Number(v.quantidade) || 0), 0)
    console.log(`   · ${p.nome} (${qtd} un)`)
  }
  console.log()

  const jaExiste = new Set(existentes.map(p => p.nome))
  const novos = []
  for (const p of PRODUTOS) {
    const nome = PREFIXO + p.nome
    if (jaExiste.has(nome)) { console.log(`   ⏭  ${nome} — já existe, pulando`); continue }
    novos.push({
      loja_id:     LOJA_ID,
      nome,
      ean:         p.ean,
      preco_custo: p.preco_custo,
      preco_venda: p.preco_venda,
      quantidade:  0,
      variacoes:   [{ cor: 'Único', quantidade: p.qtd }],
      ativo:       true,
      disponivel_catalogo_b2b: false,
    })
  }

  if (!novos.length) {
    console.log('\nNada a inserir — todos os produtos de demonstração já existem.')
    return
  }

  const { data: inseridos, error } = await supabase
    .from('lf_produtos').insert(novos).select('nome, variacoes')
  if (error) { console.error('❌ Erro ao inserir:', error.message); process.exit(1) }

  console.log(`\n✅ ${inseridos.length} produto(s) de demonstração inserido(s):`)
  for (const p of PRODUTOS) {
    const nome = PREFIXO + p.nome
    if (inseridos.some(i => i.nome === nome)) {
      console.log(`   ${String(p.qtd).padStart(3)} un  ${nome.padEnd(34)} → ${p.estado}`)
    }
  }

  const { count } = await supabase
    .from('lf_produtos').select('*', { count: 'exact', head: true }).eq('loja_id', LOJA_ID)
  console.log(`\nTotal de produtos na loja agora: ${count}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
