import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldCheck, KeyRound } from 'lucide-react'
import Logo   from '../components/junttos/Logo'
import Input  from '../components/junttos/Input'
import Button from '../components/junttos/Button'
import Card   from '../components/junttos/Card'
import { T }  from '../theme/tokens'

export default function Login() {
  const { login, error, setError } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [show2FA,  setShow2FA]  = useState(false)
  const [code2FA,  setCode2FA]  = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 650))
    const ok = login(email, password)
    setLoading(false)
    if (ok) navigate('/dashboard')
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     T.darkBg,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '48px 24px',
      fontFamily:     T.ui,
      position:       'relative',
      overflow:       'hidden',
    }}>

      {/* Background glows */}
      <div aria-hidden="true" style={{
        position:      'absolute',
        inset:         0,
        pointerEvents: 'none',
        background:
          'radial-gradient(ellipse 60% 45% at 15% 90%, rgba(94,43,208,.18) 0%, transparent 65%),' +
          'radial-gradient(ellipse 50% 50% at 90% 5%,  rgba(110,61,240,.14) 0%, transparent 60%)',
      }} />

      <div style={{
        position:  'relative',
        zIndex:    1,
        width:     '100%',
        maxWidth:  420,
        animation: 'jt-fadeUp .5s ease',
      }}>

        {/* Logo + Admin badge */}
        <div style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            16,
          marginBottom:   32,
          textAlign:      'center',
        }}>
          <Logo variant="dark" size={52} />

          <div style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          7,
            background:   'rgba(94,43,208,0.2)',
            border:       '1px solid rgba(155,123,255,0.3)',
            borderRadius: T.rChip,
            padding:      '5px 13px',
          }}>
            <ShieldCheck
              size={13}
              style={{ color: T.lilac, flexShrink: 0 }}
              aria-hidden="true"
            />
            <span style={{
              fontSize:      11,
              fontWeight:    700,
              color:         T.lilac,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Admin · Equipe Junttos
            </span>
          </div>
        </div>

        {/* Card */}
        <Card dark style={{ padding: '40px 36px' }}>

          <h1 style={{
            fontSize:      22,
            fontWeight:    700,
            letterSpacing: '-0.02em',
            color:         T.darkText,
            marginBottom:  6,
          }}>
            Acesso restrito
          </h1>
          <p style={{
            fontSize:     14,
            color:        T.darkMuted,
            marginBottom: 28,
            lineHeight:   1.55,
          }}>
            Somente membros da equipe Junttos. Acesso monitorado.
          </p>

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <Input
              label="E-mail corporativo"
              id="adm-email"
              type="email"
              autoComplete="username"
              placeholder="nome@junttos.com.br"
              dark
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              required
            />

            <Input
              label="Senha"
              id="adm-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              dark
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              required
            />

            {/* 2FA toggle */}
            <div>
              <button
                type="button"
                onClick={() => { setShow2FA(v => !v); setCode2FA('') }}
                style={{
                  background:    'none',
                  border:        'none',
                  cursor:        'pointer',
                  display:       'inline-flex',
                  alignItems:    'center',
                  gap:           6,
                  fontSize:      13,
                  color:         show2FA ? T.lilac : T.darkMuted,
                  fontFamily:    T.ui,
                  fontWeight:    500,
                  padding:       '2px 0',
                  transition:    'color .18s',
                }}
              >
                <KeyRound size={14} aria-hidden="true" />
                {show2FA ? 'Remover código 2FA' : 'Inserir código 2FA'}
              </button>

              {show2FA && (
                <div style={{ marginTop: 12 }}>
                  <Input
                    label="Código de verificação"
                    id="adm-2fa"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    placeholder="000 000"
                    dark
                    value={code2FA}
                    onChange={e => setCode2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                  />
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                style={{
                  background:   'rgba(221,79,62,0.1)',
                  border:       '1px solid rgba(221,79,62,0.3)',
                  borderRadius: T.rChip,
                  padding:      '11px 16px',
                  color:        T.coralSoft,
                  fontSize:     13.5,
                }}
              >
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} variant="primary" style={{ marginTop: 4 }}>
              Entrar no painel
            </Button>

          </form>

          <p style={{
            textAlign:  'center',
            fontSize:   12,
            color:      'rgba(255,255,255,0.25)',
            marginTop:  28,
            lineHeight: 1.65,
          }}>
            Acesso exclusivo para administradores da{' '}
            <span style={{ fontFamily: T.brand, fontWeight: 700, color: 'rgba(155,123,255,0.7)' }}>
              jun<span style={{ color: T.coral }}>tt</span>os
            </span>.
            <br />Dificuldades? Contate seu gestor.
          </p>
        </Card>
      </div>

      <style>{`
        #adm-email::placeholder,
        #adm-password::placeholder,
        #adm-2fa::placeholder { color: rgba(155,123,255,0.3); opacity: 1; }
      `}</style>
    </div>
  )
}
