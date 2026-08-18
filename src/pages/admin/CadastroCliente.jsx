import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { getPalette } from 'colorthief'
import { supabase } from '../../lib/supabase'
import { uploadLogo } from '../../utils/uploadLogo'
import {
  Building2, Upload, Check, ExternalLink, Plus,
  AlertCircle, X, RefreshCw, Copy, Loader2, ChevronDown,
} from 'lucide-react'
import StoreCard from '../../components/junttos/StoreCard'
import EmptyState from '../../components/junttos/EmptyState'
import { T } from '../../theme/tokens'
import DemoPanel from './DemoPanel'
import { useCreateLoja, toSlug, isValidSlug } from '../../hooks/useCreateLoja'
import { PLANOS, valorPlano, fmtValorPlano, SEGMENTO_PADRAO, TAXA_IMPLANTACAO } from '../../utils/planos'
import { aplicarDesconto } from '../../utils/cobrancas'
import { fmtR } from '../../utils/formatters'
import CamposContratante from '../../components/admin/CamposContratante'
import { MODELO_VAREJO, MODELO_ATACADO, featuresComModelo } from '../../utils/modeloVenda'
import { CONTRATANTE_VAZIO, apenasContratante } from '../../components/admin/contratante'

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

async function extractColors(objectUrl) {
  const palette   = await getPalette(objectUrl, { colorCount: 5 })
  const primary   = rgbToHex(palette[0])
  const secondary = rgbToHex(palette[1] ?? palette[0])
  return { primary, secondary }
}

const EMPTY_FORM = {
  nome: '', slug: '',
  segmento: SEGMENTO_PADRAO,
  cor_primaria: T.purple,
  cor_secundaria: T.coral,
  logoFile: null,
  logoPreview: null,
  email_acesso: '',
  senha_acesso: '',
  status: 'Trial',
  plano: 'starter',
  valor_mensal: String(valorPlano(SEGMENTO_PADRAO, 'starter')),
  // Ciclo de cobrança. Sem dia de vencimento a loja não entra na geração
  // automática — é o que mantém loja demo fora do faturamento.
  vencimento_dia: '',
  desconto_tipo: '',
  desconto_valor: '',
  desconto_motivo: '',
  features: { crm: false },
  // Varejo é o padrão — mesma coisa que o cadastro fazia antes de existir
  // este campo (features.catalogo_b2b: false vindo de DEFAULT_FEATURES).
  modelo_venda: MODELO_VAREJO,
  // Pedido mínimo do atacado. Opcional: em branco a lojista completa depois
  // na própria tela de catálogo B2B.
  pm_tipo: 'nenhum',
  pm_valor: '',
  pm_qtd: '',
  enviarBV: true,
  // Dados do contratante — todos opcionais: a loja pode ser criada sem eles e
  // completada depois pela edição em LojaDetalhe.
  ...CONTRATANTE_VAZIO,
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
  const [form, setForm]             = useState(EMPTY_FORM)
  const [extracting, setExtracting] = useState(false)
  const [logoError, setLogoError]   = useState('')
  const fileRef = useRef(null)

  const { save, saving, error: hookError, successLink, reset: hookReset } = useCreateLoja()

  const error = logoError || hookError

  useEffect(() => {
    if (!open) return
    function handleKey(e) { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function reset() {
    setForm(EMPTY_FORM); setLogoError(''); setExtracting(false); hookReset()
  }
  function handleClose() { reset(); onClose() }
  function handleNome(nome) { setForm(prev => ({ ...prev, nome, slug: toSlug(nome) })) }
  function handlePlanoChange(novoPlano) {
    setForm(p => ({ ...p, plano: novoPlano, valor_mensal: String(valorPlano(p.segmento, novoPlano)) }))
  }
  // Trocar o segmento precisa recalcular o valor: Mercado tem tabela própria.
  function handleSegmentoChange(novoSegmento) {
    setForm(p => ({ ...p, segmento: novoSegmento, valor_mensal: String(valorPlano(novoSegmento, p.plano)) }))
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
    setLogoError('')

    let logoUrl = null
    if (form.logoFile) {
      try { logoUrl = await uploadLogo(supabase, form.slug, form.logoFile) }
      catch (err) { setLogoError(`Upload da logo falhou: ${err.message}`); return }
    }

    const link = await save({
      nome:           form.nome,
      slug:           form.slug,
      status:         form.status,
      plano:          form.plano,
      segmento:       form.segmento,
      cor_primaria:   form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      features:       featuresComModelo(form.features, form.modelo_venda),
      // Só manda pedido mínimo se a loja nasce atacado — em varejo os campos
      // nem aparecem, e mandá-los sujaria lf_config à toa.
      pedido_minimo:  form.modelo_venda === MODELO_ATACADO
        ? { tipo: form.pm_tipo, valor: form.pm_valor, qtd: form.pm_qtd }
        : null,
      logoUrl,
      email_acesso:   form.email_acesso,
      senha_acesso:   form.senha_acesso,
      valor_mensal:   form.valor_mensal,
      enviarBV:       form.enviarBV,
      contratante:    apenasContratante(form),
      vencimento_dia:  form.vencimento_dia,
      desconto_tipo:   form.desconto_tipo,
      desconto_valor:  form.desconto_valor,
      desconto_motivo: form.desconto_motivo,
    })
    if (link) onCreated()
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
                {isValidSlug(form.slug) ? `${window.location.origin}/${form.slug}/` : 'Slug inválido — use letras, números e hífens'}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Segmento</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ key: 'moda', label: 'Moda' }, { key: 'mercado', label: 'Mercado' }].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSegmentoChange(key)}
                  style={{
                    flex: 1, height: 44, borderRadius: T.rInput, cursor: 'pointer',
                    border: `1.5px solid ${form.segmento === key ? T.purple : T.line}`,
                    background: form.segmento === key ? T.tintPurple : T.mist,
                    color: form.segmento === key ? T.purpleText : T.muted,
                    fontFamily: T.ui, fontSize: 13, fontWeight: 700,
                    transition: 'all .15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
              Define qual painel a loja usa: Moda (moda feminina) ou Mercado (mercearia/atacarejo).
            </p>
          </div>

          {/* ── Dados do contratante ── */}
          {/* Mesmos campos da edição em LojaDetalhe — ver CamposContratante. */}
          <Section title="Dados do contratante" />

          <CamposContratante
            valores={form}
            onChange={(campo, valor) => setForm(p => ({ ...p, [campo]: valor }))}
            intro="Usados para gerar o contrato. Todos opcionais — a loja pode ser criada agora e ter esses dados completados depois."
          />

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
              {Object.entries(PLANOS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label} — R$ {fmtValorPlano(valorPlano(form.segmento, key))}/mês
                </option>
              ))}
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

          {/* Dia de vencimento e desconto permanente da assinatura */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Dia de vencimento</label>
              <input
                type="number"
                min="1"
                max="28"
                value={form.vencimento_dia}
                onChange={e => setForm(p => ({ ...p, vencimento_dia: e.target.value }))}
                placeholder="Ex: 10"
                style={inp}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Desconto na assinatura</label>
              <select
                value={form.desconto_tipo}
                onChange={e => setForm(p => ({ ...p, desconto_tipo: e.target.value }))}
                style={{ ...inp, cursor: 'pointer' }}
              >
                <option value="">Sem desconto</option>
                <option value="percentual">Percentual (%)</option>
                <option value="fixo">Valor fixo (R$)</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
            De 1 a 28. Sem o dia preenchido, a loja não entra na geração automática das mensalidades seguintes.
          </p>

          {form.desconto_tipo && (
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
                  {form.desconto_tipo === 'percentual' ? 'Percentual (%)' : 'Valor abatido (R$)'}
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.desconto_valor}
                  onChange={e => setForm(p => ({ ...p, desconto_valor: e.target.value }))}
                  style={inp}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Motivo</label>
                <input
                  value={form.desconto_motivo}
                  onChange={e => setForm(p => ({ ...p, desconto_motivo: e.target.value }))}
                  placeholder="Ex: parceria"
                  style={inp}
                />
              </div>
            </div>
          )}

          {/* Prévia: o cadastro cria as duas cobranças, ambas vencendo hoje */}
          <div style={{ background: T.mist, borderRadius: T.rInput, padding: '12px 14px', marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Será cobrado hoje
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.ink, marginBottom: 3 }}>
              <span>Taxa de implantação</span><span style={{ fontWeight: 700 }}>{fmtR(TAXA_IMPLANTACAO)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.ink }}>
              <span>1ª mensalidade</span>
              <span style={{ fontWeight: 700 }}>
                {fmtR(aplicarDesconto(parseFloat(form.valor_mensal) || 0, form.desconto_tipo, form.desconto_valor))}
              </span>
            </div>
            <div style={{ height: 1, background: T.line, margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: T.ink, fontWeight: 700 }}>
              <span>Total</span>
              <span>{fmtR(TAXA_IMPLANTACAO + aplicarDesconto(parseFloat(form.valor_mensal) || 0, form.desconto_tipo, form.desconto_valor))}</span>
            </div>
            <p style={{ fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
              Duas cobranças separadas, ambas vencendo hoje — igual ao que o contrato promete. A partir do mês seguinte, só a mensalidade.
            </p>
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

          {/* Modelo de venda — grava features.catalogo_b2b. Ver utils/modeloVenda.js
              para o porquê de Atacado gravar 'pro' e não true. */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Modelo de venda</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { key: MODELO_VAREJO,  label: 'Varejo' },
                { key: MODELO_ATACADO, label: 'Atacado' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, modelo_venda: key }))}
                  style={{
                    flex: 1, height: 44, borderRadius: T.rInput, cursor: 'pointer',
                    border: `1.5px solid ${form.modelo_venda === key ? T.purple : T.line}`,
                    background: form.modelo_venda === key ? T.tintPurple : T.mist,
                    color: form.modelo_venda === key ? T.purpleText : T.muted,
                    fontFamily: T.ui, fontSize: 13, fontWeight: 700,
                    transition: 'all .15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
              {form.modelo_venda === MODELO_ATACADO
                ? 'Catálogo de atacado: pedido mínimo e grade de tamanho no catálogo público.'
                : 'Catálogo comum de varejo — o cliente escolhe uma variação por vez.'}
            </p>
          </div>

          {form.modelo_venda === MODELO_ATACADO && (
            <div style={{ background: T.mist, borderRadius: T.rCard, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Pedido mínimo
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Tipo</label>
                  <select
                    value={form.pm_tipo}
                    onChange={e => setForm(p => ({ ...p, pm_tipo: e.target.value }))}
                    style={{ ...inp, background: T.white, cursor: 'pointer' }}
                  >
                    <option value="nenhum">Sem pedido mínimo</option>
                    <option value="valor">Valor (R$)</option>
                    <option value="quantidade">Quantidade (peças)</option>
                  </select>
                </div>
                {form.pm_tipo !== 'nenhum' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
                      {form.pm_tipo === 'valor' ? 'Valor mínimo (R$)' : 'Peças no mínimo'}
                    </label>
                    {form.pm_tipo === 'valor' ? (
                      <input
                        type="number" min="0" step="0.01"
                        value={form.pm_valor}
                        onChange={e => setForm(p => ({ ...p, pm_valor: e.target.value }))}
                        placeholder="Ex: 500,00"
                        style={{ ...inp, background: T.white }}
                      />
                    ) : (
                      <input
                        type="number" min="0" step="1"
                        value={form.pm_qtd}
                        onChange={e => setForm(p => ({ ...p, pm_qtd: e.target.value }))}
                        placeholder="Ex: 12"
                        style={{ ...inp, background: T.white }}
                      />
                    )}
                  </div>
                )}
              </div>
              <p style={{ fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
                Opcional — pode ficar em branco e a lojista define depois na tela de Catálogo B2B.
              </p>
            </div>
          )}

          <div style={{ background: T.mist, borderRadius: T.rCard, padding: '4px 14px', marginBottom: 4 }}>
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

// ── Constants ────────────────────────────────────────────────────
const PLANOS_ORDER = ['starter', 'pro', 'business']
const PLANO_LABELS = { starter: 'Starter', pro: 'Pro', business: 'Business' }

// ── GruposConsultor ───────────────────────────────────────────────
function GruposConsultor({ clientes, consultoresMap, redesMap, onDelete }) {
  // agrupar por consultor_id (null → "Admin")
  const grupos = useMemo(() => {
    const map = new Map()
    clientes.forEach(c => {
      const key = c.cadastrado_por_consultor_id ?? '__admin__'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(c)
    })

    const entries = []
    map.forEach((lojas, key) => {
      const nome = key === '__admin__' ? 'Admin' : (consultoresMap[key] || 'Consultor desconhecido')
      entries.push({ key, nome, lojas })
    })

    // Admin sempre primeiro, demais em ordem alfabética
    entries.sort((a, b) => {
      if (a.key === '__admin__') return -1
      if (b.key === '__admin__') return 1
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })

    return entries
  }, [clientes, consultoresMap])

  return (
    <div>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>
        {clientes.length} {clientes.length === 1 ? 'loja' : 'lojas'} · {grupos.length} {grupos.length === 1 ? 'consultor' : 'consultores'}
      </p>
      {grupos.map(({ key, nome, lojas }) => (
        <ConsultorAccordion
          key={key}
          nomeConsultor={nome}
          lojas={lojas}
          redesMap={redesMap}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// ── ConsultorAccordion ────────────────────────────────────────────
function ConsultorAccordion({ nomeConsultor, lojas, redesMap, onDelete }) {
  const [open, setOpen] = useState(true)

  // subgrupar por plano: starter → pro → business → Outros
  const grupos = useMemo(() => {
    const buckets = { starter: [], pro: [], business: [], outros: [] }
    lojas.forEach(c => {
      const p = (c.plano || '').toLowerCase()
      if (PLANOS_ORDER.includes(p)) buckets[p].push(c)
      else buckets.outros.push(c)
    })
    return [
      ...PLANOS_ORDER.filter(p => buckets[p].length > 0).map(p => ({ key: p, label: PLANO_LABELS[p], items: buckets[p] })),
      ...(buckets.outros.length > 0 ? [{ key: 'outros', label: 'Outros', items: buckets.outros }] : []),
    ]
  }, [lojas])

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Accordion header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '10px 0', marginBottom: open ? 14 : 0,
          textAlign: 'left',
        }}
      >
        <ChevronDown
          size={16}
          color={T.muted}
          style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>
          {nomeConsultor}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: T.muted,
          background: T.mist, border: `1px solid ${T.line}`,
          borderRadius: T.rPill, padding: '2px 8px', flexShrink: 0,
        }}>
          {lojas.length} {lojas.length === 1 ? 'loja' : 'lojas'}
        </span>
        <div style={{ flex: 1, height: 1, background: T.line }} />
      </button>

      {open && (
        <div>
          {grupos.map(({ key, label, items }) => (
            <div key={key} style={{ marginBottom: 20 }}>
              {/* Plano sub-header — só exibe se houver mais de um grupo */}
              {grupos.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: T.muted2,
                    textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap',
                  }}>{label}</span>
                  <div style={{ flex: 1, height: 1, background: T.line }} />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {items.map(c => {
                  const slug = c.slug || c.loja_id
                  const link = `${window.location.origin}/${slug}/`
                  return (
                    <StoreCard
                      key={c.id}
                      nome={c.nome}
                      slug={slug}
                      status={c.status || 'ativo'}
                      logoUrl={c.logo_url}
                      primary={c.cor_primaria || T.purple}
                      link={link}
                      rede={c.rede_id ? redesMap[c.rede_id] : undefined}
                      onDelete={() => onDelete({ nome: c.nome, slug })}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function CadastroCliente() {
  const [clientes, setClientes]           = useState([])
  const [redesMap, setRedesMap]           = useState({}) // rede_id → rede.nome
  const [consultoresMap, setConsultoresMap] = useState({}) // id → nome
  const [fetching, setFetching]           = useState(true)
  const [fetchError, setFetchError]       = useState('')
  const [modalOpen, setModalOpen]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // { nome, slug }

  const fetchClientes = useCallback(async () => {
    setFetching(true); setFetchError('')
    const [cfgRes, redesRes, consultoresRes] = await Promise.all([
      supabase.from('lf_config').select('*').neq('status', 'excluida').order('nome'),
      supabase.from('jt_redes').select('id, nome'),
      supabase.from('jt_consultants').select('id, nome'),
    ])
    if (cfgRes.error) { setFetchError(cfgRes.error.message); setFetching(false); return }
    setClientes(cfgRes.data || [])
    const redesM = {}
    ;(redesRes.data || []).forEach(r => { redesM[r.id] = r.nome })
    setRedesMap(redesM)
    const consM = {}
    ;(consultoresRes.data || []).forEach(c => { consM[c.id] = c.nome })
    setConsultoresMap(consM)
    setFetching(false)
  }, [])

  useEffect(() => { fetchClientes() }, [fetchClientes])

  async function handleDelete(slug) {
    const { error } = await supabase.from('lf_config').update({ status: 'excluida' }).eq('loja_id', slug)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    setConfirmDelete(null)
    fetchClientes()
  }

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
        <GruposConsultor
          clientes={clientes}
          consultoresMap={consultoresMap}
          redesMap={redesMap}
          onDelete={setConfirmDelete}
        />
      )}

      <NovoClienteModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={fetchClientes} />

      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 400, boxShadow: T.darkCardShadow, padding: '28px 28px 24px', fontFamily: T.ui }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Excluir loja?</h2>
            <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.6, marginBottom: 24 }}>
              A loja <strong style={{ color: T.ink }}>{confirmDelete.nome}</strong> será marcada como excluída e não aparecerá mais na listagem. Os dados não são apagados e podem ser restaurados manualmente.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, height: 42, borderRadius: T.rInput, border: `1.5px solid ${T.line}`, background: T.mist, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.ink, transition: 'border-color .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.line }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.slug)}
                style={{ flex: 1, height: 42, borderRadius: T.rInput, border: 'none', background: T.coral, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.white, boxShadow: '0 4px 12px rgba(255,111,94,0.28)', transition: 'background .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = T.coralText }}
                onMouseLeave={e => { e.currentTarget.style.background = T.coral }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
