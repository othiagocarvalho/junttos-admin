import { useState, useMemo } from 'react'
import { BarChart2, TrendingUp, ShoppingBag, CreditCard } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

const FILTERS = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: '7 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'custom', label: 'Período' },
]

export default function Faturamento({ vendas, theme }) {
  const [filtro, setFiltro] = useState('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    const now = new Date()
    return vendas.filter(v => {
      const d = new Date(v.data)
      if (filtro === 'today') return d.toDateString() === now.toDateString()
      if (filtro === 'week') {
        const cutoff = new Date(now)
        cutoff.setDate(now.getDate() - 7)
        return d >= cutoff
      }
      if (filtro === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }
      if (filtro === 'custom' && dateFrom && dateTo) {
        const from = new Date(dateFrom + 'T00:00:00')
        const to = new Date(dateTo + 'T23:59:59')
        return d >= from && d <= to
      }
      return true
    })
  }, [vendas, filtro, dateFrom, dateTo])

  const totalVendas = filtered.reduce((s, v) => s + Number(v.valor), 0)
  const ticketMedio = filtered.length > 0 ? totalVendas / filtered.length : 0

  const pgtoMap = {}
  filtered.forEach(v => {
    if (v.forma_pgto) pgtoMap[v.forma_pgto] = (pgtoMap[v.forma_pgto] || 0) + Number(v.valor)
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
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className="px-4 py-2 rounded-xl text-sm font-medium border transition"
            style={
              filtro === f.id
                ? { background: theme.primary, color: '#fff', borderColor: theme.primary }
                : { background: '#fff', color: '#7B7390', borderColor: '#E6E0F0' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtro === 'custom' && (
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
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Faturamento', value: fmtR(totalVendas), Icon: TrendingUp },
          { label: 'Qtd. Vendas', value: filtered.length, Icon: ShoppingBag },
          { label: 'Ticket Médio', value: fmtR(ticketMedio), Icon: BarChart2 },
          { label: 'Pgto + usado', value: topPgto, Icon: CreditCard },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="bg-white border border-[#E6E0F0] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: theme.primary + '15' }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: theme.primary }} />
              </div>
              <span className="text-xs font-medium text-[#7B7390]">{label}</span>
            </div>
            <p className="text-xl font-bold text-[#16101F]">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Product ranking */}
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
          <p className="text-sm font-semibold text-[#16101F] mb-4">Produtos mais vendidos</p>
          {rankProd.length === 0 ? (
            <p className="text-[#7B7390] text-sm text-center py-6">Sem dados para o período</p>
          ) : (
            <div className="space-y-3">
              {rankProd.map(([nome, qtd], i) => (
                <div key={nome} className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={
                      i === 0
                        ? { background: theme.primary, color: '#fff' }
                        : i === 1
                          ? { background: theme.accent, color: '#fff' }
                          : { background: '#F6F3FA', color: '#7B7390' }
                    }
                  >
                    {i + 1}
                  </div>
                  <span className="flex-1 text-sm text-[#16101F]">{nome}</span>
                  <span className="text-sm font-semibold" style={{ color: theme.primary }}>{qtd}x</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment breakdown */}
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
          <p className="text-sm font-semibold text-[#16101F] mb-4">Por forma de pagamento</p>
          {Object.keys(pgtoMap).length === 0 ? (
            <p className="text-[#7B7390] text-sm text-center py-6">Sem dados para o período</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(pgtoMap)
                .sort((a, b) => b[1] - a[1])
                .map(([pgto, val]) => {
                  const pct = totalVendas > 0 ? (val / totalVendas) * 100 : 0
                  return (
                    <div key={pgto}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-[#16101F]">{pgto}</span>
                        <span className="font-semibold" style={{ color: theme.primary }}>
                          {fmtR(val)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: '#E6E0F0' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: theme.primary }}
                        />
                      </div>
                      <p className="text-xs text-[#7B7390] mt-0.5">{pct.toFixed(0)}%</p>
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

const inp =
  'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] transition'
