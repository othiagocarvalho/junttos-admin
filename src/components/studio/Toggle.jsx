export default function Toggle({ on, onClick, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 40, height: 24, borderRadius: 999, border: 'none', flexShrink: 0,
        background: on ? 'var(--primary)' : 'var(--line)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background .15s',
        padding: 0, opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 19 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .15s',
      }} />
    </button>
  )
}
