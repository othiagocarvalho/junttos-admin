import { formasCadastradas } from './formasPagamento'

// ── Formas cadastradas no Fechamento da Moda ──────────────────
// Cada forma que a loja cadastrou em Configurações (utils/formasPagamento)
// tem campo próprio no Fechamento (LojaFeminina/Fechamento.jsx). O conta_como
// dela diz em que linha do caixa o valor soma no total:
//   lf_caixas.dinheiro/pix/debito/credito = forma padrão + cadastradas da linha
//   lf_caixas.formas_extras               = [{ nome, conta_como, valor }]
// Assim total continua sendo a soma das quatro colunas, como sempre foi, e
// formas_extras é só o detalhe para o fechamento salvo mostrar cada forma.

/** Coluna de lf_caixas de cada conta_como. 'nenhum' não tem: fica fora do total. */
export const LINHA_DO_CONTA_COMO = {
  Dinheiro: 'dinheiro',
  Pix: 'pix',
  'Cartão de Débito': 'debito',
  'Cartão de Crédito': 'credito',
}

export const LINHAS = ['dinheiro', 'pix', 'debito', 'credito']

export const ROTULO_LINHA = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito' }

export const arred2 = v => Math.round((Number(v) || 0) * 100) / 100

/** Chave do campo de uma forma cadastrada no estado do formulário. */
export const chaveCampoForma = nome => `fp:${nome}`

/**
 * Campos de forma cadastrada que o fechamento mostra: todas as ativas, mais
 * as removidas que ainda tiveram venda no dia (senão o valor sumiria da
 * tela). Na ordem do cadastro.
 * @returns {{nome, conta_como, chave}[]}
 */
export function camposFormasCadastradas(config, porForma = {}) {
  return formasCadastradas(config)
    .filter(f => f.ativo || (porForma[f.nome] || 0) >= 0.01)
    .map(f => ({ nome: f.nome, conta_como: f.conta_como, chave: chaveCampoForma(f.nome) }))
}

/**
 * Campos de forma cadastrada de um fechamento JÁ SALVO, lidos do próprio
 * registro (lf_caixas.formas_extras) — o cadastro da loja pode ter mudado
 * depois. Registro antigo ou sem a coluna → nenhum campo extra.
 * @returns {{nome, conta_como, chave, valor}[]}
 */
export function camposDoFechamentoSalvo(fechamentoSalvo) {
  const bruto = fechamentoSalvo?.formas_extras
  if (!Array.isArray(bruto)) return []
  return bruto
    .filter(f => f && String(f.nome || '').trim())
    .map(f => {
      const nome = String(f.nome).trim()
      const conta_como = LINHA_DO_CONTA_COMO[f.conta_como] ? f.conta_como : 'nenhum'
      return { nome, conta_como, chave: chaveCampoForma(nome), valor: Number(f.valor) || 0 }
    })
}

/**
 * Total de cada linha do caixa: o campo da forma padrão + os campos das
 * formas cadastradas que somam nela. `valorDe(chave)` lê o número de um campo.
 */
export function totaisPorLinha(campos, valorDe) {
  const t = {}
  for (const linha of LINHAS) t[linha] = valorDe(linha)
  for (const c of campos || []) {
    const linha = LINHA_DO_CONTA_COMO[c.conta_como]
    if (linha) t[linha] += valorDe(c.chave)
  }
  for (const linha of LINHAS) t[linha] = arred2(t[linha])
  return t
}

/**
 * O que cada campo mostra de um fechamento salvo. `valores` são as colunas
 * do registro (total da linha); o campo da forma padrão mostra só a parte
 * dela, e cada forma salva em formas_extras ganha o próprio valor.
 */
export function separarFormasDoSalvo(valores, fechamentoSalvo) {
  if (!valores) return null
  const v = { ...valores }
  for (const c of camposDoFechamentoSalvo(fechamentoSalvo)) {
    v[c.chave] = c.valor
    const linha = LINHA_DO_CONTA_COMO[c.conta_como]
    if (linha) v[linha] = arred2((Number(v[linha]) || 0) - c.valor)
  }
  return v
}
