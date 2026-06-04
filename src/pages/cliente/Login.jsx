import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClientAuth } from '../../context/ClientAuthContext'
import { Eye, EyeOff } from 'lucide-react'

const RG = {
  primary: '#C9956C',
  primaryDeep: '#A07050',
  accent: '#E8C4A8',
  text: '#3D2010',
  muted: '#9B8070',
  line: '#EDD8C8',
  warm: '#F5EDE8',
}

function SymbolOnDark({ size = 88 }) {
  return (
    <svg width={size} height={size} viewBox="18 21 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="55" width="60" height="28" rx="14" fill="rgba(255,255,255,0.9)" />
      <circle cx="40" cy="37" r="14" fill="rgba(255,255,255,0.45)" />
      <circle cx="64" cy="39" r="14" fill={RG.accent} />
    </svg>
  )
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Left brand panel */}
      <div
        className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden"
        style={{ flex: 1, background: `linear-gradient(150deg, ${RG.primary}, ${RG.primaryDeep})` }}
      >
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 50% at 20% 80%, rgba(232,196,168,0.25) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 15%, rgba(255,255,255,0.1) 0%, transparent 65%)',
        }} />
        <div aria-hidden="true" style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.1)',
          bottom: -100, left: -80, pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 48px', maxWidth: 360 }}>
          <SymbolOnDark />
          <div style={{ marginTop: 20 }}>
            <span style={{
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 700, fontSize: 40, letterSpacing: '-0.02em',
              textTransform: 'lowercase', color: '#fff', lineHeight: 1,
            }}>
              loja estrada
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14.5, lineHeight: 1.65, marginTop: 14 }}>
            Seu painel de vendas, metas e gestão — em um só lugar.
          </p>

          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
            {[
              { emoji: '🛍️', text: 'Registro de vendas simplificado' },
              { emoji: '📈', text: 'Acompanhe metas mensais' },
              { emoji: '💳', text: 'Fechamento de caixa fácil' },
            ].map(({ emoji, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: 500 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(255,255,255,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, flexShrink: 0,
                }}>{emoji}</div>
                {text}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 44, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>by</span>
            <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.8)', letterSpacing: '-0.01em', textTransform: 'lowercase' }}>
              junttos
            </span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{
        flex: 1, background: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 32px',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Mobile heading */}
          <div className="lg:hidden" style={{ marginBottom: 28 }}>
            <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', textTransform: 'lowercase', color: RG.primary }}>
              loja estrada
            </span>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: RG.text, marginBottom: 6 }}>
            Acesse seu painel
          </h1>
          <p style={{ fontSize: 14.5, color: RG.muted, marginBottom: 28, lineHeight: 1.5 }}>
            Entre com seu e-mail e senha para continuar.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: RG.text, marginBottom: 7, letterSpacing: '0.01em' }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="seu@email.com"
                required
                style={{
                  width: '100%', height: 48,
                  border: `1.5px solid ${RG.line}`, borderRadius: 14,
                  padding: '0 16px',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 15,
                  color: RG.text, background: RG.warm,
                  outline: 'none', transition: 'border-color .18s, box-shadow .18s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = RG.primary
                  e.target.style.background = '#fff'
                  e.target.style.boxShadow = `0 0 0 3px ${RG.primary}1f`
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = RG.line
                  e.target.style.background = RG.warm
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: RG.text, marginBottom: 7, letterSpacing: '0.01em' }}>
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
                    width: '100%', height: 48,
                    border: `1.5px solid ${RG.line}`, borderRadius: 14,
                    padding: '0 48px 0 16px',
                    fontFamily: "'DM Sans', sans-serif", fontSize: 15,
                    color: RG.text, background: RG.warm,
                    outline: 'none', transition: 'border-color .18s, box-shadow .18s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = RG.primary
                    e.target.style.background = '#fff'
                    e.target.style.boxShadow = `0 0 0 3px ${RG.primary}1f`
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = RG.line
                    e.target.style.background = RG.warm
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: RG.muted,
                    display: 'flex', alignItems: 'center', padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: `${RG.primary}15`,
                border: `1px solid ${RG.primary}40`,
                borderRadius: 12, padding: '12px 16px',
                color: RG.primaryDeep, fontSize: 13.5,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 50,
                background: loading ? RG.warm : RG.primary,
                color: loading ? RG.muted : '#fff',
                border: 'none', borderRadius: 99,
                fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em',
                boxShadow: loading ? 'none' : `0 6px 20px ${RG.primary}55`,
                transition: 'background .18s, box-shadow .18s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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

          <p style={{ textAlign: 'center', fontSize: 12, color: RG.muted, marginTop: 28, lineHeight: 1.6 }}>
            Painel exclusivo da{' '}
            <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, color: RG.primary }}>
              Loja Estrada
            </span>.
            <br />
            Dificuldades? Contate a Junttos.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input::placeholder { color: #9B8070; }`}</style>
    </div>
  )
}
