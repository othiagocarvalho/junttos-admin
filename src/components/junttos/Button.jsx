import { T } from '../../theme/tokens'

const VARIANTS = {
  primary: {
    bg:     T.purple,
    color:  T.white,
    shadow: '0 6px 20px rgba(94,43,208,0.35)',
  },
  coral: {
    bg:     T.coral,
    color:  T.white,
    shadow: '0 6px 20px rgba(255,111,94,0.35)',
  },
  ghost: {
    bg:     'transparent',
    color:  T.purpleText,
    shadow: 'none',
    border: `1.5px solid ${T.line}`,
  },
  ghostDark: {
    bg:     'transparent',
    color:  'rgba(255,255,255,0.75)',
    shadow: 'none',
    border: '1.5px solid rgba(155,123,255,0.25)',
  },
}

function Spinner() {
  return (
    <svg
      style={{ width: 17, height: 17, animation: 'jt-spin 1s linear infinite', flexShrink: 0 }}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle style={{ opacity: .25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
      <path style={{ opacity: .75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

export default function Button({
  children,
  variant   = 'primary',
  loading   = false,
  fullWidth = true,
  height    = 50,
  fontSize  = 16,
  style: extra = {},
  ...props
}) {
  const v   = VARIANTS[variant] ?? VARIANTS.primary
  const off = loading || props.disabled

  return (
    <button
      disabled={off}
      style={{
        width:          fullWidth ? '100%' : 'auto',
        height,
        minHeight:      44,
        background:     off ? `${v.bg}88` : v.bg,
        color:          v.color,
        border:         v.border ?? 'none',
        borderRadius:   T.rPill,
        fontFamily:     T.ui,
        fontSize,
        fontWeight:     700,
        letterSpacing:  '-0.01em',
        cursor:         off ? 'not-allowed' : 'pointer',
        boxShadow:      off ? 'none' : v.shadow,
        transition:     'background .18s, box-shadow .18s, transform .1s',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            8,
        padding:        '0 28px',
        ...extra,
      }}
      {...props}
    >
      {loading ? <><Spinner />Entrando…</> : children}
    </button>
  )
}
