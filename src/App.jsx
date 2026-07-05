import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ClientAuthProvider, ClientPrivateRoute } from './context/ClientAuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import LoginCliente from './pages/LoginCliente'
import ClientLogin from './pages/cliente/Login'
import Dashboard from './pages/Dashboard'
import Consultants from './pages/Consultants'
import Visits from './pages/Visits'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import ArquiteturaPage from './pages/ArquiteturaPage'
import LojaFeminina from './pages/LojaFeminina'
import CadastroCliente from './pages/admin/CadastroCliente'
import Cobrancas from './pages/admin/Cobrancas'
import SimuladorPlano from './pages/SimuladorPlano'
import { supabase } from './lib/supabase'
import CatalogoPublico from './pages/catalogo/CatalogoPublico'

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

function LojaClientApp({ segment, lojaId }) {
  return (
    <ClientAuthProvider>
      <BrowserRouter basename={`/${segment}`}>
        <Routes>
          <Route path="/" element={<ClientLogin />} />
          <Route path="/dashboard" element={
            <ClientPrivateRoute lojaId={lojaId}>
              <ClientDashboard lojaId={lojaId} />
            </ClientPrivateRoute>
          } />
          <Route path="/catalogo" element={<CatalogoPublico lojaId={lojaId} />} />
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
        <BrowserRouter>
          <Routes>
            <Route path="/"            element={<Login />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/login"       element={<LoginCliente />} />
            <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/consultants" element={<ProtectedLayout><Consultants /></ProtectedLayout>} />
            <Route path="/visits" element={<ProtectedLayout><Visits /></ProtectedLayout>} />
            <Route path="/finance" element={<ProtectedLayout><Finance /></ProtectedLayout>} />
            <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
            <Route path="/arquitetura" element={<ProtectedLayout><ArquiteturaPage /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="/loja-feminina" element={<ProtectedLayout><LojaFeminina /></ProtectedLayout>} />
            <Route path="/clientes" element={<ProtectedLayout><CadastroCliente /></ProtectedLayout>} />
            <Route path="/cobrancas" element={<ProtectedLayout><Cobrancas /></ProtectedLayout>} />
            <Route path="/simulador" element={<ProtectedLayout><SimuladorPlano /></ProtectedLayout>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  )
}

export default function App() {
  const [lojaSegment, setLojaSegment] = useState(null) // URL path segment (basename do router)
  const [lojaId,      setLojaId]      = useState(null) // loja_id real do banco (para queries)
  const [ready,       setReady]       = useState(false)

  useEffect(() => {
    const segment = window.location.pathname.split('/').filter(Boolean)[0] ?? ''
    if (!segment) { setReady(true); return }
    supabase
      .from('lf_config')
      .select('loja_id')
      .or(`loja_id.eq.${segment},slug.eq.${segment}`)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLojaSegment(segment)
          setLojaId(data.loja_id)
        }
        setReady(true)
      })
  }, [])

  if (!ready) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F7F5' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '2.5px solid #7B5DD4', borderTopColor: 'transparent',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (lojaSegment) return <LojaClientApp segment={lojaSegment} lojaId={lojaId} />
  return <AdminApp />
}
