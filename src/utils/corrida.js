import { calcularPA } from './metas.js'

export function calcularRankingCorrida(vendas, corrida) {
  const { data_inicio, data_fim, tipo_medicao, produto_alvo } = corrida
  const di = new Date(data_inicio + 'T00:00:00')
  const df = new Date(data_fim + 'T23:59:59')

  const vendasPeriodo = vendas.filter(v => {
    if (!v.vendedora) return false
    const d = new Date(v.data)
    return d >= di && d <= df
  })

  const vendedoras = [...new Set(vendasPeriodo.map(v => v.vendedora))]

  const rows = vendedoras.map(nome => {
    const vendasVend = vendasPeriodo.filter(v => v.vendedora === nome)
    let valor = 0

    if (tipo_medicao === 'faturamento') {
      valor = vendasVend.reduce((s, v) => s + Number(v.valor), 0)
    } else if (tipo_medicao === 'ticket_medio') {
      const total = vendasVend.reduce((s, v) => s + Number(v.valor), 0)
      valor = vendasVend.length > 0 ? total / vendasVend.length : 0
    } else if (tipo_medicao === 'pa') {
      valor = calcularPA(vendasVend)
    } else if (tipo_medicao === 'quantidade_produto') {
      vendasVend.forEach(v => {
        ;(v.produtos || []).forEach(p => {
          if (p.nome === produto_alvo) valor += Number(p.quantidade) || 1
        })
      })
    }

    return { vendedora: nome, valor, numVendas: vendasVend.length }
  })

  // quantidade_produto: exclui vendedoras com 0 unidades do produto alvo
  return rows
    .filter(r => tipo_medicao !== 'quantidade_produto' || r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .map((r, i) => ({ ...r, posicao: i + 1 }))
}

// Positivo = dias restantes, 0 = último dia, negativo = encerrada
export function diasRestantesCorrida(corrida) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fim = new Date(corrida.data_fim + 'T00:00:00')
  return Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24))
}
