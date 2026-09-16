// Máscara e conversão da data de aniversário digitada manualmente na Nova
// Venda — DD/MM/AAAA na tela, ISO (AAAA-MM-DD) no banco
// (lf_clientes.data_nascimento).
//
// Por que texto mascarado e não <input type="date">: no celular esse tipo
// de campo sempre abre o seletor nativo ao tocar, sem opção de digitar.
// Aniversário costuma ser décadas atrás — rolar o calendário até lá é lento
// pra quem está atendendo no balcão. Digitar os 8 dígitos é mais rápido.

/** Aplica a máscara DD/MM/AAAA enquanto a pessoa digita. Só dígitos contam; o resto é ignorado. */
export function mascararDataDigitada(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '').slice(0, 8)
  const dd = digitos.slice(0, 2)
  const mm = digitos.slice(2, 4)
  const aaaa = digitos.slice(4, 8)
  if (digitos.length <= 2) return dd
  if (digitos.length <= 4) return `${dd}/${mm}`
  return `${dd}/${mm}/${aaaa}`
}

/**
 * DD/MM/AAAA completo e válido -> AAAA-MM-DD (ISO, para gravar em
 * lf_clientes.data_nascimento). Incompleto ou inválido -> null — quem chama
 * decide o que fazer (ex: não gravar, sem travar a venda).
 */
export function dataDigitadaParaISO(valor) {
  const m = String(valor ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, aaaa] = m
  const d = Number(dd), mo = Number(mm), a = Number(aaaa)
  if (mo < 1 || mo > 12) return null
  const diasNoMes = new Date(a, mo, 0).getDate()
  if (d < 1 || d > diasNoMes) return null
  if (a < 1900 || a > new Date().getFullYear()) return null
  return `${aaaa}-${mm}-${dd}`
}

/** AAAA-MM-DD (ISO, como o banco devolve) -> DD/MM/AAAA para preencher o campo. */
export function isoParaDataDigitada(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const [, aaaa, mm, dd] = m
  return `${dd}/${mm}/${aaaa}`
}
