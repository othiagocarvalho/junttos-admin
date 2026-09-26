// Código de barras por VARIAÇÃO de produto.
//
// ─── POR QUE POR VARIAÇÃO, E NÃO POR PRODUTO ────────────────────────────────
// O estoque do sistema é controlado por variação, não pelo produto genérico:
// `quantidade` mora dentro de cada item de lf_produtos.variacoes, e a baixa
// acontece via decrementar_estoque_variacao(p_produto_id, p_label, p_qtd).
// Uma etiqueta por produto não conseguiria dizer QUAL peça saiu — bipar um
// vestido que existe em Rosa e Nude teria de perguntar a cor na mão, que é
// justamente o trabalho que o leitor deveria eliminar.
//
// ─── POR QUE O CÓDIGO É DERIVADO, POR PADRÃO ────────────────────────────────
// Por padrão, o código NÃO é armazenado: é DERIVADO de (loja_id, produto.id,
// label) — a mesma trinca que o sistema já usa para baixar estoque, então o
// código automático nunca pode divergir do que o estoque enxerga. Não há
// migration, não há caminho de escrita, não há corrida com lf_set_variacoes.
//
// Custo assumido: renomear uma cor ("Rosa" → "Rosa Bebê") muda o código
// automático e invalida etiquetas já impressas daquela variação. É raro, é
// visível (a peça simplesmente não bipa e cai na busca manual) e é reversível
// reimprimindo — bem melhor do que um modo de falha silencioso.
//
// ─── CÓDIGO MANUAL (override opcional, por variação) ────────────────────────
// Exceção deliberada a tudo isso: quando duas lojas do MESMO dono vendem o
// MESMO produto físico e precisam do MESMO código nas duas — ver
// codigoEfetivo() e o comentário maior logo abaixo dela. Esse valor SIM é
// armazenado, na chave `codigo` dentro do próprio item de `variacoes`. Isso só
// é seguro porque buildVariacoes() (ProdutosB2BPro.jsx) e o
// handleSave()/handleAddProduto() de EstoqueMobile.jsx — os únicos lugares que
// reconstroem um item de variação do zero antes de salvar — foram ajustados
// para preservar essa chave; lf_set_variacoes (migration_estoque_mov.sql)
// sempre foi um UPDATE direto do jsonb que o client manda, sem reconstruir
// nada, então nunca foi ele quem ameaçava apagar a chave.

import { mesmoItem } from './itemVenda'

/** Chaves de controle dentro de uma variação; o resto é o rótulo. */
const CHAVES_CONTROLE = new Set(['quantidade', 'custo', 'codigo'])

/**
 * Rótulo da variação ("Rosa", "M", "Único").
 *
 * Mesma regra de getLabel/getVarLabel que EstoqueMobile, ProdutosB2BPro e
 * balanco.js já usam — os formatos reais em produção são
 * {cor, quantidade}, {cor, custo, quantidade} e {quantidade, tamanho}.
 */
export function rotuloVariacao(v) {
  if (!v || typeof v !== 'object') return null
  const k = Object.keys(v).find(k => !CHAVES_CONTROLE.has(k))
  const valor = k ? String(v[k]).trim() : ''
  return valor || null
}

// ─────────────────────────────────────────────────────────────────────────────
// POR QUE O CÓDIGO É SÓ DE DÍGITOS
//
// O formato anterior era `PRE-XXXXXXXX-YYYY` (17 caracteres, ex.
// TRO-16C37D44-W0E2). Legível, mas impossível de imprimir na etiqueta térmica:
//
//   medido com o próprio JsBarcode, largura útil de 31mm (33mm da etiqueta
//   menos 2mm de padding) e 20 módulos de quiet zone:
//
//     TRO-16C37D44-W0E2   17c · 222 módulos → 0,128 mm por barra estreita
//     16C37D44W0E2        12c · 167 módulos → 0,166 mm
//     482913605744        12 dígitos · 101 módulos → 0,256 mm
//
// O piso seguro para leitor de mão comum é ~0,19 mm. Encurtar o alfanumérico
// NÃO resolve: 12 caracteres ainda ficam em 0,166.
//
// O que resolve é o alfabeto. Com só dígitos, o Code128 entra em modo Code C e
// empacota DOIS dígitos por símbolo — 12 dígitos custam 101 módulos contra 167
// de 12 alfanuméricos. É a única mudança que tira a barra do vermelho dentro
// dos 33mm medidos.
//
// Aumentar a altura das barras (a outra alternativa considerada) melhora a
// tolerância de mira, mas não resolve NADA aqui: um leitor que não resolve
// 0,128mm de barra não passa a resolver porque a barra ficou mais alta.
//
// 12 dígitos dão 10^12 combinações. Numa loja com algumas centenas de
// variações a chance de colisão é desprezível, e a busca (buscarPorCodigo) é
// sempre dentro de uma loja só.
// ─────────────────────────────────────────────────────────────────────────────

/** Quantos dígitos o código tem. Par, porque o Code C consome de dois em dois. */
export const CODIGO_DIGITOS = 12

/**
 * Hash determinístico em dígitos decimais.
 *
 * Dois FNV-1a com constantes diferentes, cada um respondendo por metade dos
 * dígitos. Evita de propósito combinar os dois num único número: acima de 2^53
 * o Number perde precisão e o código deixaria de ser reprodutível.
 *
 * Precisa dar o mesmo resultado em qualquer motor JS e daqui a um ano — a
 * etiqueta impressa hoje é conferida contra o cálculo de amanhã.
 */
function hashDigitos(texto, nDigitos = CODIGO_DIGITOS) {
  const metade = Math.floor(nDigitos / 2)
  const mod = 10 ** metade
  let h1 = 0x811c9dc5
  let h2 = 0xcbf29ce4
  const s = String(texto)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0
  }
  return String(h1 % mod).padStart(metade, '0') + String(h2 % mod).padStart(metade, '0')
}

/**
 * Código da variação: 12 dígitos.
 *
 * O loja_id entra no hash para duas lojas com o mesmo produto importado não
 * colidirem — o produto pode ter o mesmo uuid nas duas.
 */
export function codigoDaVariacao(lojaId, produtoId, rotulo) {
  if (!produtoId || !rotulo) return ''
  return hashDigitos(`${lojaId}|${produtoId}|${rotulo}`)
}

/** Normaliza o que o leitor mandou: espaço em volta, caixa, aspas do scanner. */
export function normalizarCodigo(bruto) {
  return String(bruto ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

/**
 * Código EFETIVO de uma variação: usa o manual em `v.codigo` quando presente
 * e não vazio, senão cai no hash automático de sempre (ver cabeçalho do
 * arquivo para o porquê de cada um).
 *
 * Custo assumido, documentado para quem for ler os call-sites: como o item de
 * variação ganhou uma chave a mais, todo código que descobre o RÓTULO da
 * variação por "a primeira chave que não é quantidade/custo" (padrão repetido
 * em ~9 arquivos deste projeto, incluindo a função Postgres lf_var_label) tem
 * que também excluir 'codigo' — senão o "rótulo" descoberto vira o número do
 * código de barras. Foram todos ajustados junto com esta função.
 */
export function codigoEfetivo(lojaId, produtoId, v) {
  const manual = normalizarCodigo(v?.codigo)
  if (manual) return manual
  return codigoDaVariacao(lojaId, produtoId, rotuloVariacao(v))
}

/**
 * Todas as etiquetas de um produto — uma por variação.
 *
 * Produto sem variação nenhuma devolve lista vazia de propósito: não existe
 * peça física para etiquetar, e uma etiqueta "genérica" não baixaria estoque.
 */
export function etiquetasDoProduto(produto, lojaId) {
  const vars = Array.isArray(produto?.variacoes) ? produto.variacoes : []
  return vars
    .map(v => {
      const rotulo = rotuloVariacao(v)
      if (!rotulo) return null
      return {
        produtoId: produto.id,
        nome: produto.nome,
        rotulo,
        quantidade: Number(v.quantidade) || 0,
        preco: Number(produto.preco_venda) || 0,
        codigo: codigoEfetivo(lojaId, produto.id, v),
      }
    })
    .filter(Boolean)
}

/** Etiquetas de vários produtos, na ordem recebida. */
export function etiquetasDeProdutos(produtos, lojaId) {
  return (produtos || []).flatMap(p => etiquetasDoProduto(p, lojaId))
}

/**
 * Resolve um código bipado para { produto, rotulo, quantidade }.
 *
 * Varre e recalcula em vez de consultar um índice: a lista de produtos já está
 * em memória na tela de venda, e recalcular garante que o resultado siga
 * exatamente a mesma regra que gerou a etiqueta. Devolve null quando não acha
 * — quem chama decide se mostra erro ou cai na busca manual.
 */
export function buscarPorCodigo(produtos, lojaId, bruto) {
  const alvo = normalizarCodigo(bruto)
  if (!alvo) return null
  for (const produto of produtos || []) {
    for (const et of etiquetasDoProduto(produto, lojaId)) {
      if (et.codigo === alvo) {
        return { produto, rotulo: et.rotulo, quantidade: et.quantidade, codigo: et.codigo }
      }
    }
  }
  return null
}

/**
 * Heurística de leitor de código de barras.
 *
 * O leitor USB/bluetooth se comporta como teclado: dispara os caracteres em
 * rajada e termina com Enter. Gente digitando na mão leva 100ms+ entre teclas;
 * o leitor, menos de 30ms. Serve para o campo distinguir uma leitura de
 * alguém que digitou o código à mão — os dois funcionam, mas só a rajada
 * dispensa o Enter explícito.
 */
export function pareceLeitura(intervalosMs, limiteMs = 35) {
  if (!intervalosMs?.length) return false
  return intervalosMs.every(ms => ms <= limiteMs)
}

/**
 * Acrescenta a variação bipada ao carrinho da Nova Venda.
 *
 * Formato do item igual ao que toggleProd já usa em NovaVenda.jsx:
 * `{ produto_id, nome, variacao, obs, quantidade }`. Bipar duas vezes a mesma peça soma
 * quantidade em vez de criar linha repetida — é o comportamento esperado de
 * quem passa três peças iguais no leitor.
 *
 * Devolve uma lista NOVA; não muta a recebida.
 */
export function adicionarAoCarrinho(itens, { produto_id, nome, variacao }) {
  const lista = Array.isArray(itens) ? itens : []
  const novo = produto_id
    ? { produto_id, nome, variacao, obs: '', quantidade: 1 }
    : { nome, variacao, obs: '', quantidade: 1 }
  // Mesma linha = mesmo produto (pelo id quando os dois têm) + mesma variação.
  const i = lista.findIndex(p => mesmoItem(p, novo))
  if (i === -1) return [...lista, novo]
  return lista.map((p, j) => (j === i
    ? { ...p, ...(produto_id && !p.produto_id ? { produto_id } : {}), quantidade: (p.quantidade || 1) + 1 }
    : p))
}
