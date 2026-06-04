import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Building2, Upload, Check, ExternalLink, Edit2,
  ToggleLeft, ToggleRight, AlertCircle, X, RefreshCw,
} from 'lucide-react'

const PROD_BASE = 'https://junttos-admin.vercel.app'

const S = {
  purple: '#5E2BD0', purpleText: '#491FB8', coral: '#FF6F5E',
  ink: '#16101F', mist: '#F6F3FA', line: '#E6E0F0', muted: '#7B7390',
}

const PLANOS = [
  { value: 'basico',       label: 'Básico — 1 usuário' },
  { value: 'profissional', label: 'Profissional — 3 usuários' },
  { value: 'premium',      label: 'Premium — ilimitado' },
]

const DEFAULT_FEATURES = {
  vendas: true, historico: true, metas: true,
  fechamento_caixa: true, relatorios: true,
  clientes: false, estoque: false,
}

const FEATURE_LABELS = {
  vendas: 'Vendas', historico: 'Histórico', metas: 'Metas',
  fechamento_caixa: 'Fechamento de Caixa', relatorios: 'Relatórios',
  clientes: 'Clientes', estoque: 'Estoque',
}

const EMPTY = {
  nome: '', slug: '', email: '', senha: '',
  cor_primaria: '#5E2BD0', cor_secundaria: '#FF6F5E',
  plano: 'basico', status: 'ativo',
  features: { ...DEFAULT_FEATURES },
  logoFile: null, logoPreview: null, existingLogoUrl: null,
}

function toSlug(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '').trim()
}

async function uploadLogo(slug, file) {
  const ext = file.name.split('.').pop().toLowerCase()
  const path = `${slug}/logo.${ext}`
  const { error } = await supabase.storage
    .from('logos').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(`Upload: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
  return publicUrl
}

export default function CadastroCliente() {
  const [clientes,  setClientes]  = useState([])
  const [form,      setForm]      = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [fetching,  setFetching]  = useState(true)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')
  const fileRef = useRef(null)
  const formRef = useRef(null)

  useEffect(() => { fetchClientes() }, [])

  async function fetchClientes() {
    setFetching(true)
    const { data } = await supabase
      .from('lf_config').select('*').order('created_at', { ascending: false })
    setClientes(data || [])
    setFetching(false)
  }

  function handleEdit(c) {
    setForm({
      nome: c.nome || '',
      slug: c.slug || c.loja_id || '',
      email: '', senha: '',
      cor_primaria: c.cor_primaria || '#5E2BD0',
      cor_secundaria: c.cor_secundaria || '#FF6F5E',
      plano: c.plano || 'basico',
      status: c.status || 'ativo',
      features: { ...DEFAULT_FEATURES, ...(c.features || {}) },
      logoFile: null,
      logoPreview: c.logo_url || null,
      existingLogoUrl: c.logo_url || null,
    })
    setEditingId(c.id)
    setSuccess('')
    setError('')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleReset() {
    setForm(EMPTY)
    setEditingId(null)
    setSuccess('')
    setError('')
  }

  function handleNome(nome) {
    setForm(prev => ({ ...prev, nome, slug: editingId ? prev.slug : toSlug(nome) }))
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setForm(prev => ({ ...prev, logoFile: file, logoPreview: URL.createObjectURL(file) }))
  }

  function toggleFeature(key) {
    setForm(prev => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.slug.trim()) {
      setError('Nome e slug são obrigatórios.')
      return
    }
    if (!editingId && (!form.email.trim() || !form.senha.trim())) {
      setError('Email e senha são obrigatórios para nova cliente.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // 1. Upload logo
      let logoUrl = form.existingLogoUrl
      if (form.logoFile) logoUrl = await uploadLogo(form.slug, form.logoFile)

      // 2. Upsert lf_config
      const payload = {
        loja_id: form.slug, slug: form.slug, nome: form.nome,
        status: form.status, plano: form.plano,
        cor_primaria: form.cor_primaria, cor_secundaria: form.cor_secundaria,
        features: form.features, logo_url: logoUrl || null,
        updated_at: new Date().toISOString(),
      }
      const { error: cfgErr } = await supabase
        .from('lf_config').upsert(payload, { onConflict: 'loja_id' })
      if (cfgErr) throw new Error(`Configuração: ${cfgErr.message}`)

      // 3. Create Supabase Auth user (new clients only)
      let authNote = ''
      if (!editingId && form.email && form.senha) {
        const { error: authErr } = await supabase.auth.signUp({
          email: form.email,
          password: form.senha,
        })
        if (authErr && !authErr.message.toLowerCase().includes('already registered')) {
          throw new Error(`Autenticação: ${authErr.message}`)
        }
        if (authErr?.message.toLowerCase().includes('already registered')) {
          authNote = ' (email já existia no Auth — senha não alterada)'
        }
      }

      setSuccess(
        `✓ ${form.nome} ${editingId ? 'atualizada' : 'cadastrada'}!${authNote} ` +
        `URL de acesso: ${PROD_BASE}/${form.slug}`
      )
      handleReset()
      await fetchClientes()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Shared styles ────────────────────────────────────────────
  const inp = {
    width: '100%', height: 44, boxSizing: 'border-box',
    background: S.mist, border: `1.5px solid ${S.line}`,
    borderRadius: 12, padding: '0 14px',
    fontFamily: 'inherit', fontSize: 14, color: S.ink, outline: 'none',
    transition: 'border-color .18s, box-shadow .18s',
  }
  const onF = e => { e.target.style.borderColor = S.purple; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(94,43,208,0.12)' }
  const onB = e => { e.target.style.borderColor = S.line;   e.target.style.background = S.mist; e.target.style.boxShadow = 'none' }
  const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: S.ink, marginBottom: 6 }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: S.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>
          Painel de Clientes
        </h1>
        <p style={{ color: S.muted, fontSize: 14 }}>
          Cadastre e gerencie os painéis das clientes Junttos.
        </p>
      </div>

      {/* ── Lista ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: S.ink }}>
            Clientes cadastradas
            {!fetching && <span style={{ fontSize: 13, fontWeight: 500, color: S.muted, marginLeft: 8 }}>({clientes.length})</span>}
          </h2>
          <button onClick={fetchClientes} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {fetching ? (
          <p style={{ color: S.muted, fontSize: 14 }}>Carregando...</p>
        ) : clientes.length === 0 ? (
          <div style={{ background: '#fff', border: `1px solid ${S.line}`, borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
            <Building2 size={28} color={S.line} style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ color: S.muted, fontSize: 14 }}>Nenhum cliente cadastrado ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
            {clientes.map(c => {
              const initials = (c.nome || 'L').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
              const primary = c.cor_primaria || S.purple
              return (
                <div key={c.id} style={{ background: '#fff', border: `1px solid ${S.line}`, borderRadius: 16, padding: '18px 20px' }}>
                  {/* Logo + info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.nome}
                        style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', border: `1px solid ${S.line}`, background: S.mist }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${primary}18`, border: `1px solid ${primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: primary }}>{initials}</span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: S.ink, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</p>
                      <p style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>/{c.slug || c.loja_id}</p>
                    </div>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 99, fontWeight: 700, flexShrink: 0,
                      background: c.status === 'ativo' ? 'rgba(22,163,74,0.1)' : `${S.mist}`,
                      color: c.status === 'ativo' ? '#16a34a' : S.muted,
                    }}>
                      {c.status || 'ativo'}
                    </span>
                  </div>

                  {/* Plano + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, fontWeight: 600, background: S.mist, color: S.muted }}>
                      {c.plano || 'basico'}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleEdit(c)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.line}`, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: S.ink }}>
                        <Edit2 size={11} /> Editar
                      </button>
                      <a href={`${PROD_BASE}/${c.slug || c.loja_id}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: S.purple, color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                        <ExternalLink size={11} /> Acessar
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Formulário ── */}
      <div ref={formRef} style={{ background: '#fff', border: `1px solid ${S.line}`, borderRadius: 20, padding: '28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: S.ink, marginBottom: 4 }}>
              {editingId ? `Editando — ${form.nome || '...'}` : 'Nova Cliente'}
            </h2>
            <p style={{ fontSize: 13, color: S.muted }}>
              {editingId ? 'Atualize os dados abaixo e salve.' : 'Preencha os dados para criar o painel.'}
            </p>
          </div>
          {editingId && (
            <button onClick={handleReset}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: S.mist, border: `1px solid ${S.line}`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: S.muted, fontWeight: 600 }}>
              <X size={13} /> Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={handleSave}>
          {/* Row 1: Nome + Slug */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <div>
              <label style={lbl}>Nome da loja</label>
              <input value={form.nome} onChange={e => handleNome(e.target.value)}
                placeholder="Ex: Loja Estrada" style={inp} onFocus={onF} onBlur={onB} />
            </div>
            <div>
              <label style={lbl}>Slug — URL de acesso</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: S.muted, pointerEvents: 'none', userSelect: 'none' }}>.../</span>
                <input value={form.slug}
                  onChange={e => !editingId && setForm(p => ({ ...p, slug: toSlug(e.target.value) }))}
                  placeholder="lojaestrada"
                  style={{ ...inp, paddingLeft: 38, color: editingId ? S.muted : S.ink, cursor: editingId ? 'not-allowed' : 'text' }}
                  readOnly={!!editingId}
                  onFocus={editingId ? undefined : onF} onBlur={editingId ? undefined : onB}
                />
              </div>
              {form.slug && (
                <p style={{ fontSize: 11, color: S.muted, marginTop: 4, fontFamily: 'monospace' }}>
                  {PROD_BASE}/{form.slug}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Email + Senha */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <div>
              <label style={lbl}>
                Email de acesso
                {editingId && <span style={{ fontWeight: 400, color: S.muted, marginLeft: 6 }}>(somente leitura)</span>}
              </label>
              <input type="email" value={form.email}
                onChange={e => !editingId && setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="loja@email.com"
                style={{ ...inp, color: editingId ? S.muted : S.ink, cursor: editingId ? 'not-allowed' : 'text' }}
                readOnly={!!editingId}
                onFocus={editingId ? undefined : onF} onBlur={editingId ? undefined : onB}
              />
            </div>
            <div>
              <label style={lbl}>
                Senha inicial
                {editingId && <span style={{ fontWeight: 400, color: S.muted, marginLeft: 6 }}>(não editável aqui)</span>}
              </label>
              <input type="password" value={form.senha}
                onChange={e => !editingId && setForm(p => ({ ...p, senha: e.target.value }))}
                placeholder={editingId ? '—' : 'Mínimo 6 caracteres'}
                style={{ ...inp, color: editingId ? S.muted : S.ink, cursor: editingId ? 'not-allowed' : 'text' }}
                readOnly={!!editingId}
                onFocus={editingId ? undefined : onF} onBlur={editingId ? undefined : onB}
              />
            </div>
          </div>

          {/* Row 3: Plano + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <div>
              <label style={lbl}>Plano</label>
              <select value={form.plano} onChange={e => setForm(p => ({ ...p, plano: e.target.value }))}
                style={{ ...inp, cursor: 'pointer' }} onFocus={onF} onBlur={onB}>
                {PLANOS.map(pl => <option key={pl.value} value={pl.value}>{pl.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                style={{ ...inp, cursor: 'pointer' }} onFocus={onF} onBlur={onB}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          {/* Row 4: Cores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            {[
              { key: 'cor_primaria', label: 'Cor primária' },
              { key: 'cor_secundaria', label: 'Cor secundária' },
            ].map(({ key, label: l }) => (
              <div key={key}>
                <label style={lbl}>{l}</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="color" value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${S.line}`, cursor: 'pointer', padding: 2, flexShrink: 0 }}
                  />
                  <input value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ ...inp, fontFamily: 'monospace', flex: 1, width: 'auto' }}
                    onFocus={onF} onBlur={onB}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Logo upload */}
          <div style={{ marginBottom: 24 }}>
            <label style={lbl}>Logo da loja</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {form.logoPreview && (
                <img src={form.logoPreview} alt="preview"
                  style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'contain', border: `1px solid ${S.line}`, background: S.mist }} />
              )}
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, border: `1.5px dashed ${S.line}`, background: S.mist, cursor: 'pointer', fontSize: 13, color: S.muted, fontWeight: 600 }}>
                <Upload size={14} />
                {form.logoPreview ? 'Trocar logo' : 'Upload da logo'}
              </button>
              {form.logoFile && (
                <span style={{ fontSize: 12, color: S.muted }}>{form.logoFile.name}</span>
              )}
            </div>
            <p style={{ fontSize: 11, color: S.muted, marginTop: 6 }}>
              PNG, JPG, JPEG, SVG · Bucket "logos" no Supabase Storage (deve ser público).
            </p>
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp"
              onChange={handleFile} style={{ display: 'none' }} />
          </div>

          {/* Feature flags */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ ...lbl, marginBottom: 12 }}>Funcionalidades habilitadas</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
              {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                const on = form.features[key] ?? false
                return (
                  <button key={key} type="button" onClick={() => toggleFeature(key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all .15s',
                      border: `1px solid ${on ? S.purple + '40' : S.line}`,
                      background: on ? S.purple + '08' : S.mist,
                    }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: S.ink }}>{label}</span>
                    {on ? <ToggleRight size={20} color={S.purple} /> : <ToggleLeft size={20} color={S.line} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,111,94,0.08)', border: '1px solid rgba(255,111,94,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <AlertCircle size={15} color="#DD4F3E" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: '#DD4F3E', lineHeight: 1.5 }}>{error}</p>
            </div>
          )}
          {success && (
            <div style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#16a34a', lineHeight: 1.6 }}>{success}</p>
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving}
              style={{
                height: 48, padding: '0 28px', borderRadius: 99,
                background: saving ? S.mist : S.coral,
                color: saving ? S.muted : '#fff',
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                boxShadow: saving ? 'none' : '0 4px 16px rgba(255,111,94,0.35)',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all .18s',
              }}>
              {saving ? 'Salvando...' : editingId ? 'Atualizar cliente' : 'Cadastrar cliente'}
              {!saving && <Check size={16} />}
            </button>
            {editingId && (
              <button type="button" onClick={handleReset}
                style={{ height: 48, padding: '0 20px', borderRadius: 99, border: `1px solid ${S.line}`, background: '#fff', cursor: 'pointer', fontSize: 14, color: S.muted, fontWeight: 600 }}>
                Cancelar
              </button>
            )}
          </div>

          {!editingId && (
            <p style={{ fontSize: 11, color: S.muted, marginTop: 14, lineHeight: 1.7, maxWidth: 600 }}>
              <strong>Sobre a criação de usuário:</strong> usa <code>supabase.auth.signUp()</code>.
              Se "Email Confirmations" estiver ativo no Supabase, a cliente precisará confirmar o email antes de acessar.
              Para acesso imediato: <strong>Supabase Dashboard → Authentication → Settings → desativar "Confirm email"</strong>.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
