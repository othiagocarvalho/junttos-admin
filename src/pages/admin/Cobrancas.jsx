import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { AlertCircle, Loader2, CreditCard, Check, X, ChevronDown } from 'lucide-react'
import { T } from '../../theme/tokens'

function fmtR(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

function getMonthOptions() {
  const opts = []
  const now = new Date()
  for (let i = -6; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    opts.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

function currentMonthVal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function effectiveStatus(row) {
  if (row.status === 'pago') return 'pago'
  if (row.vencimento && row.vencimento < new Date().toISOString().split('T')[0]) return 'atrasado'
  return 'pendente'
}

const STATUS_STYLE = {
  pago:     { bg: '#E6F6EE', color: '#1F8A5B', label: 'Pago' },
  pendente: { bg: '#FFF4E0', color: '#B7791F', label: 'Pendente' },
  atrasado: { bg: '#FEE8E8', color: '#C0392B', label: 'Atrasado' },
}

function Avatar({ nome }) {
  const initials = (nome || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: T.iconGrad, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, color: T.white, letterSpacing: '0.02em',
    }}>{initials}</div>
  )
}

// ── Registrar Pagamento Modal ────────────────────────────────────
function PagamentoModal({ open, onClose, cobrancas, onSaved, nomeMap }) {
  const [cobrancaId, setCobrancaId] = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const pending = cobrancas.filter(c => effectiveStatus(c) !== 'pago')

  useEffect(() => {
    if (open) { setCobrancaId(pending[0]?.id || ''); setError('') }
  }, [open])

  async function handleSave() {
    if (!cobrancaId) { setError('Selecione uma cobrança.'); return }
    setSaving(true); setError('')
    try {
      const { error: upErr } = await supabase
        .from('jt_cobrancas')
        .update({ status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] })
        .eq('id', cobrancaId)
      if (upErr) throw new Error(upErr.message)
      onSaved()
      onClose()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  useEffect(() => {
    if (!open) return
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const inp = {
    width: '100%', height: 44, boxSizing: 'border-box',
    background: T.mist, border: `1.5px solid ${T.line}`,
    borderRadius: T.rInput, padding: '0 14px',
    fontFamily: T.ui, fontSize: 14, color: T.ink, outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 440, boxShadow: T.darkCardShadow, fontFamily: T.ui }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 0' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink }}>Registrar Pagamento</h2>
          <button onClick={onClose} style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} color={T.muted} />
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 8 }}>Cobrança a receber</label>
          <select value={cobrancaId} onChange={e => setCobrancaId(e.target.value)} style={inp}>
            <option value="">Selecione...</option>
            {pending.map(c => (
              <option key={c.id} value={c.id}>
                {nomeMap?.[c.loja_id] || c.loja_id} — {fmtR(c.valor)} · venc. {fmtDate(c.vencimento)}
              </option>
            ))}
          </select>

          {pending.length === 0 && (
            <p style={{ fontSize: 13, color: T.muted, marginTop: 12 }}>Nenhuma cobrança pendente neste mês.</p>
          )}

          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '10px 12px', marginTop: 14 }}>
              <AlertCircle size={13} color={T.coralText} />
              <p style={{ fontSize: 12, color: T.coralText }}>{error}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: T.rInput, border: `1px solid ${T.line}`, background: T.mist, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.muted }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !cobrancaId} style={{
              flex: 1, height: 44, borderRadius: T.rInput, border: 'none',
              background: saving || !cobrancaId ? T.mist : T.purple,
              color: saving || !cobrancaId ? T.muted : T.white,
              cursor: saving || !cobrancaId ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function Cobrancas() {
  const [configs, setConfigs]       = useState([])
  const [cobrancas, setCobrancas]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const monthOptions = getMonthOptions()
  const [selectedMonth, setSelectedMonth] = useState(currentMonthVal)

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [cfgRes, cobRes] = await Promise.all([
        supabase.from('lf_config').select('loja_id, nome, status'),
        supabase.from('jt_cobrancas').select('*').order('vencimento', { ascending: false }),
      ])
      if (cfgRes.error) throw new Error(cfgRes.error.message)
      if (cobRes.error) throw new Error(cobRes.error.message)
      setConfigs(cfgRes.data || [])
      setCobrancas(cobRes.data || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const ativos = configs.filter(c => c.status?.toLowerCase() === 'ativo')
  const ativoIds = new Set(ativos.map(c => c.loja_id))
  const mrrByLoja = new Map()
  for (const c of cobrancas) {
    if (ativoIds.has(c.loja_id) && !mrrByLoja.has(c.loja_id)) {
      mrrByLoja.set(c.loja_id, Number(c.valor || 0))
    }
  }
  const mrr = [...mrrByLoja.values()].reduce((s, v) => s + v, 0)
  const nomeMap = Object.fromEntries(configs.map(c => [c.loja_id, c.nome]))

  const [selY, selM] = selectedMonth.split('-').map(Number)
  const filtered = cobrancas.filter(c => {
    if (!c.vencimento) return false
    const [y, m] = c.vencimento.split('-').map(Number)
    return y === selY && m === selM
  })

  const recebido = filtered.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valor || 0), 0)
  const pendente = filtered.filter(c => effectiveStatus(c) !== 'pago').reduce((s, c) => s + Number(c.valor || 0), 0)

  const metrics = [
    { label: 'MRR', value: fmtR(mrr), sub: 'receita recorrente mensal', color: T.purple },
    { label: 'Recebido este mês', value: fmtR(recebido), sub: `${filtered.filter(c => c.status === 'pago').length} pagamentos`, color: T.statusAtivoTx },
    { label: 'Pendente', value: fmtR(pendente), sub: `${filtered.filter(c => effectiveStatus(c) !== 'pago').length} cobranças`, color: '#B7791F' },
    { label: 'Clientes ativos', value: ativos.length, sub: 'planos ativos', color: T.purple },
  ]

  return (
    <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Cobranças</h1>
          <p style={{ fontSize: 13.5, color: T.muted }}>Gestão financeira e recorrência dos clientes Junttos.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', borderRadius: T.rPill, background: T.purple, color: T.white, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(94,43,208,0.28)' }}
        >
          <Check size={15} /> Registrar Pagamento
        </button>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 28 }}>
        {metrics.map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '20px 22px', boxShadow: T.cardShadow }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{value}</p>
            <p style={{ fontSize: 12, color: T.muted }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Table header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Cobranças do mês</p>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              height: 38, padding: '0 36px 0 14px', borderRadius: T.rInput,
              border: `1.5px solid ${T.line}`, background: T.white,
              fontFamily: T.ui, fontSize: 13, fontWeight: 600, color: T.ink,
              outline: 'none', cursor: 'pointer', appearance: 'none',
            }}
          >
            {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} color={T.muted} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 14, padding: 32 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...
        </div>
      ) : error ? (
        <div style={{ background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rCard, padding: '20px 24px', display: 'flex', gap: 12 }}>
          <AlertCircle size={16} color={T.coralText} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13, color: T.coralText }}>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '48px 24px', textAlign: 'center', boxShadow: T.cardShadow }}>
          <CreditCard size={32} color={T.line} style={{ margin: '0 auto 12px' }} />
          <p style={{ color: T.muted, fontSize: 14 }}>Nenhuma cobrança neste mês.</p>
        </div>
      ) : (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, boxShadow: T.cardShadow, overflow: 'hidden' }}>
          {/* Table header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 130px 110px', padding: '10px 20px', borderBottom: `1px solid ${T.line}', background: T.mist` }}>
            {['Cliente', 'Valor', 'Vencimento', 'Status'].map(h => (
              <p key={h} style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</p>
            ))}
          </div>

          {filtered.map((row, i) => {
            const st = effectiveStatus(row)
            const { bg, color, label } = STATUS_STYLE[st]
            const nome = nomeMap[row.loja_id] || row.loja_id
            return (
              <div key={row.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 130px 110px',
                padding: '14px 20px', alignItems: 'center',
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.line}` : 'none',
                transition: 'background .12s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = T.mist}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar nome={nome} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, lineHeight: 1.2 }}>{nome}</p>
                    <p style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{row.loja_id}</p>
                  </div>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{fmtR(row.valor)}</p>
                <p style={{ fontSize: 13, color: T.muted }}>{fmtDate(row.vencimento)}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: T.rPill, background: bg, color, fontSize: 12, fontWeight: 700 }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <PagamentoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        cobrancas={filtered}
        onSaved={fetchData}
        nomeMap={nomeMap}
      />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
