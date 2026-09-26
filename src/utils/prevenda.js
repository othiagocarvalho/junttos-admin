// Lógica pura da Pré-venda (etapa 2) — a tela de bipagem e a lista de
// pendentes só desenham; tudo que dá pra decidir sem DOM/Supabase mora aqui,
// testável sem montar componente (mesmo motivo de utils/catalogoV2.js).
//
// ─── ARQUITETURA: INSERT no primeiro bipe, UPDATE nos seguintes ────────────
// Decisão da etapa 2 (aprovada): decremento de estoque (bipar_item_prevenda)
// e persistência em lf_vendas SEMPRE andam juntos — nunca existe estoque já
// baixado sem uma linha em lf_vendas pra rastrear aquilo. Por isso o primeiro
// bipe já grava (INSERT, status='aguardando_pagamento', estoque_baixado=true)
// e cada bipe seguinte só ACRESCENTA no registro que já existe (UPDATE) — ao
// contrário de Nova Venda, que acumula tudo em estado local e só grava no
// fim. O "Salvar e continuar depois" da tela de bipagem não cria nada: só
// navega, porque o registro já está salvo desde a primeira peça.
//
// ─── PRODUTO_ID NÃO VAI PARA lf_vendas.produtos ─────────────────────────────
// O formato de item continua EXATAMENTE o que Nova Venda já grava —
// {nome, variacao, obs, quantidade}, via adicionarAoCarrinho (utils/
// codigoBarras.js) — sem acrescentar produto_id nem nenhuma chave nova.
// Cancelamento (remover uma linha, ou cancelar a pré-venda inteira) resolve
// produto_id de volta casando por NOME contra produtosData, o mesmo padrão
// que aplicarEstoque (useLojaData.js) já usa pra baixa/restauro de Nova
// Venda e Troca. Mantém as duas frentes do sistema com uma regra só, em vez
// de inventar um segundo formato de item só pra este fluxo.

import { adicionarAoCarrinho } from './codigoBarras'
import { calcularTotalVenda } from './venda'
import { produtoDoItem } from './itemVenda'

// ─────────────────────────────────────────────────────────────────────────────
// Erro de estoque insuficiente — bipar_item_prevenda usa o MESMO prefixo de
// criar_pedido_catalogo (fix_estoque_catalogo_publico.sql), mas o payload é
// mais enxuto: só produto_id, cor, disponivel, pedido — sem `nome`, porque a
// RPC só enxerga o produto_id que recebeu. Quem chama já tem o nome (veio de
// buscarPorCodigo, no mesmo bipe) e completa aqui.
// ─────────────────────────────────────────────────────────────────────────────
const PREFIXO_ERRO_ESTOQUE = 'ESTOQUE_INSUFICIENTE:'

/** Desembrulha o erro de bipar_item_prevenda. null quando não é esse erro. */
export function parseErroEstoquePrevenda(mensagem) {
  const texto = String(mensagem ?? '')
  if (!texto.startsWith(PREFIXO_ERRO_ESTOQUE)) return null
  try {
    const dados = JSON.parse(texto.slice(PREFIXO_ERRO_ESTOQUE.length))
    return {
      produtoId: dados?.produto_id || null,
      cor: dados?.cor || '',
      disponivel: Math.max(0, Math.floor(Number(dados?.disponivel)) || 0),
      pedido: Math.max(0, Math.floor(Number(dados?.pedido)) || 0),
    }
  } catch {
    return null
  }
}

/**
 * Texto final mostrado no aviso do CampoScanner. `nome` vem de quem chama
 * (o resultado de buscarPorCodigo no MESMO bipe) — nunca do payload da RPC,
 * que não carrega nome nenhum.
 */
export function mensagemErroEstoquePrevenda(nome, info) {
  if (!info) return 'Não foi possível bipar este item agora. Tente de novo.'
  const rotulo = info.cor ? `${nome} (${info.cor})` : nome
  return `Só temos ${info.disponivel} unidade(s) de ${rotulo} disponível agora.`
}

/**
 * Variação no formato que bipar_item_prevenda/restaurar_item_prevenda
 * esperam — {cor: rotulo} quando existe rótulo, {} quando não (produto sem
 * variação). Nunca uma string solta: a RPC extrai o rótulo pela mesma regra
 * de sempre (primeira chave que não é quantidade/custo/codigo), então o
 * nome da chave (`cor`) é só uma etiqueta — funciona igual pra produto
 * rotulado por tamanho, sem chave `cor` de verdade no cadastro.
 */
export function variacaoParaRpc(rotulo) {
  return rotulo ? { cor: rotulo } : {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Montagem dos payloads — sempre {produtos, valor}, nunca escrevem no banco.
// Quem chama decide INSERT (primeiro bipe) ou UPDATE (os seguintes).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload de INSERT em lf_vendas para o PRIMEIRO bipe de uma pré-venda nova.
 *
 * status/estoque_baixado explícitos de propósito: são os dois únicos campos
 * que uma venda normal (addVenda, useLojaData.js) nunca passa — todo o resto
 * do payload é idêntico ao que uma venda comum já grava.
 */
export function montarInsertPrimeiroBipe({
  lojaId, produtoId, nome, rotulo, clienteNome, clienteTel, vendedora, produtosData,
}) {
  const produtos = adicionarAoCarrinho([], { produto_id: produtoId, nome, variacao: rotulo })
  return {
    loja_id: lojaId,
    cliente_nome: (clienteNome || '').trim() || null,
    cliente_tel: (clienteTel || '').trim() || null,
    vendedora: vendedora || null,
    data: new Date().toISOString(),
    produtos,
    valor: calcularTotalVenda(produtos, produtosData),
    obs: null,
    ajuste_valor: 0,
    status: 'aguardando_pagamento',
    estoque_baixado: true,
  }
}

/**
 * Acrescenta um bipe seguinte a uma pré-venda que já existe.
 * @returns {{produtos, valor}} pronto para updateVenda(id, {...}).
 */
export function acrescentarBipe(produtosAtuais, { produto_id, nome, variacao }, produtosData) {
  const produtos = adicionarAoCarrinho(produtosAtuais, { produto_id, nome, variacao })
  return { produtos, valor: calcularTotalVenda(produtos, produtosData) }
}

/**
 * Remove uma LINHA inteira (todas as unidades daquela combinação nome+
 * variação, não um decremento de 1) — é o que o botão "remover" da lista de
 * bipados faz. `item` devolvido carrega `quantidade`: quem chama sabe quantas
 * vezes invocar restaurar_item_prevenda (uma chamada por unidade — a RPC só
 * devolve 1 de cada vez, mesmo padrão de bipar_item_prevenda).
 *
 * `ficouVazia`: quando true, a pré-venda não tem mais nenhum item — quem
 * chama cancela o registro inteiro (status='cancelada') em vez de deixar uma
 * pré-venda com produtos=[] pairando na lista.
 *
 * @returns {{produtos, valor, item: object|null, ficouVazia: boolean}}
 */
export function removerLinha(produtosAtuais, indice, produtosData) {
  const lista = Array.isArray(produtosAtuais) ? produtosAtuais : []
  const item = lista[indice] ?? null
  const produtos = item ? lista.filter((_, i) => i !== indice) : lista
  return {
    produtos,
    valor: calcularTotalVenda(produtos, produtosData),
    item,
    ficouVazia: produtos.length === 0,
  }
}

/**
 * Achata os itens de uma pré-venda numa lista de "quantas vezes restaurar" —
 * usado tanto por cancelarPreVenda (lista de pendentes) quanto, em teoria,
 * por qualquer outro caminho que precise devolver TUDO de uma pré-venda de
 * uma vez. Uma linha por (nome, variação, quantidade) — quantidade > 1 dá
 * várias chamadas de restaurar_item_prevenda, não uma só com "quantidade=N"
 * (a RPC da etapa 1 só devolve 1 unidade por chamada, de propósito).
 */
export function itensParaRestaurar(produtos) {
  return (produtos || [])
    .filter(p => p && p.nome)
    .map(p => ({
      ...(p.produto_id ? { produto_id: p.produto_id } : {}),
      nome: p.nome, variacao: p.variacao ?? null, vezes: Math.max(1, Number(p.quantidade) || 1),
    }))
}

/**
 * Resolve o produto (linha de lf_produtos) de um item de pré-venda casando
 * por NOME contra produtosData — mesmo padrão que aplicarEstoque já usa em
 * todo o resto do sistema (useLojaData.js). null quando o produto sumiu do
 * catálogo desde a bipagem; quem chama decide seguir sem restaurar esse item
 * (mesmo comportamento de aplicarEstoque: produto ausente não é falha, é
 * ausência de alvo).
 */
export function encontrarProdutoPorNome(produtosData, nome) {
  return (produtosData || []).find(p => p.nome === nome) || null
}

/**
 * Produto de um item de pré-venda: pelo produto_id quando o item tem (etapa
 * 2 — sem ambiguidade de nome repetido), pelo nome quando não tem (pré-venda
 * bipada antes). null = saiu do catálogo; quem chama segue sem restaurar,
 * como sempre.
 */
export function encontrarProdutoDoItem(produtosData, item) {
  return produtoDoItem(produtosData, item)
}
