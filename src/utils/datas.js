/**
 * Helpers de data compartilhados pelas telas do Mercado.
 *
 * O ponto central: nunca deixar o fuso mudar o dia. Colunas date e timestamptz
 * do Postgres chegam como texto ISO; se um valor gravado à meia-noite UTC
 * passar por `new Date(...)` direto, no Brasil (UTC-3) ele vira o dia anterior
 * — e um item apareceria vencendo, ou uma compra aparecendo, um dia antes.
 */

/** Converte o valor do banco em Date local, lendo a data como texto. */
export function paraDataLocal(valor) {
  if (!valor) return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor
  const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Dias corridos de `de` até `ate` (positivo = ate é depois). */
export function diasEntre(de, ate) {
  const a = paraDataLocal(de)
  const b = paraDataLocal(ate)
  if (!a || !b) return null
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / 86400000)
}

/** Soma dias a uma data, devolvendo Date local. */
export function somarDias(valor, dias) {
  const d = paraDataLocal(valor)
  if (!d) return null
  const r = new Date(d)
  r.setDate(r.getDate() + dias)
  return r
}

/** 'DD/MM' — usado na linha "Paga dia DD/MM". */
export function fmtDiaMes(valor) {
  const d = paraDataLocal(valor)
  if (!d) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Data por extenso do extrato: "16 de julho, 18:22".
 * merc_fiado.data é uma coluna `date`, sem hora — a hora vem do created_at.
 * Sem created_at, sai só a parte da data.
 */
export function fmtDataExtenso(data, createdAt = null) {
  const d = paraDataLocal(data)
  if (!d) return ''
  const dia = d.getDate()
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' })
  const base = `${dia} de ${mes}`
  if (!createdAt) return base
  const h = new Date(createdAt)
  if (Number.isNaN(h.getTime())) return base
  return `${base}, ${String(h.getHours()).padStart(2, '0')}:${String(h.getMinutes()).padStart(2, '0')}`
}

/** Iniciais para o avatar: "Maria Silva" → "MS", "Ana" → "A". */
export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}
