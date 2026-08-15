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

  // A lojista deixa o painel aberto o dia todo e volta nele depois de
  // minimizar ou de o notebook dormir — nesse intervalo o token expira, e o
  // primeiro clique em "Confirmar Venda" batia num 401. Renovar quando a aba
  // volta a ficar visível resolve antes de ela tentar qualquer coisa.
  // Silencioso de propósito: se falhar, o refresh no momento da venda ainda
  // tenta de novo, e o onAuthStateChange cuida de derrubar a sessão se for o
  // caso — nada de alerta na cara de quem só voltou pra aba.
  useEffect(() => {
    async function aoVoltar() {
      if (document.visibilityState !== 'visible') return
      const { data } = await supabase.auth.getSession()
      if (!data?.session) return          // deslogada: nada a renovar
      const { error } = await supabase.auth.refreshSession()
      if (error) console.warn('[auth] refresh ao voltar para a aba falhou:', error.message)
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)   // cobre alt-tab sem troca de aba
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
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

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/" replace />

  const userLojaId    = session.user?.app_metadata?.loja_id
  const isConsultor   = !!session.user?.app_metadata?.consultant_id
  if (!userLojaId || userLojaId !== lojaId) {
    if (!isConsultor) supabase.auth.signOut()
    return <Navigate to="/" replace />
  }

  return children
}
