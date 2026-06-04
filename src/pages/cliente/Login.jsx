import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClientAuth } from '../../context/ClientAuthContext'
import { Eye, EyeOff } from 'lucide-react'

const METALLIC = 'linear-gradient(135deg, #E8C0AF 0%, #D49E8A 22%, #B97766 42%, #7A3E33 58%, #B97766 72%, #DCAA96 88%, #F0C9B6 100%)'

const label = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 8,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  fontFamily: 'Manrope, sans-serif',
}

const inputBase = {
  width: '100%', height: 50,
  border: '1.5px solid var(--line)', borderRadius: 14,
  padding: '0 16px',
  fontFamily: 'Manrope, sans-serif', fontSize: 15,
  color: 'var(--ink)', background: '#FAFAF8',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color .18s, box-shadow .18s',
}

export default function ClientLogin() {
  const { login } = useClientAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await login(email, password)
    setLoading(false)
    if (err) {
      setError('E-mail ou senha incorretos.')
    } else {
      navigate('/dashboard')
    }
  }

  function focusInput(e) {
    e.target.style.borderColor = 'var(--rose-deep)'
    e.target.style.boxShadow = '0 0 0 3px rgba(180,122,107,0.15)'
    e.target.style.background = '#fff'
  }
  function blurInput(e) {
    e.target.style.borderColor = 'var(--line)'
    e.target.style.boxShadow = 'none'
    e.target.style.background = '#FAFAF8'
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
      fontFamily: 'Manrope, sans-serif',
    }}>
      {/* Logo strip */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          background: METALLIC,
          borderRadius: 16, padding: '2px',
          marginBottom: 20,
        }}>
          <div style={{ background: 'var(--bg)', borderRadius: 14, padding: '10px 24px' }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic', fontWeight: 700,
              fontSize: 32, letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}>
              estrada.
            </span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
          Painel de gestão da loja
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)',
        borderRadius: 24, border: '1px solid var(--line)',
        padding: '32px 28px',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
          Entrar
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
          Use seu e-mail e senha para acessar.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={label}>E-mail</label>
            <input
              type="email" value={email} required
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="seu@email.com"
              style={inputBase}
              onFocus={focusInput} onBlur={blurInput}
            />
          </div>

          <div>
            <label style={label}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'} value={password} required
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                style={{ ...inputBase, paddingRight: 48 }}
                onFocus={focusInput} onBlur={blurInput}
              />
              <button
                type="button" onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
                  display: 'flex', alignItems: 'center', padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(180,122,107,0.08)', border: '1px solid rgba(180,122,107,0.25)',
              borderRadius: 12, padding: '12px 16px',
              color: 'var(--rose-deep)', fontSize: 13.5, fontFamily: 'Manrope, sans-serif',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', height: 52, marginTop: 4,
              background: loading ? 'var(--line)' : METALLIC,
              color: loading ? 'var(--muted)' : '#fff',
              border: 'none', borderRadius: 99,
              fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
              boxShadow: loading ? 'none' : '0 6px 24px rgba(122,62,51,0.3)',
              transition: 'opacity .18s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.3 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Entrando…
              </>
            ) : 'Entrar no painel'}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 28, fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
        Dificuldades? Contate a{' '}
        <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, color: 'var(--rose-deep)', textTransform: 'lowercase' }}>
          jun<span style={{ color: 'var(--muted)' }}>tt</span>os
        </span>
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input::placeholder { color: var(--muted); }`}</style>
    </div>
  )
}
