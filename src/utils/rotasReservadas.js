// Primeiros segmentos de URL que pertencem ao sistema, não a uma loja.
//
// Fonte única: o App.jsx consulta esta lista ANTES de tentar resolver a URL
// como loja, e o cadastro de loja recusa estes slugs. As duas coisas precisam
// concordar — quando não concordavam, /admin/login virava "Loja não
// encontrada" (o App procurava uma loja chamada "admin" em lf_config) e, do
// outro lado, nada impedia alguém de criar uma loja com slug "dashboard" e
// sequestrar a rota do painel.
//
// Regra ao mexer: rota nova no AdminApp entra aqui no mesmo commit.

/** Rotas do painel Junttos (AdminApp em App.jsx). */
const PAINEL = [
  'admin',        // /admin/login
  'login',
  'dashboard',
  'consultants',
  'visits',
  'finance',
  'reports',
  'arquitetura',
  'settings',
  'clientes',
  'redes',
  'cobrancas',
  'simulador',
  'balanco',
]

/** Rotas públicas e de outros portais. */
const OUTRAS = [
  'c',          // portal do consultor
  'contrato',   // link público de assinatura, aberto sem login
]

/** Reservados de infraestrutura — a landing estática e o que a Vercel serve. */
const INFRA = ['api', 'site', 'assets']

export const SLUGS_RESERVADOS = [...PAINEL, ...OUTRAS, ...INFRA]

export function isSlugReservado(s) {
  return SLUGS_RESERVADOS.includes(String(s || '').trim().toLowerCase())
}
