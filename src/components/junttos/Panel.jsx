import { T } from '../../theme/tokens'

export default function Panel({ title, subtitle, action, children, style: extra = {}, bodyStyle = {} }) {
  return (
    <div style={{
      background:   T.white,
      borderRadius: T.rCard,
      boxShadow:    T.cardShadow,
      border:       `1px solid ${T.line}`,
      fontFamily:   T.ui,
      ...extra,
    }}>
      <div style={{
        padding: '18px 24px 14px',
        borderBottom: `1px solid ${T.line}`,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <h3 style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, margin: 0, lineHeight: 1.3 }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{ fontSize: 13, color: T.muted, margin: 0, lineHeight: 1.4 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      <div style={{ padding: 24, ...bodyStyle }}>
        {children}
      </div>
    </div>
  )
}
