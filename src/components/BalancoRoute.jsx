import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { decidirAcessoAdmin, ROLE_SUPER, ROLE_GESTOR } from '../utils/adminUsuario'
import AuthLoading from './AuthLoading'

export default function BalancoRoute({ children }) {
  const { user, loading } = useAuth()

  const acesso = decidirAcessoAdmin({ loading, user, rolesPermitidos: [ROLE_SUPER, ROLE_GESTOR] })
  if (acesso === 'carregando')    return <AuthLoading />
  if (acesso === 'login')         return <Navigate to="/" replace />
  if (acesso === 'sem-permissao') return <Navigate to="/dashboard" replace />

  return children
}
