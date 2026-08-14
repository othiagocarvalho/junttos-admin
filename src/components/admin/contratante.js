// Constantes e helpers dos dados do contratante. Ficam fora do .jsx porque um
// arquivo de componente que também exporta valores quebra o Fast Refresh do
// Vite (react-refresh/only-export-components).

export const CONTRATANTE_CAMPOS = [
  'razao_social', 'cpf_cnpj',
  'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep',
  'responsavel_nome', 'responsavel_email', 'responsavel_telefone',
  'contrato_inicio', 'vencimento_dia',
]

export const CONTRATANTE_VAZIO = Object.fromEntries(
  CONTRATANTE_CAMPOS.map(k => [k, '']),
)

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

/**
 * Extrai só os campos do contratante de um objeto maior — o form de cadastro
 * carrega nome, plano, cores e logo junto, que não vão para jt_contratantes.
 */
export function apenasContratante(obj) {
  return Object.fromEntries(CONTRATANTE_CAMPOS.map(k => [k, obj?.[k] ?? '']))
}

/**
 * Dia recorrente do mês: aceita vazio ou 1–31. Devolve null quando a digitação
 * deve ser ignorada, para "45" não entrar no campo.
 */
export function sanitizaVencimentoDia(val) {
  if (val === '') return ''
  if (!/^\d{1,2}$/.test(val)) return null
  const n = Number(val)
  if (n < 1 || n > 31) return null
  return val
}
