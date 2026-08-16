import { T } from '../theme/tokens'

/**
 * Espera enquanto a sessão do painel é restaurada.
 *
 * Hoje isso passa num piscar — o usuário volta do localStorage no primeiro
 * render. Existe para quando a restauração virar assíncrona (Supabase Auth):
 * é o que segura a guarda de rota em vez de ela concluir "deslogado" e
 * redirecionar. Mesmo papel do Spinner do ClientAuthContext e do
 * ConsultorAuthContext, nas cores do painel.
 */
export default function AuthLoading() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T.bg,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        border: `2.5px solid ${T.purple}`, borderTopColor: 'transparent',
        animation: 'auth-spin 1s linear infinite',
      }} />
      <style>{`@keyframes auth-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
