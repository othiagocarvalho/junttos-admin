import { useState, useRef } from 'react'
import { getPalette } from 'colorthief'
import { supabaseConsultor as supabase } from '../../lib/supabaseConsultor'
import { useConsultorAuth } from '../../context/ConsultorAuthContext'
import { useCreateLoja, toSlug, isValidSlug } from '../../hooks/useCreateLoja'
import { Check, Copy, ExternalLink, Loader2, AlertCircle, Building2, Upload } from 'lucide-react'
import { T } from '../../theme/tokens'
import ConsultorLayout from './ConsultorLayout'

const PLANOS_VALORES = {
  starter:  { label: 'Starter',  valor: 99.90  },
  pro:      { label: 'Pro',      valor: 149.90 },
  business: { label: 'Business', valor: 259.90 },
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

async function extractColors(objectUrl) {
  const palette = await getPalette(objectUrl, { colorCount: 5 })
  return {
    primary:   rgbToHex(palette[0]),
    secondary: rgbToHex(palette[1] ?? palette[0]),
  }
}

async function uploadLogo(slug, file) {
  const ext  = file.name.split('.').pop().toLowerCase()
  const path = `${slug}/logo.${ext}`
  const { error } = await supabase.storage
    .from('Logo').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(`Upload: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage.from('Logo').getPublicUrl(path)
  return publicUrl
}

const emptyForm = {
  nome:         '',
  slug:         '',
  plano:        'starter',
  email_acesso: '',
  senha_acesso: '',
}

const inp = {
  width: '100%', height: 44, boxSizing: 'border-box',
  background: T.mist, border: `1.5px solid ${T.line}`,
  borderRadius: T.rInput, padding: '0 12px',
  fontFamily: T.ui, fontSize: 14, color: T.ink, outline: 'none',
}
const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 5 }

export default function ConsultorNovaLoja() {
  const { consultorId } = useConsultorAuth()
  const { save, saving, error: hookError, successLink, reset: hookReset } = useCreateLoja()
  const fileRef = useRef(null)

  const [form,        setForm]        = useState(emptyForm)
  const [copied,      setCopied]      = useState(false)
  const [logoFile,    setLogoFile]    = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [corPrimaria,   setCorPrimaria]   = useState(T.purple)
  const [corSecundaria, setCorSecundaria] = useState(T.coral)
  const [extracting,  setExtracting]  = useState(false)
  const [logoError,   setLogoError]   = useState('')

  const error = logoError || hookError

  function handleNome(nome) {
    setForm(f => ({ ...f, nome, slug: toSlug(nome) }))
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setLogoFile(file)
    setLogoPreview(preview)
    setLogoError('')
    setExtracting(true)
    try {
      const { primary, secondary } = await extractColors(preview)
      setCorPrimaria(primary)
      setCorSecundaria(secondary)
    } catch { /* mantém T.purple/T.coral como fallback */ }
    finally { setExtracting(false) }
  }

  function resetAll() {
    setForm(emptyForm)
    setLogoFile(null)
    setLogoPreview(null)
    setCorPrimaria(T.purple)
    setCorSecundaria(T.coral)
    setExtracting(false)
    setLogoError('')
    setCopied(false)
    hookReset()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLogoError('')

    let logoUrl = null
    if (logoFile) {
      try { logoUrl = await uploadLogo(form.slug, logoFile) }
      catch (err) { setLogoError(`Upload da logo falhou: ${err.message}`); return }
    }

    await save({
      nome:           form.nome,
      slug:           form.slug,
      plano:          form.plano,
      status:         'Trial',
      cor_primaria:   corPrimaria,
      cor_secundaria: corSecundaria,
      logoUrl,
      email_acesso:   form.email_acesso,
      senha_acesso:   form.senha_acesso,
      valor_mensal:   String(PLANOS_VALORES[form.plano].valor),
      enviarBV:       true,
      cadastrado_por_consultor_id: consultorId,
    })
  }

  function handleCopy() {
    navigator.clipboard.writeText(successLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ConsultorLayout>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Cadastrar Nova Loja</h1>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>
        A loja aparece automaticamente no admin da Junttos vinculada à sua visita.
      </p>

      <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '22px 20px', boxShadow: T.cardShadow, maxWidth: 480 }}>

        {successLink ? (
          <div>
            <div style={{ background: T.statusAtivoBg, border: `1px solid ${T.statusAtivoTx}44`, borderRadius: T.rCard, padding: '16px 18px', marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.statusAtivoTx, marginBottom: 8, marginTop: 0 }}>
                🎉 Loja criada com sucesso!
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontSize: 12, background: T.white, padding: '7px 10px', borderRadius: 8, border: `1px solid ${T.statusAtivoTx}28`, color: T.ink, wordBreak: 'break-all', fontFamily: T.mono }}>
                  {successLink}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copiar link"
                  style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                >
                  {copied ? <Check size={13} color={T.statusAtivoTx} /> : <Copy size={13} color={T.muted} />}
                </button>
                <a href={successLink} target="_blank" rel="noopener noreferrer" style={{ padding: '7px 10px', borderRadius: 8, background: T.purple, color: '#fff', textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
            <button
              type="button"
              onClick={resetAll}
              style={{ width: '100%', height: 44, borderRadius: T.rInput, border: 'none', background: T.tintPurple, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.purpleText, fontFamily: T.ui }}
            >
              Cadastrar outra loja
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>

            {/* Nome */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Nome da loja *</label>
              <input
                required autoFocus
                value={form.nome}
                onChange={e => handleNome(e.target.value)}
                placeholder="Ex: Boutique da Maria"
                style={inp}
              />
            </div>

            {/* Slug */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelSt}>URL de acesso (slug)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.muted, pointerEvents: 'none' }}>.../</span>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: toSlug(e.target.value) }))}
                  placeholder="boutique-da-maria"
                  style={{ ...inp, paddingLeft: 36, fontFamily: T.mono }}
                />
              </div>
              {form.slug && (
                <p style={{ fontSize: 11, marginTop: 5, fontFamily: T.mono, color: isValidSlug(form.slug) ? T.purpleText : T.coralText }}>
                  {isValidSlug(form.slug) ? `${window.location.origin}/${form.slug}/` : 'Slug inválido — só letras, números e hífens'}
                </p>
              )}
            </div>

            {/* Logo */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelSt}>Logo da loja</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Preview */}
                <div style={{
                  width: 56, height: 56, borderRadius: 12, flexShrink: 0,
                  border: `2px dashed ${logoPreview ? 'transparent' : T.line}`,
                  background: T.mist, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <Building2 size={20} color={T.line} />
                  }
                </div>
                {/* Botão upload */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    height: 44, borderRadius: T.rInput,
                    border: `1.5px dashed ${T.line}`, background: T.mist,
                    cursor: 'pointer', fontSize: 13, color: T.muted, fontWeight: 600,
                    fontFamily: T.ui,
                  }}
                >
                  {extracting
                    ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analisando cores…</>
                    : <><Upload size={13} /> {logoPreview ? 'Trocar logo' : 'Fazer upload'}</>
                  }
                </button>
              </div>
              <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                PNG, JPG, SVG · Cores extraídas automaticamente da logo
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
            </div>

            {/* Plano */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Plano contratado</label>
              <select
                value={form.plano}
                onChange={e => setForm(f => ({ ...f, plano: e.target.value }))}
                style={{ ...inp, cursor: 'pointer', appearance: 'none' }}
              >
                {Object.entries(PLANOS_VALORES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} — R$ {v.valor.toFixed(2).replace('.', ',')}/mês</option>
                ))}
              </select>
            </div>

            <div style={{ height: 1, background: T.line, margin: '18px 0' }} />

            {/* Credenciais */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>E-mail de acesso *</label>
              <input
                type="email" required
                value={form.email_acesso}
                onChange={e => setForm(f => ({ ...f, email_acesso: e.target.value }))}
                placeholder="loja@email.com"
                style={inp}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>Senha de acesso *</label>
              <input
                type="text" required
                value={form.senha_acesso}
                onChange={e => setForm(f => ({ ...f, senha_acesso: e.target.value }))}
                placeholder="Ex: loja@2026"
                style={inp}
              />
              <p style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>
                Será enviada por e-mail de boas-vindas. Pode ser alterada depois.
              </p>
            </div>

            {error && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '10px 12px', marginBottom: 16 }}>
                <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: T.coralText, margin: 0, lineHeight: 1.4 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || extracting}
              style={{
                width: '100%', height: 48, borderRadius: T.rCard,
                background: saving || extracting ? T.mist : T.purple,
                color:  saving || extracting ? T.muted : '#fff',
                border: 'none', cursor: saving || extracting ? 'not-allowed' : 'pointer',
                fontFamily: T.ui, fontSize: 15, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: saving || extracting ? 'none' : '0 4px 16px rgba(94,43,208,0.28)',
                transition: 'all .18s',
              }}
            >
              {saving
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Criando loja…</>
                : <><Check size={16} /> Criar Loja</>
              }
            </button>
          </form>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </ConsultorLayout>
  )
}
