import { createContext, useContext, useState, useEffect } from 'react'
import { ADMIN_USERS } from '../auth/users'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('junttos_admin_user')
    return saved ? JSON.parse(saved) : null
  })
  const [error, setError] = useState('')

  function login(email, password) {
    const found = ADMIN_USERS.find(
      (u) => u.email === email && u.password === password
    )
    if (found) {
      const { password: _, ...safeUser } = found
      setUser(safeUser)
      localStorage.setItem('junttos_admin_user', JSON.stringify(safeUser))
      setError('')
      return true
    }
    setError('E-mail ou senha incorretos.')
    return false
  }

  function logout() {
    setUser(null)
    localStorage.removeItem('junttos_admin_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, error, setError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
