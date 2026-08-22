// Quantas etiquetas de cada variação vão para a folha.
//
// Mora fora do componente por dois motivos: é a regra que decide o que a
// impressora cospe (errar aqui custa rolo térmico e tempo da lojista), e o
// ambiente de teste do repo é 'node' sem jsdom — dentro do componente só dava
// para conferir o estado inicial, nunca a troca de modo.

/** Os três modos, mutuamente exclusivos. */
export const MODOS = ['uma', 'estoque', 'personalizada']

/** Como cada modo se chama no subtítulo e no seletor do rodapé. */
export const ROTULO_MODO = {
  uma: 'uma por variação',
  estoque: 'uma por peça em estoque',
  personalizada: 'quantidade personalizada',
}

/**
 * Teto por variação.
 *
 * 999 não é limitação técnica, é freio contra dedo escorregado: quem digita
 * 10000 por engano manda dez mil etiquetas para a impressora térmica e só
 * percebe quando o rolo acaba. Nenhuma grade real precisa de mais que isso
 * numa tacada.
 */
export const QTD_MAX = 999

/**
 * Sanitiza o que veio do input.
 *
 * O campo é type=number, mas o usuário consegue deixar vazio, colar texto ou
 * digitar '2,5' — tudo isso chega como string. Vazio e lixo viram 0 de
 * propósito: 0 é um valor legítimo aqui (pular a variação), então não há
 * ambiguidade em cair nele.
 */
export function normalizarQtd(bruto) {
  const n = Math.floor(Number(bruto))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(QTD_MAX, n))
}

/**
 * Quantas cópias desta variação, conforme o modo em vigor.
 *
 * 'estoque' tem piso 1: uma variação zerada ainda é uma peça que pode chegar,
 * e imprimir zero etiqueta de um item que a lojista selecionou seria
 * surpresa silenciosa. Em 'personalizada' o piso é 0 justamente porque ali o
 * zero foi digitado de propósito.
 */
export function copiasDe(et, modo, qtdPorVariacao = {}) {
  if (modo === 'estoque') return Math.max(1, Number(et?.quantidade) || 1)
  if (modo === 'personalizada') {
    const bruto = qtdPorVariacao[et?.codigo]
    return normalizarQtd(bruto === undefined || bruto === null ? 1 : bruto)
  }
  return 1
}

/**
 * A lista final que vai para a folha, já com as cópias repetidas.
 *
 * `_k` é a key do React; precisa ser estável e única por cópia, por isso
 * código + índice.
 */
export function expandirEtiquetas(etiquetas = [], modo = 'uma', qtdPorVariacao = {}) {
  return etiquetas.flatMap(et => {
    const n = copiasDe(et, modo, qtdPorVariacao)
    return Array.from({ length: n }, (_, i) => ({ ...et, _k: `${et.codigo}-${i}` }))
  })
}

/**
 * Estado de quantidades ao ENTRAR num modo.
 *
 * Trocar de modo sempre parte do zero: entrar em 'personalizada' semeia 1 para
 * cada variação, qualquer outro modo devolve mapa vazio. Sem isso, mexer nas
 * quantidades, voltar para "1 por variação" e retornar traria os números
 * antigos de volta em silêncio — e a lojista imprimiria uma quantidade que não
 * pediu nesta sessão.
 */
export function qtdsIniciais(etiquetas = [], modo = 'uma') {
  if (modo !== 'personalizada') return {}
  return Object.fromEntries(etiquetas.map(et => [et.codigo, 1]))
}
