// Papel de acesso de um login de loja.
//
// Lido de app_metadata.papel — mesmo motivo de app_metadata.role no painel
// admin (ver utils/adminUsuario.js): app_metadata só é gravável pela Auth
// Admin API, o próprio usuário não consegue editá-lo, então dá para confiar
// nele para decidir permissão. user_metadata não serviria para isso.
//
// Ausente ou 'dono' = acesso total (dono da loja, comportamento de sempre).
// 'gerente' = acesso restrito — ver ehGerente() por onde cada tela usa isso.
//
// Toda checagem de restrição desta feature importa ehGerente() daqui; nenhum
// arquivo compara `papel === 'gerente'` inline.

export const PAPEL_DONO    = 'dono'
export const PAPEL_GERENTE = 'gerente'

export function ehGerente(papel) {
  return papel === PAPEL_GERENTE
}

/** Lê o papel direto do usuário do Supabase Auth (session.user do ClientAuthContext). */
export function papelDoUsuario(user) {
  return user?.app_metadata?.papel ?? null
}
