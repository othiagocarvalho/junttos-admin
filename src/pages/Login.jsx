import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'

const S = {
  purple: '#5E2BD0',
  purpleText: '#491FB8',
  purpleDeep: '#341780',
  coral: '#FF6F5E',
  ink: '#16101F',
  mist: '#F6F3FA',
  line: '#E6E0F0',
  muted: '#7B7390',
}

function SymbolOnDark({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="55" width="60" height="28" rx="14" fill="#FFFFFF" />
      <circle cx="40" cy="37" r="14" fill="#EFE9FF" />
      <circle cx="64" cy="39" r="14" fill="#FF6F5E" />
    </svg>
  )
}

function SymbolOnLight({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="55" width="60" height="28" rx="14" fill="#5E2BD0" />
      <circle cx="40" cy="37" r="14" fill="#341780" />
      <circle cx="64" cy="39" r="14" fill="#FF6F5E" />
    </svg>
  )
}

function Wordmark({ size = 38, dark = false }) {
  return (
    <span style={{
      fontFamily: "'Quicksand', sans-serif",
      fontWeight: 700,
      fontSize: size,
      letterSpacing: '-0.01em',
      textTransform: 'lowercase',
      color: dark ? '#FFFFFF' : S.purple,
      lineHeight: 1,
    }}>
      jun<span style={{ color: S.coral }}>tt</span>os
    </span>
  )
}

export default function Login() {
  const { login, error, setError } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))
    const ok = login(email, password)
    setLoading(false)
    if (ok) navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden"
        style={{
          flex: 1,
          background: 'linear-gradient(150deg, #6E3DF0, #4A1FB0)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 60% 50% at 20% 80%, rgba(255,111,94,0.18) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 15%, rgba(155,123,255,0.22) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 340,
            height: 340,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.08)',
            bottom: -120,
            left: -100,
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 48px', maxWidth: 380 }}>
          <SymbolOnDark size={80} />
          <div style={{ marginTop: 24, marginBottom: 16 }}>
            <Wordmark size={46} dark />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
            Painel de controle para gestão completa de clientes, consultores, visitas e faturamento.
          </p>

          <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
            {[
              { emoji: '📊', text: 'Dashboard e métricas em tempo real' },
              { emoji: '👥', text: 'Gestão de clientes e consultores' },
              { emoji: '💰', text: 'Faturamento, relatórios e visitas' },
            ].map(({ emoji, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: 500 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, flexShrink: 0,
                }}>
                  {emoji}
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div
        style={{
          flex: 1,
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 32px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Mobile logo */}
          <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <SymbolOnLight size={32} />
            <Wordmark size={28} />
          </div>

          {/* Restricted badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: 'rgba(94,43,208,0.08)',
            border: '1px solid rgba(94,43,208,0.2)',
            borderRadius: 10,
            padding: '6px 12px',
            marginBottom: 24,
          }}>
            <ShieldCheck style={{ width: 14, height: 14, color: S.purple, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: S.purpleText, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Área Restrita · Somente Administradores
            </span>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: S.ink, marginBottom: 6 }}>
            Bem-vindo de volta
          </h1>
          <p style={{ fontSize: 14.5, color: S.muted, marginBottom: 28, lineHeight: 1.5 }}>
            Entre com suas credenciais de administrador para continuar.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.ink, marginBottom: 7, letterSpacing: '0.01em' }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="admin@junttos.com.br"
                required
                style={{
                  width: '100%',
                  height: 48,
                  border: `1.5px solid ${S.line}`,
                  borderRadius: 14,
                  padding: '0 16px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  color: S.ink,
                  background: S.mist,
                  outline: 'none',
                  transition: 'border-color .18s, box-shadow .18s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = S.purple
                  e.target.style.background = '#fff'
                  e.target.style.boxShadow = '0 0 0 3px rgba(94,43,208,0.12)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = S.line
                  e.target.style.background = S.mist
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.ink, marginBottom: 7, letterSpacing: '0.01em' }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    height: 48,
                    border: `1.5px solid ${S.line}`,
                    borderRadius: 14,
                    padding: '0 48px 0 16px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    color: S.ink,
                    background: S.mist,
                    outline: 'none',
                    transition: 'border-color .18s, box-shadow .18s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = S.purple
                    e.target.style.background = '#fff'
                    e.target.style.boxShadow = '0 0 0 3px rgba(94,43,208,0.12)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = S.line
                    e.target.style.background = S.mist
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: S.muted,
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4,
                  }}
                >
                  {showPassword
                    ? <EyeOff style={{ width: 17, height: 17 }} />
                    : <Eye style={{ width: 17, height: 17 }} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(255,111,94,0.08)',
                border: '1px solid rgba(255,111,94,0.3)',
                borderRadius: 12,
                padding: '12px 16px',
                color: '#DD4F3E',
                fontSize: 13.5,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 50,
                background: loading ? S.mist : S.coral,
                color: loading ? S.muted : '#fff',
                border: 'none',
                borderRadius: 99,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em',
                boxShadow: loading ? 'none' : '0 6px 20px rgba(255,111,94,0.35)',
                transition: 'background .18s, box-shadow .18s, transform .12s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
              }}
            >
              {loading ? (
                <>
                  <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Entrando…
                </>
              ) : 'Entrar no painel'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: S.muted, marginTop: 28, lineHeight: 1.6 }}>
            Acesso exclusivo para administradores da{' '}
            <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, color: S.purple }}>
              jun<span style={{ color: S.coral }}>tt</span>os
            </span>.
            <br />
            Dificuldades? Contate seu gestor.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #7B7390; }
      `}</style>
    </div>
  )
}
