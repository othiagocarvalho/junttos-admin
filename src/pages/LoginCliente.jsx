import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo   from '../components/junttos/Logo'
import Input  from '../components/junttos/Input'
import Button from '../components/junttos/Button'
import { T }  from '../theme/tokens'

const FEATURES = [
  { icon: '📦', text: 'Controle de estoque em tempo real' },
  { icon: '💳', text: 'PDV e múltiplas formas de pagamento' },
  { icon: '📊', text: 'Relatórios e metas da sua loja' },
]

export default function LoginCliente() {
  const { login, error, setError } = useAuth()
  const navigate = useNavigate()

  const [credential, setCredential] = useState('')
  const [password,   setPassword]   = useState('')
  const [remember,   setRemember]   = useState(false)
  const [loading,    setLoading]    = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 650))
    const ok = login(credential, password)
    setLoading(false)
    if (ok) navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', fontFamily: T.ui }}>

      {/* ── Left brand panel (lg+) ── */}
      <div
        className="hidden lg:flex"
        style={{
          flex:       '0 0 44%',
          maxWidth:   520,
          background: T.iconGrad,
          position:   'relative',
          overflow:   'hidden',
          flexDirection: 'column',
          alignItems:    'center',
          justifyContent:'center',
          padding:    '60px 52px',
        }}
      >
        {/* Radial glows */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 55% 50% at 18% 88%, rgba(255,111,94,.22) 0%, transparent 65%),' +
            'radial-gradient(ellipse 48% 55% at 88% 8%,  rgba(155,123,255,.2) 0%, transparent 60%)',
        }} />
        {/* Decorative ring */}
        <div aria-hidden="true" style={{
          position: 'absolute', bottom: -140, left: -120,
          width: 400, height: 400, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.07)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 340 }}>
          <Logo variant="dark" size={76} />

          <p style={{
            marginTop:     28,
            color:         'rgba(255,255,255,0.92)',
            fontSize:      22,
            fontFamily:    T.brand,
            fontWeight:    700,
            lineHeight:    1.4,
            letterSpacing: '-0.02em',
          }}>
            Sua loja, organizada<br />num só lugar.
          </p>
          <p style={{
            marginTop:  10,
            color:      'rgba(255,255,255,0.52)',
            fontSize:   14,
            lineHeight: 1.65,
          }}>
            Estoque, vendas, catálogo e muito mais —<br />tudo na palma da mão.
          </p>

          <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
            {FEATURES.map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(255,255,255,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17,
                }}>
                  {icon}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: 500 }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex:           1,
        background:     T.white,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '48px 24px',
      }}>
        <div style={{
          width:     '100%',
          maxWidth:  390,
          animation: 'jt-fadeUp .5s ease',
        }}>

          {/* Logo */}
          <div style={{ marginBottom: 36 }}>
            <Logo variant="light" size={36} />
          </div>

          <h1 style={{
            fontSize:      26,
            fontWeight:    700,
            letterSpacing: '-0.02em',
            color:         T.ink,
            marginBottom:  6,
          }}>
            Que bom te ver de novo!
          </h1>
          <p style={{ fontSize: 14.5, color: T.muted, marginBottom: 30, lineHeight: 1.55 }}>
            Entre na sua conta para acessar o painel da loja.
          </p>

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <Input
              label="E-mail ou CPF"
              id="jt-credential"
              type="text"
              inputMode="email"
              autoComplete="username"
              placeholder="seu@email.com ou 000.000.000-00"
              value={credential}
              onChange={e => { setCredential(e.target.value); setError('') }}
              required
            />

            <Input
              label="Senha"
              id="jt-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              required
            />

            {/* Remember + Forgot */}
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              flexWrap:       'wrap',
              gap:            8,
            }}>
              <label style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                cursor:     'pointer',
                userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: T.purple, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13.5, color: T.muted }}>Manter conectado</span>
              </label>
              <button
                type="button"
                style={{
                  background: 'none',
                  border:     'none',
                  cursor:     'pointer',
                  fontSize:   13.5,
                  color:      T.purpleText,
                  fontWeight: 600,
                  padding:    '4px 0',
                  fontFamily: T.ui,
                }}
              >
                Esqueci minha senha
              </button>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                style={{
                  background:   'rgba(221,79,62,0.07)',
                  border:       '1px solid rgba(221,79,62,0.25)',
                  borderRadius: T.rChip,
                  padding:      '11px 16px',
                  color:        T.coralText,
                  fontSize:     13.5,
                }}
              >
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} variant="primary" style={{ marginTop: 4 }}>
              Entrar
            </Button>

          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '28px 0' }}>
            <div style={{ flex: 1, height: 1, background: T.line }} />
            <span style={{ fontSize: 12, color: T.muted, flexShrink: 0 }}>ou</span>
            <div style={{ flex: 1, height: 1, background: T.line }} />
          </div>

          {/* Create account */}
          <button
            type="button"
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = T.purple
              e.currentTarget.style.background  = 'rgba(94,43,208,0.04)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = T.line
              e.currentTarget.style.background  = 'none'
            }}
            style={{
              width:         '100%',
              height:        50,
              minHeight:     44,
              background:    'none',
              border:        `1.5px solid ${T.line}`,
              borderRadius:  T.rPill,
              fontFamily:    T.ui,
              fontSize:      15,
              fontWeight:    600,
              color:         T.purpleText,
              cursor:        'pointer',
              transition:    'border-color .18s, background .18s',
            }}
          >
            Criar conta
          </button>

          <p style={{
            textAlign:  'center',
            fontSize:   12,
            color:      T.muted,
            marginTop:  24,
            lineHeight: 1.65,
          }}>
            Ao entrar, você concorda com os{' '}
            <span style={{ color: T.purpleText, fontWeight: 600, cursor: 'pointer' }}>Termos de Uso</span>
            {' '}e a{' '}
            <span style={{ color: T.purpleText, fontWeight: 600, cursor: 'pointer' }}>Política de Privacidade</span>.
          </p>
        </div>
      </div>

      <style>{`
        #jt-credential::placeholder,
        #jt-password::placeholder { color: ${T.muted}; opacity: 1; }
      `}</style>
    </div>
  )
}
