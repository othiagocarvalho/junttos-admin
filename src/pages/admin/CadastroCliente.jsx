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
import DemoPanel from './DemoPanel'

const PROD_BASE = 'https://junttos-admin.vercel.app'

// Default features for all new lojas — legado and catalogo_b2b always false on creation
const DEFAULT_FEATURES = {
  vendas: true, historico: true, metas: true,
  fechamento_caixa: true, relatorios: true,
  clientes: false, estoque: false,
  legado: false,
  catalogo_b2b: false,
}

const PLANOS_VALORES = {
  starter:  { label: 'Starter',  valor: 99.90  },
  pro:      { label: 'Pro',      valor: 149.90 },
  business: { label: 'Business', valor: 259.90 },
}

// Allows a-z, 0-9 and hyphens; collapses spaces to hyphens; strips leading/trailing hyphens
function toSlug(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function isValidSlug(s) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s) && s.length >= 2 && s.length <= 40
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
  status: 'Trial',
  plano: 'starter',
  valor_mensal: String(PLANOS_VALORES.starter.valor),
  features: { atacado: false, crm: false },
  enviarBV: true,
}

// ── Toggle component ─────────────────────────────────────────────
function Toggle({ value, onChange, label, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: sub ? 2 : 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: T.muted }}>{sub}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? T.purple : T.line,
          position: 'relative', transition: 'background .2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2,
          left: value ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: T.white,
          transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.18)',
        }} />
      </button>
    </div>
  )
}

// ── Section divider ──────────────────────────────────────────────
function Section({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 14px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{title}</p>
      <div style={{ flex: 1, height: 1, background: T.line }} />
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────
function NovoClienteModal({ open, onClose, onCreated }) {
  const [form, setForm]               = useState(EMPTY_FORM)
  const [extracting, setExtracting]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [successLink, setSuccessLink] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e) { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function reset() {
    setForm(EMPTY_FORM); setError(''); setSuccessLink(''); setSaving(false); setExtracting(false)
  }
  function handleClose() { reset(); onClose() }
  function handleNome(nome) { setForm(prev => ({ ...prev, nome, slug: toSlug(nome) })) }
  function handlePlanoChange(novoPlano) {
    setForm(p => ({ ...p, plano: novoPlano, valor_mensal: String(PLANOS_VALORES[novoPlano].valor) }))
  }

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

    // Basic validation
    if (!form.nome.trim() || !form.slug.trim()) { setError('Nome e slug são obrigatórios.'); return }
    if (!isValidSlug(form.slug)) {
      setError('Slug inválido. Use apenas letras minúsculas, números e hífens (2–40 caracteres, não pode começar ou terminar com hífen).')
      return
    }

    setSaving(true); setError(''); setSuccessLink('')
    try {
      // Check slug uniqueness before touching anything
      const { data: existing } = await supabase
        .from('lf_config')
        .select('nome')
        .or(`loja_id.eq.${form.slug},slug.eq.${form.slug}`)
        .maybeSingle()
      if (existing) throw new Error(`O slug "${form.slug}" já está em uso pela loja "${existing.nome}".`)

      let logoUrl = null
      if (form.logoFile) logoUrl = await uploadLogo(form.slug, form.logoFile)

      const features = {
        ...DEFAULT_FEATURES,
        atacado: form.features.atacado,
        crm: form.features.crm,
      }

      // Insert only valid lf_config columns (no valor_mensal, email_acesso, senha_acesso)
      const { error: cfgErr } = await supabase.from('lf_config').insert({
        loja_id:        form.slug,
        slug:           form.slug,
        nome:           form.nome,
        status:         form.status,
        plano:          form.plano,
        cor_primaria:   form.cor_primaria,
        cor_secundaria: form.cor_secundaria,
        features,
        logo_url:       logoUrl,
        updated_at:     new Date().toISOString(),
      })
      if (cfgErr) throw new Error(cfgErr.message)

      // Create Auth user — rollback lf_config if this fails
      if (form.email_acesso && form.senha_acesso) {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('create-user', {
          body: { email: form.email_acesso, password: form.senha_acesso, loja_id: form.slug, nome: form.nome },
        })
        const authError = fnErr?.message || fnData?.error
        if (authError) {
          await supabase.from('lf_config').delete().eq('loja_id', form.slug)
          throw new Error(`Erro ao criar usuário: ${authError} — config da loja removida (rollback).`)
        }
      }

      // Create first billing record
      const venc = new Date()
      venc.setDate(venc.getDate() + 30)
      await supabase.from('jt_cobrancas').insert({
        loja_id:    form.slug,
        valor:      parseFloat(form.valor_mensal) || 0,
        vencimento: venc.toISOString().split('T')[0],
        status:     'pendente',
      })

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
    <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 540, boxShadow: T.darkCardShadow, maxHeight: '90vh', overflowY: 'auto', fontFamily: T.ui }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 0' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 2 }}>Nova Loja</h2>
            <p style={{ fontSize: 13, color: T.muted }}>Configure o painel da nova loja.</p>
          </div>
          <button onClick={handleClose} style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={T.muted} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ padding: '20px 28px 28px' }}>

          {/* ── Dados básicos ── */}
          <Section title="Dados da loja" />

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Nome da loja</label>
            <input value={form.nome} onChange={e => handleNome(e.target.value)} placeholder="Ex: Maria Store" style={inp} autoFocus />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Slug — URL de acesso</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.muted, pointerEvents: 'none' }}>.../</span>
              <input
                value={form.slug}
                onChange={e => setForm(p => ({ ...p, slug: toSlug(e.target.value) }))}
                placeholder="maria-store"
                style={{ ...inp, paddingLeft: 38, fontFamily: T.mono }}
              />
            </div>
            {form.slug && (
              <p style={{ fontSize: 11, color: isValidSlug(form.slug) ? T.purpleText : T.coralText, marginTop: 5, fontFamily: T.mono }}>
                {isValidSlug(form.slug) ? `${PROD_BASE}/${form.slug}/` : 'Slug inválido — use letras, números e hífens'}
              </p>
            )}
          </div>

          {/* ── Logo ── */}
          <Section title="Logo da loja" />

          <div style={{ marginBottom: 4 }}>
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
          <div style={{ marginBottom: 4, marginTop: 16 }}>
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

          {/* ── Plano e cobrança ── */}
          <Section title="Plano e cobrança" />

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Plano contratado</label>
            <select
              value={form.plano}
              onChange={e => handlePlanoChange(e.target.value)}
              style={{ ...inp, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%237B7390' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
            >
              <option value="starter">Starter — R$ 99,90/mês</option>
              <option value="pro">Pro — R$ 149,90/mês</option>
              <option value="business">Business — R$ 259,90/mês</option>
            </select>
          </div>

          <div style={{ background: T.mist, borderRadius: T.rInput, padding: '10px 14px', marginBottom: 16, fontSize: 11, color: T.muted }}>
            {form.plano === 'starter' && 'Inclui: vendas, estoque, clientes, relatórios básicos, cartão fidelidade.'}
            {form.plano === 'pro' && 'Inclui tudo do Starter + metas, comissão automática, curva ABC, crediário.'}
            {form.plano === 'business' && 'Inclui tudo do Pro + catálogo online, financeiro completo, notificações.'}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 0 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Status do cliente</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                style={{ ...inp, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%237B7390' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
              >
                <option value="Trial">Trial</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Valor mensal (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.valor_mensal}
                onChange={e => setForm(p => ({ ...p, valor_mensal: e.target.value }))}
                placeholder="0,00"
                style={inp}
              />
            </div>
          </div>

          {/* ── Credenciais ── */}
          <Section title="Acesso do cliente" />

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Email de acesso</label>
            <input type="email" value={form.email_acesso} onChange={e => setForm(p => ({ ...p, email_acesso: e.target.value }))} placeholder="loja@email.com" style={inp} />
          </div>
          <div style={{ marginBottom: 4 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Senha de acesso</label>
            <input type="text" value={form.senha_acesso} onChange={e => setForm(p => ({ ...p, senha_acesso: e.target.value }))} placeholder="Ex: loja@2026" style={inp} />
          </div>
          <p style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
            Opcional — se preenchido, cria o usuário Supabase Auth vinculado à loja. A senha pode ser alterada depois nas configurações da loja.
          </p>

          {/* ── Funcionalidades ── */}
          <Section title="Funcionalidades" />

          <div style={{ background: T.mist, borderRadius: T.rCard, padding: '4px 14px', marginBottom: 4 }}>
            <Toggle
              value={form.features.atacado}
              onChange={v => setForm(p => ({ ...p, features: { ...p.features, atacado: v } }))}
              label="Modo atacado"
              sub="Estoque com variações e tabela de preços"
            />
            <div style={{ height: 1, background: T.line }} />
            <Toggle
              value={form.features.crm}
              onChange={v => setForm(p => ({ ...p, features: { ...p.features, crm: v } }))}
              label="CRM"
              sub="Histórico de clientes e relacionamento"
            />
            <div style={{ height: 1, background: T.line }} />
            <Toggle
              value={form.enviarBV}
              onChange={v => setForm(p => ({ ...p, enviarBV: v }))}
              label="Enviar email de boas-vindas"
              sub="Notifica o cliente com o link de acesso"
            />
          </div>

          {/* Alerts */}
          {error && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '12px 14px', marginTop: 16, marginBottom: 16 }}>
              <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: T.coralText, lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            {successLink ? (
              <div style={{ background: T.statusAtivoBg, border: `1px solid ${T.statusAtivoTx}44`, borderRadius: T.rCard, padding: '16px 18px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.statusAtivoTx, marginBottom: 8 }}>Loja criada com sucesso!</p>
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
                <button type="button" onClick={() => { reset(); onCreated() }} style={{ marginTop: 14, width: '100%', height: 42, borderRadius: T.rInput, border: 'none', background: T.tintPurple, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.purpleText }}>
                  Criar outra loja
                </button>
                <button type="button" onClick={handleClose} style={{ marginTop: 8, width: '100%', height: 42, borderRadius: T.rInput, border: 'none', background: T.mist, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.ink }}>
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
                {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Criando...</> : <><Check size={16} /> Criar Loja</>}
              </button>
            )}
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function CadastroCliente() {
  const [clientes, setClientes]     = useState([])
  const [fetching, setFetching]     = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [modalOpen, setModalOpen]   = useState(false)

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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Lojas</h1>
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
            <Plus size={16} /> Nova Loja
          </button>
        </div>
      </div>

      <DemoPanel />

      {/* Content */}
      {fetching ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 14, padding: 24 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Carregando lojas...
        </div>
      ) : fetchError ? (
        <div style={{ background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rCard, padding: '20px 24px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={16} color={T.coralText} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.coralText, marginBottom: 4 }}>Erro ao carregar lojas</p>
            <p style={{ fontSize: 12, color: T.coralText, lineHeight: 1.6 }}>{fetchError}</p>
          </div>
        </div>
      ) : clientes.length === 0 ? (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, boxShadow: T.cardShadow }}>
          <EmptyState
            title="Nenhuma loja cadastrada"
            description="Comece criando o primeiro painel de loja."
            action="Nova Loja"
            onAction={() => setModalOpen(true)}
          />
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>
            {clientes.length} {clientes.length === 1 ? 'loja' : 'lojas'}
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
