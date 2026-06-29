export const PLANOS = {
  starter: { label: 'Starter', nivel: 1 },
  pro:     { label: 'Pro',     nivel: 2 },
  business:{ label: 'Business',nivel: 3 },
}

export function temAcesso(planoAtual, planoMinimo) {
  const nivelAtual  = PLANOS[planoAtual]?.nivel  || 1
  const nivelMinimo = PLANOS[planoMinimo]?.nivel || 1
  return nivelAtual >= nivelMinimo
}

// Mapa de cada funcionalidade e o plano mínimo para acessá-la
export const ACESSO = {
  venda:        'starter',
  estoque:      'starter',
  historico:    'starter',
  fechamento:   'starter',
  relatorios:   'starter',
  clientes:     'starter',
  meta:         'pro',
  relatorios_avancados: 'pro',
  catalogo:     'business',
  financeiro:   'business',
  notificacoes: 'business',
}
