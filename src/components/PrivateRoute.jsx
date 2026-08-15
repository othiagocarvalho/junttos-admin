import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { decidirAcessoAdmin } from '../utils/adminUsuario'
import AuthLoading from './AuthLoading'

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  const acesso = decidirAcessoAdmin({ loading, user })
  if (acesso === 'carregando') return <AuthLoading />
  if (acesso === 'login')      return <Navigate to="/" replace />

  return children
}
