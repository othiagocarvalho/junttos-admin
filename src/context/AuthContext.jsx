import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { ADMIN_USERS } from '../auth/users'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { normalizarUsuarioSupabase } from '../utils/adminUsuario'

const AuthContext = createContext(null)

const CHAVE_LEGADO = 'junttos_admin_user'

/**
 * Fase 2 da migração: modo duplo.
 *
 * O login tenta o Supabase Auth primeiro e cai na lista de auth/users.js se
 * não der. Os dois caminhos produzem o mesmo shape de usuário, então nada a
 * jusante (Sidebar, guardas, Dashboard) percebe a diferença.
 *
 * A reserva existe para não haver janela de tranca: hoje só admin@ existe no
 * Supabase — gestor@ NÃO existe, por decisão consciente, e entra pela lista.
 * Se o Supabase estiver fora, ou a senha lá estiver errada, a senha antiga
 * ainda abre o painel. A lista só sai na Fase 3, depois de confirmado que o
 * caminho novo funciona e sobrevive a um F5.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // 'supabase' | 'lista' — de onde veio a sessão atual. Sem isso, um evento de
  // auth do Supabase (que dispara com session null quando não há sessão lá)
  // apagaria um usuário que entrou pela lista.
  const [origem, setOrigem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Espelho da origem para ler dentro de callbacks sem recriar a inscrição.
  const origemRef = useRef(null)
  function aplicar(novoUser, novaOrigem) {
    origemRef.current = novaOrigem
    setUser(novoUser)
    setOrigem(novaOrigem)
  }

  // Restauração da sessão. Agora é assíncrona — é exatamente por isso que as
  // guardas de rota ganharam o estado 'carregando' na Fase 1.
  useEffect(() => {
    let vivo = true

    supabaseAdmin.auth.getSession().then(({ data }) => {
      if (!vivo) return
      const doSupabase = normalizarUsuarioSupabase(data?.session?.user)
      if (doSupabase) {
        aplicar(doSupabase, 'supabase')
        setLoading(false)
        return
      }
      // Sem sessão no Supabase: pode ser alguém que entrou pela lista antes
      // deste deploy. Restaurar evita deslogar todo mundo na virada.
      try {
        const salvo = localStorage.getItem(CHAVE_LEGADO)
        if (salvo) aplicar(JSON.parse(salvo), 'lista')
      } catch { /* JSON corrompido: segue deslogado */ }
      setLoading(false)
    })

    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange((_evento, session) => {
      const doSupabase = normalizarUsuarioSupabase(session?.user)
      if (doSupabase) { aplicar(doSupabase, 'supabase'); return }
      // Só derruba quem veio do Supabase. Sessão da lista não é assunto deste
      // callback — e ele dispara com session null logo na inscrição.
      if (origemRef.current === 'supabase') aplicar(null, null)
    })

    return () => { vivo = false; subscription.unsubscribe() }
  }, [])

  function entrarPelaLista(email, password) {
    const found = ADMIN_USERS.find(u => u.email === email && u.password === password)
    if (!found) return false
    // Shape explícito — o mesmo que normalizarUsuarioSupabase produz.
    const safeUser = {
      id:     found.id,
      name:   found.name,
      email:  found.email,
      role:   found.role,
      avatar: found.avatar,
    }
    aplicar(safeUser, 'lista')
    localStorage.setItem(CHAVE_LEGADO, JSON.stringify(safeUser))
    setError('')
    return true
  }

  async function login(email, password) {
    const { data, error: errSupabase } = await supabaseAdmin.auth.signInWithPassword({ email, password })

    if (!errSupabase && data?.session) {
      const doSupabase = normalizarUsuarioSupabase(data.session.user)
      if (doSupabase) {
        aplicar(doSupabase, 'supabase')
        // Some com o resquício da lista para não restaurar por engano depois.
        localStorage.removeItem(CHAVE_LEGADO)
        setError('')
        return true
      }
      // Autenticou, mas sem app_metadata.role: não dá para dizer que permissão
      // essa pessoa tem. Encerra a sessão e tenta a reserva.
      console.warn('[auth] usuário do Supabase sem app_metadata.role — caindo na lista')
      await supabaseAdmin.auth.signOut()
    }

    if (entrarPelaLista(email, password)) return true

    setError('E-mail ou senha incorretos.')
    return false
  }

  async function logout() {
    // Sempre os dois: a pessoa pode ter sessão no Supabase e resquício da lista.
    await supabaseAdmin.auth.signOut().catch(() => {})
    localStorage.removeItem(CHAVE_LEGADO)
    aplicar(null, null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, origem, login, logout, error, setError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
