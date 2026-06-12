import { T } from '../../theme/tokens'

const SYMBOL_COLORS = {
  light: { shoulders: T.purple,  headLeft: T.purpleDeep, headRight: T.coral },
  dark:  { shoulders: '#6E3DF0', headLeft: '#EFE9FF',    headRight: T.coral },
  icon:  { shoulders: T.white,   headLeft: T.white,      headRight: T.coral },
}

function Symbol({ variant = 'light', size = 40 }) {
  const c = SYMBOL_COLORS[variant] ?? SYMBOL_COLORS.light
  return (
    <svg
      width={size}
      height={size}
      viewBox="18 21 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="20" y="55" width="60" height="28" rx="14" fill={c.shoulders} />
      <circle cx="40" cy="37" r="14" fill={c.headLeft} />
      <circle cx="64" cy="39" r="14" fill={c.headRight} />
    </svg>
  )
}

export default function Logo({
  variant      = 'light',
  size         = 40,
  showWordmark = true,
  horizontal   = true,
}) {
  const wordColor = variant === 'dark' ? T.white : T.purple
  const wordSize  = Math.round(size * 0.66)
  const gap       = Math.round(size * 0.3)

  return (
    <div
      role="img"
      aria-label="Junttos"
      style={{
        display:        'inline-flex',
        flexDirection:  horizontal ? 'row' : 'column',
        alignItems:     'center',
        gap,
      }}
    >
      <Symbol variant={variant} size={size} />
      {showWordmark && (
        <span style={{
          fontFamily:    T.brand,
          fontWeight:    700,
          fontSize:      wordSize,
          letterSpacing: '-0.01em',
          color:         wordColor,
          lineHeight:    1,
          userSelect:    'none',
        }}>
          jun<span style={{ color: T.coral }}>tt</span>os
        </span>
      )}
    </div>
  )
}
