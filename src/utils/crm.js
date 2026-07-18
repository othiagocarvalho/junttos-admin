// Pure CRM utilities — no side effects, safe to test with Vitest

// Normalizes a Brazilian phone number to wa.me format (digits only, with DDI 55).
export function normalizeWaPhone(tel) {
  if (!tel) return null
  const digits = tel.replace(/\D/g, '')
  if (!digits) return null
  // Already has country code (12–13 digits starting with 55)
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return '55' + digits
}

// Returns the number of days since the client's most recent purchase, or null if none.
export function diasDesdeUltima(vendas, nomeCliente, hoje = new Date().toISOString().slice(0, 10)) {
  const norm = s => (s || '').trim().toLowerCase()
  const vendasC = vendas.filter(v => norm(v.cliente_nome) === norm(nomeCliente))
  if (vendasC.length === 0) return null
  const ultima = vendasC.reduce((max, v) => {
    const d = (v.data || '').slice(0, 10)
    return d > max ? d : max
  }, '0000-00-00')
  const ms = new Date(hoje + 'T12:00:00') - new Date(ultima + 'T12:00:00')
  return Math.max(0, Math.floor(ms / 86400000))
}

// Returns true if the client has no purchase in the last diasLimite days.
export function isInativo(vendas, nomeCliente, hoje = new Date().toISOString().slice(0, 10), diasLimite = 45) {
  const dias = diasDesdeUltima(vendas, nomeCliente, hoje)
  if (dias === null) return false
  return dias >= diasLimite
}

// Ticket médio da loja no mês corrente (reuses same logic as Início card).
export function ticketMedioLoja(vendas, hoje = new Date().toISOString().slice(0, 10)) {
  const [ano, mes] = hoje.split('-').map(Number)
  const vendasMes = vendas.filter(v => {
    if (!v.data) return false
    const d = new Date(v.data.slice(0, 10) + 'T12:00:00')
    return d.getFullYear() === ano && d.getMonth() + 1 === mes
  })
  if (vendasMes.length === 0) return 0
  return vendasMes.reduce((s, v) => s + Number(v.valor || 0), 0) / vendasMes.length
}

// Returns true if client's total spending >= 10× store ticket médio.
export function isVip(totalGasto, ticketMedio) {
  if (!ticketMedio || ticketMedio <= 0) return false
  return totalGasto >= 10 * ticketMedio
}

// Returns 'hoje' if birthday is today, 'mes' if in current month, null otherwise.
export function badgeAniversario(dataNascimento, hoje = new Date().toISOString().slice(0, 10)) {
  if (!dataNascimento) return null
  const parts = dataNascimento.split('-')
  if (parts.length < 3) return null
  const [, mesNasc, diaNasc] = parts
  const [, mesHoje, diaHoje] = hoje.split('-')
  if (mesNasc !== mesHoje) return null
  return diaNasc === diaHoje ? 'hoje' : 'mes'
}

// Returns the most frequently purchased variacao (size label) for the client, or null.
export function tamanhoPreferido(vendas, nomeCliente) {
  const norm = s => (s || '').trim().toLowerCase()
  const vendasC = vendas.filter(v => norm(v.cliente_nome) === norm(nomeCliente))
  const freq = {}
  vendasC.forEach(v => {
    ;(v.produtos || []).forEach(p => {
      const va = p.variacao
      if (va && va !== 'Único') freq[va] = (freq[va] || 0) + (Number(p.quantidade) || 1)
    })
  })
  const entries = Object.entries(freq)
  if (entries.length === 0) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

// Returns the most frequently purchased product category for the client, or null.
export function categoriaFavorita(vendas, nomeCliente, produtosData) {
  const norm = s => (s || '').trim().toLowerCase()
  const vendasC = vendas.filter(v => norm(v.cliente_nome) === norm(nomeCliente))
  const freq = {}
  vendasC.forEach(v => {
    ;(v.produtos || []).forEach(p => {
      const prod = (produtosData || []).find(pd => norm(pd.nome) === norm(p.nome))
      const cat = prod?.categoria
      if (cat && cat !== 'Outros') freq[cat] = (freq[cat] || 0) + (Number(p.quantidade) || 1)
    })
  })
  const entries = Object.entries(freq)
  if (entries.length === 0) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

// Ticket médio do cliente: total spent / number of purchases.
export function ticketMedioCliente(vendas, nomeCliente) {
  const norm = s => (s || '').trim().toLowerCase()
  const vendasC = vendas.filter(v => norm(v.cliente_nome) === norm(nomeCliente))
  if (vendasC.length === 0) return 0
  const total = vendasC.reduce((s, v) => s + Number(v.valor || 0), 0)
  return total / vendasC.length
}

// Returns days until next birthday (0 = today, >0 = upcoming), or null.
export function diasParaAniversario(dataNascimento, hoje = new Date().toISOString().slice(0, 10)) {
  if (!dataNascimento) return null
  const parts = dataNascimento.split('-')
  if (parts.length < 3) return null
  const [, mes, dia] = parts
  const [anoHoje] = hoje.split('-')
  const hojeDate = new Date(hoje + 'T12:00:00')
  let anivDate = new Date(`${anoHoje}-${mes}-${dia}T12:00:00`)
  if (anivDate < hojeDate) {
    anivDate = new Date(`${Number(anoHoje) + 1}-${mes}-${dia}T12:00:00`)
  }
  return Math.round((anivDate - hojeDate) / 86400000)
}

// Generates automatic follow-up suggestions for all clients.
// Each item: { id, tipo:'auto', subtipo:'aniversario'|'inativo'|'vip', cliente_nome, cliente_telefone, nota, data, data_referencia }
export function gerarSugestoesAuto(clientes, vendas, hoje = new Date().toISOString().slice(0, 10)) {
  const norm = s => (s || '').trim().toLowerCase()
  const ticket = ticketMedioLoja(vendas, hoje)
  const [anoHoje, mesHoje] = hoje.split('-')
  const sugestoes = []

  ;(clientes || []).forEach(c => {
    const vendasC = (vendas || []).filter(v => norm(v.cliente_nome) === norm(c.nome))
    const totalGasto = vendasC.reduce((s, v) => s + Number(v.valor || 0), 0)
    const vip = isVip(totalGasto, ticket)
    const dias = diasDesdeUltima(vendas, c.nome, hoje)

    // Birthday within next 7 days (0 = today)
    const diasAniv = diasParaAniversario(c.data_nascimento, hoje)
    if (diasAniv !== null && diasAniv >= 0 && diasAniv <= 7) {
      const [, mesNasc, diaNasc] = c.data_nascimento.split('-')
      const dataAnivEsteAno = `${anoHoje}-${mesNasc}-${diaNasc}`
      sugestoes.push({
        id: `auto_aniv_${norm(c.nome)}_${dataAnivEsteAno}`,
        tipo: 'auto',
        subtipo: 'aniversario',
        cliente_nome: c.nome,
        cliente_telefone: c.telefone || null,
        nota: diasAniv === 0 ? 'Aniversário hoje!' : `Aniversário em ${diasAniv} dia${diasAniv !== 1 ? 's' : ''}`,
        data: dataAnivEsteAno,
        data_referencia: dataAnivEsteAno,
      })
    }

    // VIP: no purchase in 30+ days
    if (vip && dias !== null && dias >= 30) {
      const dataRefVip = `${anoHoje}-${mesHoje}-01`
      sugestoes.push({
        id: `auto_vip_${norm(c.nome)}_${dataRefVip}`,
        tipo: 'auto',
        subtipo: 'vip',
        cliente_nome: c.nome,
        cliente_telefone: c.telefone || null,
        nota: `Cliente VIP — ${dias} dias sem visita`,
        data: hoje,
        data_referencia: dataRefVip,
      })
    }

    // Non-VIP inactive 45+ days
    if (!vip && dias !== null && dias >= 45) {
      const ultimaData = vendasC.reduce((max, v) => {
        const d = (v.data || '').slice(0, 10)
        return d > max ? d : max
      }, '0000-00-00')
      sugestoes.push({
        id: `auto_inativo_${norm(c.nome)}_${ultimaData}`,
        tipo: 'auto',
        subtipo: 'inativo',
        cliente_nome: c.nome,
        cliente_telefone: c.telefone || null,
        nota: `Sem compras há ${dias} dias`,
        data: hoje,
        data_referencia: ultimaData,
      })
    }
  })

  return sugestoes
}

// Returns true if a specific auto suggestion occurrence has been dismissed.
export function isDispensado(dispensados, clienteNome, tipo, dataReferencia) {
  const norm = s => (s || '').trim().toLowerCase()
  return (dispensados || []).some(d =>
    norm(d.cliente_nome) === norm(clienteNome) &&
    d.tipo === tipo &&
    (d.data_referencia || '').slice(0, 10) === (dataReferencia || '').slice(0, 10)
  )
}

// Combines auto suggestions + active manual reminders into a sorted feed.
// Items with data <= hoje appear first (sorted asc), then upcoming (sorted asc).
export function combinarFeed(sugestoesAuto, lembretes, dispensados, hoje = new Date().toISOString().slice(0, 10)) {
  const autoAtivas = (sugestoesAuto || []).filter(s =>
    !isDispensado(dispensados, s.cliente_nome, s.subtipo, s.data_referencia)
  )

  const lembretesAtivos = (lembretes || [])
    .filter(l => !l.concluido)
    .map(l => ({
      id: `lembrete_${l.id}`,
      tipo: 'lembrete',
      subtipo: null,
      cliente_nome: l.cliente_nome,
      cliente_telefone: null,
      nota: l.nota || '',
      data: (l.data_lembrete || '').slice(0, 10),
      data_referencia: null,
      lembrete_id: l.id,
    }))

  const todos = [...autoAtivas, ...lembretesAtivos]
  todos.sort((a, b) => {
    const aHoje = a.data <= hoje
    const bHoje = b.data <= hoje
    if (aHoje && !bHoje) return -1
    if (!aHoje && bHoje) return 1
    return a.data.localeCompare(b.data)
  })
  return todos
}
