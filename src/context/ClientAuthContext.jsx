import { createContext, useContext, useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const Spinner = () => (
  <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDF8F5' }}>
    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid #C9956C', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

const ClientAuthContext = createContext(null)

export function ClientAuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function login(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function logout() {
    return supabase.auth.signOut()
  }

  return (
    <ClientAuthContext.Provider value={{ session, user: session?.user, loading, login, logout }}>
      {children}
    </ClientAuthContext.Provider>
  )
}

export function useClientAuth() {
  return useContext(ClientAuthContext)
}

export function ClientPrivateRoute({ children, lojaId }) {
  const { session, loading } = useClientAuth()
  const [lojaAllowed, setLojaAllowed] = useState(null)

  // Valida que o usuário autenticado tem vínculo ativo com esta loja específica
  useEffect(() => {
    if (loading) return
    if (!session) { setLojaAllowed(false); return }

    let cancelled = false
    supabase
      .from('lf_usuarios')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .eq('loja_id', lojaId)
      .eq('ativo', true)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setLojaAllowed(!!data) })

    return () => { cancelled = true }
  }, [session, loading, lojaId])

  // Encerra sessão se usuário não tem vínculo com esta loja
  useEffect(() => {
    if (!loading && lojaAllowed === false && session) {
      supabase.auth.signOut()
    }
  }, [loading, lojaAllowed, session])

  if (loading || lojaAllowed === null) return <Spinner />

  if (!session || !lojaAllowed) return <Navigate to="/" replace />

  return children
}
