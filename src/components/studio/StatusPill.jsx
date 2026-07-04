const TONES = {
  warn: { bg: 'var(--status-warn-bg)', tx: 'var(--status-warn-tx)', dot: 'var(--status-warn-dot)' },
  ok:   { bg: 'var(--status-ok-bg)',   tx: 'var(--status-ok-tx)',   dot: 'var(--status-ok-dot)'   },
  info: { bg: 'var(--status-info-bg)', tx: 'var(--status-info-tx)', dot: 'var(--status-info-dot)' },
  bad:  { bg: 'var(--status-bad-bg)',  tx: 'var(--status-bad-tx)',  dot: 'var(--status-bad-dot)'  },
}

export default function StatusPill({ tone = 'info', label, style }) {
  const t = TONES[tone] || TONES.info
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 'var(--r-pill)',
      background: t.bg, color: t.tx,
      fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
      whiteSpace: 'nowrap', lineHeight: 1.4,
      ...style,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot, flexShrink: 0 }} />
      {label}
    </span>
  )
}
