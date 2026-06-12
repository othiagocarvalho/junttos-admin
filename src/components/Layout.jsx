import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import Logo from './junttos/Logo'
import { T } from '../theme/tokens'

export default function Layout({ children }) {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg }}>

      {/* Sidebar always occupies 64px on desktop — content never shifts on expand */}
      <style>{`
        @media (min-width: 1024px) {
          .jt-main-content { margin-left: 64px; }
        }
      `}</style>

      <Sidebar navOpen={navOpen} onClose={() => setNavOpen(false)} />

      {/* Mobile overlay */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="lg:hidden"
          style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(22,16,31,0.35)' }}
        />
      )}

      <main
        className="jt-main-content"
        style={{
          flex:          1,
          minWidth:      0,
          height:        '100vh',
          overflowY:     'auto',
          display:       'flex',
          flexDirection: 'column',
        }}
      >
        {/* Mobile top bar */}
        <div
          className="lg:hidden"
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '14px 20px',
            background:     T.white,
            borderBottom:   `1px solid ${T.line}`,
            position:       'sticky',
            top:            0,
            zIndex:         30,
            flexShrink:     0,
          }}
        >
          <button
            onClick={() => setNavOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink, padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <Menu size={22} strokeWidth={1.9} />
          </button>
          <Logo variant="light" size={26} />
          <div style={{ width: 30 }} />
        </div>

        <div style={{ padding: '30px 32px', flex: 1 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
