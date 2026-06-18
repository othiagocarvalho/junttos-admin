import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClientAuth } from '../../context/ClientAuthContext'
import { supabase } from '../../lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import { gerarLogoDataURL } from '../../utils/gerarLogoSVG'

const LOJA_NAMES = {
  estrada:  'Loja Estrada',
  biastore: 'Usy Bia Store',
}

const KEYFRAMES = `
  @keyframes popIn {
    from { transform: scale(0.4); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
  @keyframes fadeUp {
    from { transform: translateY(16px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  input::placeholder { color: #b0a8c8; }
`

// ── Junttos logo ────────────────────────────────────────────
function JunttosLogo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
        <circle cx="13" cy="12" r="10" fill="rgba(255,255,255,0.92)"
          style={{ animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' }} />
        <circle cx="27" cy="15" r="9.5" fill="#FF6B47"
          style={{ animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.25s both' }} />
        <rect x="2" y="27" width="36" height="16" rx="8" fill="rgba(255,255,255,0.92)"
          style={{ animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.4s both' }} />
      </svg>
      <span style={{
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 700, fontSize: 18,
        color: '#fff', letterSpacing: '-0.01em',
        animation: 'fadeUp 0.6s ease 0.2s both',
      }}>
        jun<span style={{ color: '#FF6B47' }}>tt</span>os
      </span>
    </div>
  )
}

// ── Client logo ─────────────────────────────────────────────
function ClientLogo({ lojaSlug, lojaConfig }) {
  const nome      = lojaConfig?.nome || LOJA_NAMES[lojaSlug] || 'Loja'
  const logoUrl   = lojaConfig?.logo_url || null
  const primary   = lojaConfig?.cor_primaria  || '#C9A84C'
  const secondary = lojaConfig?.cor_secundaria || '#1A1A1A'
  const [imgErr, setImgErr] = useState(false)

  const isBiaStore = lojaSlug === 'biastore'

  const src = isBiaStore
    ? '/logos/biastore-gold.svg'
    : (logoUrl && !imgErr
        ? logoUrl
        : gerarLogoDataURL({ nome, corPrimaria: primary, corSecundaria: secondary }))

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      animation: 'fadeUp 0.6s ease 0.4s both',
    }}>
      <img
        src={src}
        alt={nome}
        style={{ height: 68, width: 'auto', objectFit: 'contain', display: 'block' }}
        onError={isBiaStore ? undefined : () => setImgErr(true)}
      />
    </div>
  )
}

// ── Main component ──────────────────────────────────────────
export default function ClientLogin() {
  const { login } = useClientAuth()
  const navigate  = useNavigate()

  const lojaSlug = window.location.pathname.split('/')[1] || 'estrada'

  const [selectedMode, setSelectedMode] = useState(
    () => localStorage.getItem('junttos_viewMode') || 'mobile'
  )
  function saveMode(mode) {
    localStorage.setItem('junttos_viewMode', mode)
    setSelectedMode(mode)
  }

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [lojaConfig,  setLojaConfig]  = useState(null)
  const [remember,    setRemember]    = useState(
    () => localStorage.getItem('junttos_remember') === 'true'
  )

  useEffect(() => {
    supabase
      .from('lf_config')
      .select('nome, logo_url, cor_primaria, cor_secundaria')
      .eq('slug', lojaSlug)
      .maybeSingle()
      .then(({ data }) => { if (data) setLojaConfig(data) })
  }, [lojaSlug])

  useEffect(() => {
    if (localStorage.getItem('junttos_remember') === 'true') {
      const savedEmail = localStorage.getItem('junttos_saved_email') || ''
      const savedPwd   = localStorage.getItem('junttos_saved_pwd')   || ''
      if (savedEmail) setEmail(savedEmail)
      if (savedPwd)   setPassword(savedPwd)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (remember) {
      localStorage.setItem('junttos_remember',     'true')
      localStorage.setItem('junttos_saved_email',  email)
      localStorage.setItem('junttos_saved_pwd',    password)
    } else {
      localStorage.removeItem('junttos_remember')
      localStorage.removeItem('junttos_saved_email')
      localStorage.removeItem('junttos_saved_pwd')
    }
    const { error: err } = await login(email, password)
    setLoading(false)
    if (err) setError('E-mail ou senha incorretos.')
    else navigate('/dashboard')
  }

  const labelStyle = {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: '#6B5B8F', letterSpacing: '1.5px',
    textTransform: 'uppercase', marginBottom: 7,
  }

  const inputStyle = {
    width: '100%', height: 46, boxSizing: 'border-box',
    background: '#f7f5fc', border: '1.5px solid #e0d8f0',
    borderRadius: 10, padding: '0 14px',
    fontFamily: "'DM Sans', sans-serif", fontSize: 14,
    color: '#2A1F1F', outline: 'none',
    transition: 'border-color .18s, box-shadow .18s',
  }

  function onFocus(e) {
    e.target.style.borderColor = '#7B5DD4'
    e.target.style.boxShadow   = '0 0 0 3px rgba(123,93,212,0.12)'
    e.target.style.background  = '#fff'
  }
  function onBlur(e) {
    e.target.style.borderColor = '#e0d8f0'
    e.target.style.boxShadow   = 'none'
    e.target.style.background  = '#f7f5fc'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #6B4FBB 0%, #4A2D9C 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{KEYFRAMES}</style>

      {/* ── Logos ── */}
      <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <JunttosLogo />

          {/* Divisor vertical */}
          <div style={{
            width: 1, height: 52,
            background: 'rgba(255,255,255,0.25)',
            animation: 'fadeIn 0.4s ease 0.4s both',
          }} />

          <ClientLogo lojaSlug={lojaSlug} lojaConfig={lojaConfig} />
        </div>

        <p style={{
          fontSize: 12, color: 'rgba(255,255,255,0.6)',
          fontWeight: 500, letterSpacing: '0.02em',
          animation: 'fadeIn 0.5s ease 0.7s both',
        }}>
          Painel exclusivo para sua loja
        </p>
      </div>

      {/* ── Formulário ── */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: '#fff', borderRadius: 20,
        padding: '32px 28px',
        boxShadow: '0 24px 60px rgba(30,15,70,0.25)',
        animation: 'fadeUp 0.6s ease 0.6s both',
      }}>
        <h2 style={{
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600, fontSize: 15,
          color: '#3A2470', marginBottom: 5,
          letterSpacing: '-0.01em',
        }}>
          Olá, que bom te ver!
        </h2>
        <p style={{ fontSize: 13, color: '#7B7390', marginBottom: 24, lineHeight: 1.5 }}>
          Entre com suas credenciais para continuar.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Email */}
          <div>
            <label style={labelStyle}>E-mail</label>
            <input
              type="email" value={email} required autoComplete="off"
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="seu@email.com"
              style={inputStyle}
              onFocus={onFocus} onBlur={onBlur}
            />
          </div>

          {/* Senha */}
          <div>
            <label style={labelStyle}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'} value={password} required autoComplete="off"
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 46 }}
                onFocus={onFocus} onBlur={onBlur}
              />
              <button
                type="button" onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9C8FC0', display: 'flex', alignItems: 'center', padding: 4,
                }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Lembrar dados */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: '#7B5DD4', cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: '#7B7390' }}>Lembrar meus dados</span>
          </label>

          {/* Erro */}
          {error && (
            <div style={{
              background: 'rgba(123,93,212,0.08)',
              border: '1px solid rgba(123,93,212,0.2)',
              borderRadius: 10, padding: '10px 14px',
              color: '#5E2BD0', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', height: 48, marginTop: 4,
              background: loading ? '#e0d8f0' : 'linear-gradient(135deg, #7B5DD4, #4A2D9C)',
              color: loading ? '#9C8FC0' : '#fff',
              border: 'none', borderRadius: 12,
              fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 6px 20px rgba(74,45,156,0.35)',
              transition: 'opacity .18s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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

          {/* Mode selection */}
          <div style={{ marginTop: 14 }}>
            <p style={{ textAlign: 'center', fontSize: 10, color: '#9C8FC0', fontFamily: 'Manrope, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Modo de visualização
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { mode: 'mobile',  label: '📱 Celular' },
                { mode: 'desktop', label: '💻 Computador' },
              ].map(({ mode, label }) => {
                const active = selectedMode === mode
                return (
                  <button key={mode} type="button" onClick={() => saveMode(mode)} style={{
                    flex: 1, height: 40, borderRadius: 10, cursor: 'pointer',
                    fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: active ? 700 : 500,
                    border: active ? '2px solid #7B5DD4' : '1.5px solid #e0d8f0',
                    background: active ? 'rgba(123,93,212,0.08)' : '#f7f5fc',
                    color: active ? '#5E2BD0' : '#9C8FC0',
                    transition: 'all .15s',
                  }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9C8FC0', marginTop: 20, lineHeight: 1.6, whiteSpace: 'nowrap' }}>
          Uma boa gestão não se faz sozinho(a). Vamos fazer <span style={{ fontWeight: 700, color: '#5E2BD0' }}>Jun<span style={{ color: '#F4613A' }}>tt</span>os</span>?
        </p>
      </div>
    </div>
  )
}
