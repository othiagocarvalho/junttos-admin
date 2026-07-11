import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Check, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, BarChart2, Wallet, FileText, Receipt, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { calcularStatusReal, mesclarContasReceber, calcularFluxoCaixa, calcularDRE, mesAtualRange, navegarMes } from '../../utils/financeiro'
import { HeroCard } from '../../components/studio/Card'
import { StatGrid } from '../../components/studio/StatCard'
import StatusPill from '../../components/studio/StatusPill'
import EmptyState from '../../components/studio/EmptyState'

const fmtR = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')
const fmtDate = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

const CATEGORIAS_PAGAR = ['aluguel', 'fornecedor', 'salario', 'imposto', 'energia', 'agua', 'internet', 'marketing', 'outros']
const ORIGENS = ['outro', 'crediario', 'venda_prazo']

const STATUS_META = {
  pago:     { tone: 'ok',   label: 'Pago'     },
  recebido: { tone: 'ok',   label: 'Recebido' },
  pendente: { tone: 'warn', label: 'Pendente' },
  atrasado: { tone: 'bad',  label: 'Atrasado' },
}

const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Plus Jakarta Sans, sans-serif' }
const inp = { width: '100%', height: 44, boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-input)', padding: '0 14px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)', outline: 'none' }

function KpiCard({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '20px 22px' }}>
      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>{label}</p>
      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: color || 'var(--ink)', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Aba Contas a Pagar ────────────────────────────────────────────
function ContasPagarPane({ lojaId, theme }) {
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pagandoId, setPagandoId] = useState(null)
  const [form, setForm] = useState({ descricao: '', categoria: 'outros', valor: '', data_vencimento: '', observacoes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('lf_contas_pagar').select('*').eq('loja_id', lojaId).order('data_vencimento')
    setContas((data || []).map(c => ({ ...c, _status: calcularStatusReal(c, 'data_pagamento') })))
    setLoading(false)
  }, [lojaId])

  useEffect(() => { load() }, [load])

  async function handleSalvar() {
    if (!form.descricao.trim() || !form.valor || !form.data_vencimento) return
    setSaving(true)
    await supabase.from('lf_contas_pagar').insert({ loja_id: lojaId, descricao: form.descricao.trim(), categoria: form.categoria, valor: parseFloat(form.valor.replace(',', '.')) || 0, data_vencimento: form.data_vencimento, status: 'pendente', observacoes: form.observacoes || null })
    setForm({ descricao: '', categoria: 'outros', valor: '', data_vencimento: '', observacoes: '' })
    setShowModal(false)
    setSaving(false)
    load()
  }

  async function handlePagar(id) {
    setPagandoId(id)
    await supabase.from('lf_contas_pagar').update({ status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) }).eq('id', id)
    setPagandoId(null)
    load()
  }

  const filtradas = filtro === 'todas' ? contas : contas.filter(c => c._status === filtro)
  const totalPendente = contas.filter(c => c._status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalAtrasado = contas.filter(c => c._status === 'atrasado').reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalPago = contas.filter(c => c._status === 'pago').reduce((s, c) => s + Number(c.valor || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Contas a Pagar</h2>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{contas.length} conta{contas.length !== 1 ? 's' : ''} cadastrada{contas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--r-input)', border: 'none', background: theme.primary, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', boxShadow: 'var(--shadow-btn-primary)' }}>
          <Plus size={15} /> Nova Conta
        </button>
      </div>

      <StatGrid style={{ marginBottom: 24 }}>
        <KpiCard label="Pendente" value={fmtR(totalPendente)} color="var(--status-warn-tx)" />
        <KpiCard label="Atrasado" value={fmtR(totalAtrasado)} color="var(--negative)" />
        <KpiCard label="Pago (total)" value={fmtR(totalPago)} color="var(--positive)" />
      </StatGrid>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['todas', 'pendente', 'atrasado', 'pago'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '7px 16px', borderRadius: 'var(--r-input)', border: filtro === f ? 'none' : '1px solid var(--line)', background: filtro === f ? theme.primary : 'var(--surface)', color: filtro === f ? '#fff' : 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', padding: '24px 0' }}>Carregando...</p>
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nada por aqui"
          subtitle="Cadastre sua primeira conta."
          actionLabel="Nova Conta"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(c => {
            const sm = STATUS_META[c._status] || STATUS_META.pendente
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</p>
                    <StatusPill tone={sm.tone} label={sm.label} />
                  </div>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
                    {c.categoria} · Vence {fmtDate(c.data_vencimento)}{c.data_pagamento ? ` · Pago ${fmtDate(c.data_pagamento)}` : ''}
                  </p>
                </div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>{fmtR(c.valor)}</p>
                {c._status !== 'pago' && (
                  <button onClick={() => handlePagar(c.id)} disabled={pagandoId === c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-input)', border: 'none', background: pagandoId === c.id ? 'var(--line)' : 'var(--positive)', color: '#fff', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    <Check size={12} /> {pagandoId === c.id ? '...' : 'Pago'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Nova Conta a Pagar" onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={lbl}>Descrição *</label><input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel março" style={inp} /></div>
            <div><label style={lbl}>Categoria</label><select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>{CATEGORIAS_PAGAR.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}</select></div>
            <div><label style={lbl}>Valor *</label><input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" style={inp} /></div>
            <div><label style={lbl}>Vencimento *</label><input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Observações</label><input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional" style={inp} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, height: 46, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={saving || !form.descricao || !form.valor || !form.data_vencimento} style={{ flex: 2, height: 46, borderRadius: 'var(--r-input)', border: 'none', background: (!saving && form.descricao && form.valor && form.data_vencimento) ? theme.primary : 'var(--line)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Aba Contas a Receber ──────────────────────────────────────────
function ContasReceberPane({ lojaId, crediarios, theme }) {
  const [contasRaw, setContasRaw] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recebendoId, setRecebendoId] = useState(null)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ descricao: '', cliente_nome: '', origem: 'outro', valor: '', data_vencimento: '', observacoes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('lf_contas_receber').select('*').eq('loja_id', lojaId).order('data_vencimento')
    setContasRaw(data || [])
    setLoading(false)
  }, [lojaId])

  useEffect(() => { load() }, [load])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handleSalvar() {
    if (!form.descricao.trim() || !form.valor || !form.data_vencimento) return
    setSaving(true)
    const row = { loja_id: lojaId, descricao: form.descricao.trim(), valor: parseFloat(form.valor.replace(',', '.')) || 0, data_vencimento: form.data_vencimento, status: 'pendente', observacoes: form.observacoes || null }
    if (form.cliente_nome) row.cliente_nome = form.cliente_nome.trim()
    if (form.origem) row.origem = form.origem
    await supabase.from('lf_contas_receber').insert(row)
    setForm({ descricao: '', cliente_nome: '', origem: 'outro', valor: '', data_vencimento: '', observacoes: '' })
    setShowModal(false)
    setSaving(false)
    load()
  }

  async function handleReceber(id) {
    setRecebendoId(id)
    await supabase.from('lf_contas_receber').update({ status: 'recebido', data_recebimento: new Date().toISOString().slice(0, 10) }).eq('id', id)
    setRecebendoId(null)
    load()
  }

  const contas = mesclarContasReceber(contasRaw, crediarios)
  const filtradas = filtro === 'todas' ? contas : contas.filter(c => c._status === filtro)
  const totalPendente = contas.filter(c => c._status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalAtrasado = contas.filter(c => c._status === 'atrasado').reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalRecebido = contas.filter(c => c._status === 'recebido').reduce((s, c) => s + Number(c.valor || 0), 0)

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#18181B', color: '#fff', padding: '12px 20px', borderRadius: 'var(--r-input)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, zIndex: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Contas a Receber</h2>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{contas.length} lançamento{contas.length !== 1 ? 's' : ''} (manuais + crediário)</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--r-input)', border: 'none', background: theme.primary, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', boxShadow: 'var(--shadow-btn-primary)' }}>
          <Plus size={15} /> Nova Conta
        </button>
      </div>

      <StatGrid style={{ marginBottom: 24 }}>
        <KpiCard label="A Receber" value={fmtR(totalPendente)} color="var(--status-warn-tx)" />
        <KpiCard label="Atrasado"  value={fmtR(totalAtrasado)} color="var(--negative)" />
        <KpiCard label="Recebido"  value={fmtR(totalRecebido)} color="var(--positive)" />
      </StatGrid>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['todas', 'pendente', 'atrasado', 'recebido'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '7px 16px', borderRadius: 'var(--r-input)', border: filtro === f ? 'none' : '1px solid var(--line)', background: filtro === f ? theme.primary : 'var(--surface)', color: filtro === f ? '#fff' : 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', padding: '24px 0' }}>Carregando...</p>
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nada por aqui"
          subtitle="Cadastre sua primeira conta."
          actionLabel="Nova Conta"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(c => {
            const sm = STATUS_META[c._status] || STATUS_META.pendente
            const isCrediario = c._origem === 'crediario'
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: `1px solid ${isCrediario ? 'color-mix(in srgb, var(--primary) 25%, transparent)' : 'var(--line)'}`, borderRadius: 'var(--r-card)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</p>
                    <StatusPill tone={sm.tone} label={sm.label} />
                    {isCrediario && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, flexShrink: 0 }}>Crediário</span>
                    )}
                  </div>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
                    {c.cliente_nome ? `${c.cliente_nome} · ` : ''}{isCrediario ? 'crediário' : (c.origem || 'outro')} · Vence {fmtDate(c.data_vencimento)}
                  </p>
                </div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>{fmtR(c.valor)}</p>
                {isCrediario ? (
                  c._status === 'recebido' ? (
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--positive)', fontWeight: 700, flexShrink: 0 }}>✓ Recebido</span>
                  ) : (
                    <button onClick={() => showToast('Gerencie esta parcela na tela de Crediário')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-input)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', background: 'color-mix(in srgb, var(--primary) 6%, white)', color: 'var(--primary)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      Ver Crediário
                    </button>
                  )
                ) : (
                  c._status !== 'recebido' && (
                    <button onClick={() => handleReceber(c.id)} disabled={recebendoId === c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-input)', border: 'none', background: recebendoId === c.id ? 'var(--line)' : 'var(--positive)', color: '#fff', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      <Check size={12} /> {recebendoId === c.id ? '...' : 'Recebido'}
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Nova Conta a Receber" onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={lbl}>Descrição *</label><input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Pagamento cliente João" style={inp} /></div>
            <div><label style={lbl}>Cliente</label><input value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} placeholder="Nome do cliente" style={inp} /></div>
            <div><label style={lbl}>Origem</label><select value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>{ORIGENS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace('_', ' ')}</option>)}</select></div>
            <div><label style={lbl}>Valor *</label><input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" style={inp} /></div>
            <div><label style={lbl}>Vencimento *</label><input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Observações</label><input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional" style={inp} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, height: 46, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={saving || !form.descricao || !form.valor || !form.data_vencimento} style={{ flex: 2, height: 46, borderRadius: 'var(--r-input)', border: 'none', background: (!saving && form.descricao && form.valor && form.data_vencimento) ? theme.primary : 'var(--line)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Aba Fluxo de Caixa ───────────────────────────────────────────
function FluxoCaixaPane({ lojaId, vendas, crediarios, theme }) {
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
  const totalEntradas = fluxo.reduce((s, d) => s + d.entradas, 0)
  const totalSaidas = fluxo.reduce((s, d) => s + d.saidas, 0)
  const saldoFinal = fluxo.length > 0 ? fluxo[fluxo.length - 1].saldoAcumulado : 0

  const chartData = fluxo.map(d => ({
    dia: d.data.slice(8),
    Entradas: d.entradas,
    Saidas: d.saidas,
  }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Fluxo de Caixa</h2>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginTop: 2, textTransform: 'capitalize' }}>{periodo.label}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-input)', padding: '8px 14px' }}>
          <button onClick={() => setPeriodo(p => navegarMes(p.inicio, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 2 }}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize', minWidth: 120, textAlign: 'center' }}>{periodo.label}</span>
          <button onClick={() => setPeriodo(p => navegarMes(p.inicio, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 2 }}><ChevronRight size={16} /></button>
        </div>
      </div>

      <StatGrid style={{ marginBottom: 28 }}>
        <KpiCard label="Total Entradas" value={fmtR(totalEntradas)} color="var(--positive)" />
        <KpiCard label="Total Saídas"   value={fmtR(totalSaidas)}   color="var(--negative)" />
        <HeroCard tone="dark" style={{ padding: '20px 22px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Saldo do Mês</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: saldoFinal >= 0 ? 'var(--positive)' : 'var(--negative)', lineHeight: 1 }}>{fmtR(saldoFinal)}</p>
        </HeroCard>
      </StatGrid>

      {chartData.length === 0 ? (
        <EmptyState icon={BarChart2} title="Nada por aqui" subtitle="Sem movimentações no período." />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '24px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 20 }}>Entradas × Saídas por dia</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2}>
              <XAxis dataKey="dia" tick={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `R$${v}`} tick={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={64} />
              <Tooltip formatter={(v, name) => [fmtR(v), name]} contentStyle={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, borderRadius: 10, border: '1px solid var(--line)' }} />
              <Bar dataKey="Entradas" fill="var(--positive)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saidas"   fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--positive)' }} /><span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>Entradas</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} /><span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>Saídas</span></div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fluxo.map(d => (
              <div key={d.data} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{fmtDate(d.data)}</span>
                <div style={{ display: 'flex', gap: 20 }}>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--positive)' }}>+{fmtR(d.entradas)}</span>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--negative)' }}>-{fmtR(d.saidas)}</span>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, color: d.saldo >= 0 ? 'var(--positive)' : 'var(--negative)', minWidth: 80, textAlign: 'right' }}>{d.saldo >= 0 ? '+' : ''}{fmtR(d.saldo)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Aba DRE ──────────────────────────────────────────────────────
function DREPane({ lojaId, vendas, theme }) {
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>DRE — Resultado</h2>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginTop: 2, textTransform: 'capitalize' }}>{periodo.label}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-input)', padding: '8px 14px' }}>
          <button onClick={() => setPeriodo(p => navegarMes(p.inicio, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 2 }}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize', minWidth: 120, textAlign: 'center' }}>{periodo.label}</span>
          <button onClick={() => setPeriodo(p => navegarMes(p.inicio, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 2 }}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--status-ok-bg)', border: '1px solid color-mix(in srgb, var(--status-ok-tx) 30%, transparent)', borderRadius: 'var(--r-card)', padding: '22px 24px' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--status-ok-tx)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Receita de Vendas</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 30, fontWeight: 700, color: 'var(--status-ok-tx)', lineHeight: 1 }}>{fmtR(dre.receitaBruta)}</p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--status-ok-tx)', marginTop: 6, opacity: 0.8 }}>Soma das vendas no período</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--status-ok-tx) 20%, transparent)', borderRadius: 'var(--r-card)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Outras Receitas</p>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>Contas a receber manuais recebidas</p>
            </div>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: dre.outrasReceitas > 0 ? 'var(--status-ok-tx)' : 'var(--muted)' }}>{fmtR(dre.outrasReceitas)}</p>
          </div>
        </div>
        <HeroCard tone="dark" style={{ padding: '22px 24px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Resultado Líquido</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 30, fontWeight: 700, color: positivo ? 'var(--positive)' : 'var(--negative)', lineHeight: 1 }}>{positivo ? '+' : ''}{fmtR(dre.resultadoLiquido)}</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>Margem: {dre.margemPercentual.toFixed(1)}%</p>
        </HeroCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Despesas por categoria */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '24px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Total Despesas</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: 'var(--negative)', marginBottom: 20 }}>{fmtR(dre.totalDespesas)}</p>
          {dre.despesasPorCategoria.length === 0 ? (
            <EmptyState icon={AlertCircle} title="Nada por aqui" subtitle="Nenhuma despesa paga." style={{ padding: '24px 0' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {dre.despesasPorCategoria.map(({ categoria, total }) => {
                const pct = dre.totalDespesas > 0 ? (total / dre.totalDespesas) * 100 : 0
                return (
                  <div key={categoria}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink)', textTransform: 'capitalize' }}>{categoria}</span>
                      <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: theme.primary }}>{fmtR(total)} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--line)' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: theme.primary, width: `${pct}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Gráfico de pizza de despesas com recharts BarChart */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '24px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 20 }}>Resumo Visual</p>
          {dre.despesasPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dre.despesasPorCategoria} layout="vertical">
                <XAxis type="number" tickFormatter={v => `R$${v}`} tick={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="categoria" type="category" tick={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fill: 'var(--ink)' }} axisLine={false} tickLine={false} width={72} />
                <Tooltip formatter={v => fmtR(v)} contentStyle={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, borderRadius: 10 }} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {dre.despesasPorCategoria.map((_, i) => (
                    <Cell key={i} fill={theme.primary} fillOpacity={1 - i * 0.12} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Wallet} title="Nada por aqui" subtitle="Registre despesas pagas para visualizar aqui." />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────
const TABS = [
  { id: 'pagar',   label: 'Contas a Pagar',  Icon: TrendingDown },
  { id: 'receber', label: 'Contas a Receber', Icon: TrendingUp   },
  { id: 'fluxo',  label: 'Fluxo de Caixa',  Icon: BarChart2    },
  { id: 'dre',    label: 'DRE',              Icon: Wallet       },
]

export default function FinanceiroDesktop({ data, theme }) {
  const [tab, setTab] = useState('pagar')
  const [crediarios, setCrediarios] = useState([])
  const lojaId = data.LOJA_ID
  const vendas = data.vendas || []
  const primary = theme.primary

  useEffect(() => {
    supabase.from('lf_crediario').select('*').eq('loja_id', lojaId)
      .then(({ data: d }) => setCrediarios(d || []))
  }, [lojaId])

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--line)', paddingBottom: 0 }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', border: 'none', background: 'transparent',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: tab === id ? 700 : 500,
            color: tab === id ? primary : 'var(--muted)',
            cursor: 'pointer',
            borderBottom: tab === id ? `2px solid ${primary}` : '2px solid transparent',
            marginBottom: -1,
            transition: 'color .15s',
          }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'pagar'   && <ContasPagarPane   lojaId={lojaId} theme={theme} />}
      {tab === 'receber' && <ContasReceberPane  lojaId={lojaId} crediarios={crediarios} theme={theme} />}
      {tab === 'fluxo'   && <FluxoCaixaPane    lojaId={lojaId} vendas={vendas} crediarios={crediarios} theme={theme} />}
      {tab === 'dre'     && <DREPane           lojaId={lojaId} vendas={vendas} theme={theme} />}
    </div>
  )
}
