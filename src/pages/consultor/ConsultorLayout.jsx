import { NavLink, useNavigate } from 'react-router-dom'
import { useConsultorAuth } from '../../context/ConsultorAuthContext'
import { Smartphone, ClipboardList, Plus, LogOut } from 'lucide-react'
import { T } from '../../theme/tokens'
import Logo from '../../components/junttos/Logo'

const NAV = [
  { to: '/demo',      icon: Smartphone,    label: 'Demo' },
  { to: '/visitas',   icon: ClipboardList, label: 'Visitas' },
  { to: '/nova-loja', icon: Plus,          label: 'Nova Loja' },
]

export default function ConsultorLayout({ children }) {
  const { user, logout } = useConsultorAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const firstName = user?.email?.split('@')[0] ?? 'Consultor'

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, fontFamily: T.ui, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: T.white, borderBottom: `1px solid ${T.line}`,
        padding: '0 16px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        {/* Logo + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: T.tintPurple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Logo variant="light" size={26} showWordmark={false} />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Junttos</p>
            <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{firstName}</p>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 10,
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? T.purple : T.muted,
                background: isActive ? T.tintPurple : 'transparent',
                textDecoration: 'none', transition: 'background .14s, color .14s',
              })}
            >
              <Icon size={15} strokeWidth={1.9} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sair"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', borderRadius: 10, border: `1px solid ${T.line}`,
            background: T.white, cursor: 'pointer',
            color: T.muted, fontSize: 13, fontFamily: T.ui, flexShrink: 0,
          }}
        >
          <LogOut size={14} strokeWidth={1.9} />
        </button>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '24px 16px 48px', maxWidth: 960, width: '100%', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
