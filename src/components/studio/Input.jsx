import { useState } from 'react'

export function Label({ children }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
      marginBottom: 7, letterSpacing: '0.08em', textTransform: 'uppercase',
      fontFamily: 'var(--font-ui)',
    }}>{children}</label>
  )
}

export default function Input({ mono = false, style, ...rest }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...rest}
      onFocus={e => { setFocused(true); rest.onFocus?.(e) }}
      onBlur={e => { setFocused(false); rest.onBlur?.(e) }}
      style={{
        width: '100%', height: 44, boxSizing: 'border-box',
        background: focused ? 'var(--surface)' : 'var(--bg)',
        border: `1.5px solid ${focused ? 'var(--primary)' : 'var(--line)'}`,
        borderRadius: 'var(--r-input)', padding: '0 14px',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
        fontSize: 14, color: 'var(--ink)', outline: 'none',
        boxShadow: focused ? `0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent)` : 'none',
        transition: 'border-color .15s, box-shadow .15s, background .15s',
        ...style,
      }}
    />
  )
}
