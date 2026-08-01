// ── Faixas de validade (Junttos Mercado · T7) ─────────────────
// A data é por produto (lf_produtos.data_vencimento), não por lote.
// Produto sem data, ou vencendo depois de DIAS_ATENCAO, não entra na tela.
export const DIAS_URGENTE = 3  // até 3 dias corridos (inclui já vencido)
export const DIAS_ATENCAO = 9  // de 4 a 9 dias

export const COR_VALIDADE = {
  urgente: '#C4321F',
  atencao: '#E07A0C',
}

// Compartilhado com a tela de Fiado — a regra de não deixar o fuso mudar o dia
// vale para as duas. Reexportado para não quebrar quem já importava daqui.
export { paraDataLocal } from './datas'
import { paraDataLocal } from './datas'

/** Dias corridos até vencer: 0 = hoje, negativo = já vencido, null = sem data. */
export function diasAteVencimento(dataVenc, hoje = new Date()) {
  const d = paraDataLocal(dataVenc)
  if (!d) return null
  const alvo = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((alvo - base) / 86400000)
}

/** 'urgente' | 'atencao' | null (null = não aparece na tela). */
export function estadoValidade(dias) {
  if (dias === null || dias === undefined) return null
  if (dias <= DIAS_URGENTE) return 'urgente'
  if (dias <= DIAS_ATENCAO) return 'atencao'
  return null
}

/** Texto da linha de status do item. */
export function textoVencimento(dias) {
  if (dias === null || dias === undefined) return ''
  if (dias === 0)  return 'Vence HOJE'
  if (dias === 1)  return 'Vence amanhã'
  if (dias === -1) return 'Vencido ontem'
  if (dias < -1)   return `Vencido há ${Math.abs(dias)} dias`
  return `Vence em ${dias} dias`
}

/** Partes do bloco de data: { dia: '28', mes: 'JUL' }. */
export function blocoData(dataVenc) {
  const d = paraDataLocal(dataVenc)
  if (!d) return null
  return {
    dia: String(d.getDate()).padStart(2, '0'),
    mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
  }
}

/**
 * Separa os produtos nas duas seções da tela, cada uma ordenada do que vence
 * primeiro para o que vence depois.
 * @returns {{urgente: Array, atencao: Array}} itens { produto, dias, estado, cor, texto, bloco }
 */
export function agruparPorValidade(produtos, hoje = new Date()) {
  const urgente = []
  const atencao = []

  for (const produto of produtos || []) {
    if (produto?.ativo === false) continue
    const dias = diasAteVencimento(produto?.data_vencimento, hoje)
    const estado = estadoValidade(dias)
    if (!estado) continue

    const item = {
      produto,
      dias,
      estado,
      cor:   COR_VALIDADE[estado],
      texto: textoVencimento(dias),
      bloco: blocoData(produto.data_vencimento),
    }
    ;(estado === 'urgente' ? urgente : atencao).push(item)
  }

  const porData = (a, b) => a.dias - b.dias
  return { urgente: urgente.sort(porData), atencao: atencao.sort(porData) }
}
