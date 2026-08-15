import { createContext, useContext, useState } from 'react'
import { ADMIN_USERS } from '../auth/users'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('junttos_admin_user')
    return saved ? JSON.parse(saved) : null
  })
  const [error, setError] = useState('')

  // Restauração da sessão ainda é síncrona (localStorage), então nasce false e
  // nunca muda. Está exposto agora porque as guardas de rota já dependem dele:
  // quando a fonte virar o Supabase Auth, getSession() é assíncrono e este
  // valor passa a começar true. Sem ele, o primeiro render veria user=null e
  // redirecionaria para o login a cada F5.
  const [loading] = useState(false)

  // async de propósito, mesmo resolvendo na hora: as telas de login já passam
  // a esperar por ela, e a troca por signInWithPassword não muda a assinatura.
  async function login(email, password) {
    const found = ADMIN_USERS.find(
      (u) => u.email === email && u.password === password
    )
    if (found) {
      // Shape explícito, e não "tudo menos a senha": é o contrato que o resto
      // do painel consome (Sidebar, guardas de rota, saudação do Dashboard) e
      // que a migração para o Supabase Auth vai ter que reproduzir a partir de
      // app_metadata. Listar os campos evita vazar qualquer coisa nova que
      // apareça na lista e deixa o contrato visível num lugar só.
      const safeUser = {
        id:     found.id,
        name:   found.name,
        email:  found.email,
        role:   found.role,
        avatar: found.avatar,
      }
      setUser(safeUser)
      localStorage.setItem('junttos_admin_user', JSON.stringify(safeUser))
      setError('')
      return true
    }
    setError('E-mail ou senha incorretos.')
    return false
  }

  async function logout() {
    setUser(null)
    localStorage.removeItem('junttos_admin_user')
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
