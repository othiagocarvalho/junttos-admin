/**
 * Taxa de conversão do consultor: percentual de visitas com resultado 'fechamento'.
 * @param {Array} visitas - registros de jt_visits
 * @returns {number} 0–100 (arredondado)
 */
export function calcTaxaConversao(visitas) {
  if (!visitas?.length) return 0
  const fechamentos = visitas.filter(v => v.resultado === 'fechamento').length
  return Math.round((fechamentos / visitas.length) * 100)
}

/** Formata hora "HH:MM:SS" → "HH:MM" */
export function fmtHora(h) {
  if (!h) return ''
  return String(h).slice(0, 5)
}
