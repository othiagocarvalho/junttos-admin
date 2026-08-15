/**
 * Normaliza texto para busca: sem acento, minúsculo, sem espaço nas pontas.
 * NFD separa a letra do acento e o replace remove os diacríticos soltos, então
 * "Saída" vira "saida" e passa a casar com o que a lojista digita sem acento.
 */
export function normalizaTexto(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Correspondência parcial, ignorando acento e caixa. Termo vazio casa com tudo,
 * para a lista voltar inteira quando o campo de busca é limpo.
 */
export function contemBusca(texto, termo) {
  const t = normalizaTexto(termo)
  if (!t) return true
  return normalizaTexto(texto).includes(t)
}
