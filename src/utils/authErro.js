// Erros de autenticação vindos do Supabase/PostgREST.
//
// Vale para qualquer consulta, não só a de balanço: o PostgREST valida o JWT
// antes de olhar a tabela, então um token morto no localStorage derruba a
// request mesmo em tabela sem RLS. Quem trata isso como "não achei nada" toma
// a decisão errada — foi assim que a trava de balanço acusava balanço
// inexistente e que a resolução de loja caía no painel do admin.
//
// Sem import do client de propósito: é predicado puro, testável sem rede, e
// quem reexporta (utils/balanco.js) precisa continuar puro também.

export function isErroAuth(error) {
  if (!error) return false
  const code = String(error.code ?? '')
  const msg  = String(error.message ?? '').toLowerCase()
  return code === 'PGRST301' || code === '401' || String(error.status ?? '') === '401'
    || msg.includes('jwt') || msg.includes('token') || msg.includes('unauthorized')
}
