import Button from './Button'

export default function EmptyState({
  icon: Icon, title, subtitle,
  actionLabel, onAction,
  secondaryLabel, onSecondary,
  style,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      padding: '48px 24px', gap: 6, ...style,
    }}>
      {Icon && (
        <div style={{
          width: 84, height: 84, borderRadius: 20, marginBottom: 10,
          background: `color-mix(in srgb, var(--primary) 10%, white)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={34} color="var(--primary)" strokeWidth={1.8} />
        </div>
      )}
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 17, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
        {title}
      </p>
      {subtitle && (
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--muted)',
          margin: 0, maxWidth: 320, lineHeight: 1.5,
        }}>{subtitle}</p>
      )}
      {actionLabel && (
        <div style={{ marginTop: 14 }}>
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
      {secondaryLabel && (
        <button
          type="button"
          onClick={onSecondary}
          style={{
            marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--muted)',
            textDecoration: 'underline',
          }}
        >{secondaryLabel}</button>
      )}
    </div>
  )
}
