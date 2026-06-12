import { ExternalLink } from 'lucide-react'
import StatusPill from './StatusPill'
import { T } from '../../theme/tokens'

export default function ListRow({ logo, name, slug, status, href, primary = T.purple }) {
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        14,
        padding:    '12px 20px',
        borderBottom: `1px solid ${T.line}`,
        transition: 'background .12s',
        fontFamily: T.ui,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#FBFAFE' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Avatar */}
      {logo ? (
        <img
          src={logo}
          alt={name}
          style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain', border: `1px solid ${T.line}`, background: T.mist, flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `${primary}18`,
          border: `1px solid ${primary}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: primary,
        }}>
          {initials}
        </div>
      )}

      {/* Name + slug */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </p>
        <p style={{ fontSize: 12, color: T.muted2, margin: 0, fontFamily: T.mono }}>
          /{slug}
        </p>
      </div>

      {/* Status */}
      {status && <StatusPill status={status} />}

      {/* Link */}
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:    'inline-flex',
            alignItems: 'center',
            gap:        5,
            fontSize:   12.5,
            fontWeight: 600,
            color:      T.purpleText,
            textDecoration: 'none',
            flexShrink: 0,
            padding:    '4px 0',
          }}
        >
          <ExternalLink style={{ width: 13, height: 13, strokeWidth: 1.9 }} />
          Acessar
        </a>
      )}
    </div>
  )
}
