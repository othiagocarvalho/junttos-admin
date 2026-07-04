export default function PageHeader({ title, subtitle, actions, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16, marginBottom: 24, flexWrap: 'wrap', ...style,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{
          fontFamily: 'var(--font-ui)', fontSize: 26, fontWeight: 800, color: 'var(--ink)',
          letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2,
        }}>{title}</h1>
        {subtitle && (
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--muted)', margin: '4px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}
