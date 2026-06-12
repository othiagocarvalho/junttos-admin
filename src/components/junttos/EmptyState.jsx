import { T } from '../../theme/tokens'

function JunttosSymbol() {
  return (
    <svg width="44" height="44" viewBox="18 21 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="55" width="60" height="28" rx="14" fill={T.purple} />
      <circle cx="40" cy="37" r="14" fill={T.purpleDeep} />
      <circle cx="64" cy="39" r="14" fill={T.coral} />
    </svg>
  )
}

export default function EmptyState({ title, description, action, onAction }) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      textAlign:      'center',
      padding:        '56px 24px',
      fontFamily:     T.ui,
    }}>
      {/* Tile */}
      <div style={{
        width: 78, height: 78, borderRadius: 22,
        background: T.tintPurple,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        flexShrink: 0,
      }}>
        <JunttosSymbol />
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8, maxWidth: 340 }}>
        {title}
      </h3>

      {description && (
        <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.6, marginBottom: action ? 24 : 0, maxWidth: 340 }}>
          {description}
        </p>
      )}

      {action && onAction && (
        <button
          onClick={onAction}
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            8,
            height:         44,
            padding:        '0 24px',
            borderRadius:   T.rPill,
            background:     T.purple,
            color:          T.white,
            border:         'none',
            cursor:         'pointer',
            fontSize:       14,
            fontWeight:     700,
            fontFamily:     T.ui,
            boxShadow:      '0 4px 16px rgba(94,43,208,0.28)',
            transition:     'background .18s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.purpleDeep }}
          onMouseLeave={e => { e.currentTarget.style.background = T.purple }}
        >
          {action}
        </button>
      )}
    </div>
  )
}
