// Decisões derivadas do usuário do painel admin.
//
// Vive num módulo puro porque a FONTE do usuário vai mudar: hoje é a lista
// hardcoded em auth/users.js, depois passa a ser o Supabase Auth. Estas regras
// não podem mudar junto com a fonte — testá-las aqui é o que garante que a
// troca não mexa, sem querer, em quem entra onde.

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
