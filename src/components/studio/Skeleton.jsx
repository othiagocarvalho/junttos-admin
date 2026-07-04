export function SkeletonLine({ width = '100%', height = 14, style }) {
  return <div className="jt-skeleton" style={{ width, height, ...style }} />
}

export function SkeletonCard({ height = 90, style }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)',
      padding: 16, boxSizing: 'border-box', ...style,
    }}>
      <SkeletonLine width="40%" height={11} style={{ marginBottom: 10 }} />
      <SkeletonLine width="65%" height={height >= 90 ? 24 : 16} />
    </div>
  )
}

export function SkeletonRow({ style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 14,
      background: 'var(--surface)', ...style,
    }}>
      <div className="jt-skeleton" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonLine width="55%" height={12} />
        <SkeletonLine width="30%" height={10} />
      </div>
      <SkeletonLine width={54} height={16} />
    </div>
  )
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}
