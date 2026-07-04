import { useState, useMemo } from 'react'
import { Search, ArrowLeft, Pencil, Trash2, X, Plus } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtTime(s) { return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }

function parsePgtos(v) {
  try { const arr = JSON.parse(v.forma_pgto); if (Array.isArray(arr)) return arr } catch {}
  return v.forma_pgto ? [{ forma: v.forma_pgto, valor: Number(v.valor) }] : []
}

function fmtPgtos(v) { return parsePgtos(v).map(p => p.forma).join(' + ') }

function groupByDay(vendas) {
  const map = {}
  vendas.forEach(v => {
    const key = new Date(v.data).toLocaleDateString('pt-BR')
    if (!map[key]) map[key] = { label: key, vendas: [], total: 0 }
    map[key].vendas.push(v)
    map[key].total += Number(v.valor)
  })
  return Object.values(map).sort((a, b) => {
    const [da, ma, ya] = a.label.split('/').map(Number)
    const [db, mb, yb] = b.label.split('/').map(Number)
    return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da)
  })
}

function fmtDayLabel(dateStr) {
  const [d, m, y] = dateStr.split('/').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

const PGTOS = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito']

function VendasDetalhadas({ vendas, deleteVenda, updateVenda, theme, onBack }) {
  const [search, setSearch] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [editVenda, setEditVenda] = useState(null)
  const [editPgtos, setEditPgtos] = useState([])
  const [editSaving, setEditSaving] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return vendas
    const q = search.toLowerCase()
    return vendas.filter(v =>
      (v.cliente_nome || '').toLowerCase().includes(q) ||
      (v.vendedora || '').toLowerCase().includes(q) ||
      fmtPgtos(v).toLowerCase().includes(q)
    )
  }, [vendas, search])

  const days = groupByDay(filtered)

  const editTotal = editVenda ? Number(editVenda.valor) : 0
  const editAlloc = editPgtos.reduce((s, p) => s + (parseFloat((String(p.valor) || '0').replace(',', '.')) || 0), 0)
  const editPgtoOk = editVenda && Math.abs(editAlloc - editTotal) < 0.005

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

  async function handleDelete() {
    await deleteVenda(confirmDel.id)
    setConfirmDel(null)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--ink)', flexShrink: 0,
        }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Vendas Detalhadas</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{vendas.length} venda{vendas.length !== 1 ? 's' : ''} no período</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente, vendedora, pagamento..."
          style={{
            width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 12,
            paddingLeft: 40, paddingRight: 14, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14,
            color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Days */}
      {days.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14 }}>
          Nenhuma venda encontrada.
        </div>
      ) : days.map(day => (
        <div key={day.label} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              {fmtDayLabel(day.label)}
            </p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: theme.primary }}>
              {fmtR(day.total)}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {day.vendas.map(v => (
              <div key={v.id} style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 14, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {fmtTime(v.data)}
                    </p>
                    {v.cliente_nome && (
                      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.cliente_nome}
                      </p>
                    )}
                  </div>
                  {(v.produtos || []).length > 0 && (
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(v.produtos || []).map(p => p.nome).join(', ')}
                    </p>
                  )}
                  {v.forma_pgto && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: `${theme.primary}18`, color: theme.primary, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {fmtPgtos(v)}
                    </span>
                  )}
                </div>

                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: theme.primary, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {fmtR(v.valor)}
                </p>

                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => openEdit(v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 8, transition: 'color .15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = theme.primary}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDel(v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 8, transition: 'color .15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Delete modal */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 28px', maxWidth: 380, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>Excluir venda?</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Venda de <strong>{fmtR(confirmDel.valor)}</strong>{confirmDel.cliente_nome ? ` para ${confirmDel.cliente_nome}` : ''}. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>Cancelar</button>
              <button onClick={handleDelete} style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit payment modal */}
      {editVenda && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 28px', maxWidth: 440, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                Editar Pagamento — {fmtR(editVenda.valor)}
              </p>
              <button onClick={() => setEditVenda(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {editPgtos.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={p.forma}
                    onChange={e => setEditPgtos(prev => prev.map((x, idx) => idx === i ? { ...x, forma: e.target.value } : x))}
                    style={{ height: 44, flex: '2 1 0', minWidth: 0, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 8px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    {PGTOS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', pointerEvents: 'none' }}>R$</span>
                    <input
                      value={p.valor}
                      onChange={e => setEditPgtos(prev => prev.map((x, idx) => idx === i ? { ...x, valor: e.target.value } : x))}
                      placeholder="0,00"
                      style={{ width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 10px 0 30px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  {editPgtos.length > 1 && (
                    <button
                      onClick={() => setEditPgtos(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setEditPgtos(prev => [...prev, { forma: 'Pix', valor: '' }])}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px dashed var(--line)', background: 'none', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}
            >
              <Plus size={13} /> Adicionar forma
            </button>

            <div style={{
              marginBottom: 20, padding: '8px 12px', borderRadius: 10,
              background: editPgtoOk ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)',
              border: `1px solid ${editPgtoOk ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600,
              color: editPgtoOk ? '#16a34a' : '#dc2626',
            }}>
              {editPgtoOk ? '✓ Valor alocado corretamente' : `Alocado: ${fmtR(editAlloc)} · Total: ${fmtR(editTotal)}`}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditVenda(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editPgtoOk}
                style={{
                  flex: 2, height: 46, borderRadius: 12, border: 'none',
                  background: editPgtoOk && !editSaving ? theme.primary : 'var(--line)',
                  cursor: editPgtoOk && !editSaving ? 'pointer' : 'not-allowed',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
                  color: editPgtoOk && !editSaving ? '#fff' : 'var(--muted)', fontSize: 14,
                  boxShadow: editPgtoOk && !editSaving ? `0 4px 16px ${theme.primary}40` : 'none',
                }}
              >
                {editSaving ? 'Salvando...' : 'Salvar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RelatoriosDesktop({ vendas = [], deleteVenda, updateVenda, theme }) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showDetalhadas, setShowDetalhadas] = useState(false)

  const filtered = useMemo(() => {
    if (!dateFrom || !dateTo) return []
    return vendas.filter(v => {
      const d = new Date(v.data)
      if (d < new Date(dateFrom + 'T00:00:00')) return false
      if (d > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
  }, [vendas, dateFrom, dateTo])

  const totalVendas = filtered.reduce((s, v) => s + Number(v.valor), 0)
  const nVendas = filtered.length
  const ticketMedio = nVendas > 0 ? totalVendas / nVendas : 0
  const totalItens = filtered.reduce((s, v) => s + (v.produtos?.length || 0), 0)
  const pa = nVendas > 0 ? (totalItens / nVendas).toFixed(1) : '0.0'

  const pgtoMap = {}
  filtered.forEach(v => {
    parsePgtos(v).forEach(p => {
      pgtoMap[p.forma] = (pgtoMap[p.forma] || 0) + Number(p.valor)
    })
  })
  const pgtoTotal = Object.values(pgtoMap).reduce((s, v) => s + v, 0)
  const pgtoEntries = Object.entries(pgtoMap).sort((a, b) => b[1] - a[1])

  function openPicker(e) {
    const input = e.currentTarget.querySelector('input')
    if (input?.showPicker) {
      input.showPicker()
    } else {
      input?.focus()
    }
  }

  if (showDetalhadas) {
    return (
      <VendasDetalhadas
        vendas={filtered}
        deleteVenda={deleteVenda}
        updateVenda={updateVenda}
        theme={theme}
        onBack={() => setShowDetalhadas(false)}
      />
    )
  }

  const kpis = [
    { label: 'Faturamento Total', value: fmtR(totalVendas) },
    { label: 'Nº de Vendas',      value: nVendas },
    { label: 'Ticket Médio',      value: fmtR(ticketMedio) },
    { label: 'P.A.',              value: pa },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Date filter */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '20px 24px' }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>
          Período
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>De</label>
            <div onClick={openPicker} style={{ position: 'relative', cursor: 'pointer' }}>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{ width: '100%', height: 42, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box', cursor: 'pointer', colorScheme: theme?.isDark ? 'dark' : 'light' }}
              />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Até</label>
            <div onClick={openPicker} style={{ position: 'relative', cursor: 'pointer' }}>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{ width: '100%', height: 42, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box', cursor: 'pointer', colorScheme: theme?.isDark ? 'dark' : 'light' }}
              />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              style={{ height: 42, padding: '0 16px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* 2×2 KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {kpis.map(({ label, value }, i) => (
          <div key={label} style={{
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--line)',
            borderTop: `3px solid ${i === 0 ? theme.primary : 'var(--line)'}`,
            padding: '22px 24px',
          }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
              {label}
            </p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 30, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Formas de pagamento */}
      {pgtoEntries.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 20 }}>
            Formas de Pagamento
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pgtoEntries.map(([forma, valor]) => {
              const pct = pgtoTotal > 0 ? (valor / pgtoTotal) * 100 : 0
              return (
                <div key={forma}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{forma}</span>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{fmtR(valor)} · {pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--line)' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: theme.primary, width: `${pct}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Vendas Detalhadas card */}
      <div
        onClick={() => setShowDetalhadas(true)}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
        style={{
          background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)',
          padding: '20px 24px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'background .15s',
        }}
      >
        <div>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
            Vendas Detalhadas
          </p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
            {nVendas} venda{nVendas !== 1 ? 's' : ''} no período selecionado
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: theme.primary }}>
            {fmtR(totalVendas)}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  )
}
