import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConsultorAuth } from '../../context/ConsultorAuthContext'
import { Loader2, AlertCircle } from 'lucide-react'
import { T } from '../../theme/tokens'

export default function ConsultorLogin() {
  const { login } = useConsultorAuth()
  const navigate  = useNavigate()
  const [email,    setEmail]    = useState('')
  const [senha,    setSenha]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await login(email, senha)
    setLoading(false)
    if (err) { setError(err.message); return }
    navigate('/visitas', { replace: true })
  }

  const inp = {
    width: '100%', height: 48, boxSizing: 'border-box',
    background: T.mist, border: `1.5px solid ${T.line}`,
    borderRadius: T.rInput, padding: '0 14px',
    fontFamily: T.ui, fontSize: 15, color: T.ink, outline: 'none',
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: T.ui }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(150deg,#6E3DF0,#4A1FB0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>J</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Portal do Consultor</h1>
          <p style={{ fontSize: 14, color: T.muted }}>Acesse com suas credenciais Junttos</p>
        </div>

        {/* Form */}
        <div style={{ background: T.white, borderRadius: T.rCard + 4, boxShadow: T.cardShadow, border: `1px solid ${T.line}`, padding: '28px 24px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>E-mail</label>
              <input
                type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                style={inp}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Senha</label>
              <input
                type="password" required
                value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                style={inp}
              />
            </div>

            {error && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '10px 12px', marginBottom: 16 }}>
                <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: T.coralText, margin: 0, lineHeight: 1.4 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 48, borderRadius: T.rCard,
                background: loading ? T.mist : T.purple,
                color: loading ? T.muted : '#fff',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: T.ui, fontSize: 15, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: loading ? 'none' : '0 4px 16px rgba(94,43,208,0.28)',
                transition: 'all .18s',
              }}
            >
              {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Entrando…</> : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: T.muted, marginTop: 16 }}>
          Só consultores credenciados têm acesso.
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
