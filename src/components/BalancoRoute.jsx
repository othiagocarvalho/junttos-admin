import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function BalancoRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'Super Admin' && user.role !== 'Gestor') return <Navigate to="/dashboard" replace />
  return children
}
