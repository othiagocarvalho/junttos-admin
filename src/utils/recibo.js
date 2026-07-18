function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

export function parsePgtosRecibo(venda) {
  try { const arr = JSON.parse(venda.forma_pgto); if (Array.isArray(arr)) return arr } catch {}
  return venda.forma_pgto ? [{ forma: venda.forma_pgto, valor: Number(venda.valor) }] : []
}

export function numeracaoRecibo(vendas, vendaId) {
  const sorted = [...vendas].sort((a, b) => new Date(a.data) - new Date(b.data))
  const idx = sorted.findIndex(v => v.id === vendaId)
  return idx === -1 ? null : idx + 1
}

export function formatarReciboTexto(venda, nomeFantasia, numero) {
  const pgtos = parsePgtosRecibo(venda)
  const isTroca = venda.tipo_venda === 'troca'
  const d = new Date(venda.data)
  const dataStr = d.toLocaleDateString('pt-BR') + ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const L = []
  L.push(nomeFantasia || 'Loja')
  L.push(isTroca ? 'Recibo de Troca' : 'Recibo de Venda')
  if (numero) L.push(`N° ${String(numero).padStart(4, '0')}`)
  L.push(dataStr)
  L.push('---')
  if (venda.cliente_nome) L.push(`Cliente: ${venda.cliente_nome}`)
  if (venda.vendedora) L.push(`Vendedor(a): ${venda.vendedora}`)
  if (venda.cliente_nome || venda.vendedora) L.push('---')
  ;(venda.produtos || []).forEach(p => {
    const qtd = p.quantidade || 1
    const nome = p.variacao ? `${p.nome} (${p.variacao})` : p.nome
    L.push(`${qtd}x ${nome}`)
  })
  L.push('---')
  L.push(`TOTAL: ${fmtR(venda.valor)}`)
  L.push('')
  pgtos.forEach(p => L.push(`• ${p.forma}: ${fmtR(p.valor)}`))
  if (venda.obs) { L.push(''); L.push(`Obs: ${venda.obs}`) }
  L.push('')
  L.push('Documento sem valor fiscal')
  return L.join('\n')
}
