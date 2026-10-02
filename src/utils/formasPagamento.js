// ── Formas de pagamento da loja ───────────────────────────────
// Cada loja tem as formas padrão do seu PDV (fixas no código) e pode
// cadastrar as suas, que ficam em lf_config.formas_pagamento como
//   [{ nome: 'Vale-presente', conta_como: 'nenhum', ativo: true }]
// conta_como diz em que linha do fechamento de caixa a forma soma — a
// lojista escolhe na hora de cadastrar (Configurações).
//
// Remover uma forma só marca ativo = false: as vendas antigas continuam com
// o nome gravado em forma_pgto e o caixa daqueles dias continua sabendo em
// que linha somar.

/** Formas fixas da Moda (Nova Venda, Pré-venda, Histórico, Relatórios). */
export const FORMAS_PADRAO_MODA = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito']

/** Formas fixas do PDV do Mercado (ver utils/caixa.js). */
export const FORMAS_PADRAO_MERCADO = ['Dinheiro', 'Pix', 'Cartão', 'Fiado']

/** Opções de "conta no caixa como" oferecidas no cadastro. */
export const CONTA_COMO = [
  { value: 'Dinheiro',          label: 'Dinheiro (entra na gaveta)' },
  { value: 'Pix',               label: 'Pix' },
  { value: 'Cartão de Débito',  label: 'Cartão de Débito' },
  { value: 'Cartão de Crédito', label: 'Cartão de Crédito' },
  { value: 'nenhum',            label: 'Não entra no caixa' },
]

const CONTA_COMO_VALIDOS = new Set(CONTA_COMO.map(c => c.value))

const chave = nome => String(nome || '').trim().toLocaleLowerCase('pt-BR')

const NOMES_RESERVADOS = new Set([...FORMAS_PADRAO_MODA, ...FORMAS_PADRAO_MERCADO].map(chave))

/**
 * Formas cadastradas pela loja, normalizadas (ativas e inativas).
 * Tolera config nulo, coluna ainda inexistente e lixo no JSON. Descarta nome
 * de forma padrão (só entraria editando o banco à mão): ela apareceria em
 * dobro no seletor e somaria duas vezes no caixa.
 */
export function formasCadastradas(config) {
  const bruto = config?.formas_pagamento
  const lista = Array.isArray(bruto) ? bruto : []
  const vistos = new Set()
  const out = []
  for (const f of lista) {
    const nome = String(f?.nome || '').trim()
    if (!nome || vistos.has(chave(nome)) || NOMES_RESERVADOS.has(chave(nome))) continue
    vistos.add(chave(nome))
    out.push({
      nome,
      conta_como: CONTA_COMO_VALIDOS.has(f?.conta_como) ? f.conta_como : 'nenhum',
      ativo: f?.ativo !== false,
    })
  }
  return out
}

/**
 * Nomes para o seletor de pagamento: padrão + cadastradas ativas.
 * `atual` entra no fim se não estiver na lista — editar uma venda feita numa
 * forma que depois foi removida não pode trocar a forma sem a lojista ver.
 */
export function opcoesFormaPgto(config, { padrao = FORMAS_PADRAO_MODA, atual } = {}) {
  const nomes = [...padrao, ...formasCadastradas(config).filter(f => f.ativo).map(f => f.nome)]
  if (atual && !nomes.some(n => chave(n) === chave(atual))) nomes.push(atual)
  return nomes
}

/**
 * Em que linha do caixa uma forma cadastrada soma: 'Dinheiro' | 'Pix' |
 * 'Cartão de Débito' | 'Cartão de Crédito' | 'nenhum'. null quando o nome não
 * é uma forma cadastrada (as padrão cada tela já trata do seu jeito).
 */
export function contaComoNoCaixa(forma, config) {
  const f = formaCadastrada(forma, config)
  return f ? f.conta_como : null
}

/**
 * A forma cadastrada ({nome, conta_como, ativo}) com esse nome — sem
 * diferenciar maiúscula/minúscula nem espaços nas pontas —, ou null.
 */
export function formaCadastrada(forma, config) {
  return formasCadastradas(config).find(x => chave(x.nome) === chave(forma)) || null
}

/** Erro de validação do nome, ou null se pode cadastrar. */
export function validarNovaForma(nome, config) {
  const n = String(nome || '').trim()
  if (!n) return 'Informe o nome da forma de pagamento.'
  if (n.length > 40) return 'Use um nome com até 40 caracteres.'
  // O recibo impresso monta HTML com o nome da forma.
  if (/[<>]/.test(n)) return 'Não use os sinais < e > no nome.'
  if (NOMES_RESERVADOS.has(chave(n))) return `"${n}" já é uma forma padrão.`
  const existente = formasCadastradas(config).find(f => chave(f.nome) === chave(n))
  if (existente?.ativo) return `"${n}" já está cadastrada.`
  return null
}

/**
 * Lista nova (para gravar em lf_config.formas_pagamento) com a forma
 * adicionada. Se ela existia removida, volta a valer com o conta_como novo.
 */
export function adicionarForma(config, nome, conta_como) {
  const n = String(nome).trim()
  const cc = CONTA_COMO_VALIDOS.has(conta_como) ? conta_como : 'nenhum'
  const atuais = formasCadastradas(config)
  const idx = atuais.findIndex(f => chave(f.nome) === chave(n))
  if (idx >= 0) return atuais.map((f, i) => i === idx ? { ...f, conta_como: cc, ativo: true } : f)
  return [...atuais, { nome: n, conta_como: cc, ativo: true }]
}

/** Lista nova com a forma marcada como removida (ativo = false). */
export function removerForma(config, nome) {
  return formasCadastradas(config).map(f => chave(f.nome) === chave(nome) ? { ...f, ativo: false } : f)
}
