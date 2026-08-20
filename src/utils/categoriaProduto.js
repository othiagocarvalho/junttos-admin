// Categoria de produto derivada do NOME, sem campo novo no banco.
//
// lf_produtos não tem coluna de categoria e não vamos criar uma: a lojista
// já escreve "Vestido floral", "Conjunto alfaiataria", "Short academia" — a
// primeira palavra significativa do nome já é a categoria na prática.
// Tudo aqui é derivado em memória, no front, e some se o nome mudar.
//
// Calibrado contra os nomes reais de hmboutique (144 produtos) e sualoja (9).

/** Tokens que não são categoria: abreviação de conjunto, kit, etc. */
const SIGLAS = new Set(['cj', 'cjt', 'conj', 'kit'])

export const CHAVE_TODOS  = '__todos'
export const CHAVE_OUTROS = '__outros'

const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Palavra que não serve como categoria: sigla conhecida, número, curta
 * demais (3 letras ou menos) ou abreviada com ponto ("CJ.", "Cj.").
 */
function ehTokenIgnoravel(palavra) {
  const limpo = semAcento(palavra).toLowerCase().replace(/[.,]/g, '')
  if (!limpo) return true
  if (SIGLAS.has(limpo)) return true
  if (/^\d+$/.test(limpo)) return true
  if (limpo.length <= 3) return true
  if (palavra.endsWith('.')) return true
  return false
}

/**
 * Plural em português para os casos que aparecem de verdade num catálogo de
 * roupa. O ingênuo (+'s') gerava "Macacãos" e "Cordãos" nos dados da
 * hmboutique — daí as regras de terminação.
 */
export function pluralizar(p) {
  if (/s$/i.test(p))    return p
  if (/ão$/i.test(p))   return p.replace(/ão$/i, 'ões')
  if (/m$/i.test(p))    return p.replace(/m$/i, 'ns')
  if (/l$/i.test(p))    return p.replace(/l$/i, 'is')
  if (/[rz]$/i.test(p)) return p + 'es'
  return p + 's'
}

/**
 * Categoria de um nome de produto.
 * @returns {{chave:string,label:string}|null} null se o nome for vazio.
 */
export function derivarCategoria(nome) {
  // Prefixo de marcação seguido de separador ("Demo - Arroz 5kg",
  // "PROMO: Vestido", "NOVO | Blusa") é etiqueta, não categoria. Sem isto,
  // os 18 produtos "Demo - ..." da mercadodemo viravam uma categoria "Demos"
  // com 72% do catálogo dentro, que não ajuda ninguém a achar nada.
  const semPrefixo = String(nome || '').trim().replace(/^\S{1,12}\s*[-–—|:]\s+/, '')
  const palavras = (semPrefixo || String(nome || '')).trim().split(/\s+/).filter(Boolean)
  if (!palavras.length) return null
  // Primeira palavra que sirva; se nenhuma servir, usa a primeira mesmo —
  // melhor uma categoria estranha do que produto sem categoria nenhuma.
  const escolhida = (palavras.find(p => !ehTokenIgnoravel(p)) || palavras[0]).replace(/[.,]/g, '')
  const base = escolhida.charAt(0).toUpperCase() + escolhida.slice(1).toLowerCase()
  const label = pluralizar(base)
  return { chave: semAcento(label).toLowerCase(), label }
}

/**
 * Monta as categorias de uma lista de nomes.
 *
 * - categoria com menos de `minPorCategoria` produtos vira "Outros", senão o
 *   filtro viraria uma lista de dezenas de categorias de 1 item
 * - ordena por quantidade (mais produtos primeiro); "Todos" abre e "Outros"
 *   fecha a faixa
 * - `exibir` é false quando a faixa não ajudaria: loja pequena ou sem pelo
 *   menos duas categorias de verdade (a sualoja, com 9 produtos, cai aqui —
 *   mostraria só "Todos / Vestidos / Outros", que é ruído)
 */
export function construirCategorias(nomes = [], {
  minPorCategoria = 2,
  minProdutos     = 12,
  minCategorias   = 2,
} = {}) {
  const porChave = new Map()
  const chaveDe  = new Map()

  for (const nome of nomes) {
    const d = derivarCategoria(nome)
    if (!d) continue
    chaveDe.set(nome, d.chave)
    if (!porChave.has(d.chave)) porChave.set(d.chave, { chave: d.chave, label: d.label, total: 0 })
    porChave.get(d.chave).total += 1
  }

  const todas   = [...porChave.values()]
  const grandes = todas.filter(c => c.total >= minPorCategoria).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'))
  const chavesGrandes = new Set(grandes.map(c => c.chave))
  const nOutros = todas.filter(c => !chavesGrandes.has(c.chave)).reduce((s, c) => s + c.total, 0)

  // Produto de categoria rara passa a responder por "Outros".
  const mapaFinal = new Map()
  for (const [nome, chave] of chaveDe) {
    mapaFinal.set(nome, chavesGrandes.has(chave) ? chave : CHAVE_OUTROS)
  }

  const categorias = [
    { chave: CHAVE_TODOS, label: 'Todos', total: nomes.length },
    ...grandes,
    ...(nOutros > 0 ? [{ chave: CHAVE_OUTROS, label: 'Outros', total: nOutros }] : []),
  ]

  return {
    categorias,
    mapa: mapaFinal,
    exibir: nomes.length >= minProdutos && grandes.length >= minCategorias,
  }
}

/** Filtra nomes pela categoria escolhida. CHAVE_TODOS devolve tudo. */
export function filtrarPorCategoria(nomes = [], chave, mapa) {
  if (!chave || chave === CHAVE_TODOS) return nomes
  return nomes.filter(n => (mapa?.get(n) || CHAVE_OUTROS) === chave)
}
