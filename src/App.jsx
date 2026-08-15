import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ClientAuthProvider, ClientPrivateRoute } from './context/ClientAuthContext'
import PrivateRoute from './components/PrivateRoute'
import SuperAdminRoute from './components/SuperAdminRoute'
import BalancoRoute from './components/BalancoRoute'
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
import LojaMercado from './pages/LojaMercado'
import CadastroCliente from './pages/admin/CadastroCliente'
import LojaDetalhe from './pages/admin/LojaDetalhe'
import AssinaturaContrato from './pages/publico/AssinaturaContrato'
import Cobrancas from './pages/admin/Cobrancas'
import Redes from './pages/admin/Redes'
import SimuladorPlano from './pages/SimuladorPlano'
import BalancoApp from './pages/balanco/BalancoApp'
import { supabase } from './lib/supabase'
import { isErroAuth } from './utils/authErro'
import CatalogoPublico from './pages/catalogo/CatalogoPublico'
import ConsultorApp from './pages/consultor/ConsultorApp'

function ProtectedLayout({ children }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  )
}

function ClientDashboard({ lojaId, segmento }) {
  if (segmento === 'mercado') return <LojaMercado lojaId={lojaId} />
  return <LojaFeminina lojaId={lojaId} />
}

function LojaClientApp({ segment, lojaId, segmento }) {
  return (
    <ClientAuthProvider>
      <BrowserRouter basename={`/${segment}`}>
        <Routes>
          <Route path="/" element={<ClientLogin />} />
          <Route path="/dashboard" element={
            <ClientPrivateRoute lojaId={lojaId}>
              <ClientDashboard lojaId={lojaId} segmento={segmento} />
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
            {/* Pública: o cliente abre pelo link, sem login. O slug 'contrato'
                é reservado em useCreateLoja para nenhuma loja tomar esta rota. */}
            <Route path="/contrato/:token" element={<AssinaturaContrato />} />
            <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/consultants" element={<ProtectedLayout><Consultants /></ProtectedLayout>} />
            <Route path="/visits" element={<ProtectedLayout><Visits /></ProtectedLayout>} />
            <Route path="/finance" element={<ProtectedLayout><Finance /></ProtectedLayout>} />
            <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
            <Route path="/arquitetura" element={<ProtectedLayout><ArquiteturaPage /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="/clientes" element={<ProtectedLayout><SuperAdminRoute><CadastroCliente /></SuperAdminRoute></ProtectedLayout>} />
            <Route path="/clientes/:slug" element={<ProtectedLayout><SuperAdminRoute><LojaDetalhe /></SuperAdminRoute></ProtectedLayout>} />
            <Route path="/redes"    element={<ProtectedLayout><SuperAdminRoute><Redes /></SuperAdminRoute></ProtectedLayout>} />
            <Route path="/cobrancas" element={<ProtectedLayout><Cobrancas /></ProtectedLayout>} />
            <Route path="/simulador" element={<ProtectedLayout><SimuladorPlano /></ProtectedLayout>} />
            <Route path="/balanco" element={<PrivateRoute><BalancoRoute><BalancoApp /></BalancoRoute></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  )
}

function TelaCarregando() {
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

/**
 * A loja da URL não abriu. Duas situações bem diferentes na mesma tela:
 * `inexistente` é definitivo (slug errado, loja removida) e não oferece
 * retry; o outro caso é falha de carregamento e o botão resolve.
 *
 * Não oferece link para o painel da Junttos de propósito: quem chega por
 * /minhaloja é lojista ou cliente dela, e mandar essa pessoa para o login
 * do admin foi exatamente o bug que esta tela existe para não repetir.
 */
function TelaLojaIndisponivel({ segment, inexistente, onTentarNovamente }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F8F7F5', padding: 24, boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, margin: '0 auto 20px',
          background: inexistente ? '#FDECEC' : '#F1EDFB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, lineHeight: 1,
        }}>{inexistente ? '🔍' : '⚠️'}</div>

        <h1 style={{
          fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 19, fontWeight: 700,
          color: '#241B26', margin: '0 0 10px', lineHeight: 1.3,
        }}>
          {inexistente ? 'Loja não encontrada' : 'Não foi possível abrir a loja'}
        </h1>

        <p style={{
          fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 14,
          color: '#6E6172', margin: '0 0 22px', lineHeight: 1.6,
        }}>
          {inexistente
            ? <>Não existe nenhuma loja no endereço <strong style={{ color: '#241B26' }}>/{segment}</strong>. Confira o link.</>
            : <>Não conseguimos carregar <strong style={{ color: '#241B26' }}>/{segment}</strong> agora. Verifique a conexão e tente de novo.</>}
        </p>

        {!inexistente && (
          <button
            onClick={onTentarNovamente}
            style={{
              height: 46, padding: '0 26px', borderRadius: 12, border: 'none',
              background: '#7B5DD4', color: '#fff', cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 14, fontWeight: 700,
            }}
          >
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [lojaSegment, setLojaSegment] = useState(null) // URL path segment (basename do router)
  const [lojaId,      setLojaId]      = useState(null) // loja_id real do banco (para queries)
  const [segmentoLoja,setSegmentoLoja]= useState('moda')
  const [tentativa,   setTentativa]   = useState(0)

  // Segmento da URL: fixo durante a vida do app (o router só troca o que vem
  // depois dele), então lê uma vez e não entra nas dependências do efeito.
  const [segment] = useState(() => window.location.pathname.split('/').filter(Boolean)[0] ?? '')

  const consultor = segment === 'c'          // área do consultor (/c/...)
  // Sem segmento é o painel da Junttos; 'c' é o consultor. Nenhum dos dois
  // precisa perguntar nada ao banco, então já nascem resolvidos.
  const precisaResolver = !!segment && !consultor

  // 'carregando' | 'ok' | 'falha' | 'inexistente'.
  // 'falha' e 'inexistente' são estados distintos de propósito: um pede
  // "tente de novo", o outro é definitivo e não adianta insistir.
  const [estado, setEstado] = useState(precisaResolver ? 'carregando' : 'ok')

  useEffect(() => {
    let vivo = true
    if (!precisaResolver) return

    const consultar = () => supabase
      .from('lf_config')
      .select('loja_id, segmento')
      .or(`loja_id.eq.${segment},slug.eq.${segment}`)
      .maybeSingle()

    // Não zera o estado aqui: já nasce 'carregando', e no retry quem volta a
    // marcar é o próprio clique — setState síncrono dentro do efeito só
    // provocaria render em cascata.
    async function resolver() {
      let { data, error } = await consultar()

      // Token morto no localStorage: o PostgREST recusa a request (401
      // PGRST301) antes mesmo de olhar a tabela, e lf_config nem tem RLS.
      // Antes isso virava data=null e o app caía no painel do admin.
      if (isErroAuth(error)) {
        // Tenta salvar a sessão antes de descartá-la: se o refresh token ainda
        // presta, a lojista segue logada e só perdeu um round-trip.
        const { error: refreshErr } = await supabase.auth.refreshSession()
        if (refreshErr) {
          // scope 'local': o token já está morto, o signOut remoto falharia —
          // e derrubaria as outras sessões da conta se não falhasse.
          try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* segue anônimo */ }
        }
        ;({ data, error } = await consultar())
      }

      if (!vivo) return
      // Erro que sobreviveu ao retry: rede fora, PostgREST fora, ou linha
      // duplicada quebrando o .maybeSingle(). Não é "loja inexistente".
      if (error) { console.error('[App] falha ao resolver a loja:', error); setEstado('falha'); return }
      if (!data) { setEstado('inexistente'); return }

      setLojaSegment(segment)
      setLojaId(data.loja_id)
      setSegmentoLoja(data.segmento ?? 'moda')
      setEstado('ok')
    }

    resolver()
    return () => { vivo = false }
  }, [segment, precisaResolver, tentativa])

  if (estado === 'carregando') return <TelaCarregando />

  // Havia loja na URL e ela não resolveu: mostrar o que aconteceu, preservando
  // a URL. Cair no AdminApp aqui é o que levava a lojista para o login da
  // Junttos e, no reload seguinte, para a landing (o catch-all reescreve a URL
  // para "/" e a Vercel redireciona "/" para "/site/").
  if (estado === 'falha' || estado === 'inexistente') {
    return (
      <TelaLojaIndisponivel
        segment={segment}
        inexistente={estado === 'inexistente'}
        onTentarNovamente={() => { setEstado('carregando'); setTentativa(t => t + 1) }}
      />
    )
  }

  if (consultor)   return <ConsultorApp />
  if (lojaSegment) return <LojaClientApp segment={lojaSegment} lojaId={lojaId} segmento={segmentoLoja} />
  return <AdminApp />
}
