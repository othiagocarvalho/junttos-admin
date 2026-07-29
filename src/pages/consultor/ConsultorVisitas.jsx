import { useState, useEffect } from 'react'
import { supabaseConsultor as supabase } from '../../lib/supabaseConsultor'
import { useConsultorAuth } from '../../context/ConsultorAuthContext'
import { calcTaxaConversao, fmtHora } from '../../utils/consultor'
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import { T } from '../../theme/tokens'
import ConsultorLayout from './ConsultorLayout'

const PLANOS = [
  { value: 'starter',  label: 'Starter — R$ 99,90/mês' },
  { value: 'pro',      label: 'Pro — R$ 149,90/mês' },
  { value: 'business', label: 'Business — R$ 259,90/mês' },
]

const FORMAS_PGTO = [
  { value: 'pix',        label: 'Pix' },
  { value: 'cartao',     label: 'Cartão de Crédito' },
  { value: 'boleto',     label: 'Boleto' },
  { value: 'parcelado',  label: 'Parcelado' },
]

const RESULT_CONFIG = {
  fechamento:    { bg: T.statusAtivoBg,  text: T.statusAtivoTx,  label: 'Fechamento'    },
  sem_interesse: { bg: T.tintCoral,      text: T.coralText,       label: 'Sem Interesse' },
  retornar:      { bg: T.statusTrialBg,  text: T.statusTrialTx,   label: 'Retornar'      },
  pendente:      { bg: T.tintPurple,     text: T.purpleText,      label: 'Pendente'      },
}

function nowTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function today() {
  return new Date().toISOString().split('T')[0]
}

const emptyForm = {
  cliente_nome:         '',
  empresa:              '',
  telefone:             '',
  bairro:               '',
  hora_inicio:          '',
  hora_fim:             '',
  fechou_negocio:       false,
  plano_fechado:        'starter',
  forma_pagamento_impl: 'pix',
  observacoes:          '',
}

const inp = {
  width: '100%', height: 44, boxSizing: 'border-box',
  background: T.mist, border: `1.5px solid ${T.line}`,
  borderRadius: T.rInput, padding: '0 12px',
  fontFamily: T.ui, fontSize: 14, color: T.ink, outline: 'none',
}
const label = { display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 5 }

export default function ConsultorVisitas() {
  const { consultorId } = useConsultorAuth()
  const [visitas,  setVisitas]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [form,     setForm]     = useState({ ...emptyForm, hora_inicio: nowTime() })

  useEffect(() => { fetchVisitas() }, [])

  async function fetchVisitas() {
    setLoading(true)
    const { data } = await supabase
      .from('jt_visits')
      .select('*')
      .eq('data_visita', today())
      .order('created_at', { ascending: false })
    setVisitas(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.cliente_nome.trim()) { setError('Nome do cliente é obrigatório.'); return }
    if (!form.bairro.trim()) { setError('Bairro é obrigatório.'); return }

    setSaving(true); setError('')
    const { error: err } = await supabase.from('jt_visits').insert({
      consultor_id:         consultorId,
      cliente_nome:         form.cliente_nome.trim(),
      empresa:              form.empresa.trim() || null,
      telefone:             form.telefone.trim() || null,
      bairro:               form.bairro.trim(),
      hora_inicio:          form.hora_inicio || null,
      hora_fim:             form.hora_fim    || null,
      resultado:            form.fechou_negocio ? 'fechamento' : 'sem_interesse',
      plano_fechado:        form.fechou_negocio ? form.plano_fechado        : null,
      forma_pagamento_impl: form.fechou_negocio ? form.forma_pagamento_impl : null,
      data_visita:          today(),
      observacoes:          form.observacoes.trim() || null,
    })

    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ ...emptyForm, hora_inicio: nowTime() })
    fetchVisitas()
  }

  const taxa    = calcTaxaConversao(visitas)
  const fechados = visitas.filter(v => v.resultado === 'fechamento').length

  return (
    <ConsultorLayout>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Visitas de Hoje</h1>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>
        {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Visitas hoje', value: visitas.length, color: T.purple },
          { label: 'Fechamentos', value: fechados, color: T.statusAtivoTx },
          { label: 'Conversão', value: `${taxa}%`, color: taxa >= 50 ? T.statusAtivoTx : T.statusTrialTx },
        ].map(({ label: l, value, color }) => (
          <div key={l} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '14px 12px', textAlign: 'center', boxShadow: T.cardShadow }}>
            <p style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{value}</p>
            <p style={{ fontSize: 11, color: T.muted, margin: 0, fontWeight: 600 }}>{l}</p>
          </div>
        ))}
      </div>

      {/* ── Layout: formulário | lista ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>

        {/* ─ Formulário ─ */}
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '20px 18px', boxShadow: T.cardShadow }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 16, marginTop: 0 }}>Registrar nova visita</p>

          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '10px 12px', marginBottom: 14 }}>
              <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: T.coralText, margin: 0 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Nome do cliente *</label>
              <input required value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} placeholder="Ex: Maria das Graças" style={inp} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>Nome da loja / Empresa</label>
              <input value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Ex: Boutique da Maria" style={inp} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={label}>Telefone</label>
                <input type="tel" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 9 0000-0000" style={inp} />
              </div>
              <div>
                <label style={label}>Bairro *</label>
                <input required value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Ex: Aldeota" style={inp} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={label}>Hora início</label>
                <input type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={label}>Hora fim</label>
                <input type="time" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} style={inp} />
              </div>
            </div>

            {/* Toggle fechou_negocio */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.mist, borderRadius: T.rInput, padding: '12px 14px', marginBottom: form.fechou_negocio ? 14 : 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: '0 0 2px' }}>Fechou negócio?</p>
                <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>Assinou o plano agora</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, fechou_negocio: !f.fechou_negocio }))}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: form.fechou_negocio ? T.statusAtivoTx : T.line,
                  position: 'relative', transition: 'background .2s', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3,
                  left: form.fechou_negocio ? 24 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                }} />
              </button>
            </div>

            {/* Campos condicionais */}
            {form.fechou_negocio && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={label}>Plano fechado</label>
                  <select value={form.plano_fechado} onChange={e => setForm(f => ({ ...f, plano_fechado: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                    {PLANOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Forma de pagamento da implantação</label>
                  <select value={form.forma_pagamento_impl} onChange={e => setForm(f => ({ ...f, forma_pagamento_impl: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                    {FORMAS_PGTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={label}>Observações</label>
              <textarea
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="O que aconteceu na visita..."
                rows={3}
                style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%', height: 48, borderRadius: T.rCard,
                background: saving ? T.mist : T.coral,
                color: saving ? T.muted : '#fff',
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: T.ui, fontSize: 15, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: saving ? 'none' : '0 4px 16px rgba(255,111,94,0.28)',
                transition: 'all .18s',
              }}
            >
              {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Registrando…</> : 'Registrar Visita'}
            </button>
          </form>
        </div>

        {/* ─ Lista de hoje ─ */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 12 }}>
            {visitas.length === 0 ? 'Nenhuma visita registrada hoje' : `${visitas.length} visita${visitas.length !== 1 ? 's' : ''} hoje`}
          </p>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Carregando…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visitas.map(v => {
                const rc      = RESULT_CONFIG[v.resultado] || RESULT_CONFIG.pendente
                const horario = [fmtHora(v.hora_inicio), fmtHora(v.hora_fim)].filter(Boolean).join(' → ')
                return (
                  <div
                    key={v.id}
                    style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '14px 16px', boxShadow: T.cardShadow }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: v.plano_fechado ? 8 : 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.cliente_nome || v.empresa || '—'}
                        </p>
                        <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>
                          {[v.bairro, horario].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: rc.bg, color: rc.text, borderRadius: 99, fontSize: 12, fontWeight: 600, padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {v.resultado === 'fechamento' ? <CheckCircle2 size={11} /> : v.resultado === 'sem_interesse' ? <XCircle size={11} /> : <Clock size={11} />}
                        {rc.label}
                      </span>
                    </div>
                    {v.plano_fechado && (
                      <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>
                        Plano: <strong style={{ color: T.ink }}>{v.plano_fechado}</strong>
                        {v.forma_pagamento_impl && <> · {v.forma_pagamento_impl}</>}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </ConsultorLayout>
  )
}
