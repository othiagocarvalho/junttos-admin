export default function Card({ children, style, padding = 20, hoverable = false, className, ...rest }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-card)',
        padding,
        boxSizing: 'border-box',
        transition: hoverable ? 'box-shadow .15s, transform .15s' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

export function HeroCard({ children, tone = 'primary', style, ...rest }) {
  const bg = tone === 'dark'
    ? '#18181B'
    : `linear-gradient(135deg, var(--primary) 0%, var(--rose-deep) 100%)`
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--r-card)',
        background: bg,
        padding: '28px 24px',
        boxSizing: 'border-box',
        ...style,
      }}
      {...rest}
    >
      <div style={{
        position: 'absolute', top: -46, right: -36, width: 150, height: 150,
        borderRadius: '50%',
        background: tone === 'dark' ? 'rgba(94,43,208,0.25)' : 'var(--accent)',
        opacity: tone === 'dark' ? 1 : 0.28,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}
