import { useState, useEffect } from 'react'
import { Settings, Save, Palette, ToggleLeft, ToggleRight, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useClientAuth } from '../../context/ClientAuthContext'

const PRESETS = [
  { label: 'Junttos',   primary: '#5E2BD0', accent: '#FF6F5E' },
  { label: 'Rosê',      primary: '#C9956C', accent: '#E8C4A8' },
  { label: 'Verde',     primary: '#16a34a', accent: '#4ade80' },
  { label: 'Azul',      primary: '#2563eb', accent: '#38bdf8' },
  { label: 'Borgonha',  primary: '#9D174D', accent: '#FB7185' },
]

const FEATURE_LABELS = {
  vendas:           'Nova Venda',
  historico:        'Histórico',
  metas:            'Metas',
  fechamento_caixa: 'Fechamento de Caixa',
  relatorios:       'Relatórios / Faturamento',
  clientes:         'Clientes',
  estoque:          'Estoque',
}

export default function LojaConfig({ config, features, saveConfig, theme }) {
  const { user } = useClientAuth()

  const [nome,   setNome]   = useState(config?.nome            || '')
  const [primary, setPrimary] = useState(config?.cor_primaria  || '#5E2BD0')
  const [accent,  setAccent]  = useState(config?.cor_secundaria || '#FF6F5E')
  const [feats,  setFeats]  = useState({ ...features })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const [pwdForm,   setPwdForm]   = useState({ current: '', novo: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg,    setPwdMsg]    = useState(null)

  useEffect(() => {
    if (config) {
      setNome(config.nome            || '')
      setPrimary(config.cor_primaria  || '#5E2BD0')
      setAccent(config.cor_secundaria || '#FF6F5E')
      setFeats({ ...features })
    }
  }, [config])

  function toggleFeat(key) {
    setFeats(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    setSaving(true)
    await saveConfig({
      nome: nome || 'Loja Feminina',
      cor_primaria:   primary,
      cor_secundaria: accent,
      features: feats,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleChangePwd() {
    const { current, novo, confirm } = pwdForm
    if (novo !== confirm) {
      setPwdMsg({ type: 'error', text: 'A nova senha e a confirmação não coincidem.' })
      return
    }
    if (novo.length < 6) {
      setPwdMsg({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' })
      return
    }
    setPwdSaving(true)
    setPwdMsg(null)
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user?.email,
      password: current,
    })
    if (authErr) {
      setPwdSaving(false)
      setPwdMsg({ type: 'error', text: 'Senha atual incorreta.' })
      return
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: novo })
    if (updateErr) {
      setPwdSaving(false)
      setPwdMsg({ type: 'error', text: 'Erro ao atualizar senha. Tente novamente.' })
      return
    }
    await saveConfig({ senha: novo })
    setPwdSaving(false)
    setPwdMsg({ type: 'success', text: 'Senha alterada com sucesso!' })
    setPwdForm({ current: '', novo: '', confirm: '' })
    setTimeout(() => setPwdMsg(null), 4000)
  }

  const card = {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  }

  const sectionTitle = {
    fontSize: 14, fontWeight: 600, color: 'var(--ink)',
    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  }

  const lbl = {
    fontSize: 11, fontWeight: 700, color: theme.primary,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    display: 'block', marginBottom: 6, fontFamily: 'Plus Jakarta Sans, sans-serif',
  }

  const inputStyle = {
    width: '100%', background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14,
    color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ background: 'var(--bg)', padding: '0 16px 32px', minHeight: '100dvh' }}>

      {/* Identidade */}
      <div style={card}>
        <p style={sectionTitle}>
          <Settings size={16} style={{ color: theme.primary }} />
          Identidade da Loja
        </p>
        <label style={lbl}>Nome da Loja</label>
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Ex: Estrada Moda Feminina"
          style={inputStyle}
        />
      </div>

      {/* Funcionalidades */}
      <div style={card}>
        <p style={{ ...sectionTitle, marginBottom: 4 }}>
          <ToggleRight size={16} style={{ color: theme.primary }} />
          Funcionalidades Habilitadas
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Controle quais abas e módulos ficam visíveis para esta loja.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(FEATURE_LABELS).map(([key, label]) => {
            const on = feats[key] ?? false
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => toggleFeat(key)}
                onKeyDown={e => e.key === 'Enter' && toggleFeat(key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                  userSelect: 'none',
                  border: on ? `1px solid ${theme.primary}50` : '1px solid var(--line)',
                  background: on ? `${theme.primary}0A` : 'var(--bg)',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {label}
                </span>
                {on
                  ? <ToggleRight size={20} style={{ color: theme.primary }} />
                  : <ToggleLeft  size={20} style={{ color: 'var(--muted)' }} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tema */}
      <div style={card}>
        <p style={sectionTitle}>
          <Palette size={16} style={{ color: theme.primary }} />
          Tema de Cores
        </p>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <div
              key={p.label}
              role="button"
              tabIndex={0}
              onClick={() => { setPrimary(p.primary); setAccent(p.accent) }}
              onKeyDown={e => e.key === 'Enter' && (setPrimary(p.primary), setAccent(p.accent))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                fontSize: 12, fontWeight: 500, fontFamily: 'Plus Jakarta Sans, sans-serif',
                userSelect: 'none',
                ...(primary === p.primary
                  ? { border: `1px solid ${p.primary}`, background: `${p.primary}15`, color: p.primary }
                  : { border: '1px solid var(--line)', color: 'var(--muted)', background: 'transparent' }),
              }}
            >
              <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.primary }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.accent }} />
              </div>
              {p.label}
            </div>
          ))}
        </div>

        {/* Color pickers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={lbl}>Cor primária</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
                style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer', padding: 2, background: 'var(--surface)' }} />
              <input value={primary} onChange={e => setPrimary(e.target.value)}
                style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }} />
            </div>
          </div>
          <div>
            <label style={lbl}>Cor de destaque</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer', padding: 2, background: 'var(--surface)' }} />
              <input value={accent} onChange={e => setAccent(e.target.value)}
                style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }} />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div style={{ borderRadius: 12, padding: 12, border: '1px solid var(--line)' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Preview</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ height: 32, flex: 1, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: primary, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Primária
            </div>
            <div style={{ height: 32, flex: 1, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: accent, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Destaque
            </div>
          </div>
        </div>
      </div>

      {/* Salvar */}
      <div
        role="button"
        tabIndex={0}
        onClick={!saving ? handleSave : undefined}
        onKeyDown={e => !saving && e.key === 'Enter' && handleSave()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: 14, borderRadius: 12, marginBottom: 12,
          fontSize: 14, fontWeight: 600, color: '#fff',
          cursor: saving ? 'not-allowed' : 'pointer',
          background: saved ? '#16a34a' : theme.primary,
          opacity: saving ? 0.5 : 1,
          userSelect: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        <Save size={16} color="#fff" />
        {saved ? 'Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
      </div>

      {/* Alterar Senha */}
      <div style={card}>
        <p style={sectionTitle}>
          <Lock size={16} style={{ color: theme.primary }} />
          Alterar Senha
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lbl}>Senha atual</label>
            <input
              type="password" value={pwdForm.current} autoComplete="current-password"
              onChange={e => setPwdForm({ ...pwdForm, current: e.target.value })}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={lbl}>Nova senha</label>
            <input
              type="password" value={pwdForm.novo} autoComplete="new-password"
              onChange={e => setPwdForm({ ...pwdForm, novo: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={lbl}>Confirmar nova senha</label>
            <input
              type="password" value={pwdForm.confirm} autoComplete="new-password"
              onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {pwdMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              fontSize: 13, fontWeight: 500, fontFamily: 'Plus Jakarta Sans, sans-serif',
              ...(pwdMsg.type === 'success'
                ? { background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', color: '#16a34a' }
                : { background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }),
            }}>
              {pwdMsg.text}
            </div>
          )}

          <div
            role="button"
            tabIndex={0}
            onClick={!pwdSaving && pwdForm.current && pwdForm.novo && pwdForm.confirm ? handleChangePwd : undefined}
            onKeyDown={e => e.key === 'Enter' && !pwdSaving && pwdForm.current && pwdForm.novo && pwdForm.confirm && handleChangePwd()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 14px', borderRadius: 10,
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: pwdSaving || !pwdForm.current || !pwdForm.novo || !pwdForm.confirm ? 'not-allowed' : 'pointer',
              background: theme.primary,
              opacity: pwdSaving || !pwdForm.current || !pwdForm.novo || !pwdForm.confirm ? 0.4 : 1,
              userSelect: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            {pwdSaving ? 'Salvando...' : 'Salvar nova senha'}
          </div>
        </div>
      </div>
    </div>
  )
}
