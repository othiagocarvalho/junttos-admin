import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, BarChart2, FileText, Receipt, Check, AlertCircle } from 'lucide-react'
import { calcularStatusReal, mesclarContasReceber, calcularFluxoCaixa, calcularDRE, mesAtualRange, navegarMes } from '../../utils/financeiro'
import { HeroCard } from '../../components/studio/Card'
import StatCard, { StatGrid } from '../../components/studio/StatCard'
import StatusPill from '../../components/studio/StatusPill'
import EmptyState from '../../components/studio/EmptyState'

const fmtR = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')
const fmtDate = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

const CATEGORIAS_PAGAR = ['aluguel', 'fornecedor', 'salario', 'imposto', 'energia', 'agua', 'internet', 'marketing', 'outros']
const ORIGENS = ['outro', 'crediario', 'venda_prazo']

const STATUS_META = {
  pago:      { tone: 'ok',   label: 'Pago'     },
  recebido:  { tone: 'ok',   label: 'Recebido' },
  pendente:  { tone: 'warn', label: 'Pendente' },
  atrasado:  { tone: 'bad',  label: 'Atrasado' },
}

const labelStyle = {
  display: 'block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5,
}
const inputStyle = {
  width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 12,
  padding: '0 14px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14,
  color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
}

// ── Contas a Pagar ───────────────────────────────────────────────
function ContasPagarTab({ lojaId, theme }) {
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pagandoId, setPagandoId] = useState(null)
  const [form, setForm] = useState({
    descricao: '', categoria: 'outros', valor: '', data_vencimento: '', observacoes: '',
  })

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('lf_contas_pagar').select('*').eq('loja_id', lojaId).order('data_vencimento')
    setContas((data || []).map(c => ({ ...c, _status: calcularStatusReal(c, 'data_pagamento') })))
    setLoading(false)
  }, [lojaId])

  useEffect(() => { fetch() }, [fetch])

  async function handleSalvar() {
    if (!form.descricao.trim() || !form.valor || !form.data_vencimento) return
    setSaving(true)
    await supabase.from('lf_contas_pagar').insert({
      loja_id: lojaId,
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      data_vencimento: form.data_vencimento,
      status: 'pendente',
      observacoes: form.observacoes || null,
    })
    setForm({ descricao: '', categoria: 'outros', valor: '', data_vencimento: '', observacoes: '' })
    setShowModal(false)
    setSaving(false)
    fetch()
  }

  async function handlePagar(id) {
    setPagandoId(id)
    await supabase.from('lf_contas_pagar').update({
      status: 'pago',
      data_pagamento: new Date().toISOString().slice(0, 10),
    }).eq('id', id)
    setPagandoId(null)
    fetch()
  }

  const filtradas = filtro === 'todas' ? contas : contas.filter(c => c._status === filtro)
  const totalPendente = contas.filter(c => c._status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalAtrasado = contas.filter(c => c._status === 'atrasado').reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalPago = contas.filter(c => c._status === 'pago').reduce((s, c) => s + Number(c.valor || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Contas a Pagar</span>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-input)', border: 'none', background: theme.primary, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', boxShadow: 'var(--shadow-btn-primary)' }}>
          <Plus size={14} /> Nova
        </button>
      </div>

      <StatGrid>
        <StatCard label="Pendente" value={fmtR(totalPendente)} style={{ borderLeft: '3px solid var(--status-warn-tx)' }} />
        <StatCard label="Atrasado" value={fmtR(totalAtrasado)} style={{ borderLeft: '3px solid var(--negative)' }} />
        <StatCard label="Pago" value={fmtR(totalPago)} style={{ borderLeft: '3px solid var(--positive)' }} />
      </StatGrid>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['todas', 'pendente', 'atrasado', 'pago'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 12px', borderRadius: 'var(--r-pill)', border: filtro === f ? 'none' : '1px solid var(--line)', background: filtro === f ? theme.primary : 'var(--surface)', color: filtro === f ? '#fff' : 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
            {f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nada por aqui"
          subtitle="Cadastre sua primeira conta."
          actionLabel="Nova Conta"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtradas.map(c => {
            const sm = STATUS_META[c._status] || STATUS_META.pendente
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '14px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</p>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                      {c.categoria} · Vence {fmtDate(c.data_vencimento)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(c.valor)}</p>
                    <StatusPill tone={sm.tone} label={sm.label} />
                  </div>
                </div>
                {c._status !== 'pago' && (
                  <button onClick={() => handlePagar(c.id)} disabled={pagandoId === c.id} style={{ width: '100%', height: 36, borderRadius: 'var(--r-input)', border: 'none', background: pagandoId === c.id ? 'var(--line)' : 'var(--positive)', color: '#fff', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Check size={13} /> {pagandoId === c.id ? 'Registrando...' : 'Marcar como pago'}
                  </button>
                )}
                {c._status === 'pago' && c.data_pagamento && (
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--positive)', textAlign: 'center', marginTop: 4 }}>Pago em {fmtDate(c.data_pagamento)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Nova Conta a Pagar</p>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Descrição *</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel março" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {CATEGORIAS_PAGAR.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Valor *</label>
                <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Vencimento *</label>
                <input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, height: 46, borderRadius: 'var(--r-input)', border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--ink)' }}>Cancelar</button>
              <button onClick={handleSalvar} disabled={saving || !form.descricao || !form.valor || !form.data_vencimento} style={{ flex: 2, height: 46, borderRadius: 'var(--r-input)', border: 'none', background: (!saving && form.descricao && form.valor && form.data_vencimento) ? theme.primary : 'var(--line)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff' }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Contas a Receber ─────────────────────────────────────────────
function ContasReceberTab({ lojaId, crediarios, theme }) {
  const [contasRaw, setContasRaw] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recebendoId, setRecebendoId] = useState(null)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({
    descricao: '', cliente_nome: '', valor: '', data_vencimento: '', origem: 'outro', observacoes: '',
  })

  const fetchContas = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('lf_contas_receber').select('*').eq('loja_id', lojaId).order('data_vencimento')
    setContasRaw(data || [])
    setLoading(false)
  }, [lojaId])

  useEffect(() => { fetchContas() }, [fetchContas])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handleSalvar() {
    if (!form.descricao.trim() || !form.valor || !form.data_vencimento) return
    setSaving(true)
    const row = {
      loja_id: lojaId,
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      data_vencimento: form.data_vencimento,
      status: 'pendente',
      observacoes: form.observacoes || null,
    }
    if (form.cliente_nome) row.cliente_nome = form.cliente_nome.trim()
    if (form.origem) row.origem = form.origem
    await supabase.from('lf_contas_receber').insert(row)
    setForm({ descricao: '', cliente_nome: '', valor: '', data_vencimento: '', origem: 'outro', observacoes: '' })
    setShowModal(false)
    setSaving(false)
    fetchContas()
  }

  async function handleReceber(id) {
    setRecebendoId(id)
    await supabase.from('lf_contas_receber').update({
      status: 'recebido',
      data_recebimento: new Date().toISOString().slice(0, 10),
    }).eq('id', id)
    setRecebendoId(null)
    fetchContas()
  }

  const contas = mesclarContasReceber(contasRaw, crediarios)
  const filtradas = filtro === 'todas' ? contas : contas.filter(c => c._status === filtro)
  const totalPendente = contas.filter(c => c._status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalAtrasado = contas.filter(c => c._status === 'atrasado').reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalRecebido = contas.filter(c => c._status === 'recebido').reduce((s, c) => s + Number(c.valor || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#18181B', color: '#fff', padding: '10px 20px', borderRadius: 'var(--r-input)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, zIndex: 400, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Contas a Receber</span>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-input)', border: 'none', background: theme.primary, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', boxShadow: 'var(--shadow-btn-primary)' }}>
          <Plus size={14} /> Nova
        </button>
      </div>

      <StatGrid>
        <StatCard label="A Receber" value={fmtR(totalPendente)} style={{ borderLeft: '3px solid var(--status-warn-tx)' }} />
        <StatCard label="Atrasado" value={fmtR(totalAtrasado)} style={{ borderLeft: '3px solid var(--negative)' }} />
        <StatCard label="Recebido" value={fmtR(totalRecebido)} style={{ borderLeft: '3px solid var(--positive)' }} />
      </StatGrid>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['todas', 'pendente', 'atrasado', 'recebido'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 12px', borderRadius: 'var(--r-pill)', border: filtro === f ? 'none' : '1px solid var(--line)', background: filtro === f ? theme.primary : 'var(--surface)', color: filtro === f ? '#fff' : 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nada por aqui"
          subtitle="Cadastre sua primeira conta."
          actionLabel="Nova Conta"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtradas.map(c => {
            const sm = STATUS_META[c._status] || STATUS_META.pendente
            const isCrediario = c._origem === 'crediario'
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: `1px solid ${isCrediario ? 'color-mix(in srgb, var(--primary) 25%, transparent)' : 'var(--line)'}`, borderRadius: 'var(--r-card)', padding: '14px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</p>
                      {isCrediario && (
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, flexShrink: 0 }}>Crediário</span>
                      )}
                    </div>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                      {c.cliente_nome ? `${c.cliente_nome} · ` : ''}{isCrediario ? 'crediário' : (c.origem || 'outro')} · Vence {fmtDate(c.data_vencimento)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(c.valor)}</p>
                    <StatusPill tone={sm.tone} label={sm.label} />
                  </div>
                </div>
                {isCrediario ? (
                  c._status === 'recebido' ? (
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--positive)', textAlign: 'center', marginTop: 4 }}>Recebido ✓</p>
                  ) : (
                    <button onClick={() => showToast('Gerencie esta parcela na tela de Crediário')} style={{ width: '100%', height: 36, borderRadius: 'var(--r-input)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', background: 'color-mix(in srgb, var(--primary) 6%, white)', color: 'var(--primary)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700 }}>
                      Ver na tela de Crediário →
                    </button>
                  )
                ) : (
                  c._status !== 'recebido' ? (
                    <button onClick={() => handleReceber(c.id)} disabled={recebendoId === c.id} style={{ width: '100%', height: 36, borderRadius: 'var(--r-input)', border: 'none', background: recebendoId === c.id ? 'var(--line)' : 'var(--positive)', color: '#fff', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Check size={13} /> {recebendoId === c.id ? 'Registrando...' : 'Marcar como recebido'}
                    </button>
                  ) : (
                    c.data_recebimento && <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--positive)', textAlign: 'center', marginTop: 4 }}>Recebido em {fmtDate(c.data_recebimento)}</p>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Nova Conta a Receber</p>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Descrição *</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Pagamento cliente João" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Cliente</label>
                <input value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} placeholder="Nome do cliente" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Origem</label>
                <select value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {ORIGENS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Valor *</label>
                <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Vencimento *</label>
                <input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, height: 46, borderRadius: 'var(--r-input)', border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--ink)' }}>Cancelar</button>
              <button onClick={handleSalvar} disabled={saving || !form.descricao || !form.valor || !form.data_vencimento} style={{ flex: 2, height: 46, borderRadius: 'var(--r-input)', border: 'none', background: (!saving && form.descricao && form.valor && form.data_vencimento) ? theme.primary : 'var(--line)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff' }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Fluxo de Caixa ───────────────────────────────────────────────
function FluxoCaixaTab({ lojaId, vendas, crediarios, theme }) {
  const [periodo, setPeriodo] = useState(mesAtualRange())
  const [contasPagar, setContasPagar] = useState([])
  const [contasReceberRaw, setContasReceberRaw] = useState([])

  useEffect(() => {
    async function load() {
      const [{ data: cp }, { data: cr }] = await Promise.all([
        supabase.from('lf_contas_pagar').select('data_pagamento, valor, status').eq('loja_id', lojaId),
        supabase.from('lf_contas_receber').select('*').eq('loja_id', lojaId),
      ])
      setContasPagar(cp || [])
      setContasReceberRaw(cr || [])
    }
    load()
  }, [lojaId])

  const contasReceber = mesclarContasReceber(contasReceberRaw, crediarios)
  const fluxo = calcularFluxoCaixa(vendas, contasPagar, contasReceber, periodo.inicio, periodo.fim)
  const saldoFinal = fluxo.length > 0 ? fluxo[fluxo.length - 1].saldoAcumulado : 0
  const totalEntradas = fluxo.reduce((s, d) => s + d.entradas, 0)
  const totalSaidas = fluxo.reduce((s, d) => s + d.saidas, 0)
  const maxVal = Math.max(...fluxo.map(d => Math.max(d.entradas, d.saidas)), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Navegador de mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '10px 14px' }}>
        <button onClick={() => setPeriodo(p => navegarMes(p.inicio, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize' }}>{periodo.label}</span>
        <button onClick={() => setPeriodo(p => navegarMes(p.inicio, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* KPIs */}
      <StatGrid>
        <StatCard label="Entradas" value={fmtR(totalEntradas)} style={{ borderLeft: '3px solid var(--positive)' }} />
        <StatCard label="Saídas" value={fmtR(totalSaidas)} style={{ borderLeft: '3px solid var(--negative)' }} />
        <HeroCard tone="dark" style={{ padding: '16px 16px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Saldo</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: saldoFinal >= 0 ? 'var(--positive)' : 'var(--negative)', lineHeight: 1 }}>{fmtR(saldoFinal)}</p>
        </HeroCard>
      </StatGrid>

      {/* Gráfico de barras CSS */}
      {fluxo.length === 0 ? (
        <EmptyState icon={BarChart2} title="Nada por aqui" subtitle="Sem movimentações no período." />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '16px 14px' }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>Entradas × Saídas por dia</p>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', overflowX: 'auto', paddingBottom: 8, minHeight: 80 }}>
            {fluxo.map(d => (
              <div key={d.data} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, minWidth: 24 }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                  <div style={{ width: 8, background: 'var(--positive)', borderRadius: '3px 3px 0 0', height: `${Math.max(2, (d.entradas / maxVal) * 64)}px` }} title={`Entradas: ${fmtR(d.entradas)}`} />
                  <div style={{ width: 8, background: 'var(--accent)', borderRadius: '3px 3px 0 0', height: `${Math.max(2, (d.saidas / maxVal) * 64)}px` }} title={`Saídas: ${fmtR(d.saidas)}`} />
                </div>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 8, color: 'var(--muted)' }}>{d.data.slice(8)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--positive)' }} /><span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>Entradas</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} /><span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>Saídas</span></div>
          </div>
        </div>
      )}

      {/* Lista por dia */}
      {fluxo.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fluxo.map(d => (
            <div key={d.data} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-input)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{fmtDate(d.data)}</p>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                  +{fmtR(d.entradas)} / -{fmtR(d.saidas)}
                </p>
              </div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: d.saldo >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                {d.saldo >= 0 ? '+' : ''}{fmtR(d.saldo)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── DRE ─────────────────────────────────────────────────────────
function DRETab({ lojaId, vendas, theme }) {
  const [periodo, setPeriodo] = useState(mesAtualRange())
  const [contasPagar, setContasPagar] = useState([])
  const [contasReceber, setContasReceber] = useState([])

  useEffect(() => {
    async function load() {
      const [{ data: cp }, { data: cr }] = await Promise.all([
        supabase.from('lf_contas_pagar').select('categoria, valor, status, data_pagamento').eq('loja_id', lojaId),
        supabase.from('lf_contas_receber').select('valor, status, data_recebimento, origem').eq('loja_id', lojaId),
      ])
      setContasPagar(cp || [])
      setContasReceber(cr || [])
    }
    load()
  }, [lojaId])

  const dre = calcularDRE(vendas, contasPagar, contasReceber, periodo.inicio, periodo.fim)
  const positivo = dre.resultadoLiquido >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Navegador */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '10px 14px' }}>
        <button onClick={() => setPeriodo(p => navegarMes(p.inicio, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize' }}>{periodo.label}</span>
        <button onClick={() => setPeriodo(p => navegarMes(p.inicio, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Resultado — hero */}
      <HeroCard tone="dark" style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Resultado Líquido</p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 36, fontWeight: 700, color: positivo ? 'var(--positive)' : 'var(--negative)', lineHeight: 1 }}>
          {positivo ? '+' : ''}{fmtR(dre.resultadoLiquido)}
        </p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>Margem: {dre.margemPercentual.toFixed(1)}%</p>
      </HeroCard>

      {/* Receita bruta */}
      <div style={{ background: 'var(--status-ok-bg)', border: '1px solid color-mix(in srgb, var(--status-ok-tx) 30%, transparent)', borderRadius: 'var(--r-card)', padding: '14px 12px' }}>
        <p style={{ ...labelStyle, color: 'var(--status-ok-tx)', marginBottom: 6 }}>Receita de Vendas</p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--status-ok-tx)' }}>{fmtR(dre.receitaBruta)}</p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--status-ok-tx)', marginTop: 2, opacity: 0.8 }}>Vendas no período</p>
      </div>

      {/* Outras Receitas */}
      <div style={{ background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--status-ok-tx) 20%, transparent)', borderRadius: 'var(--r-card)', padding: '14px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ ...labelStyle, marginBottom: 4 }}>Outras Receitas</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--muted)' }}>Contas a receber manuais recebidas</p>
        </div>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: dre.outrasReceitas > 0 ? 'var(--status-ok-tx)' : 'var(--muted)' }}>{fmtR(dre.outrasReceitas)}</p>
      </div>

      {/* Total despesas + despesas por categoria */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '18px 16px' }}>
        <p style={{ ...labelStyle, marginBottom: 6 }}>Total Despesas</p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--negative)', marginBottom: 4 }}>{fmtR(dre.totalDespesas)}</p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--muted)', marginBottom: 14 }}>Contas pagas</p>
        {dre.despesasPorCategoria.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dre.despesasPorCategoria.map(({ categoria, total }) => {
              const pct = dre.totalDespesas > 0 ? (total / dre.totalDespesas) * 100 : 0
              return (
                <div key={categoria}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink)', textTransform: 'capitalize' }}>{categoria}</span>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: theme.primary }}>{fmtR(total)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--line)' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: theme.primary, width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState icon={AlertCircle} title="Nada por aqui" subtitle="Nenhuma despesa paga no período." style={{ padding: '24px 0' }} />
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────
const TABS = [
  { id: 'pagar',   label: 'A Pagar',  Icon: TrendingDown },
  { id: 'receber', label: 'A Receber', Icon: TrendingUp   },
  { id: 'fluxo',  label: 'Fluxo',    Icon: BarChart2    },
  { id: 'dre',    label: 'DRE',      Icon: Wallet       },
]

export default function Financeiro({ lojaId, vendas = [], theme }) {
  const [tab, setTab] = useState('pagar')
  const [crediarios, setCrediarios] = useState([])

  useEffect(() => {
    supabase.from('lf_crediario').select('*').eq('loja_id', lojaId)
      .then(({ data }) => setCrediarios(data || []))
  }, [lojaId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Tabs horizontais roláveis — indicador underline */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0, WebkitOverflowScrolling: 'touch', borderBottom: '1px solid var(--line)' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
            border: 'none', background: 'transparent',
            color: tab === id ? theme.primary : 'var(--muted)',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: tab === id ? 700 : 500,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            borderBottom: tab === id ? `2px solid ${theme.primary}` : '2px solid transparent',
            marginBottom: -1, transition: 'color .15s',
          }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'pagar'   && <ContasPagarTab   lojaId={lojaId} theme={theme} />}
      {tab === 'receber' && <ContasReceberTab  lojaId={lojaId} crediarios={crediarios} theme={theme} />}
      {tab === 'fluxo'   && <FluxoCaixaTab    lojaId={lojaId} vendas={vendas} crediarios={crediarios} theme={theme} />}
      {tab === 'dre'     && <DRETab           lojaId={lojaId} vendas={vendas} theme={theme} />}
    </div>
  )
}
