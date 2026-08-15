// Decisões derivadas do usuário do painel admin.
//
// Vive num módulo puro porque a FONTE do usuário mudou: era uma lista
// hardcoded em auth/users.js, hoje é o Supabase Auth. Estas regras não podem
// mudar junto com a fonte — testá-las aqui é o que garantiu que a troca não
// mexesse, sem querer, em quem entra onde.

export const ROLE_SUPER  = 'Super Admin'
export const ROLE_GESTOR = 'Gestor'

/**
 * O que uma rota protegida do painel deve renderizar.
 *
 * O estado 'carregando' existe por causa da restauração de sessão. Hoje o
 * usuário volta do localStorage já no primeiro render, então nunca aparece.
 * Com Supabase Auth o getSession() é assíncrono e `user` fica null por um
 * instante — sem este estado a guarda leria null como "deslogado" e
 * redirecionaria, derrubando a pessoa para o login a cada F5.
 *
 * @param {boolean} loading          sessão ainda sendo restaurada
 * @param {object}  user             usuário já normalizado ({ role, ... })
 * @param {string[]} rolesPermitidos omitido = basta estar logado
 */
export function decidirAcessoAdmin({ loading, user, rolesPermitidos } = {}) {
  if (loading) return 'carregando'
  if (!user) return 'login'
  if (rolesPermitidos && !rolesPermitidos.includes(user.role)) return 'sem-permissao'
  return 'ok'
}

/**
 * Primeiro nome, para a saudação do Dashboard.
 *
 * Nome ausente não pode derrubar a tela: `user?.name.split(...)` protegia o
 * `user` mas não o `name`, então um usuário sem nome lançava TypeError
 * justamente na primeira tela depois do login.
 */
export function primeiroNome(user) {
  const nome = String(user?.name ?? '').trim()
  return nome ? nome.split(/\s+/)[0] : ''
}

/** Iniciais para o avatar da Sidebar. Nome de uma palavra usa as duas primeiras letras. */
export function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '??'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * Converte o usuário do Supabase Auth para o mesmo shape que a lista
 * hardcoded sempre produziu — { id, name, email, role, avatar }.
 *
 * É o coração da migração: Sidebar, guardas de rota e a saudação do Dashboard
 * continuam consumindo o contrato de antes e não precisam saber que a fonte
 * mudou.
 *
 * Devolve null quando falta `app_metadata.role`. Isso é recusa deliberada, não
 * um default permissivo: o role vem de app_metadata justamente porque o
 * usuário não consegue editá-lo (ao contrário de user_metadata). Sem o claim,
 * não dá para afirmar nada sobre a permissão dessa pessoa.
 */
export function normalizarUsuarioSupabase(user) {
  const role = user?.app_metadata?.role
  if (!role) return null

  const email = String(user?.email ?? '')
  const doMetadata = String(user?.user_metadata?.name ?? '').trim()
  // Sem nome cadastrado, o trecho antes do @ é melhor que um espaço vazio.
  const doEmail = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  const name = doMetadata || (doEmail ? doEmail[0].toUpperCase() + doEmail.slice(1) : '')

  return { id: user.id, name, email, role, avatar: iniciais(name) }
}
