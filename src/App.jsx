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
import CadastroCliente from './pages/admin/CadastroCliente'

// Lojas conhecidas — adicionar novo slug aqui para cadastrar nova cliente
const LOJA_IDS = ['estrada', 'biastore']

function getLojaId() {
  const path = window.location.pathname
  return LOJA_IDS.find(id => path.startsWith(`/${id}`)) ?? null
}

function ProtectedLayout({ children }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  )
}

function ClientDashboard({ lojaId }) {
  return <LojaFeminina lojaId={lojaId} />
}

function LojaClientApp({ lojaId }) {
  return (
    <ClientAuthProvider>
      <BrowserRouter basename={`/${lojaId}`}>
        <Routes>
          <Route path="/" element={<ClientLogin />} />
          <Route path="/dashboard" element={
            <ClientPrivateRoute>
              <ClientDashboard lojaId={lojaId} />
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
            <Route path="/clientes" element={<ProtectedLayout><CadastroCliente /></ProtectedLayout>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  )
}

export default function App() {
  const lojaId = getLojaId()
  if (lojaId) return <LojaClientApp lojaId={lojaId} />
  return <AdminApp />
}
