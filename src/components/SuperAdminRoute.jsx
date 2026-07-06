import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SuperAdminRoute({ children }) {
  const { user } = useAuth()
  return user?.role === 'Super Admin' ? children : <Navigate to="/dashboard" replace />
}
