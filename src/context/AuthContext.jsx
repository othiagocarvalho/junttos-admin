import { createContext, useContext, useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { normalizarUsuarioSupabase } from '../utils/adminUsuario'

const AuthContext = createContext(null)

// Resquício do login antigo. Some na entrada porque era JSON não assinado no
// localStorage: enquanto essa chave fosse aceita, bastava forjá-la à mão no
// DevTools para entrar no painel como Super Admin. Agora quem manda é a sessão
// do Supabase, e ela é assinada.
const CHAVE_LEGADO = 'junttos_admin_user'

/**
 * Fase 3: Supabase Auth é a única fonte.
 *
 * A lista hardcoded de auth/users.js saiu junto com este commit — ela ia
 * inteira para o bundle público, com e-mail e senha em texto plano, então
 * qualquer visitante do site conseguia entrar como Super Admin.
 *
 * Consequência assumida: gestor@junttos.com.br não existe no Supabase e passa
 * a não ter acesso. Foi decisão consciente, não esquecimento — para devolver o
 * acesso, criar a conta com app_metadata.role = 'Gestor'.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true

    // Limpa a sessão do modelo antigo em quem ainda a tiver guardada.
    try { localStorage.removeItem(CHAVE_LEGADO) } catch { /* storage indisponível */ }

    supabaseAdmin.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setUser(normalizarUsuarioSupabase(data?.session?.user))
      setLoading(false)
    })

    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange((_evento, session) => {
      setUser(normalizarUsuarioSupabase(session?.user))
    })

    return () => { vivo = false; subscription.unsubscribe() }
  }, [])

  async function login(email, password) {
    const { data, error: errSupabase } = await supabaseAdmin.auth.signInWithPassword({ email, password })

    if (errSupabase || !data?.session) {
      setError('E-mail ou senha incorretos.')
      return false
    }

    const usuario = normalizarUsuarioSupabase(data.session.user)
    if (!usuario) {
      // Autenticou, mas sem app_metadata.role: é conta de lojista ou consultor
      // tentando entrar pelo painel da equipe. Não dá para inferir permissão.
      await supabaseAdmin.auth.signOut()
      setError('Esta conta não tem acesso ao painel Junttos.')
      return false
    }

    setUser(usuario)
    setError('')
    return true
  }

  async function logout() {
    await supabaseAdmin.auth.signOut().catch(() => {})
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, error, setError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
