export default function Button({
  children, variant = 'primary', fullWidth = false, icon: Icon,
  disabled = false, style, type = 'button', ...rest
}) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700,
    padding: '11px 18px', borderRadius: 'var(--r-input)', border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    width: fullWidth ? '100%' : undefined,
    minHeight: 44, boxSizing: 'border-box',
    transition: 'filter .15s, background .15s, transform .1s',
  }
  const variants = {
    primary: { background: 'var(--primary)', color: '#fff', boxShadow: 'var(--shadow-btn-primary)' },
    secondary: { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)' },
    ghost: { background: 'transparent', color: 'var(--primary)' },
    dark: { background: '#18181B', color: '#fff' },
  }
  return (
    <button
      type={type}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(0.94)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
      {...rest}
    >
      {Icon && <Icon size={16} strokeWidth={2.3} />}
      {children}
    </button>
  )
}
