import { createContext, useContext, useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { criarRenovadorAoVoltar } from '../lib/authRefresh'

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
  //
  // Os DOIS listeners continuam: 'visibilitychange' pega a troca de aba e
  // 'focus' pega o alt-tab que volta para a mesma aba, que é um caso que o
  // outro evento não cobre. O que mudou é que voltar para a aba dispara os
  // dois quase juntos, e antes cada um fazia o seu refreshSession() — duas
  // chamadas a /auth/v1/token com um refresh token de uso único, a segunda
  // já com o token que a primeira rotacionou. Agora os dois passam pelo
  // mesmo single-flight (ver src/lib/authRefresh.js) e viram uma chamada só.
  useEffect(() => {
    const aoVoltar = criarRenovadorAoVoltar(supabase, {
      aoFalhar: msg => console.warn('[auth] refresh ao voltar para a aba falhou:', msg),
    })
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

  const userLojaId  = session?.user?.app_metadata?.loja_id
  const isConsultor = !!session?.user?.app_metadata?.consultant_id
  // Loja errada = tem sessão, mas ela não é desta loja.
  const lojaErrada  = !!session && (!userLojaId || userLojaId !== lojaId)

  // O signOut ficava SOLTO NA RENDER, dentro do if abaixo.
  //
  // Chamada de rede na render é disparada quantas vezes o React resolver
  // renderizar — inclusive no render duplo do StrictMode e em re-renders
  // concorrentes. Quando isso cai em cima do refresh que o
  // criarRenovadorAoVoltar acabou de começar, o auth-js descarta o resultado
  // e loga exatamente o que apareceu no console do relato:
  //
  //   Refresh result discarded: session state changed mid-flight
  //   (e.g., concurrent signOut)
  //
  // E sessão instável no meio de um salvamento é o que faz a linha sair de
  // dentro da policy de RLS e o UPDATE não pegar nada — a falha silenciosa
  // que esta tarefa está corrigindo do outro lado, em
  // utils/credenciaisPagamento.js.
  //
  // O comportamento visível não muda: quem está na loja errada continua sendo
  // deslogado e mandado para a raiz. O que muda é QUANDO — depois do commit,
  // uma vez só, em vez de no meio da render.
  useEffect(() => {
    if (lojaErrada && !isConsultor) supabase.auth.signOut()
  }, [lojaErrada, isConsultor])

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/" replace />
  if (lojaErrada) return <Navigate to="/" replace />

  return children
}
