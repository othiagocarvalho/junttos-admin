export default function Chip({ label, count, active, onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
        padding: '8px 14px', borderRadius: 'var(--r-chip)',
        fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
        border: active ? '1px solid var(--primary)' : '1px solid var(--line)',
        background: active ? `color-mix(in srgb, var(--primary) 10%, white)` : 'var(--surface)',
        color: active ? 'var(--primary)' : 'var(--muted)',
        cursor: 'pointer', whiteSpace: 'nowrap',
        minHeight: 36,
        ...style,
      }}
    >
      {label}
      {count != null && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          padding: '1px 6px', borderRadius: 999,
          background: active ? 'var(--primary)' : 'var(--line)',
          color: active ? '#fff' : 'var(--muted)',
        }}>{count}</span>
      )}
    </button>
  )
}

export function ChipRow({ children, style }) {
  return (
    <div style={{
      display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2,
      WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      ...style,
    }}>
      {children}
    </div>
  )
}
