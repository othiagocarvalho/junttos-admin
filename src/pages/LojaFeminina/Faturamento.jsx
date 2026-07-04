import { useState, useMemo } from 'react'
import { BarChart2, TrendingUp, ShoppingBag, CreditCard } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function todayStr() { return new Date().toISOString().slice(0, 10) }
function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function parsePgtos(v) {
  try {
    const arr = JSON.parse(v.forma_pgto)
    if (Array.isArray(arr)) return arr
  } catch {}
  return v.forma_pgto ? [{ forma: v.forma_pgto, valor: Number(v.valor) }] : []
}

const dateInputStyle = {
  height: 40, border: '1.5px solid var(--line)', borderRadius: 10,
  padding: '0 10px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13,
  color: 'var(--ink)', background: 'var(--surface)', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}
const dateLabel = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.12em',
  fontFamily: 'Plus Jakarta Sans, sans-serif', marginBottom: 4,
}

export default function Faturamento({ vendas, theme }) {
  const [dateFrom, setDateFrom] = useState(monthStartStr)
  const [dateTo,   setDateTo]   = useState(todayStr)

  const filtered = useMemo(() => {
    return vendas.filter(v => {
      const d = new Date(v.data)
      if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false
      if (dateTo   && d > new Date(dateTo   + 'T23:59:59')) return false
      return true
    })
  }, [vendas, dateFrom, dateTo])

  const totalVendas  = filtered.reduce((s, v) => s + Number(v.valor), 0)
  const ticketMedio  = filtered.length > 0 ? totalVendas / filtered.length : 0

  const pgtoMap = {}
  filtered.forEach(v => {
    parsePgtos(v).forEach(p => {
      pgtoMap[p.forma] = (pgtoMap[p.forma] || 0) + Number(p.valor)
    })
  })
  const topPgto = Object.keys(pgtoMap).sort((a, b) => pgtoMap[b] - pgtoMap[a])[0] || '—'

  const prodMap = {}
  filtered.forEach(v => {
    ;(v.produtos || []).forEach(p => {
      prodMap[p.nome] = (prodMap[p.nome] || 0) + 1
    })
  })
  const rankProd = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* Date range */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={dateLabel}>De</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={dateLabel}>Até</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInputStyle} />
        </div>
      </div>

      {/* KPIs — grid 2 colunas fixo para não extravazar em mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Faturamento', value: fmtR(totalVendas), Icon: TrendingUp },
          { label: 'Qtd. Vendas',  value: filtered.length,   Icon: ShoppingBag },
          { label: 'Ticket Médio', value: fmtR(ticketMedio), Icon: BarChart2 },
          { label: 'Pgto + usado', value: topPgto,            Icon: CreditCard },
        ].map(({ label, value, Icon }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.primary + '18', flexShrink: 0 }}>
                <Icon size={13} style={{ color: theme.primary }} />
              </div>
              <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* Product ranking */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '20px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Produtos mais vendidos</p>
          {rankProd.length === 0 ? (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Sem dados para o período</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rankProd.map(([nome, qtd], i) => (
                <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif',
                    background: i === 0 ? theme.primary : i === 1 ? (theme.accent || '#D49E8A') : 'var(--bg)',
                    color: i < 2 ? '#fff' : 'var(--muted)',
                    border: i >= 2 ? '1px solid var(--line)' : 'none',
                  }}>{i + 1}</div>
                  <span style={{ flex: 1, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink)' }}>{nome}</span>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: theme.primary }}>{qtd}×</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '20px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Por forma de pagamento</p>
          {Object.keys(pgtoMap).length === 0 ? (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Sem dados para o período</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(pgtoMap)
                .sort((a, b) => b[1] - a[1])
                .map(([pgto, val]) => {
                  const pct = totalVendas > 0 ? (val / totalVendas) * 100 : 0
                  return (
                    <div key={pgto}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13 }}>
                        <span style={{ color: 'var(--ink)' }}>{pgto}</span>
                        <span style={{ fontWeight: 700, color: theme.primary }}>{fmtR(val)}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--line)' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: theme.primary, width: `${pct}%`, transition: 'width 0.5s' }} />
                      </div>
                      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{pct.toFixed(0)}%</p>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
