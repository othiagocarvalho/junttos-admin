export function calcularProgressoMetaProduto(vendas, produtosData, metaProduto) {
  if (!metaProduto) return { realizado: 0, pct: 0, atingida: false, faltam: 0 }

  const [y, m] = metaProduto.mes.split('-').map(Number)
  const vendasMes = vendas.filter(v => {
    const d = new Date(v.data)
    return d.getFullYear() === y && d.getMonth() + 1 === m
  })

  const precoMap = {}
  const catMap   = {}
  produtosData.forEach(p => {
    precoMap[p.nome] = Number(p.preco_venda || 0)
    catMap[p.nome]   = p.categoria || 'Outros'
  })

  let realizado = 0
  vendasMes.forEach(v => {
    ;(v.produtos || []).forEach(p => {
      const pertence = metaProduto.escopo_tipo === 'produto'
        ? p.nome === metaProduto.escopo_valor
        : (catMap[p.nome] || 'Outros') === metaProduto.escopo_valor
      if (!pertence) return
      const qtd = Number(p.quantidade) || 1
      realizado += metaProduto.tipo_medicao === 'quantidade'
        ? qtd
        : qtd * (precoMap[p.nome] || 0)
    })
  })

  const meta = Number(metaProduto.valor_meta || 0)
  const pct  = meta > 0 ? (realizado / meta) * 100 : 0
  const atingida = meta > 0 && realizado >= meta
  return { realizado, pct, atingida, faltam: Math.max(meta - realizado, 0) }
}

export function calcularPA(vendas) {
  if (!vendas.length) return 0
  const totalItens = vendas.reduce(
    (s, v) => s + (v.produtos || []).reduce((ss, p) => ss + (Number(p.quantidade) || 1), 0),
    0,
  )
  return totalItens / vendas.length
}

export function calcularProgressoMeta(vendas, meta, mes) {
  const [y, m] = mes.split('-').map(Number)
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const vendasMes = vendas.filter(v => {
    const d = new Date(v.data)
    return d.getFullYear() === y && d.getMonth() + 1 === m
  })
  const realizado = vendasMes.reduce((s, v) => s + Number(v.valor), 0)
  const diasNoMes = new Date(y, m, 0).getDate()
  const diaAtual = mes === currentYM ? now.getDate() : diasNoMes
  const diasRestantes = Math.max(diasNoMes - diaAtual, 0)
  const mediaDiaria = diaAtual > 0 ? realizado / diaAtual : 0
  const projecao = mediaDiaria * diasNoMes
  const pct = meta > 0 ? (realizado / meta) * 100 : 0
  const atingida = meta > 0 && realizado >= meta
  return { realizado, pct, atingida, faltam: Math.max(meta - realizado, 0), projecao, diasRestantes }
}
