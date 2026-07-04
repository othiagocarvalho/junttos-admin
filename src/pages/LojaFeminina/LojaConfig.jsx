import { useState, useEffect } from 'react'
import { Settings, Save, Palette, ToggleRight, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useClientAuth } from '../../context/ClientAuthContext'
import Card from '../../components/studio/Card'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import Toggle from '../../components/studio/Toggle'

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

  const sectionTitle = {
    fontSize: 14, fontWeight: 700, color: 'var(--ink)',
    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  }

  return (
    <div style={{ background: 'var(--bg)', padding: '0 16px 32px', minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Identidade */}
      <Card>
        <p style={sectionTitle}>
          <Settings size={16} style={{ color: theme.primary }} />
          Identidade da Loja
        </p>
        <Label>Nome da Loja</Label>
        <Input
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Ex: Estrada Moda Feminina"
        />
      </Card>

      {/* Funcionalidades */}
      <Card>
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
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 'var(--r-input)',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {label}
                </span>
                <Toggle on={on} onClick={() => toggleFeat(key)} />
              </div>
            )
          })}
        </div>
      </Card>

      {/* Tema */}
      <Card>
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
            <Label>Cor primária</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
                style={{ width: 40, height: 40, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', cursor: 'pointer', padding: 2, background: 'var(--surface)', flexShrink: 0 }} />
              <Input mono value={primary} onChange={e => setPrimary(e.target.value)}
                style={{ flex: 1 }} />
            </div>
          </div>
          <div>
            <Label>Cor de destaque</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                style={{ width: 40, height: 40, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', cursor: 'pointer', padding: 2, background: 'var(--surface)', flexShrink: 0 }} />
              <Input mono value={accent} onChange={e => setAccent(e.target.value)}
                style={{ flex: 1 }} />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div style={{ borderRadius: 'var(--r-input)', padding: 12, border: '1px solid var(--line)', background: 'var(--bg)' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Preview</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ height: 32, flex: 1, borderRadius: 'var(--r-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: primary, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Primária
            </div>
            <div style={{ height: 32, flex: 1, borderRadius: 'var(--r-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: accent, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Destaque
            </div>
          </div>
        </div>
      </Card>

      {/* Salvar */}
      <Button
        variant="primary"
        fullWidth
        icon={Save}
        onClick={handleSave}
        disabled={saving}
        style={saved ? { background: '#16a34a', boxShadow: 'none' } : undefined}
      >
        {saved ? 'Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
      </Button>

      {/* Alterar Senha */}
      <Card>
        <p style={sectionTitle}>
          <Lock size={16} style={{ color: theme.primary }} />
          Alterar Senha
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label>Senha atual</Label>
            <Input
              type="password" value={pwdForm.current} autoComplete="current-password"
              onChange={e => setPwdForm({ ...pwdForm, current: e.target.value })}
              placeholder="••••••••"
            />
          </div>
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password" value={pwdForm.novo} autoComplete="new-password"
              onChange={e => setPwdForm({ ...pwdForm, novo: e.target.value })}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              type="password" value={pwdForm.confirm} autoComplete="new-password"
              onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })}
              placeholder="••••••••"
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

          <Button
            variant="primary"
            onClick={handleChangePwd}
            disabled={pwdSaving || !pwdForm.current || !pwdForm.novo || !pwdForm.confirm}
          >
            {pwdSaving ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
