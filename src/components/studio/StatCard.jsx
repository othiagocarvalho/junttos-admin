export default function StatCard({ label, value, sub, icon: Icon, iconColor, style }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)',
      padding: '16px 16px', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 10,
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</p>
        {Icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 9, flexShrink: 0,
            background: `color-mix(in srgb, ${iconColor || 'var(--primary)'} 14%, white)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={15} color={iconColor || 'var(--primary)'} strokeWidth={2} />
          </div>
        )}
      </div>
      <p style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, color: 'var(--ink)',
        lineHeight: 1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</p>
      {sub && (
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)', margin: 0 }}>{sub}</p>
      )}
    </div>
  )
}

export function StatGrid({ children, style }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
      gap: 12,
      width: '100%',
      boxSizing: 'border-box',
      ...style,
    }}>
      {children}
    </div>
  )
}
