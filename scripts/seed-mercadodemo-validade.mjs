/**
 * Semeia produtos de demonstração com validade próxima na loja 'mercadodemo',
 * para a tela de Validade (T7).
 *
 * Nenhum produto da mercadodemo tinha data_vencimento preenchida, então a tela
 * caía no estado vazio e não dava para ver as seções "Urgente" e "Fique de olho".
 *
 * - Nomes próprios, distintos dos usados em seed-mercadodemo-estoque.mjs:
 *   os dois scripts são independentes e nenhum mexe nos produtos do outro.
 * - Só insere produtos novos; nunca altera Arroz, Feijão ou os "Demo -" do
 *   script de estoque.
 * - Idempotente com uma diferença importante: se um produto DESTE script já
 *   existe, a data_vencimento é recalculada. Datas absolutas envelhecem — sem
 *   isso, o "vence hoje" viraria "vencido há N dias" e a demo perderia sentido.
 *   Reexecute sempre que quiser recolocar a demo no lugar.
 *
 * Quantidades propositalmente >= 10 para que estes produtos fiquem no estado
 * "ok" da tela de Estoque e não interfiram no contador de estoque baixo, que é
 * a demonstração do outro script.
 *
 * Faixas da tela (src/utils/validade.js): até 3 dias corridos, incluindo já
 * vencido, é "Urgente"; de 4 a 9 dias é "Fique de olho"; acima disso não
 * aparece. O produto de 40 dias existe justamente para provar a exclusão.
 *
 * Uso:
 *   SUPABASE_SERVICE_KEY=<service_role> node scripts/seed-mercadodemo-validade.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dbfxigylileupucnuhmb.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY
const LOJA_ID      = 'mercadodemo'

if (!SERVICE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_KEY antes de rodar.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Data relativa a hoje em 'YYYY-MM-DDT12:00:00'.
 * Meio-dia, nunca meia-noite: em coluna timestamptz, 00:00 UTC seria lido como
 * o dia anterior no Brasil e o produto apareceria vencendo um dia antes.
 * Montada à mão — toISOString() reintroduziria o shift de fuso.
 */
function emDias(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${ymd}T12:00:00`
}

const PRODUTOS = [
  { nome: 'Demo - Iogurte Vencido 170g',   dias: -2, qtd: 12, preco_venda: 3.90,  preco_custo: 2.60, ean: '7891000910016', secao: 'Urgente' },
  { nome: 'Demo - Pão de Forma Hoje',      dias:  0, qtd: 15, preco_venda: 8.50,  preco_custo: 5.90, ean: '7891000910023', secao: 'Urgente' },
  { nome: 'Demo - Presunto Amanhã 200g',   dias:  1, qtd: 10, preco_venda: 12.90, preco_custo: 9.10, ean: '7891000910030', secao: 'Urgente' },
  { nome: 'Demo - Queijo 3 Dias 500g',     dias:  3, qtd: 18, preco_venda: 28.90, preco_custo: 21.00,ean: '7891000910047', secao: 'Urgente' },
  { nome: 'Demo - Leite 4 Dias 1L',        dias:  4, qtd: 24, preco_venda: 5.90,  preco_custo: 4.20, ean: '7891000910054', secao: 'Fique de olho' },
  { nome: 'Demo - Iogurte Grego 6 Dias',   dias:  6, qtd: 20, preco_venda: 4.50,  preco_custo: 3.10, ean: '7891000910061', secao: 'Fique de olho' },
  { nome: 'Demo - Requeijão 9 Dias 200g',  dias:  9, qtd: 14, preco_venda: 9.90,  preco_custo: 6.80, ean: '7891000910078', secao: 'Fique de olho' },
  { nome: 'Demo - Biscoito 40 Dias',       dias: 40, qtd: 30, preco_venda: 6.50,  preco_custo: 4.30, ean: '7891000910085', secao: '(fora da janela)' },
]

const NOMES = new Set(PRODUTOS.map(p => p.nome))

async function main() {
  console.log(`Semeando produtos com validade em '${LOJA_ID}'...\n`)

  const { data: existentes, error: errLista } = await supabase
    .from('lf_produtos').select('id, nome, data_vencimento').eq('loja_id', LOJA_ID)
  if (errLista) { console.error('❌ Erro ao listar produtos:', errLista.message); process.exit(1) }

  const naoTocados = existentes.filter(p => !NOMES.has(p.nome))
  console.log(`Produtos que NÃO serão tocados (${naoTocados.length}):`)
  for (const p of naoTocados) console.log(`   · ${p.nome}`)
  console.log()

  const porNome = new Map(existentes.map(p => [p.nome, p]))
  const inserir = []
  let atualizados = 0

  for (const p of PRODUTOS) {
    const venc = emDias(p.dias)
    const atual = porNome.get(p.nome)

    if (atual) {
      const { error } = await supabase
        .from('lf_produtos').update({ data_vencimento: venc })
        .eq('id', atual.id).eq('loja_id', LOJA_ID)
      if (error) { console.error(`❌ Erro ao atualizar ${p.nome}:`, error.message); process.exit(1) }
      console.log(`   ♻️  ${p.nome} — já existia, data_vencimento recalculada`)
      atualizados++
      continue
    }

    inserir.push({
      loja_id:         LOJA_ID,
      nome:            p.nome,
      ean:             p.ean,
      preco_custo:     p.preco_custo,
      preco_venda:     p.preco_venda,
      quantidade:      0,
      variacoes:       [{ cor: 'Único', quantidade: p.qtd }],
      data_vencimento: venc,
      ativo:           true,
      disponivel_catalogo_b2b: false,
    })
  }

  if (inserir.length) {
    const { error } = await supabase.from('lf_produtos').insert(inserir)
    if (error) { console.error('❌ Erro ao inserir:', error.message); process.exit(1) }
  }

  console.log(`\n✅ ${inserir.length} inserido(s), ${atualizados} atualizado(s).\n`)
  console.log('   dias  qtd  produto                             → seção')
  for (const p of PRODUTOS) {
    console.log(`   ${String(p.dias).padStart(4)}  ${String(p.qtd).padStart(3)}  ${p.nome.padEnd(34)} → ${p.secao}`)
  }

  const { count } = await supabase
    .from('lf_produtos').select('*', { count: 'exact', head: true }).eq('loja_id', LOJA_ID)
  console.log(`\nTotal de produtos na loja agora: ${count}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
