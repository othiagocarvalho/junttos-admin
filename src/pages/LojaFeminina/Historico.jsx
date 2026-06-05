import { useState } from 'react'
import { Trash2, Search, Tag, Calendar, User, Clock } from 'lucide-react'
import Modal from '../../components/Modal'

const METALLIC = 'linear-gradient(135deg, #E8C0AF 0%, #D49E8A 22%, #B97766 42%, #7A3E33 58%, #B97766 72%, #DCAA96 88%, #F0C9B6 100%)'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtTime(s) {
  return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

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

function todayStr() { return new Date().toISOString().slice(0, 10) }
function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const dateInputStyle = {
  height: 40, border: '1.5px solid var(--line)', borderRadius: 10,
  padding: '0 10px', fontFamily: 'Manrope, sans-serif', fontSize: 13,
  color: 'var(--ink)', background: 'var(--surface)', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}
const dateLabel = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.12em',
  fontFamily: 'Manrope, sans-serif', marginBottom: 4,
}

export default function Historico({ vendas, deleteVenda, theme }) {
  const [search,     setSearch]     = useState('')
  const [dateFrom,   setDateFrom]   = useState(monthStartStr)
  const [dateTo,     setDateTo]     = useState(todayStr)
  const [confirmDel, setConfirmDel] = useState(null)

  const filtradas = vendas.filter(v => {
    const d = new Date(v.data)
    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false
    if (dateTo   && d > new Date(dateTo   + 'T23:59:59')) return false
    return true
  }).filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (v.cliente_nome || '').toLowerCase().includes(q) ||
      (v.vendedora    || '').toLowerCase().includes(q) ||
      (v.forma_pgto   || '').toLowerCase().includes(q)
    )
  })

  const groups = groupByDay(filtradas)

  async function handleDelete() {
    await deleteVenda(confirmDel.id)
    setConfirmDel(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

      {/* Date range + count */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={dateLabel}>De</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={dateLabel}>Até</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInputStyle} />
        </div>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)', paddingBottom: 10, whiteSpace: 'nowrap' }}>
          {filtradas.length} venda{filtradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
          padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <Tag size={28} color="var(--line)" />
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)' }}>
            Nenhuma venda encontrada.
          </p>
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
                <div key={v.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px',
                }}>
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
                            {v.forma_pgto}
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

                      {v.obs && (
                        <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginTop: 6, fontFamily: 'Manrope, sans-serif' }}>{v.obs}</p>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--rose-deep)' }}>
                        {fmtR(v.valor)}
                      </span>
                      <button
                        onClick={() => setConfirmDel(v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--line)', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--line)'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Excluir venda" size="sm">
        <p style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 20, fontFamily: 'Manrope, sans-serif', lineHeight: 1.5 }}>
          Excluir a venda de{' '}
          <span style={{ fontWeight: 700 }}>{fmtR(confirmDel?.valor || 0)}</span>?{' '}
          Esta ação não pode ser desfeita.
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
      </Modal>
    </div>
  )
}
