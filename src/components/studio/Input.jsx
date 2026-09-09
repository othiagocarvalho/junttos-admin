import { useState } from 'react'

/**
 * Rótulo de campo — padrão oficial da Junttos (ver docs/DESIGN_SYSTEM.md).
 *
 * Bolinha na cor do tema à esquerda + texto em peso médio, na cor do tema,
 * pequeno e SEM caixa alta.
 *
 * SUBSTITUI o padrão antigo: 11px, peso 700, cinza (--muted), uppercase com
 * letter-spacing. Aquele rótulo pesava mais que o valor digitado logo abaixo e,
 * em formulário com muitos campos, virava uma parede de caixa alta cinza.
 *
 * A cor vem de var(--primary), que useLojaTheme.js preenche com a cor_primaria
 * da loja — o rótulo acompanha o tema sem receber prop nenhuma, e é por isso
 * que trocar SÓ este componente já muda todos os formulários do sistema.
 */
export function Label({ children }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 7,
      fontSize: 12.5, fontWeight: 600, color: 'var(--primary)',
      marginBottom: 7, fontFamily: 'var(--font-ui)',
    }}>
      <span aria-hidden="true" style={{
        width: 6, height: 6, borderRadius: 99, flexShrink: 0,
        background: 'var(--primary)',
      }} />
      {children}
    </label>
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
