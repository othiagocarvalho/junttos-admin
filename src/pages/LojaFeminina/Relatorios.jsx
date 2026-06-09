import { useState, useMemo } from 'react'
import { BarChart2, TrendingUp, ShoppingBag, ChevronRight, ArrowLeft, Search, Tag, Calendar, User, Clock, Pencil, Trash2, Plus, X } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtTime(s) { return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }

function parsePgtos(v) {
  try {
    const arr = JSON.parse(v.forma_pgto)
    if (Array.isArray(arr)) return arr
  } catch {}
  return v.forma_pgto ? [{ forma: v.forma_pgto, valor: Number(v.valor) }] : []
}

function fmtPgtos(v) { return parsePgtos(v).map(p => p.forma).join(' + ') }

function groupByDay(vendas) {
  const groups = {}
  vendas.forEach(v => {
    const d = new Date(v.data)
    const key = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
    if (!groups[key]) groups[key] = { label: key, vendas: [], total: 0 }
    groups[key].vendas.push(v)
    groups[key].total += Number(v.valor)
  })
  return Object.values(groups)
}

const PGTOS = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito']

// ── Subview: lista de vendas com editar/excluir ────────────────
function VendasDetalhadas({ vendas, dateFrom, dateTo, deleteVenda, updateVenda, theme, onBack }) {
  const [search, setSearch] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [editVenda, setEditVenda] = useState(null)
  const [editPgtos, setEditPgtos] = useState([])
  const [editSaving, setEditSaving] = useState(false)

  const editTotal = editVenda ? Number(editVenda.valor) : 0
  const editAlloc = editPgtos.reduce((s, p) => s + (parseFloat((String(p.valor) || '0').replace(',', '.')) || 0), 0)
  const editPgtoOk = editVenda && Math.abs(editAlloc - editTotal) < 0.005

  const filtradas = vendas.filter(v => {
    const d = new Date(v.data)
    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
    return true
  }).filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (v.cliente_nome || '').toLowerCase().includes(q) ||
      (v.vendedora || '').toLowerCase().includes(q) ||
      fmtPgtos(v).toLowerCase().includes(q)
    )
  })

  const groups = groupByDay(filtradas)

  async function handleDelete() {
    await deleteVenda(confirmDel.id)
    setConfirmDel(null)
  }

  function openEdit(v) {
    setEditPgtos(parsePgtos(v).map(p => ({ ...p, valor: String(p.valor) })))
    setEditVenda(v)
  }

  async function handleSaveEdit() {
    if (!editPgtoOk) return
    setEditSaving(true)
    await updateVenda(editVenda.id, {
      forma_pgto: JSON.stringify(editPgtos.map(p => ({
        forma: p.forma,
        valor: parseFloat((String(p.valor) || '0').replace(',', '.')) || 0,
      }))),
    })
    setEditSaving(false)
    setEditVenda(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Back header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>
          <ArrowLeft size={20} />
        </button>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
          Vendas Detalhadas
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
          {filtradas.length} venda{filtradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente, vendedora..."
          style={{
            width: '100%', height: 46, border: '1.5px solid var(--line)', borderRadius: 14,
            padding: '0 14px 0 40px', fontFamily: 'Manrope, sans-serif', fontSize: 14,
            color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Tag size={28} color="var(--line)" />
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)' }}>Nenhuma venda encontrada.</p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={13} color="var(--muted)" />
                <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                  {group.label}
                </span>
              </div>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: 'var(--rose-deep)' }}>
                {fmtR(group.total)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.vendas.map(v => (
                <div key={v.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <User size={12} color="var(--muted)" />
                          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                            {v.cliente_nome || 'Cliente não identificado'}
                          </span>
                        </div>
                        {v.forma_pgto && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                            {fmtPgtos(v)}
                          </span>
                        )}
                        {v.vendedora && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(180,122,107,0.1)', border: '1px solid rgba(180,122,107,0.2)', color: 'var(--rose-deep)', fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                            {v.vendedora}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: v.produtos?.length ? 8 : 0 }}>
                        <Clock size={11} color="var(--muted)" />
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>
                          {fmtTime(v.data)}{v.cliente_tel ? ` · ${v.cliente_tel}` : ''}
                        </span>
                      </div>
                      {v.produtos?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {v.produtos.map((p, i) => (
                            <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink-soft)', fontFamily: 'Manrope, sans-serif' }}>
                              {p.nome}{p.obs ? ` — ${p.obs}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {v.obs && <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginTop: 6, fontFamily: 'Manrope, sans-serif' }}>{v.obs}</p>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--rose-deep)' }}>
                        {fmtR(v.valor)}
                      </span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => openEdit(v)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--line)', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--rose-deep)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--line)'}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setConfirmDel(v)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--line)', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--line)'}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Delete modal */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 20px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>Excluir venda?</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 20, fontFamily: 'Manrope, sans-serif' }}>
              Excluir a venda de <span style={{ fontWeight: 700 }}>{fmtR(confirmDel?.valor || 0)}</span>? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDel(null)}
                style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={handleDelete}
                style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit payment modal */}
      {editVenda && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 20px 36px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                Editar Pagamento — {fmtR(editVenda.valor)}
              </p>
              <button onClick={() => setEditVenda(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {editPgtos.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={p.forma}
                    onChange={e => setEditPgtos(prev => prev.map((x, idx) => idx === i ? { ...x, forma: e.target.value } : x))}
                    style={{ height: 46, flex: '2 1 0', minWidth: 0, border: '1.5px solid var(--line)', borderRadius: 12, padding: '0 8px', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {PGTOS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'Manrope, sans-serif', pointerEvents: 'none' }}>R$</span>
                    <input value={p.valor}
                      onChange={e => setEditPgtos(prev => prev.map((x, idx) => idx === i ? { ...x, valor: e.target.value } : x))}
                      placeholder="0,00"
                      style={{ width: '100%', height: 46, border: '1.5px solid var(--line)', borderRadius: 12, padding: '0 10px 0 30px', fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  {editPgtos.length > 1 && (
                    <button onClick={() => setEditPgtos(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setEditPgtos(prev => [...prev, { forma: 'Pix', valor: '' }])}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px dashed var(--line)', background: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}>
              <Plus size={13} /> Adicionar forma
            </button>
            <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 10, background: editPgtoOk ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${editPgtoOk ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`, fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: editPgtoOk ? '#16a34a' : '#dc2626' }}>
              {editPgtoOk ? '✓ Valor alocado corretamente' : `Alocado: ${fmtR(editAlloc)} · Total: ${fmtR(editTotal)}`}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditVenda(null)}
                style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving || !editPgtoOk}
                style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: editPgtoOk && !editSaving ? theme.primary : 'var(--line)', cursor: editPgtoOk && !editSaving ? 'pointer' : 'not-allowed', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: editPgtoOk && !editSaving ? '#fff' : 'var(--muted)', fontSize: 14 }}>
                {editSaving ? 'Salvando...' : 'Salvar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function Relatorios({ vendas = [], deleteVenda, updateVenda, theme }) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showDetalhadas, setShowDetalhadas] = useState(false)

  const filtered = useMemo(() => {
    return vendas.filter(v => {
      const d = new Date(v.data)
      if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
  }, [vendas, dateFrom, dateTo])

  const totalVendas = filtered.reduce((s, v) => s + Number(v.valor), 0)
  const nVendas = filtered.length
  const ticketMedio = nVendas > 0 ? totalVendas / nVendas : 0
  const totalItens = filtered.reduce((s, v) => s + (v.produtos?.length || 0), 0)
  const pa = nVendas > 0 ? (totalItens / nVendas).toFixed(1) : '—'

  const pgtoMap = {}
  filtered.forEach(v => {
    parsePgtos(v).forEach(p => {
      pgtoMap[p.forma] = (pgtoMap[p.forma] || 0) + Number(p.valor)
    })
  })

  if (showDetalhadas) {
    return (
      <VendasDetalhadas
        vendas={vendas}
        dateFrom={dateFrom}
        dateTo={dateTo}
        deleteVenda={deleteVenda}
        updateVenda={updateVenda}
        theme={theme}
        onBack={() => setShowDetalhadas(false)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-[#7B7390] mb-1.5 block">De</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#7B7390] mb-1.5 block">Até</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inp} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Faturamento',  value: fmtR(totalVendas), Icon: TrendingUp },
          { label: 'Nº de Vendas', value: nVendas,           Icon: ShoppingBag },
          { label: 'Ticket Médio', value: fmtR(ticketMedio), Icon: BarChart2 },
          { label: 'P.A.',         value: pa, sub: 'peças/atend.', Icon: BarChart2 },
        ].map(({ label, value, sub, Icon }) => (
          <div key={label} className="bg-white border border-[#E6E0F0] rounded-xl p-3 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: theme.primary + '15' }}>
                <Icon className="w-3 h-3" style={{ color: theme.primary }} />
              </div>
              <span className="text-xs font-medium text-[#7B7390] truncate">{label}</span>
            </div>
            <p className="text-base font-bold text-[#16101F] truncate">{value}</p>
            {sub && <p className="text-xs text-[#7B7390] mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Payment breakdown */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
        <p className="text-sm font-semibold text-[#16101F] mb-4">Por forma de pagamento</p>
        {Object.keys(pgtoMap).length === 0 ? (
          <p className="text-[#7B7390] text-sm text-center py-6">Sem dados para o período</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(pgtoMap).sort((a, b) => b[1] - a[1]).map(([pgto, val]) => {
              const pct = totalVendas > 0 ? (val / totalVendas) * 100 : 0
              return (
                <div key={pgto}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-[#16101F]">{pgto}</span>
                    <span className="font-semibold" style={{ color: theme.primary }}>{fmtR(val)}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: '#E6E0F0' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: theme.primary }} />
                  </div>
                  <p className="text-xs text-[#7B7390] mt-0.5">{pct.toFixed(0)}%</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Vendas detalhadas card */}
      <button
        onClick={() => setShowDetalhadas(true)}
        className="w-full bg-white border border-[#E6E0F0] rounded-2xl p-5 flex items-center justify-between text-left cursor-pointer"
      >
        <div>
          <p className="text-sm font-semibold text-[#16101F] mb-1">Vendas Detalhadas</p>
          <p className="text-xs text-[#7B7390]">{nVendas} venda{nVendas !== 1 ? 's' : ''} no período</p>
        </div>
        <ChevronRight size={18} color="#7B7390" className="flex-shrink-0" />
      </button>
    </div>
  )
}

const inp =
  'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] transition'
