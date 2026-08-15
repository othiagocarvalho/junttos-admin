export const PLANOS = {
  starter: { label: 'Starter', nivel: 1 },
  pro:     { label: 'Pro',     nivel: 2 },
  business:{ label: 'Business',nivel: 3 },
}

// Valor mensal por segmento. Moda e Mercado têm tabelas de preço diferentes —
// antes existia só a de Moda duplicada em CadastroCliente e ConsultorNovaLoja,
// o que gravava R$ 99,90 em jt_cobrancas ao cadastrar um Mercado no Starter.
export const VALORES_PLANO = {
  moda:    { starter:  99.90, pro: 149.90, business: 259.90 },
  mercado: { starter:  79.90, pro: 109.90, business: 159.90 },
}

/**
 * Taxa de implantação, cobrada uma única vez no ato do cadastro, junto com a
 * primeira mensalidade. Vivia solta como texto dentro do PDF do contrato
 * (contrato-pdf.ts), sem nunca virar cobrança de verdade.
 *
 * A edge function roda em Deno e não importa src/, então o mesmo número está
 * duplicado lá — mesma convenção já usada por VALORES_PLANO. Mudar aqui exige
 * mudar lá também.
 */
export const TAXA_IMPLANTACAO = 300

export const SEGMENTO_PADRAO = 'moda'

export const SEGMENTO_LABEL = { moda: 'Moda', mercado: 'Mercado' }

/**
 * Nome do módulo que a loja contratou — "Junttos Moda" ou "Junttos Mercado".
 * O contrato nomeia sempre o módulo exato, nunca um "Moda/Mercado" genérico.
 * Segmento ausente cai em Moda, mesma convenção do resto do app.
 */
export function nomeModulo(segmento) {
  return `Junttos ${SEGMENTO_LABEL[segmento] || SEGMENTO_LABEL[SEGMENTO_PADRAO]}`
}

/** Valor mensal do plano no segmento. Segmento desconhecido cai em Moda. */
export function valorPlano(segmento, plano) {
  const tabela = VALORES_PLANO[segmento] || VALORES_PLANO[SEGMENTO_PADRAO]
  return tabela[plano] ?? VALORES_PLANO[SEGMENTO_PADRAO][plano] ?? 0
}

/** 99.9 → "99,90" */
export function fmtValorPlano(valor) {
  return Number(valor).toFixed(2).replace('.', ',')
}

export function temAcesso(planoAtual, planoMinimo) {
  const nivelAtual  = PLANOS[planoAtual]?.nivel  || 1
  const nivelMinimo = PLANOS[planoMinimo]?.nivel || 1
  return nivelAtual >= nivelMinimo
}

// Cliente legado — ignora controle de planos, acessa tudo
export function isLegado(features) {
  if (!features) return false
  const f = typeof features === 'string' ? JSON.parse(features) : features
  return f?.legado === true
}

// Mapa de cada funcionalidade e o plano mínimo para acessá-la
export const ACESSO = {
  venda:        'starter',
  estoque:      'starter',
  historico:    'starter',
  fechamento:   'starter',
  relatorios:   'starter',
  clientes:     'starter',
  meta:         'starter',
  relatorios_avancados: 'pro',
  catalogo:     'business',
  financeiro:   'business',
  notificacoes: 'business',
  rede:         'business',
}
