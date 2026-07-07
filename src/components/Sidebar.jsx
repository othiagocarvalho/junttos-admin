import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from './junttos/Logo'
import {
  LayoutDashboard, Users, UserCheck, DollarSign, MapPin,
  Settings, LogOut, BarChart2, Network, CreditCard,
  ChevronsRight, ChevronsLeft, Sparkles,
} from 'lucide-react'
import { T } from '../theme/tokens'

const NAV = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clientes',    icon: Users,           label: 'Clientes',           superAdmin: true },
  { to: '/cobrancas',   icon: CreditCard,      label: 'Cobranças' },
  { to: '/consultants', icon: UserCheck,       label: 'Consultores' },
  { to: '/visits',      icon: MapPin,          label: 'Visitas e Rotas' },
  { to: '/finance',     icon: DollarSign,      label: 'Faturamento' },
  { to: '/reports',     icon: BarChart2,       label: 'Relatórios' },
  { to: '/arquitetura', icon: Network,         label: 'Arquitetura' },
  { to: '/simulador',   icon: Sparkles,        label: 'Simulador de Plano' },
  { to: '/settings',    icon: Settings,        label: 'Configurações' },
]

const COLLAPSED_W = 64
const EXPANDED_W  = 248
const EASE        = 'cubic-bezier(0.4, 0, 0.2, 1)'

function readPinned() {
  try { return localStorage.getItem('jt-sidebar-pinned') === 'true' } catch { return false }
}

export default function Sidebar({ navOpen, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [pinned,  setPinned]  = useState(readPinned)
  const [hovered, setHovered] = useState(false)

  // Mobile (navOpen) always shows full sidebar; desktop uses hover/pin
  const isExpanded = pinned || hovered || navOpen

  function togglePin() {
    const next = !pinned
    setPinned(next)
    try { localStorage.setItem('jt-sidebar-pinned', String(next)) } catch {}
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  const w = isExpanded ? EXPANDED_W : COLLAPSED_W

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-screen z-40 flex flex-col
          transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width:        w,
          background:   T.white,
          borderRight:  `1px solid ${T.line}`,
          fontFamily:   T.ui,
          transition:   `width 0.22s ${EASE}, transform 200ms ease-in-out`,
          overflow:     'hidden',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* ── Header: logo + pin toggle ── */}
        <div style={{
          padding:        '18px 0 0',
          flexShrink:     0,
          display:        'flex',
          flexDirection:  'column',
        }}>
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: isExpanded ? 'space-between' : 'center',
            padding:        isExpanded ? '0 14px 0 16px' : '0',
            minHeight:      40,
            transition:     `padding 0.22s ${EASE}`,
          }}>
            {/* Logo — symbol only when collapsed, full lockup when expanded */}
            <div style={{ overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {isExpanded
                ? <Logo variant="light" size={28} />
                : <Logo variant="light" size={28} showWordmark={false} />
              }
            </div>

            {/* Pin toggle — only on desktop, fades in when expanded */}
            <button
              onClick={togglePin}
              title={pinned ? 'Desafixar sidebar' : 'Fixar sidebar expandida'}
              className="hidden lg:flex"
              style={{
                alignItems:     'center',
                justifyContent: 'center',
                width:          28,
                height:         28,
                borderRadius:   8,
                border:         `1px solid ${T.line}`,
                background:     pinned ? T.tintPurple : T.white,
                color:          pinned ? T.purpleText : T.muted,
                cursor:         'pointer',
                flexShrink:     0,
                opacity:        isExpanded ? 1 : 0,
                pointerEvents:  isExpanded ? 'auto' : 'none',
                transition:     `opacity 0.15s ease, background 0.15s, color 0.15s`,
              }}
              onMouseEnter={e => {
                if (!pinned) {
                  e.currentTarget.style.background = T.tintPurple
                  e.currentTarget.style.color      = T.purpleText
                  e.currentTarget.style.borderColor = T.purple
                }
              }}
              onMouseLeave={e => {
                if (!pinned) {
                  e.currentTarget.style.background  = T.white
                  e.currentTarget.style.color        = T.muted
                  e.currentTarget.style.borderColor  = T.line
                }
              }}
            >
              {pinned
                ? <ChevronsLeft  style={{ width: 14, height: 14 }} />
                : <ChevronsRight style={{ width: 14, height: 14 }} />
              }
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: `1px solid ${T.line}`, margin: '14px 0 0' }} />
        </div>

        {/* ── Nav ── */}
        <nav style={{
          flex:          1,
          padding:       '6px 8px',
          display:       'flex',
          flexDirection: 'column',
          gap:           2,
          overflowY:     'auto',
          overflowX:     'hidden',
        }}>
          {NAV.filter(item => !item.superAdmin || user?.role === 'Super Admin').map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              title={!isExpanded ? label : undefined}
              className="jt-nav-item"
              style={({ isActive }) => ({
                display:        'flex',
                alignItems:     'center',
                justifyContent: isExpanded ? 'flex-start' : 'center',
                gap:            isExpanded ? 10 : 0,
                padding:        isExpanded ? '9px 12px' : '9px 0',
                borderRadius:   10,
                fontSize:       13.5,
                fontWeight:     isActive ? 600 : 500,
                color:          isActive ? T.coralText : T.muted,
                background:     isActive ? T.tintCoral  : 'transparent',
                textDecoration: 'none',
                transition:     `background .14s, color .14s, padding 0.22s ${EASE}, gap 0.22s ${EASE}`,
                whiteSpace:     'nowrap',
                minWidth:       0,
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon style={{
                    width:     18,
                    height:    18,
                    flexShrink: 0,
                    color:     isActive ? T.coral : 'inherit',
                    strokeWidth: 1.9,
                    transition: 'color .14s',
                  }} />
                  <span style={{
                    overflow:   'hidden',
                    whiteSpace: 'nowrap',
                    maxWidth:   isExpanded ? 180 : 0,
                    opacity:    isExpanded ? 1 : 0,
                    transition: `max-width 0.22s ${EASE}, opacity 0.15s ease`,
                    display:    'block',
                  }}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Footer: user info + logout ── */}
        <div style={{
          borderTop:  `1px solid ${T.line}`,
          padding:    '8px 8px 12px',
          flexShrink: 0,
          display:    'flex',
          flexDirection: 'column',
          gap:        4,
          overflow:   'hidden',
        }}>
          {/* User card */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            gap:            isExpanded ? 10 : 0,
            padding:        isExpanded ? '10px 12px' : '8px 0',
            borderRadius:   10,
            background:     T.tintPurple,
            transition:     `padding 0.22s ${EASE}, gap 0.22s ${EASE}`,
            overflow:       'hidden',
          }}>
            <div style={{
              width:          38,
              height:         38,
              borderRadius:   '50%',
              flexShrink:     0,
              background:     T.iconGrad,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          T.white,
              fontSize:       13,
              fontWeight:     700,
            }}>
              {user?.avatar}
            </div>

            <div style={{
              minWidth:   0,
              overflow:   'hidden',
              maxWidth:   isExpanded ? 140 : 0,
              opacity:    isExpanded ? 1 : 0,
              transition: `max-width 0.22s ${EASE}, opacity 0.15s ease`,
            }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </p>
              <p style={{ fontSize: 11.5, color: T.muted, margin: 0, whiteSpace: 'nowrap' }}>
                {user?.role}
              </p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title={!isExpanded ? 'Sair' : undefined}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              gap:            isExpanded ? 10 : 0,
              padding:        isExpanded ? '9px 12px' : '9px 0',
              borderRadius:   10,
              fontSize:       13.5,
              fontWeight:     500,
              color:          T.muted,
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              fontFamily:     T.ui,
              width:          '100%',
              transition:     `color .14s, background .14s, padding 0.22s ${EASE}`,
              whiteSpace:     'nowrap',
              overflow:       'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color      = T.coralText
              e.currentTarget.style.background = T.tintCoral
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color      = T.muted
              e.currentTarget.style.background = 'none'
            }}
          >
            <LogOut style={{ width: 17, height: 17, strokeWidth: 1.9, flexShrink: 0 }} />
            <span style={{
              overflow:   'hidden',
              whiteSpace: 'nowrap',
              maxWidth:   isExpanded ? 140 : 0,
              opacity:    isExpanded ? 1 : 0,
              transition: `max-width 0.22s ${EASE}, opacity 0.15s ease`,
              display:    'block',
            }}>
              Sair
            </span>
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
