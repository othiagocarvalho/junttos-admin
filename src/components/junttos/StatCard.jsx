import { T } from '../../theme/tokens'

const PALETTE = {
  purple: { icon: T.purple,     tint: T.tintPurple },
  coral:  { icon: T.coral,      tint: T.tintCoral  },
  lilac:  { icon: T.lilac,      tint: T.tintLilac  },
  deep:   { icon: T.purpleDeep, tint: T.tintDeep   },
}

export default function StatCard({ icon: Icon, color = 'purple', label, value, delta }) {
  const p = PALETTE[color] ?? PALETTE.purple

  const deltaDir = delta == null
    ? null
    : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'

  const deltaColor =
    deltaDir === 'up'   ? T.statusAtivoTx :
    deltaDir === 'down' ? T.coralText      : T.muted

  return (
    <div
      style={{
        background:   T.white,
        borderRadius: T.rCard,
        boxShadow:    T.cardShadow,
        border:       `1px solid ${T.line}`,
        padding:      20,
        cursor:       'default',
        transition:   'transform .18s, box-shadow .18s',
        fontFamily:   T.ui,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform  = 'translateY(-2px)'
        e.currentTarget.style.boxShadow  = T.cardShadowHover
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform  = 'none'
        e.currentTarget.style.boxShadow  = T.cardShadow
      }}
    >
      {/* Icon tile */}
      <div style={{
        width: 42, height: 42, borderRadius: T.rTile,
        background: p.tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
        flexShrink: 0,
      }}>
        <Icon style={{ width: 20, height: 20, color: p.icon, strokeWidth: 1.9 }} />
      </div>

      {/* Label */}
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 5, lineHeight: 1.4 }}>
        {label}
      </p>

      {/* Value */}
      <p style={{ fontSize: 27, fontWeight: 700, color: T.ink, lineHeight: 1.1, marginBottom: deltaDir ? 8 : 0 }}>
        {value}
      </p>

      {/* Delta */}
      {deltaDir && (
        <p style={{ fontSize: 12.5, color: deltaColor, display: 'flex', alignItems: 'center', gap: 3, margin: 0 }}>
          <span>{deltaDir === 'up' ? '↑' : deltaDir === 'down' ? '↓' : '—'}</span>
          <span>{Math.abs(delta)}%</span>
        </p>
      )}
    </div>
  )
}
