// ── Critério de estoque mínimo (Junttos Mercado · T6) ─────────
// lf_produtos ainda não tem coluna de estoque mínimo, então ele é derivado:
// um piso fixo, elevado para cobrir uma semana de venda quando o produto tem
// giro. Assim item parado não fica alarmando e item que vende rápido exige
// mais folga. Substituir por um campo real na tabela quando ele existir.
export const MINIMO_PADRAO  = 10  // unidades — piso para produto sem histórico
export const DIAS_COBERTURA = 7   // quantos dias de venda o estoque deve cobrir
export const JANELA_DIAS    = 30  // período usado para medir a média diária
export const LIMITE_CRITICO = 0.4 // abaixo de 40% do mínimo o item é crítico

export const COR_NIVEL = {
  critico: '#C4321F',
  baixo:   '#E07A0C',
  ok:      '#17864F',
}

/**
 * Estoque atual de um produto.
 * O estoque real do Mercado vive nas variações — CadastrarProduto grava
 * [{ cor: 'Único', quantidade }] e deixa a coluna `quantidade` em 0. A coluna
 * só é usada como fallback para produtos sem variação.
 */
export function estoqueAtual(produto) {
  const vars = produto?.variacoes
  if (Array.isArray(vars) && vars.length) {
    return vars.reduce((s, v) => s + (Number(v?.quantidade) || 0), 0)
  }
  return Number(produto?.quantidade) || 0
}

/**
 * Unidades vendidas por dia de cada produto na janela, indexadas por nome.
 * O PDV grava produtos como [{ nome, quantidade }] (NovaVenda.jsx:131).
 */
export function mediaDiariaPorNome(vendas, hoje = new Date()) {
  const corte = new Date(hoje)
  corte.setDate(corte.getDate() - JANELA_DIAS)

  const totais = {}
  for (const venda of vendas || []) {
    if (!venda?.data || new Date(venda.data) < corte) continue
    for (const item of (venda.produtos || [])) {
      if (!item?.nome) continue
      totais[item.nome] = (totais[item.nome] || 0) + (Number(item.quantidade) || 0)
    }
  }
  for (const nome of Object.keys(totais)) totais[nome] = totais[nome] / JANELA_DIAS
  return totais
}

/**
 * Nível de estoque de um produto: quanto tem, quanto deveria ter, e o estado.
 * @returns {{atual:number, minimo:number, razao:number, estado:'critico'|'baixo'|'ok', cor:string, pct:number}}
 */
export function nivelDoProduto(produto, mediaDiaria = 0) {
  const atual  = estoqueAtual(produto)
  const minimo = Math.max(MINIMO_PADRAO, Math.ceil((Number(mediaDiaria) || 0) * DIAS_COBERTURA))
  const razao  = minimo > 0 ? atual / minimo : 1

  const estado = razao >= 1 ? 'ok' : razao < LIMITE_CRITICO ? 'critico' : 'baixo'

  return { atual, minimo, razao, estado, cor: COR_NIVEL[estado], pct: Math.min(razao, 1) * 100 }
}
