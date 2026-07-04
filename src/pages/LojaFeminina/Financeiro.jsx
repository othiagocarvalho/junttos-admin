import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, BarChart2, FileText, Receipt, Check, AlertCircle } from 'lucide-react'
import { calcularStatusReal, mesclarContasReceber, calcularFluxoCaixa, calcularDRE, mesAtualRange, navegarMes } from '../../utils/financeiro'

const fmtR = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')
const fmtDate = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

const CATEGORIAS_PAGAR = ['aluguel', 'fornecedor', 'salario', 'imposto', 'energia', 'agua', 'internet', 'marketing', 'outros']
const ORIGENS = ['outro', 'crediario', 'venda_prazo']

const STATUS_COLOR = {
  pago:      { bg: 'rgba(22,163,74,0.10)',  color: '#16a34a', label: 'Pago'     },
  recebido:  { bg: 'rgba(22,163,74,0.10)',  color: '#16a34a', label: 'Recebido' },
  pendente:  { bg: 'rgba(202,138,4,0.10)',  color: '#ca8a04', label: 'Pendente' },
  atrasado:  { bg: 'rgba(239,68,68,0.10)',  color: '#ef4444', label: 'Atrasado' },
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Contas a Pagar</span>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: 'none', background: theme.primary, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>
          <Plus size={14} /> Nova
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 12px' }}>
          <p style={{ ...labelStyle, marginBottom: 6 }}>Pendente</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 19, fontWeight: 700, color: '#ca8a04' }}>{fmtR(totalPendente)}</p>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 12px' }}>
          <p style={{ ...labelStyle, marginBottom: 6 }}>Atrasado</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 19, fontWeight: 700, color: '#ef4444' }}>{fmtR(totalAtrasado)}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['todas', 'pendente', 'atrasado', 'pago'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 12px', borderRadius: 99, border: filtro === f ? 'none' : '1px solid var(--line)', background: filtro === f ? theme.primary : 'var(--surface)', color: filtro === f ? '#fff' : 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
            {f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
          <FileText size={28} color="var(--line)" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)' }}>Nenhuma conta encontrada</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtradas.map(c => {
            const sc = STATUS_COLOR[c._status] || STATUS_COLOR.pendente
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</p>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                      {c.categoria} · Vence {fmtDate(c.data_vencimento)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(c.valor)}</p>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: sc.bg, color: sc.color, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700 }}>{sc.label}</span>
                  </div>
                </div>
                {c._status !== 'pago' && (
                  <button onClick={() => handlePagar(c.id)} disabled={pagandoId === c.id} style={{ width: '100%', height: 36, borderRadius: 10, border: 'none', background: pagandoId === c.id ? 'var(--line)' : '#16a34a', color: '#fff', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Check size={13} /> {pagandoId === c.id ? 'Registrando...' : 'Marcar como pago'}
                  </button>
                )}
                {c._status === 'pago' && c.data_pagamento && (
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: '#16a34a', textAlign: 'center', marginTop: 4 }}>Pago em {fmtDate(c.data_pagamento)}</p>
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
              <button onClick={() => setShowModal(false)} style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--ink)' }}>Cancelar</button>
              <button onClick={handleSalvar} disabled={saving || !form.descricao || !form.valor || !form.data_vencimento} style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: (!saving && form.descricao && form.valor && form.data_vencimento) ? theme.primary : 'var(--line)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff' }}>
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
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1e1b4b', color: '#fff', padding: '10px 20px', borderRadius: 12, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, zIndex: 400, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Contas a Receber</span>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: 'none', background: theme.primary, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>
          <Plus size={14} /> Nova
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'A Receber', val: totalPendente, color: '#ca8a04' },
          { label: 'Atrasado',  val: totalAtrasado, color: '#ef4444' },
          { label: 'Recebido',  val: totalRecebido, color: '#16a34a' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 10px' }}>
            <p style={{ ...labelStyle, marginBottom: 4, fontSize: 9 }}>{label}</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color }}>{fmtR(val)}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['todas', 'pendente', 'atrasado', 'recebido'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 12px', borderRadius: 99, border: filtro === f ? 'none' : '1px solid var(--line)', background: filtro === f ? theme.primary : 'var(--surface)', color: filtro === f ? '#fff' : 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
          <Receipt size={28} color="var(--line)" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)' }}>Nenhuma conta encontrada</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtradas.map(c => {
            const sc = STATUS_COLOR[c._status] || STATUS_COLOR.pendente
            const isCrediario = c._origem === 'crediario'
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: `1px solid ${isCrediario ? 'rgba(107,79,187,0.25)' : 'var(--line)'}`, borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</p>
                      {isCrediario && (
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(107,79,187,0.12)', color: '#6B4FBB', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, flexShrink: 0 }}>Crediário</span>
                      )}
                    </div>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                      {c.cliente_nome ? `${c.cliente_nome} · ` : ''}{isCrediario ? 'crediário' : (c.origem || 'outro')} · Vence {fmtDate(c.data_vencimento)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(c.valor)}</p>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: sc.bg, color: sc.color, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700 }}>{sc.label}</span>
                  </div>
                </div>
                {isCrediario ? (
                  c._status === 'recebido' ? (
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: '#16a34a', textAlign: 'center', marginTop: 4 }}>Recebido ✓</p>
                  ) : (
                    <button onClick={() => showToast('Gerencie esta parcela na tela de Crediário')} style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(107,79,187,0.3)', background: 'rgba(107,79,187,0.06)', color: '#6B4FBB', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700 }}>
                      Ver na tela de Crediário →
                    </button>
                  )
                ) : (
                  c._status !== 'recebido' ? (
                    <button onClick={() => handleReceber(c.id)} disabled={recebendoId === c.id} style={{ width: '100%', height: 36, borderRadius: 10, border: 'none', background: recebendoId === c.id ? 'var(--line)' : '#16a34a', color: '#fff', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Check size={13} /> {recebendoId === c.id ? 'Registrando...' : 'Marcar como recebido'}
                    </button>
                  ) : (
                    c.data_recebimento && <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: '#16a34a', textAlign: 'center', marginTop: 4 }}>Recebido em {fmtDate(c.data_recebimento)}</p>
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
              <button onClick={() => setShowModal(false)} style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--ink)' }}>Cancelar</button>
              <button onClick={handleSalvar} disabled={saving || !form.descricao || !form.valor || !form.data_vencimento} style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: (!saving && form.descricao && form.valor && form.data_vencimento) ? theme.primary : 'var(--line)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 10px' }}>
          <p style={{ ...labelStyle, fontSize: 9, marginBottom: 4 }}>Entradas</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: '#16a34a' }}>{fmtR(totalEntradas)}</p>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 10px' }}>
          <p style={{ ...labelStyle, fontSize: 9, marginBottom: 4 }}>Saídas</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: '#ef4444' }}>{fmtR(totalSaidas)}</p>
        </div>
        <div style={{ background: saldoFinal >= 0 ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${saldoFinal >= 0 ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 14, padding: '12px 10px' }}>
          <p style={{ ...labelStyle, fontSize: 9, marginBottom: 4 }}>Saldo</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: saldoFinal >= 0 ? '#16a34a' : '#ef4444' }}>{fmtR(saldoFinal)}</p>
        </div>
      </div>

      {/* Gráfico de barras CSS */}
      {fluxo.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
          <BarChart2 size={28} color="var(--line)" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)' }}>Sem movimentações no período</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 14px' }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>Movimentações por dia</p>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', overflowX: 'auto', paddingBottom: 8, minHeight: 80 }}>
            {fluxo.map(d => (
              <div key={d.data} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, minWidth: 24 }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                  <div style={{ width: 8, background: '#16a34a', borderRadius: '3px 3px 0 0', height: `${Math.max(2, (d.entradas / maxVal) * 64)}px` }} title={`Entradas: ${fmtR(d.entradas)}`} />
                  <div style={{ width: 8, background: '#ef4444', borderRadius: '3px 3px 0 0', height: `${Math.max(2, (d.saidas / maxVal) * 64)}px` }} title={`Saídas: ${fmtR(d.saidas)}`} />
                </div>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 8, color: 'var(--muted)' }}>{d.data.slice(8)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a' }} /><span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>Entradas</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} /><span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>Saídas</span></div>
          </div>
        </div>
      )}

      {/* Lista por dia */}
      {fluxo.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fluxo.map(d => (
            <div key={d.data} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{fmtDate(d.data)}</p>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                  +{fmtR(d.entradas)} / -{fmtR(d.saidas)}
                </p>
              </div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: d.saldo >= 0 ? '#16a34a' : '#ef4444' }}>
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

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('lf_contas_pagar').select('categoria, valor, status, data_pagamento').eq('loja_id', lojaId)
      setContasPagar(data || [])
    }
    load()
  }, [lojaId])

  const dre = calcularDRE(vendas, contasPagar, periodo.inicio, periodo.fim)
  const positivo = dre.resultadoLiquido >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Navegador */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '10px 14px' }}>
        <button onClick={() => setPeriodo(p => navegarMes(p.inicio, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize' }}>{periodo.label}</span>
        <button onClick={() => setPeriodo(p => navegarMes(p.inicio, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Resultado */}
      <div style={{ background: positivo ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${positivo ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 16, padding: '20px 18px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: positivo ? '#16a34a' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Resultado Líquido</p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 36, fontWeight: 700, color: positivo ? '#16a34a' : '#ef4444', lineHeight: 1 }}>
          {positivo ? '+' : ''}{fmtR(dre.resultadoLiquido)}
        </p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: positivo ? '#16a34a' : '#ef4444', marginTop: 6 }}>Margem: {dre.margemPercentual.toFixed(1)}%</p>
      </div>

      {/* Receita e despesas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 12px' }}>
          <p style={{ ...labelStyle, marginBottom: 6 }}>Receita Bruta</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{fmtR(dre.receitaBruta)}</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Vendas no período</p>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 12px' }}>
          <p style={{ ...labelStyle, marginBottom: 6 }}>Total Despesas</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{fmtR(dre.totalDespesas)}</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Contas pagas</p>
        </div>
      </div>

      {/* Despesas por categoria */}
      {dre.despesasPorCategoria.length > 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 16px' }}>
          <p style={{ ...labelStyle, marginBottom: 14 }}>Despesas por categoria</p>
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
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
          <AlertCircle size={24} color="var(--line)" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)' }}>Nenhuma despesa paga no período</p>
        </div>
      )}
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
      {/* Tabs horizontais roláveis */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
            borderRadius: 12, border: tab === id ? 'none' : '1px solid var(--line)',
            background: tab === id ? theme.primary : 'var(--surface)',
            color: tab === id ? '#fff' : 'var(--muted)',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
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
