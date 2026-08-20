// Nome de cor (texto livre da lojista) → hex, para a bolinha de cor do catálogo.
//
// O banco só guarda o NOME da variação (lf_produtos.variacoes[].cor: "AZUL",
// "ROSA PINK", "OFF/ FLOR LARANJA"). A spec do catálogo pede `cores[] = {nome, hex}`,
// então o hex precisa ser derivado do nome — não existe campo de cor no cadastro.
//
// Calibrado contra os 35 nomes distintos usados pela tropicaleatacado (única
// loja com produtos publicados no catálogo hoje) e ampliado para as cores
// comuns em catálogo de roupa em português.
//
// Regra de casamento: vence o nome de cor que aparece MAIS CEDO no texto; em
// empate, o mais específico (frase mais longa). É o que a lojista quer dizer:
// em "BEGE C/ AZUL" a peça é bege com detalhe azul, em "BORBOLETA LARANJA" o
// desenho é borboleta e a cor é laranja.

/** Cinza neutro para nome que não casa com nenhuma cor conhecida. */
export const HEX_FALLBACK = '#B7B2A6'

/**
 * Frases → hex. Frases compostas convivem com a base ("rosa pink" e "rosa"):
 * o desempate por comprimento garante que a composta ganhe.
 */
export const CORES_CONHECIDAS = {
  // neutros
  'preto': '#1A1A1A',
  'preta': '#1A1A1A',
  'branco': '#FFFFFF',
  'branca': '#FFFFFF',
  'off white': '#F2EDE3',
  'off': '#F2EDE3',
  'creme': '#F0E6D2',
  'marfim': '#F5F0E1',
  'cinza': '#9AA0A6',
  'grafite': '#4A4F55',
  'prata': '#C0C0C0',
  'dourado': '#C9A227',

  // terrosos
  'bege claro': '#E6D9C0',
  'bege escuro': '#C4AC85',
  'bege': '#D9C7A9',
  'nude': '#DFC3AC',
  'areia': '#DCCBA8',
  'caramelo': '#B5762F',
  'marrom cafe': '#4B3226',
  'marrom': '#6B4423',
  'cafe': '#4B3226',
  'chocolate': '#4B3226',
  'terracota': '#B85C38',
  'terra cota': '#B85C38',

  // vermelhos / vinhos
  'vermelho': '#C62828',
  'vermelha': '#C62828',
  'vinho': '#6E1A2B',
  'bordo': '#6E1A2B',
  'marsala': '#7B2E3A',
  'marsalla': '#7B2E3A',
  'coral': '#F4613A',
  'salmao': '#F08A7A',

  // rosas
  'rosa pink': '#E8317B',
  'pink': '#E8317B',
  'rosa bebe': '#F7C8DA',
  'rosa baby': '#F7C8DA',
  'rosa bb': '#F7C8DA',
  'rosa': '#F49FC0',
  'rose': '#C98B8B',

  // laranjas / amarelos
  'laranja': '#F07622',
  'mostarda': '#D6A419',
  'amarelo': '#F2C230',
  'amarela': '#F2C230',

  // verdes
  'verde militar': '#4B5320',
  'verde musgo': '#5A6B3B',
  'verde oliva': '#6B7A3A',
  'oliva': '#6B7A3A',
  'verde': '#2E9E5B',
  'turquesa': '#1FBFB8',

  // azuis
  'azul marinho': '#1B2A5B',
  'azul royal': '#1F4FCC',
  'azul piscina': '#4FC3E8',
  'azul petroleo': '#12626B',
  'azul escuro': '#16336B',
  'azul bebe': '#A9D2F0',
  'azul bb': '#A9D2F0',
  'azul claro': '#8EC5F0',
  'azul': '#2563C9',

  // roxos
  'lilas': '#B79CE0',
  'lavanda': '#C3B1E1',
  'roxo': '#6B3FA0',
  'uva': '#5B2A63',
  'acai': '#4A2358',
}

/** "ROSA BEBÊ" → "rosa bebe"; separadores viram espaço para casar por palavra. */
export function normalizarNomeCor(nome) {
  return String(nome ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Hex da cor a partir do nome livre.
 * @returns {{hex:string, exato:boolean}} `exato:false` quando caiu no fallback.
 */
export function corParaHex(nome) {
  const texto = normalizarNomeCor(nome)
  if (!texto) return { hex: HEX_FALLBACK, exato: false }

  const alvo = ` ${texto} `
  let melhor = null

  for (const [frase, hex] of Object.entries(CORES_CONHECIDAS)) {
    // Casamento por palavra inteira: evita "rose" casar dentro de "rosewood"
    // e "off" casar dentro de "coffee".
    const pos = alvo.indexOf(` ${frase} `)
    if (pos === -1) continue
    if (!melhor || pos < melhor.pos || (pos === melhor.pos && frase.length > melhor.frase.length)) {
      melhor = { pos, frase, hex }
    }
  }

  return melhor ? { hex: melhor.hex, exato: true } : { hex: HEX_FALLBACK, exato: false }
}

/**
 * variacoes do banco → `cores[]` da spec.
 * Nome preservado exatamente como a lojista cadastrou (é o que ela reconhece
 * no pedido do WhatsApp); só o hex é derivado.
 *
 * @param {Array<{cor?:string,tamanho?:string,quantidade?:number}>} variacoes
 * @returns {Array<{nome:string, hex:string, exato:boolean}>}
 */
export function coresDeVariacoes(variacoes) {
  const vistas = new Set()
  const cores = []
  for (const v of variacoes || []) {
    const nome = v?.cor ?? v?.tamanho
    if (nome == null || nome === '') continue
    const chave = normalizarNomeCor(nome)
    if (vistas.has(chave)) continue
    vistas.add(chave)
    cores.push({ nome: String(nome), ...corParaHex(nome) })
  }
  return cores
}
