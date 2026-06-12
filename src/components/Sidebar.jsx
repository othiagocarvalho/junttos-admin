import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from './junttos/Logo'
import {
  LayoutDashboard, Users, UserCheck, DollarSign, MapPin,
  Settings, LogOut, BarChart2, Network, Building2,
} from 'lucide-react'
import { T } from '../theme/tokens'

const NAV = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients',     icon: Users,           label: 'Clientes' },
  { to: '/consultants', icon: UserCheck,       label: 'Consultores' },
  { to: '/visits',      icon: MapPin,          label: 'Visitas e Rotas' },
  { to: '/finance',     icon: DollarSign,      label: 'Faturamento' },
  { to: '/reports',     icon: BarChart2,       label: 'Relatórios' },
  { to: '/arquitetura', icon: Network,         label: 'Arquitetura' },
  { to: '/clientes',    icon: Building2,       label: 'Painel Clientes' },
  { to: '/settings',    icon: Settings,        label: 'Configurações' },
]

export default function Sidebar({ navOpen, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-screen z-40 flex flex-col
          transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width: 248,
          background: T.white,
          borderRight: `1px solid ${T.line}`,
          fontFamily: T.ui,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 20px 0' }}>
          <Logo variant="light" size={30} />
          <hr style={{ border: 'none', borderTop: `1px solid ${T.line}`, margin: '16px 0 0' }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className="jt-nav-item"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? T.coralText : T.muted,
                background: isActive ? T.tintCoral : 'transparent',
                textDecoration: 'none',
                transition: 'background .14s, color .14s',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon style={{ width: 18, height: 18, flexShrink: 0, color: isActive ? T.coral : T.muted, strokeWidth: 1.9 }} />
                  <span style={{ flex: 1 }}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer: user + logout */}
        <div style={{ padding: '10px 10px 14px', borderTop: `1px solid ${T.line}` }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: T.tintPurple, marginBottom: 4,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: T.iconGrad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.white, fontSize: 13, fontWeight: 700,
            }}>
              {user?.avatar}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </p>
              <p style={{ fontSize: 11.5, color: T.muted, margin: 0 }}>{user?.role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 12px', borderRadius: 10,
              fontSize: 13.5, fontWeight: 500, color: T.muted,
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: T.ui, transition: 'color .14s, background .14s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = T.coralText
              e.currentTarget.style.background = T.tintCoral
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = T.muted
              e.currentTarget.style.background = 'none'
            }}
          >
            <LogOut style={{ width: 17, height: 17, strokeWidth: 1.9 }} />
            Sair
          </button>
        </div>
      </aside>

      <style>{`
        .jt-nav-item:hover:not(.active) {
          background: ${T.mist} !important;
          color: ${T.ink} !important;
        }
        .jt-nav-item:hover:not(.active) svg {
          color: ${T.ink} !important;
        }
      `}</style>
    </>
  )
}
