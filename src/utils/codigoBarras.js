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
// ─── POR QUE O CÓDIGO NÃO É ARMAZENADO ──────────────────────────────────────
// A alternativa óbvia era gravar um campo `codigo` dentro de cada item de
// `variacoes`. Foi descartada por evidência no próprio código:
//
//   • supabase/migration_estoque_mov.sql, lf_set_variacoes:
//         UPDATE lf_produtos SET variacoes = p_variacoes
//     substitui o ARRAY INTEIRO;
//   • ProdutosB2BPro.jsx, buildVariacoes(), reconstrói cada item do zero
//         .map(t => ({ tamanho: ..., quantidade: ... }))
//     descartando qualquer chave extra.
//
// Ou seja: um código gravado no JSONB seria apagado em silêncio na primeira
// edição de grade — e etiquetas já impressas e coladas na roupa parariam de
// casar com o banco, sem ninguém perceber. Coluna nova em lf_produtos também
// não serve, porque seria por produto, e o estoque é por variação.
//
// Então o código é DERIVADO de (loja_id, produto.id, label). Essa trinca é
// exatamente a identidade que o sistema já usa para baixar estoque, então o
// código nunca pode divergir do que o estoque enxerga. Não há migration, não
// há caminho de escrita, não há corrida com lf_set_variacoes.
//
// Custo assumido: renomear uma cor ("Rosa" → "Rosa Bebê") muda o código e
// invalida etiquetas já impressas daquela variação. É raro, é visível (a peça
// simplesmente não bipa e cai na busca manual) e é reversível reimprimindo —
// bem melhor do que o modo de falha silencioso do JSONB apagado.

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

/**
 * Hash FNV-1a de 32 bits, em base36 e com 4 caracteres.
 *
 * Determinístico e igual em qualquer motor JS — o código impresso hoje precisa
 * bater com o calculado daqui a um ano, em outro navegador.
 */
function hash4(texto) {
  let h = 0x811c9dc5
  const s = String(texto)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36).toUpperCase().padStart(4, '0').slice(-4)
}

/** Prefixo legível da loja: 3 letras, só para a etiqueta dizer de onde veio. */
export function prefixoLoja(lojaId) {
  const so = String(lojaId ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return (so.slice(0, 3) || 'LOJ').padEnd(3, 'X')
}

/**
 * Código da variação. Formato: PRE-XXXXXXXX-YYYY
 *
 * Só maiúsculas, dígitos e hífen: o Code128 aceita ASCII inteiro, mas manter o
 * alfabeto estreito evita problema com leitor configurado em teclado ABNT2,
 * onde símbolo acentuado ou caractere exótico chega trocado.
 */
export function codigoDaVariacao(lojaId, produtoId, rotulo) {
  if (!produtoId || !rotulo) return ''
  const id8 = String(produtoId).replace(/-/g, '').slice(0, 8).toUpperCase()
  // O loja_id entra no hash (e não só no prefixo) para duas lojas com o mesmo
  // produto importado não colidirem.
  return `${prefixoLoja(lojaId)}-${id8}-${hash4(`${lojaId}|${produtoId}|${rotulo}`)}`
}

/** Normaliza o que o leitor mandou: espaço em volta, caixa, aspas do scanner. */
export function normalizarCodigo(bruto) {
  return String(bruto ?? '').trim().replace(/\s+/g, '').toUpperCase()
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
        codigo: codigoDaVariacao(lojaId, produto.id, rotulo),
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
 * `{ nome, variacao, obs, quantidade }`. Bipar duas vezes a mesma peça soma
 * quantidade em vez de criar linha repetida — é o comportamento esperado de
 * quem passa três peças iguais no leitor.
 *
 * Devolve uma lista NOVA; não muta a recebida.
 */
export function adicionarAoCarrinho(itens, { nome, variacao }) {
  const lista = Array.isArray(itens) ? itens : []
  const mesma = p => p.nome === nome && (p.variacao ?? null) === (variacao ?? null)
  const i = lista.findIndex(mesma)
  if (i === -1) return [...lista, { nome, variacao, obs: '', quantidade: 1 }]
  return lista.map((p, j) => (j === i ? { ...p, quantidade: (p.quantidade || 1) + 1 } : p))
}
