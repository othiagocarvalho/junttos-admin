const S = {
  purple: '#5E2BD0',
  purpleText: '#491FB8',
  purpleDeep: '#341780',
  coral: '#FF6F5E',
  ink: '#16101F',
  mist: '#F6F3FA',
  line: '#E6E0F0',
  muted: '#7B7390',
}

const layers = [
  {
    title: 'Frontend',
    color: S.purple,
    bg: 'rgba(94,43,208,0.07)',
    border: 'rgba(94,43,208,0.2)',
    items: [
      { name: 'React 18 + Vite', desc: 'SPA com roteamento via React Router v6' },
      { name: 'Tailwind CSS + inline styles', desc: 'Estilização híbrida com design system próprio' },
      { name: 'Lucide React', desc: 'Biblioteca de ícones' },
      { name: 'Context API', desc: 'AuthContext e DataContext para estado global' },
    ],
  },
  {
    title: 'Autenticação',
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.07)',
    border: 'rgba(14,165,233,0.2)',
    items: [
      { name: 'Credenciais via VITE_* env vars', desc: 'Injetadas em build time pelo Vercel' },
      { name: 'Sessão em localStorage', desc: 'Persistência sem backend — junttos_admin_user' },
      { name: 'PrivateRoute', desc: 'Guard de rota que redireciona para login se não autenticado' },
    ],
  },
  {
    title: 'Dados',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.07)',
    border: 'rgba(16,185,129,0.2)',
    items: [
      { name: 'DataContext', desc: 'Mock de dados em memória — clientes, consultores, visitas, finanças' },
      { name: 'Sem backend/API', desc: 'Todos os dados são gerados localmente no browser' },
    ],
  },
  {
    title: 'Infra & Deploy',
    color: S.coral,
    bg: 'rgba(255,111,94,0.07)',
    border: 'rgba(255,111,94,0.2)',
    items: [
      { name: 'Vercel', desc: 'Deploy automático via push no GitHub (branch master)' },
      { name: 'GitHub — othiagocarvalho/junttos-admin', desc: 'Repositório fonte com CI/CD integrado à Vercel' },
      { name: 'Variáveis de ambiente', desc: 'Configuradas no dashboard Vercel em Production' },
    ],
  },
]

const routes = [
  { path: '/admin/', label: 'Login', restricted: false },
  { path: '/admin/dashboard', label: 'Dashboard' },
  { path: '/admin/clients', label: 'Clientes' },
  { path: '/admin/consultants', label: 'Consultores' },
  { path: '/admin/visits', label: 'Visitas e Rotas' },
  { path: '/admin/finance', label: 'Faturamento' },
  { path: '/admin/reports', label: 'Relatórios' },
  { path: '/admin/arquitetura', label: 'Arquitetura' },
  { path: '/admin/settings', label: 'Configurações' },
]

export default function ArquiteturaPage() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: S.ink, maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          Arquitetura do sistema
        </h1>
        <p style={{ fontSize: 14.5, color: S.muted, margin: 0 }}>
          Visão geral da stack, autenticação, dados e infraestrutura do painel Junttos Admin.
        </p>
      </div>

      {/* Layers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16, marginBottom: 32 }}>
        {layers.map((layer) => (
          <div
            key={layer.title}
            style={{
              background: layer.bg,
              border: `1px solid ${layer.border}`,
              borderRadius: 16,
              padding: '20px 22px',
            }}
          >
            <h2 style={{ fontSize: 13, fontWeight: 700, color: layer.color, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' }}>
              {layer.title}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {layer.items.map((item) => (
                <div key={item.name}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: S.ink, margin: '0 0 2px' }}>{item.name}</p>
                  <p style={{ fontSize: 13, color: S.muted, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Routes */}
      <div style={{ background: '#fff', border: `1px solid ${S.line}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${S.line}` }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: S.ink }}>Rotas da aplicação</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: S.mist }}>
              <th style={{ padding: '10px 22px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Path</th>
              <th style={{ padding: '10px 22px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Página</th>
              <th style={{ padding: '10px 22px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Acesso</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r, i) => (
              <tr key={r.path} style={{ borderTop: i > 0 ? `1px solid ${S.line}` : 'none' }}>
                <td style={{ padding: '11px 22px' }}>
                  <code style={{ fontSize: 12.5, background: S.mist, padding: '2px 8px', borderRadius: 6, color: S.purpleText, fontFamily: 'monospace' }}>
                    {r.path}
                  </code>
                </td>
                <td style={{ padding: '11px 22px', fontWeight: 500, color: S.ink }}>{r.label}</td>
                <td style={{ padding: '11px 22px' }}>
                  {r.restricted === false
                    ? <span style={{ fontSize: 12, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)', padding: '2px 10px', borderRadius: 99, fontWeight: 600 }}>Público</span>
                    : <span style={{ fontSize: 12, background: 'rgba(94,43,208,0.08)', color: S.purpleText, border: '1px solid rgba(94,43,208,0.2)', padding: '2px 10px', borderRadius: 99, fontWeight: 600 }}>Restrito</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
