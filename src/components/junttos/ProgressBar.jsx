import { T } from '../../theme/tokens'

export default function ProgressBar({ name, description, value, percent, color = T.purple }) {
  const pct = Math.min(100, Math.max(0, percent ?? 0))

  return (
    <div style={{ fontFamily: T.ui }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
        {/* Left: name + description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          {description && (
            <span style={{ fontSize: 12, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {description}
            </span>
          )}
        </div>
        {/* Right: value + percent */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
          {value != null && (
            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, fontFamily: T.mono }}>
              {value}
            </span>
          )}
          <span style={{ fontSize: 12, color: T.muted }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Track */}
      <div style={{
        height: 8, borderRadius: T.rPill,
        background: T.mist,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: T.rPill,
          background: color,
          width: `${pct}%`,
          transition: 'width .4s ease',
        }} />
      </div>
    </div>
  )
}
