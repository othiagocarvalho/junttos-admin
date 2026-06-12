import { useState, useEffect, useRef, useCallback } from 'react'
import { getPalette } from 'colorthief'
import { supabase } from '../../lib/supabase'
import {
  Building2, Upload, Check, ExternalLink, Plus,
  AlertCircle, X, RefreshCw, Copy, Loader2,
} from 'lucide-react'
import StoreCard from '../../components/junttos/StoreCard'
import EmptyState from '../../components/junttos/EmptyState'
import { T } from '../../theme/tokens'

const PROD_BASE = 'https://junttos-admin.vercel.app'

const DEFAULT_FEATURES = {
  vendas: true, historico: true, metas: true,
  fechamento_caixa: true, relatorios: true,
  clientes: false, estoque: false,
}

function toSlug(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '').trim()
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

async function extractColors(objectUrl) {
  const palette   = await getPalette(objectUrl, { colorCount: 5 })
  const primary   = rgbToHex(palette[0])
  const secondary = rgbToHex(palette[1] ?? palette[0])
  return { primary, secondary }
}

async function uploadLogo(slug, file) {
  const ext = file.name.split('.').pop().toLowerCase()
  const path = `${slug}/logo.${ext}`
  const { error } = await supabase.storage
    .from('Logo').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(`Upload: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage.from('Logo').getPublicUrl(path)
  return publicUrl
}

const EMPTY_FORM = {
  nome: '', slug: '',
  cor_primaria: T.purple,
  cor_secundaria: T.coral,
  logoFile: null,
  logoPreview: null,
  email_acesso: '',
  senha_acesso: '',
}

// ── Modal ────────────────────────────────────────────────────────
function NovoClienteModal({ open, onClose, onCreated }) {
  const [form, setForm]               = useState(EMPTY_FORM)
  const [extracting, setExtracting]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [successLink, setSuccessLink] = useState('')
  const fileRef = useRef(null)

  function reset() {
    setForm(EMPTY_FORM); setError(''); setSuccessLink(''); setSaving(false); setExtracting(false)
  }
  function handleClose() { reset(); onClose() }
  function handleNome(nome) { setForm(prev => ({ ...prev, nome, slug: toSlug(nome) })) }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setForm(prev => ({ ...prev, logoFile: file, logoPreview: preview }))
    setExtracting(true)
    try {
      const { primary, secondary } = await extractColors(preview)
      setForm(prev => ({ ...prev, cor_primaria: primary, cor_secundaria: secondary }))
    } catch { /* keep defaults */ }
    finally { setExtracting(false) }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.slug.trim()) { setError('Nome e slug são obrigatórios.'); return }
    setSaving(true); setError(''); setSuccessLink('')
    try {
      let logoUrl = null
      if (form.logoFile) logoUrl = await uploadLogo(form.slug, form.logoFile)
      const payload = {
        loja_id:        form.slug,
        slug:           form.slug,
        nome:           form.nome,
        status:         'ativo',
        plano:          'basico',
        cor_primaria:   form.cor_primaria,
        cor_secundaria: form.cor_secundaria,
        features:       { ...DEFAULT_FEATURES },
        logo_url:       logoUrl,
        email_acesso:   form.email_acesso || null,
        senha_acesso:   form.senha_acesso || null,
        updated_at:     new Date().toISOString(),
      }
      const { error: cfgErr } = await supabase.from('lf_config').upsert(payload, { onConflict: 'loja_id' })
      if (cfgErr) throw new Error(cfgErr.message)
      if (form.email_acesso && form.senha_acesso) {
        await supabase.functions.invoke('create-user', { body: { email: form.email_acesso, password: form.senha_acesso } })
      }
      setSuccessLink(`${PROD_BASE}/${form.slug}/`)
      onCreated()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const inp = {
    width: '100%', height: 44, boxSizing: 'border-box',
    background: T.mist, border: `1.5px solid ${T.line}`,
    borderRadius: T.rInput, padding: '0 14px',
    fontFamily: T.ui, fontSize: 14, color: T.ink, outline: 'none',
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 520, boxShadow: T.darkCardShadow, maxHeight: '90vh', overflowY: 'auto', fontFamily: T.ui }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 0' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 2 }}>Novo Cliente</h2>
            <p style={{ fontSize: 13, color: T.muted }}>Configure o painel da nova loja.</p>
          </div>
          <button onClick={handleClose} style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={T.muted} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ padding: '24px 28px 28px' }}>
          {/* Nome */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Nome da loja</label>
            <input value={form.nome} onChange={e => handleNome(e.target.value)} placeholder="Ex: Maria Store" style={inp} autoFocus />
          </div>

          {/* Slug */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Slug — URL de acesso</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.muted, pointerEvents: 'none' }}>.../</span>
              <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: toSlug(e.target.value) }))} placeholder="mariastore" style={{ ...inp, paddingLeft: 38, fontFamily: T.mono }} />
            </div>
            {form.slug && (
              <p style={{ fontSize: 11, color: T.purpleText, marginTop: 5, fontFamily: T.mono }}>
                {PROD_BASE}/{form.slug}/
              </p>
            )}
          </div>

          {/* Logo upload */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 10 }}>
              Logo da loja {extracting && <span style={{ fontWeight: 400, color: T.muted, marginLeft: 8 }}>extraindo cores...</span>}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 64, height: 64, borderRadius: 14, flexShrink: 0, border: `2px dashed ${form.logoPreview ? 'transparent' : T.line}`, background: T.mist, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {form.logoPreview ? <img src={form.logoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Building2 size={22} color={T.line} />}
              </div>
              <div style={{ flex: 1 }}>
                <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: T.rInput, border: `1.5px dashed ${T.line}`, background: T.mist, cursor: 'pointer', fontSize: 13, color: T.muted, fontWeight: 600, width: '100%', justifyContent: 'center' }}>
                  {extracting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analisando cores...</> : <><Upload size={14} /> {form.logoPreview ? 'Trocar logo' : 'Fazer upload da logo'}</>}
                </button>
                <p style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>PNG, JPG, SVG · Cores extraídas automaticamente</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={handleFile} style={{ display: 'none' }} />
          </div>

          {/* Colors */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 10 }}>
              Cores {!form.logoFile && <span style={{ fontWeight: 400, color: T.muted }}>(padrão Junttos)</span>}
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              {[{ key: 'cor_primaria', label: 'Primária' }, { key: 'cor_secundaria', label: 'Secundária' }].map(({ key, label }) => (
                <div key={key} style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: form[key], border: `1px solid ${T.line}`, flexShrink: 0, transition: 'background .3s' }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: T.ink, marginBottom: 1 }}>{label}</p>
                      <p style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{form[key]}</p>
                    </div>
                  </div>
                  <input type="color" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={{ width: '100%', height: 32, borderRadius: 8, border: `1px solid ${T.line}`, cursor: 'pointer', padding: 2 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Credentials */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Email de acesso</label>
            <input type="email" value={form.email_acesso} onChange={e => setForm(p => ({ ...p, email_acesso: e.target.value }))} placeholder="loja@email.com" style={inp} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Senha de acesso</label>
            <input type="text" value={form.senha_acesso} onChange={e => setForm(p => ({ ...p, senha_acesso: e.target.value }))} placeholder="Ex: loja@2026" style={inp} />
          </div>

          {/* Alerts */}
          {error && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '12px 14px', marginBottom: 16 }}>
              <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: T.coralText, lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          {successLink ? (
            <div style={{ background: T.statusAtivoBg, border: `1px solid ${T.statusAtivoTx}44`, borderRadius: T.rCard, padding: '16px 18px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.statusAtivoTx, marginBottom: 8 }}>Cliente criada com sucesso!</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontSize: 12, background: T.white, padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.statusAtivoTx}28`, color: T.ink, wordBreak: 'break-all', fontFamily: T.mono }}>
                  {successLink}
                </code>
                <button type="button" onClick={() => navigator.clipboard.writeText(successLink)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', flexShrink: 0 }}>
                  <Copy size={13} color={T.muted} />
                </button>
                <a href={successLink} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 10px', borderRadius: 8, background: T.purple, color: T.white, textDecoration: 'none', flexShrink: 0 }}>
                  <ExternalLink size={13} />
                </a>
              </div>
              <button type="button" onClick={handleClose} style={{ marginTop: 14, width: '100%', height: 42, borderRadius: T.rInput, border: 'none', background: T.mist, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.ink }}>
                Fechar
              </button>
            </div>
          ) : (
            <button type="submit" disabled={saving || extracting} style={{
              width: '100%', height: 48, borderRadius: T.rCard,
              background: saving || extracting ? T.mist : T.coral,
              color: saving || extracting ? T.muted : T.white,
              border: 'none', cursor: saving || extracting ? 'not-allowed' : 'pointer',
              fontFamily: T.ui, fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: saving || extracting ? 'none' : '0 4px 16px rgba(255,111,94,0.32)',
              transition: 'all .18s',
            }}>
              {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Criando...</> : <><Check size={16} /> Criar Cliente</>}
            </button>
          )}
        </form>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function CadastroCliente() {
  const [clientes, setClientes]   = useState([])
  const [fetching, setFetching]   = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const fetchClientes = useCallback(async () => {
    setFetching(true); setFetchError('')
    const { data, error } = await supabase.from('lf_config').select('*').order('nome')
    if (error) setFetchError(error.message)
    else setClientes(data || [])
    setFetching(false)
  }, [])

  useEffect(() => { fetchClientes() }, [fetchClientes])

  return (
    <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Clientes</h1>
          <p style={{ fontSize: 13.5, color: T.muted }}>Painéis de loja cadastrados na plataforma Junttos.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={fetchClientes} style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.mist, border: `1px solid ${T.line}`, borderRadius: T.rInput, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.muted, transition: 'border-color .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.line }}>
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={() => setModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', borderRadius: T.rPill, background: T.purple, color: T.white, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(94,43,208,0.28)', transition: 'background .18s' }}
            onMouseEnter={e => { e.currentTarget.style.background = T.purpleDeep }}
            onMouseLeave={e => { e.currentTarget.style.background = T.purple }}>
            <Plus size={16} /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Content */}
      {fetching ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 14, padding: 24 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Carregando clientes...
        </div>
      ) : fetchError ? (
        <div style={{ background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rCard, padding: '20px 24px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={16} color={T.coralText} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.coralText, marginBottom: 4 }}>Erro ao carregar clientes</p>
            <p style={{ fontSize: 12, color: T.coralText, lineHeight: 1.6 }}>{fetchError}</p>
          </div>
        </div>
      ) : clientes.length === 0 ? (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, boxShadow: T.cardShadow }}>
          <EmptyState
            title="Nenhum cliente cadastrado"
            description="Comece criando o primeiro painel de loja."
            action="Novo Cliente"
            onAction={() => setModalOpen(true)}
          />
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>
            {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {clientes.map(c => {
              const slug = c.slug || c.loja_id
              const link = `${PROD_BASE}/${slug}/`
              return (
                <StoreCard
                  key={c.id}
                  nome={c.nome}
                  slug={slug}
                  status={c.status || 'ativo'}
                  logoUrl={c.logo_url}
                  primary={c.cor_primaria || T.purple}
                  link={link}
                />
              )
            })}
          </div>
        </>
      )}

      <NovoClienteModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={fetchClientes} />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
