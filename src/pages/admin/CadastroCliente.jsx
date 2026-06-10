import { useState, useEffect, useRef, useCallback } from 'react'
import { getPalette } from 'colorthief'
import { supabase } from '../../lib/supabase'
import {
  Building2, Upload, Check, ExternalLink, Plus,
  AlertCircle, X, RefreshCw, Copy, Loader2,
} from 'lucide-react'

const PROD_BASE = 'https://junttos-admin.vercel.app'

const S = {
  purple: '#6C3CE1',
  coral:  '#F4613A',
  ink:    '#16101F',
  mist:   '#F6F3FA',
  line:   '#E6E0F0',
  muted:  '#7B7390',
  white:  '#ffffff',
}

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
  const palette = await getPalette(objectUrl, { colorCount: 5 })
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
  cor_primaria: S.purple,
  cor_secundaria: S.coral,
  logoFile: null,
  logoPreview: null,
}

// ── Modal ────────────────────────────────────────────────────────
function NovoClienteModal({ open, onClose, onCreated }) {
  const [form, setForm]           = useState(EMPTY_FORM)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [successLink, setSuccessLink] = useState('')
  const fileRef = useRef(null)

  function reset() {
    setForm(EMPTY_FORM)
    setError('')
    setSuccessLink('')
    setSaving(false)
    setExtracting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleNome(nome) {
    setForm(prev => ({ ...prev, nome, slug: toSlug(nome) }))
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setForm(prev => ({ ...prev, logoFile: file, logoPreview: preview }))

    // Extract colors via Color Thief
    setExtracting(true)
    try {
      const { primary, secondary } = await extractColors(preview)
      setForm(prev => ({ ...prev, cor_primaria: primary, cor_secundaria: secondary }))
    } catch {
      // Silently keep defaults if extraction fails
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.slug.trim()) {
      setError('Nome e slug são obrigatórios.')
      return
    }
    setSaving(true)
    setError('')
    setSuccessLink('')
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
        updated_at:     new Date().toISOString(),
      }

      const { error: cfgErr } = await supabase
        .from('lf_config').upsert(payload, { onConflict: 'loja_id' })
      if (cfgErr) throw new Error(cfgErr.message)

      const link = `${PROD_BASE}/${form.slug}/`
      setSuccessLink(link)
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = {
    width: '100%', height: 44, boxSizing: 'border-box',
    background: S.mist, border: `1.5px solid ${S.line}`,
    borderRadius: 10, padding: '0 14px',
    fontFamily: 'inherit', fontSize: 14, color: S.ink, outline: 'none',
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520,
        boxShadow: '0 24px 64px rgba(22,16,31,0.18)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 0' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: S.ink, marginBottom: 2 }}>Novo Cliente</h2>
            <p style={{ fontSize: 13, color: S.muted }}>Configure o painel da nova loja.</p>
          </div>
          <button onClick={handleClose} style={{ background: S.mist, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={S.muted} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ padding: '24px 28px 28px' }}>
          {/* Nome */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.ink, marginBottom: 6 }}>
              Nome da loja
            </label>
            <input
              value={form.nome}
              onChange={e => handleNome(e.target.value)}
              placeholder="Ex: Maria Store"
              style={inp}
              autoFocus
            />
          </div>

          {/* Slug */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.ink, marginBottom: 6 }}>
              Slug — URL de acesso
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: S.muted, pointerEvents: 'none' }}>
                .../
              </span>
              <input
                value={form.slug}
                onChange={e => setForm(p => ({ ...p, slug: toSlug(e.target.value) }))}
                placeholder="mariastore"
                style={{ ...inp, paddingLeft: 38, fontFamily: 'monospace' }}
              />
            </div>
            {form.slug && (
              <p style={{ fontSize: 11, color: S.purple, marginTop: 5, fontFamily: 'monospace' }}>
                {PROD_BASE}/{form.slug}/
              </p>
            )}
          </div>

          {/* Logo upload */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.ink, marginBottom: 10 }}>
              Logo da loja
              {extracting && <span style={{ fontWeight: 400, color: S.muted, marginLeft: 8 }}>extraindo cores...</span>}
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Preview */}
              <div style={{
                width: 64, height: 64, borderRadius: 14, flexShrink: 0,
                border: `2px dashed ${form.logoPreview ? 'transparent' : S.line}`,
                background: form.logoPreview ? S.mist : S.mist,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {form.logoPreview ? (
                  <img
                    src={form.logoPreview}
                    alt="preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Building2 size={22} color={S.line} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 16px', borderRadius: 10,
                    border: `1.5px dashed ${S.line}`, background: S.mist,
                    cursor: 'pointer', fontSize: 13, color: S.muted, fontWeight: 600,
                    width: '100%', justifyContent: 'center',
                  }}
                >
                  {extracting
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analisando cores...</>
                    : <><Upload size={14} /> {form.logoPreview ? 'Trocar logo' : 'Fazer upload da logo'}</>
                  }
                </button>
                <p style={{ fontSize: 11, color: S.muted, marginTop: 5 }}>
                  PNG, JPG, SVG · Cores extraídas automaticamente
                </p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp"
              onChange={handleFile} style={{ display: 'none' }} />
          </div>

          {/* Color preview */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.ink, marginBottom: 10 }}>
              Cores {!form.logoFile && <span style={{ fontWeight: 400, color: S.muted }}>(padrão Junttos)</span>}
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { key: 'cor_primaria', label: 'Primária' },
                { key: 'cor_secundaria', label: 'Secundária' },
              ].map(({ key, label }) => (
                <div key={key} style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: form[key],
                      border: `1px solid ${S.line}`, flexShrink: 0,
                      transition: 'background .3s',
                    }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: S.ink, marginBottom: 1 }}>{label}</p>
                      <p style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>{form[key]}</p>
                    </div>
                  </div>
                  <input
                    type="color"
                    value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', height: 32, borderRadius: 8, border: `1px solid ${S.line}`, cursor: 'pointer', padding: 2 }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(244,97,58,0.08)', border: '1px solid rgba(244,97,58,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <AlertCircle size={14} color={S.coral} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: S.coral, lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          {successLink ? (
            <div style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>Cliente criada com sucesso!</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontSize: 12, background: '#fff', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(22,163,74,0.25)', color: S.ink, wordBreak: 'break-all' }}>
                  {successLink}
                </code>
                <button type="button"
                  onClick={() => navigator.clipboard.writeText(successLink)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.line}`, background: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                  <Copy size={13} color={S.muted} />
                </button>
                <a href={successLink} target="_blank" rel="noopener noreferrer"
                  style={{ padding: '6px 10px', borderRadius: 8, background: S.purple, color: '#fff', textDecoration: 'none', flexShrink: 0 }}>
                  <ExternalLink size={13} />
                </a>
              </div>
              <button type="button" onClick={handleClose}
                style={{ marginTop: 14, width: '100%', height: 42, borderRadius: 10, border: 'none', background: S.mist, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: S.ink }}>
                Fechar
              </button>
            </div>
          ) : (
            <button type="submit" disabled={saving || extracting}
              style={{
                width: '100%', height: 48, borderRadius: 12,
                background: saving || extracting ? S.mist : S.coral,
                color: saving || extracting ? S.muted : '#fff',
                border: 'none', cursor: saving || extracting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: saving || extracting ? 'none' : '0 4px 16px rgba(244,97,58,0.32)',
                transition: 'all .18s',
              }}>
              {saving
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Criando...</>
                : <><Check size={16} /> Criar Cliente</>
              }
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
  const [clientes, setClientes] = useState([])
  const [fetching, setFetching] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [copied, setCopied] = useState(null)

  const fetchClientes = useCallback(async () => {
    setFetching(true)
    setFetchError('')
    const { data, error } = await supabase.from('lf_config').select('*').order('nome')
    if (error) setFetchError(error.message)
    else setClientes(data || [])
    setFetching(false)
  }, [])

  useEffect(() => { fetchClientes() }, [fetchClientes])

  function handleCreated() {
    fetchClientes()
  }

  async function copyLink(slug) {
    const link = `${PROD_BASE}/${slug}/`
    await navigator.clipboard.writeText(link)
    setCopied(slug)
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: S.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>
            Clientes
          </h1>
          <p style={{ color: S.muted, fontSize: 14 }}>
            Painéis de loja cadastrados na plataforma Junttos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={fetchClientes} style={{ display: 'flex', alignItems: 'center', gap: 6, background: S.mist, border: `1px solid ${S.line}`, borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: S.muted }}>
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={() => setModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 44, padding: '0 20px', borderRadius: 12,
              background: S.purple, color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700,
              boxShadow: '0 4px 16px rgba(108,60,225,0.3)',
            }}>
            <Plus size={16} /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Content */}
      {fetching ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: S.muted, fontSize: 14, padding: 24 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Carregando clientes...
        </div>
      ) : fetchError ? (
        <div style={{ background: 'rgba(244,97,58,0.06)', border: '1px solid rgba(244,97,58,0.25)', borderRadius: 16, padding: '20px 24px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={16} color={S.coral} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: S.coral, marginBottom: 4 }}>Erro ao carregar clientes</p>
            <p style={{ fontSize: 12, color: S.coral, lineHeight: 1.6 }}>{fetchError}</p>
          </div>
        </div>
      ) : clientes.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${S.line}`, borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
          <Building2 size={32} color={S.line} style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ color: S.muted, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhum cliente cadastrado</p>
          <p style={{ color: S.muted, fontSize: 13, marginBottom: 20 }}>Comece criando o primeiro painel de loja.</p>
          <button onClick={() => setModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: S.purple, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            <Plus size={15} /> Novo Cliente
          </button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: S.muted, marginBottom: 16 }}>
            {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {clientes.map(c => {
              const slug = c.slug || c.loja_id
              const initials = (c.nome || 'L').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
              const primary = c.cor_primaria || S.purple
              const link = `${PROD_BASE}/${slug}/`

              return (
                <div key={c.id} style={{
                  background: '#fff', border: `1px solid ${S.line}`, borderRadius: 18,
                  padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14,
                  transition: 'box-shadow .18s',
                }}>
                  {/* Top: logo + nome + slug */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.nome}
                        style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', border: `1px solid ${S.line}`, background: S.mist, flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                        background: `${primary}18`, border: `1px solid ${primary}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: primary }}>{initials}</span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: S.ink, fontSize: 15, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.nome}
                      </p>
                      <p style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace' }}>/{slug}</p>
                    </div>
                    {/* Cor primária swatch */}
                    <div title={`Cor primária: ${primary}`} style={{
                      width: 28, height: 28, borderRadius: 8, background: primary,
                      border: `2px solid ${S.line}`, flexShrink: 0,
                    }} />
                  </div>

                  {/* Link de acesso */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: S.mist, borderRadius: 10, padding: '8px 12px',
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: S.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link}
                    </span>
                    <button onClick={() => copyLink(slug)}
                      title="Copiar link"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2, flexShrink: 0 }}>
                      {copied === slug
                        ? <Check size={13} color="#16a34a" />
                        : <Copy size={13} color={S.muted} />
                      }
                    </button>
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: 8, background: S.purple, flexShrink: 0 }}>
                      <ExternalLink size={12} color="#fff" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <NovoClienteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
