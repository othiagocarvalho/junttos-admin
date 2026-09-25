// Baixa/restauro de estoque a partir dos itens de uma venda, troca ou pedido.
//
// Antes isto morava inteiro dentro de useLojaData.js (aplicarEstoque) e
// buscava o produto com .eq('nome').maybeSingle(), ignorando o erro: com dois
// produtos de MESMO nome o PostgREST devolve data=null + PGRST116, e o código
// fazia `if (!prod) continue` — a venda era gravada e o estoque não mexia,
// sem ninguém saber (caso Short Listrado / Tropicale, 26 vendas; e os 18
// produtos da Audaz cujas duplicatas inativas mantêm o mesmo nome).
//
// Agora:
//   · a busca por nome considera só produto ATIVO (ativo IS NOT FALSE) —
//     duplicata inativa deixa de atrapalhar;
//   · 0 produtos, 2+ produtos, variação inexistente, erro de busca ou de
//     gravação viram FALHA com motivo — nunca mais um `continue` mudo;
//   · toda falha é registrada em lf_estoque_pendencias (via RPC, ver
//     supabase/fix_estoque_pendencias.sql) e devolvida a quem chamou, que
//     mostra o aviso na tela.
//
// Sem React e sem Supabase: quem chama injeta `buscarPorNome`,
// `gravarVariacoes` e `registrarPendencia` (padrão de criarLojaFluxo.js),
// o que deixa a regra testável com fakes.

import { decrementarVariacoes, restaurarVariacoes } from './venda'
import { normalizarItensEstoque, agruparPorNome, labelVariacao } from './estoqueMov'

/** Motivos de falha → frase para a vendedora. */
export const MOTIVOS_FALHA = {
  produto_duplicado:       'há mais de um produto ativo com esse nome',
  produto_nao_encontrado:  'o produto não foi encontrado no cadastro',
  variacao_nao_encontrada: 'essa variação não existe no cadastro do produto',
  erro_busca:              'não foi possível consultar o produto',
  erro_gravacao:           'não foi possível gravar o estoque',
}

/**
 * Motivos que impedem excluir um pedido. Só erro de GRAVAÇÃO: o produto sumiu
 * do catálogo, está duplicado ou sem a variação — nenhuma nova tentativa
 * resolve isso sozinha, e bloquear deixaria o pedido impossível de excluir
 * para sempre (comportamento que excluirPedido já documentava). Esses casos
 * seguem registrados como pendência.
 */
export const MOTIVOS_BLOQUEANTES = ['erro_gravacao']

/**
 * Busca de produto por nome usada na baixa/restauro — a query real, aqui para
 * ser testável com um fake do cliente Supabase.
 *   · só produto ATIVO (`ativo IS NOT FALSE`: null conta como ativo, igual ao
 *     resto do app) — a duplicata inativa não "empata" mais com a ativa;
 *   · limit(2) em vez de .maybeSingle(): basta para distinguir 1 de 2+, e não
 *     transforma "achei dois" em data=null.
 */
export function criarBuscaPorNome(supabase, lojaId) {
  return nome => supabase
    .from('lf_produtos')
    .select('id, variacoes')
    .eq('loja_id', lojaId)
    .eq('nome', nome)
    .not('ativo', 'is', false)
    .limit(2)
}

/**
 * Decide qual produto usar a partir das linhas da busca por nome (até 2).
 * @returns {{ produto } | { motivo, detalhe }}
 */
export function resolverProduto(linhas) {
  const lista = Array.isArray(linhas) ? linhas : []
  if (lista.length === 1) return { produto: lista[0] }
  if (lista.length === 0) return { motivo: 'produto_nao_encontrado', detalhe: {} }
  return { motivo: 'produto_duplicado', detalhe: { produto_ids: lista.map(p => p.id) } }
}

/** Itens cuja variação não existe no produto. */
export function itensSemVariacao(variacoes, itens) {
  const labels = new Set((variacoes || []).map(labelVariacao).filter(l => l !== null))
  return (itens || []).filter(i => !labels.has(String(i.variacao)))
}

function falhaDoItem(item, motivo, detalhe = {}, modo = 'baixa') {
  return {
    modo,
    nome: item.nome,
    variacao: item.variacao ?? null,
    quantidade: Number(item.quantidade) || 1,
    motivo,
    mensagem: MOTIVOS_FALHA[motivo] || motivo,
    detalhe,
  }
}

/**
 * Aplica a baixa ou o restauro. Nunca lança: tudo que dá errado volta como
 * falha (e vira pendência). Itens sem variação continuam ignorados, como o
 * app sempre fez (normalizarItensEstoque).
 *
 * @param deps.buscarPorNome(nome)            → Promise<{ data: [{id, variacoes}], error }>
 * @param deps.gravarVariacoes(id, vars, ctx) → Promise<error|null>
 * @param deps.registrarPendencia(pend)       → Promise<void>  (falha dela é engolida e logada)
 * @param opts.modo       'baixa' | 'restauro'
 * @param opts.vendaId    id da venda (quando houver) — vai para a pendência
 * @returns {Promise<Array<falha>>} vazia quando tudo gravou
 */
export async function aplicarEstoqueItens(deps, produtosItens, opts) {
  const { buscarPorNome, gravarVariacoes, registrarPendencia } = deps
  const { modo, tipo, origemTipo = null, origemId = null, motivo = null, vendaId = null } = opts
  const falhas = []
  const itens = normalizarItensEstoque(produtosItens)

  for (const grupo of agruparPorNome(itens)) {
    let busca
    try {
      busca = await buscarPorNome(grupo.nome)
    } catch (e) {
      busca = { data: null, error: e }
    }
    if (busca?.error) {
      grupo.itens.forEach(i => falhas.push(falhaDoItem(i, 'erro_busca', { erro: busca.error.message || String(busca.error) }, modo)))
      continue
    }

    const r = resolverProduto(busca?.data)
    if (!r.produto) {
      grupo.itens.forEach(i => falhas.push(falhaDoItem(i, r.motivo, r.detalhe, modo)))
      continue
    }

    const prod = r.produto
    const faltando = itensSemVariacao(prod.variacoes, grupo.itens)
    faltando.forEach(i => falhas.push(falhaDoItem(i, 'variacao_nao_encontrada', { produto_id: prod.id }, modo)))
    const aplicaveis = grupo.itens.filter(i => !faltando.includes(i))
    if (aplicaveis.length === 0) continue

    const novasVariacoes = modo === 'baixa'
      ? decrementarVariacoes(prod.variacoes, aplicaveis)
      : restaurarVariacoes(prod.variacoes, aplicaveis)

    let erro
    try {
      erro = await gravarVariacoes(prod.id, novasVariacoes, { tipo, origemTipo, origemId, motivo })
    } catch (e) {
      erro = e
    }
    if (erro) {
      console.error('[estoque] gravação de variações falhou:', erro.message, grupo.nome)
      aplicaveis.forEach(i => falhas.push(falhaDoItem(i, 'erro_gravacao', { produto_id: prod.id, erro: erro.message || String(erro) }, modo)))
    }
  }

  for (const f of falhas) {
    try {
      await registrarPendencia?.({
        venda_id:     vendaId,
        produto_nome: f.nome,
        variacao:     f.variacao,
        quantidade:   f.quantidade,
        motivo:       f.motivo,
        detalhe:      { ...f.detalhe, modo, origem_tipo: origemTipo, origem_id: origemId },
      })
    } catch (e) {
      // A pendência é o registro permanente; o aviso na tela já garante que
      // a falha não passa em silêncio mesmo se isto não gravar.
      console.error('[estoque] não foi possível registrar a pendência:', e?.message || e)
    }
  }
  return falhas
}

/** "SHORT LISTRADO (AZUL M): há mais de um produto ativo com esse nome" */
export function descreverFalha(f) {
  const alvo = f.variacao ? `${f.nome} (${f.variacao})` : f.nome
  return `${alvo}: ${f.mensagem || MOTIVOS_FALHA[f.motivo] || f.motivo}`
}

/**
 * Texto do aviso, conforme o momento.
 *   venda    → "Venda salva, mas o estoque de X (M) não foi baixado: …"
 *   exclusao → "Venda excluída, mas o estoque de X (M) não foi devolvido: …"
 * O verbo segue o `modo` de cada falha: numa troca, a falha pode ser na
 * DEVOLUÇÃO do produto trocado, não na baixa.
 */
export function textoAvisoEstoque(falhas, contexto = 'venda') {
  const lista = falhas || []
  if (lista.length === 0) return ''
  const inicio = contexto === 'exclusao' ? 'Venda excluída' : 'Venda salva'
  const verbo = f => (f.modo === 'restauro' ? 'não foi devolvido' : 'não foi baixado')
  const alvo = f => (f.variacao ? `${f.nome} (${f.variacao})` : f.nome)
  if (lista.length === 1) {
    const f = lista[0]
    return `${inicio}, mas o estoque de ${alvo(f)} ${verbo(f)}: ${f.mensagem || MOTIVOS_FALHA[f.motivo] || f.motivo}. Ajuste manualmente em Estoque.`
  }
  return `${inicio}, mas o estoque de ${lista.length} itens não foi atualizado. Ajuste manualmente em Estoque.`
}

/**
 * Grava a venda e depois mexe no estoque. A venda NUNCA é desfeita por falha
 * de estoque: ela já está no banco, e desfazer (ou deixar a vendedora repetir
 * o clique) seria pior — duplicaria a venda. A falha volta em `falhasEstoque`
 * para a tela avisar.
 *
 * @param deps.inserir(payload)            → Promise<{ data, error }>
 * @param deps.aplicar(itens, opts)        → Promise<falhas[]>  (aplicarEstoqueItens já ligado)
 */
export async function salvarVendaComEstoque({ inserir, aplicar }, venda) {
  const { produto_devolvido, ...payload } = venda
  const { data: novaVenda, error } = await inserir(payload)
  // PGRST116 = select-after-insert voltou vazio (insert OK, borda de RLS).
  if (error && error.code !== 'PGRST116') return { error, venda: null, falhasEstoque: [] }

  const vendaId = novaVenda?.id || null
  let falhasEstoque
  try {
    const devolucao = await aplicar(produto_devolvido, {
      modo: 'restauro', tipo: 'devolucao', origemTipo: 'venda', origemId: vendaId,
      motivo: 'Devolução em troca', vendaId,
    })
    const baixa = await aplicar(venda.produtos, {
      modo: 'baixa', tipo: 'venda', origemTipo: 'venda', origemId: vendaId, vendaId,
    })
    falhasEstoque = [...(devolucao || []), ...(baixa || [])]
  } catch (e) {
    // aplicarEstoqueItens não lança; isto é só cinto de segurança para a
    // venda nunca "sumir" da tela por causa do estoque.
    console.error('[estoque] erro inesperado após gravar a venda:', e)
    falhasEstoque = [{ modo: 'baixa', nome: 'itens da venda', variacao: null, quantidade: 0, motivo: 'erro_gravacao', mensagem: MOTIVOS_FALHA.erro_gravacao, detalhe: {} }]
  }
  return { error: null, venda: novaVenda || null, falhasEstoque }
}
