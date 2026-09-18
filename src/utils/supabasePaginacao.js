// PostgREST (a API que o supabase-js chama) tem um limite padrão de linhas
// por resposta — max-rows, geralmente 1000 — que corta qualquer `.select()`
// SILENCIOSAMENTE quando a tabela tem mais linhas que isso: não vem erro,
// não vem aviso, o array simplesmente chega incompleto. Numa loja de alto
// volume (auditado em produção: audazwear tinha 3595 linhas em lf_vendas,
// tropicaleatacado 1115 — as duas já sofrendo o corte antes desta correção),
// isso derruba silenciosamente totais, contagens e médias que dependem do
// histórico completo.
//
// buscarTodasAsLinhas() pagina com `.range()` em lotes, unindo tudo antes de
// devolver — então qualquer código que já fazia `.select('*')` esperando a
// tabela inteira continua funcionando do mesmo jeito, só que sem o limite.

/**
 * Busca TODAS as linhas de uma consulta, paginando com `.range()` em lotes
 * de `tamanhoPagina`, para nunca cair no limite de max-rows do PostgREST.
 *
 * @param {(from: number, to: number) => PromiseLike<{data: any[]|null, error: any}>} construirPagina
 *   Função que devolve uma NOVA consulta com `.range(from, to)` já aplicado,
 *   a cada chamada — o query builder do supabase-js é de uso único, não dá
 *   para reexecutar o mesmo objeto com um range diferente.
 * @param {number} [tamanhoPagina] tamanho de cada lote — 1000 por padrão,
 *   o mesmo valor do max-rows default do PostgREST, então cada página já
 *   bate o teto sozinha e o loop para assim que uma página vier mais curta.
 * @returns {Promise<{data: any[]|null, error: any}>}
 */
export async function buscarTodasAsLinhas(construirPagina, tamanhoPagina = 1000) {
  const linhas = []
  let from = 0
  let tamanhoDaUltimaPagina
  do {
    const { data, error } = await construirPagina(from, from + tamanhoPagina - 1)
    if (error) return { data: null, error }
    const pagina = data || []
    linhas.push(...pagina)
    tamanhoDaUltimaPagina = pagina.length
    from += tamanhoPagina
    // Página mais curta que o lote = era a última. Cobre também o caso de
    // pagina.length === tamanhoPagina exato: aí faz UMA chamada extra que
    // volta vazia, custo baixo e sem risco de parar cedo por coincidência.
  } while (tamanhoDaUltimaPagina === tamanhoPagina)
  return { data: linhas, error: null }
}
