import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { T } from '../../theme/tokens'

export default function Input({
  label,
  error,
  type  = 'text',
  dark  = false,
  id,
  ...rest
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const inputType  = isPassword ? (show ? 'text' : 'password') : type
  const inputId    = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  const borderNormal = error
    ? T.coralText
    : dark ? T.darkLine : T.line
  const bgNormal  = dark ? 'rgba(255,255,255,0.06)' : T.mist
  const textColor = dark ? T.darkText : T.ink

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize:      13,
            fontWeight:    600,
            color:         dark ? 'rgba(255,255,255,0.65)' : T.ink,
            letterSpacing: '0.01em',
            fontFamily:    T.ui,
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          type={inputType}
          style={{
            width:          '100%',
            height:         50,
            minHeight:      44,
            borderRadius:   T.rInput,
            border:         `1.5px solid ${borderNormal}`,
            background:     bgNormal,
            color:          textColor,
            fontFamily:     T.ui,
            fontSize:       15,
            padding:        `0 ${isPassword ? 50 : 16}px 0 16px`,
            outline:        'none',
            boxSizing:      'border-box',
            transition:     'border-color .18s, box-shadow .18s, background .18s',
          }}
          onFocus={e => {
            e.target.style.borderColor = T.purple
            e.target.style.background  = dark ? 'rgba(255,255,255,0.1)' : T.white
            e.target.style.boxShadow   = `0 0 0 3px rgba(94,43,208,${dark ? '.2' : '.1'})`
          }}
          onBlur={e => {
            e.target.style.borderColor = borderNormal
            e.target.style.background  = bgNormal
            e.target.style.boxShadow   = 'none'
          }}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            tabIndex={0}
            style={{
              position:       'absolute',
              right:          12,
              top:            '50%',
              transform:      'translateY(-50%)',
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              color:          dark ? 'rgba(255,255,255,0.4)' : T.muted,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        4,
              minWidth:       44,
              minHeight:      44,
            }}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>

      {error && (
        <span
          role="alert"
          style={{ fontSize: 12.5, color: T.coralText, fontFamily: T.ui }}
        >
          {error}
        </span>
      )}
    </div>
  )
}
