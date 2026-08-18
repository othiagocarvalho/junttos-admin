// Cálculos do relatório de vendas por período.
//
// Funções puras, sem React e sem Supabase: é a mesma conta que aparece na tela
// do lojista e precisa ser testável sozinha.
//
// Nasceu para o Relatórios do Mercado. A Moda (LojaFeminina/Relatorios.jsx e
// cliente/RelatoriosDesktop.jsx) faz as mesmas contas inline — não foram
// migradas junto de propósito: são telas em produção e a troca não tem
// benefício imediato que justifique o risco. Quando alguém for mexer nelas,
// é daqui que devem passar a ler.

import { parsePgtosRecibo } from './recibo'

/**
 * Vendas dentro do intervalo, inclusive nas duas pontas.
 *
 * `de`/`ate` são 'YYYY-MM-DD' vindos de <input type="date">. O dia final entra
 * até 23:59:59 — sem isso, filtrar "hoje até hoje" devolvia zero vendas,
 * porque toda venda tem hora e ficava depois da meia-noite do limite.
 *
 * Intervalo incompleto devolve [] em vez da lista inteira: relatório sem
 * período escolhido não deve mostrar um total que ninguém pediu.
 */
export function filtrarPorPeriodo(vendas = [], de, ate) {
  if (!de || !ate) return []
  const inicio = new Date(`${de}T00:00:00`)
  const fim    = new Date(`${ate}T23:59:59`)
  return vendas.filter(v => {
    const d = new Date(v.data)
    return d >= inicio && d <= fim
  })
}

/** Faturamento, número de vendas, ticket médio e itens do período. */
export function totaisDoPeriodo(vendas = []) {
  const total = vendas.reduce((s, v) => s + (Number(v.valor) || 0), 0)
  const quantidade = vendas.length
  const itens = vendas.reduce(
    (s, v) => s + (v.produtos || []).reduce((n, p) => n + (Number(p.quantidade) || 1), 0),
    0,
  )
  return {
    total:       arredonda(total),
    quantidade,
    ticketMedio: quantidade > 0 ? arredonda(total / quantidade) : 0,
    itens,
  }
}

/**
 * Quanto entrou por forma de pagamento, da maior para a menor.
 *
 * Lê forma_pgto pelo parse compartilhado (utils/recibo), que aceita tanto o
 * JSON novo `[{forma, valor}]` quanto a string solta das vendas antigas.
 * Não assume a lista de formas: o Mercado usa Dinheiro/Pix/Cartão/Fiado e a
 * Moda usa outras quatro — aqui sai o que estiver gravado.
 */
export function porFormaPgto(vendas = []) {
  const mapa = {}
  for (const v of vendas) {
    for (const p of parsePgtosRecibo(v)) {
      const forma = p.forma || 'Não informado'
      mapa[forma] = (mapa[forma] || 0) + (Number(p.valor) || 0)
    }
  }
  const total = Object.values(mapa).reduce((s, n) => s + n, 0)
  return Object.entries(mapa)
    .map(([forma, valor]) => ({
      forma,
      valor: arredonda(valor),
      pct: total > 0 ? arredonda((valor / total) * 100) : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
}

/** Faturamento por dia, em ordem cronológica — base do gráfico de barras. */
export function porDia(vendas = []) {
  const mapa = {}
  for (const v of vendas) {
    const d = new Date(v.data)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!mapa[chave]) {
      mapa[chave] = {
        chave,
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        total: 0,
      }
    }
    mapa[chave].total += Number(v.valor) || 0
  }
  return Object.values(mapa)
    .map(d => ({ ...d, total: arredonda(d.total) }))
    .sort((a, b) => a.chave.localeCompare(b.chave))
}

function arredonda(v) {
  return Math.round(v * 100) / 100
}
