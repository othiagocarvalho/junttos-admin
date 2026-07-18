export const FREQ_LABEL = { semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' }

// Avança uma data em uma ocorrência da frequência dada.
// dataInicio (string 'YYYY-MM-DD') é usado para fixar o dia-do-mês no modo mensal.
export function avancarOcorrencia(data, frequencia, dataInicio) {
  const d = data instanceof Date ? new Date(data) : new Date(data + 'T12:00:00')
  if (frequencia === 'semanal') {
    d.setDate(d.getDate() + 7)
  } else if (frequencia === 'mensal') {
    const diaOrigem = new Date(dataInicio + 'T12:00:00').getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(diaOrigem, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  } else if (frequencia === 'anual') {
    d.setFullYear(d.getFullYear() + 1)
  }
  return d
}

// Retorna a primeira data de ocorrência >= minDate a partir de dataInicio.
export function primeirOcorrenciaAPartirDe(dataInicio, frequencia, minDate) {
  let d = new Date(dataInicio + 'T12:00:00')
  const min = new Date(minDate + 'T12:00:00')
  let guard = 600
  while (d < min && guard-- > 0) {
    d = avancarOcorrencia(d, frequencia, dataInicio)
  }
  return d
}

// Conta lançamentos futuros não pagos de uma regra.
export function contarLancamentosFuturos(recorrenciaId, lancamentos, hoje = new Date().toISOString().slice(0, 10)) {
  return lancamentos.filter(
    l => l.recorrencia_id === recorrenciaId && l.status !== 'pago' && l.data_vencimento >= hoje
  ).length
}

// Retorna os lançamentos que faltam inserir para garantir 6 futuros.
// regra: linha de lf_recorrencias
// lancamentosExistentes: todas as linhas de lf_contas_pagar com recorrencia_id preenchido
export function gerarLancamentosFaltantes(regra, lancamentosExistentes, hoje = new Date().toISOString().slice(0, 10)) {
  const ALVO = 6

  const existentesFuturos = lancamentosExistentes.filter(
    l => l.recorrencia_id === regra.id && l.status !== 'pago' && l.data_vencimento >= hoje
  )
  const faltam = ALVO - existentesFuturos.length
  if (faltam <= 0) return []

  const datasExistentes = new Set(
    lancamentosExistentes.filter(l => l.recorrencia_id === regra.id).map(l => l.data_vencimento)
  )

  let data = primeirOcorrenciaAPartirDe(regra.data_inicio, regra.frequencia, hoje)
  const novos = []
  let guard = 300
  while (novos.length < faltam && guard-- > 0) {
    const dataStr = data.toISOString().slice(0, 10)
    if (!datasExistentes.has(dataStr)) {
      novos.push({
        loja_id: regra.loja_id,
        descricao: regra.descricao,
        categoria: regra.categoria,
        valor: regra.valor,
        data_vencimento: dataStr,
        status: 'pendente',
        observacoes: regra.observacoes || null,
        recorrencia_id: regra.id,
      })
    }
    data = avancarOcorrencia(data, regra.frequencia, regra.data_inicio)
  }
  return novos
}
