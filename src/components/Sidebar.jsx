import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  DollarSign,
  MapPin,
  Settings,
  LogOut,
  ChevronRight,
  BarChart2,
} from 'lucide-react'

const S = {
  purple: '#5E2BD0',
  purpleText: '#491FB8',
  coral: '#FF6F5E',
  ink: '#16101F',
  mist: '#F6F3FA',
  line: '#E6E0F0',
  muted: '#7B7390',
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/consultants', icon: UserCheck, label: 'Consultores' },
  { to: '/visits', icon: MapPin, label: 'Visitas e Rotas' },
  { to: '/finance', icon: DollarSign, label: 'Faturamento' },
  { to: '/reports', icon: BarChart2, label: 'Relatórios' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

function JunttosSymbol({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="18 21 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="55" width="60" height="28" rx="14" fill="#5E2BD0" />
      <circle cx="40" cy="37" r="14" fill="#341780" />
      <circle cx="64" cy="39" r="14" fill="#FF6F5E" />
    </svg>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width: 240,
        background: '#FFFFFF',
        borderRight: `1px solid ${S.line}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '20px 20px',
        borderBottom: `1px solid ${S.line}`,
      }}>
        <JunttosSymbol size={36} />
        <span style={{
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: '-0.01em',
          textTransform: 'lowercase',
          color: S.purple,
          lineHeight: 1,
        }}>
          jun<span style={{ color: S.coral }}>tt</span>os
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10,
          fontWeight: 700,
          background: 'rgba(94,43,208,0.1)',
          color: S.purpleText,
          padding: '3px 8px',
          borderRadius: 99,
          border: '1px solid rgba(94,43,208,0.2)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          Admin
        </span>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? S.purpleText : S.muted,
              background: isActive ? 'rgba(94,43,208,0.09)' : 'transparent',
              border: isActive ? '1px solid rgba(94,43,208,0.18)' : '1px solid transparent',
              textDecoration: 'none',
              transition: 'background .14s, color .14s',
              position: 'relative',
            })}
            className="sidebar-nav-item"
          >
            {({ isActive }) => (
              <>
                <Icon style={{ width: 16, height: 16, flexShrink: 0, color: isActive ? S.purple : 'currentColor' }} />
                <span style={{ flex: 1 }}>{label}</span>
                <ChevronRight style={{ width: 13, height: 13, opacity: 0.3, flexShrink: 0 }} />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── User + logout ── */}
      <div style={{ padding: '10px 10px 16px', borderTop: `1px solid ${S.line}` }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 12,
          background: S.mist,
          marginBottom: 4,
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #6E3DF0, #4A1FB0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {user?.avatar}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: S.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </p>
            <p style={{ fontSize: 11.5, color: S.muted, margin: 0 }}>{user?.role}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '9px 12px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 500,
            color: S.muted,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'color .14s, background .14s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#DD4F3E'
            e.currentTarget.style.background = 'rgba(255,111,94,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = S.muted
            e.currentTarget.style.background = 'none'
          }}
        >
          <LogOut style={{ width: 16, height: 16 }} />
          Sair
        </button>
      </div>

      <style>{`
        .sidebar-nav-item:hover {
          background: rgba(94,43,208,0.05) !important;
          color: #16101F !important;
        }
        .sidebar-nav-item.active:hover {
          background: rgba(94,43,208,0.09) !important;
          color: #491FB8 !important;
        }
      `}</style>
    </aside>
  )
}
