import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ClientAuthProvider, ClientPrivateRoute } from './context/ClientAuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import ClientLogin from './pages/cliente/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Consultants from './pages/Consultants'
import Visits from './pages/Visits'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import ArquiteturaPage from './pages/ArquiteturaPage'
import LojaFeminina from './pages/LojaFeminina'

// junttos.vercel.app/estrada → loja client
// junttos.vercel.app/admin   → painel admin
function getAppMode() {
  return window.location.pathname.startsWith('/estrada') ? 'loja' : 'admin'
}

function ProtectedLayout({ children }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  )
}

function ClientDashboard() {
  return <LojaFeminina />
}

function LojaClientApp() {
  return (
    <ClientAuthProvider>
      <BrowserRouter basename="/estrada">
        <Routes>
          <Route path="/" element={<ClientLogin />} />
          <Route path="/dashboard" element={
            <ClientPrivateRoute>
              <ClientDashboard />
            </ClientPrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ClientAuthProvider>
  )
}

function AdminApp() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter basename="/admin">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/clients" element={<ProtectedLayout><Clients /></ProtectedLayout>} />
            <Route path="/consultants" element={<ProtectedLayout><Consultants /></ProtectedLayout>} />
            <Route path="/visits" element={<ProtectedLayout><Visits /></ProtectedLayout>} />
            <Route path="/finance" element={<ProtectedLayout><Finance /></ProtectedLayout>} />
            <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
            <Route path="/arquitetura" element={<ProtectedLayout><ArquiteturaPage /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="/loja-feminina" element={<ProtectedLayout><LojaFeminina /></ProtectedLayout>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  )
}

export default function App() {
  const mode = getAppMode()
  if (mode === 'loja') return <LojaClientApp />
  return <AdminApp />
}
