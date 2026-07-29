import { createContext, useContext, useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabaseConsultor as supabase } from '../lib/supabaseConsultor'

const Spinner = () => (
  <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F1F9' }}>
    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid #5E2BD0', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

const ConsultorAuthContext = createContext(null)

export function ConsultorAuthProvider({ children }) {
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
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.data?.session) {
      const consultorId = result.data.session.user?.app_metadata?.consultant_id
      if (!consultorId) {
        await supabase.auth.signOut()
        return { error: { message: 'Usuário não é um consultor Junttos.' } }
      }
    }
    return result
  }

  async function logout() {
    return supabase.auth.signOut()
  }

  const consultorId = session?.user?.app_metadata?.consultant_id ?? null

  return (
    <ConsultorAuthContext.Provider value={{ session, user: session?.user, consultorId, loading, login, logout }}>
      {children}
    </ConsultorAuthContext.Provider>
  )
}

export function useConsultorAuth() {
  return useContext(ConsultorAuthContext)
}

export function ConsultorPrivateRoute({ children }) {
  const { session, loading, consultorId } = useConsultorAuth()

  if (loading) return <Spinner />
  if (!session || !consultorId) return <Navigate to="/" replace />

  return children
}
