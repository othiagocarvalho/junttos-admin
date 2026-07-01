export function calcularStatusReal(item, campoPagamento = 'data_pagamento') {
  if (item.status === 'pago' || item.status === 'recebido') return item.status
  if (!item.data_vencimento) return 'pendente'
  const hoje = new Date().toISOString().slice(0, 10)
  if (item.data_vencimento < hoje && !item[campoPagamento]) return 'atrasado'
  return 'pendente'
}

export function mesclarContasReceber(contasManual, crediarios) {
  const hoje = new Date().toISOString().slice(0, 10)

  const manuais = (contasManual || []).map(c => ({
    ...c,
    _status: c._status || calcularStatusReal(c, 'data_recebimento'),
    _origem: 'manual',
  }))

  const derivadas = []
  ;(crediarios || []).forEach(cr => {
    const totalParcelas = Number(cr.parcelas) || 1
    const pagas = Number(cr.parcelas_pagas) || 0
    const valorParcela = Number(cr.valor_parcela) || 0

    for (let i = 1; i <= totalParcelas; i++) {
      const dataBase = new Date(cr.data_compra + 'T12:00:00')
      dataBase.setMonth(dataBase.getMonth() + i)
      const vencimento = dataBase.toISOString().slice(0, 10)
      const pago = i <= pagas
      const st = pago ? 'recebido' : (vencimento < hoje ? 'atrasado' : 'pendente')

      derivadas.push({
        id: `cr_${cr.id}_p${i}`,
        _origem: 'crediario',
        crediario_id: cr.id,
        parcela_index: i,
        descricao: `${cr.cliente_nome} (${i}/${totalParcelas})`,
        cliente_nome: cr.cliente_nome,
        valor: valorParcela,
        data_vencimento: vencimento,
        data_recebimento: pago ? vencimento : null,
        status: st,
        _status: st,
      })
    }
  })

  return [...manuais, ...derivadas].sort((a, b) =>
    (a.data_vencimento || '').localeCompare(b.data_vencimento || '')
  )
}

export function agruparPorCategoria(contas) {
  const map = {}
  contas.forEach(c => {
    const cat = c.categoria || 'outros'
    if (!map[cat]) map[cat] = { categoria: cat, total: 0 }
    map[cat].total += Number(c.valor || 0)
  })
  return Object.values(map).sort((a, b) => b.total - a.total)
}

export function calcularFluxoCaixa(vendas, contasPagar, contasReceber, dataInicio, dataFim) {
  const dias = {}
  const add = (data, tipo, valor) => {
    if (!dias[data]) dias[data] = { data, entradas: 0, saidas: 0 }
    if (tipo === 'entrada') dias[data].entradas += valor
    else dias[data].saidas += valor
  }

  vendas.forEach(v => {
    const d = new Date(v.data).toISOString().slice(0, 10)
    if (d >= dataInicio && d <= dataFim) add(d, 'entrada', Number(v.valor || 0))
  })

  contasReceber.forEach(c => {
    const d = c.data_recebimento
    if (d && d >= dataInicio && d <= dataFim) add(d, 'entrada', Number(c.valor || 0))
  })

  contasPagar.forEach(c => {
    const d = c.data_pagamento
    if (d && d >= dataInicio && d <= dataFim) add(d, 'saida', Number(c.valor || 0))
  })

  let saldoAcumulado = 0
  return Object.values(dias)
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(d => {
      const saldo = d.entradas - d.saidas
      saldoAcumulado += saldo
      return { ...d, saldo, saldoAcumulado }
    })
}

export function calcularDRE(vendas, contasPagar, dataInicio, dataFim) {
  const receitaBruta = vendas
    .filter(v => {
      const d = new Date(v.data).toISOString().slice(0, 10)
      return d >= dataInicio && d <= dataFim
    })
    .reduce((s, v) => s + Number(v.valor || 0), 0)

  const despesas = contasPagar.filter(c =>
    c.status === 'pago' &&
    c.data_pagamento >= dataInicio &&
    c.data_pagamento <= dataFim
  )

  const despesasPorCategoria = agruparPorCategoria(despesas)
  const totalDespesas = despesas.reduce((s, c) => s + Number(c.valor || 0), 0)
  const resultadoLiquido = receitaBruta - totalDespesas
  const margemPercentual = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0

  return { receitaBruta, despesasPorCategoria, totalDespesas, resultadoLiquido, margemPercentual }
}

export function mesAtualRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const inicio = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const fim = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  return { inicio, fim, label: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }
}

export function navegarMes(inicio, delta) {
  const d = new Date(inicio + 'T12:00:00')
  d.setMonth(d.getMonth() + delta)
  const y = d.getFullYear()
  const m = d.getMonth()
  const novoInicio = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const novoFim = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return { inicio: novoInicio, fim: novoFim, label }
}
