import { useState, useMemo } from 'react'
import { BarChart2, TrendingUp, ShoppingBag, CreditCard } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function parsePgtos(v) {
  try {
    const arr = JSON.parse(v.forma_pgto)
    if (Array.isArray(arr)) return arr
  } catch {}
  return v.forma_pgto ? [{ forma: v.forma_pgto, valor: Number(v.valor) }] : []
}

export default function Faturamento({ vendas, theme }) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    return vendas.filter(v => {
      const d = new Date(v.data)
      if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
  }, [vendas, dateFrom, dateTo])

  const totalVendas = filtered.reduce((s, v) => s + Number(v.valor), 0)
  const ticketMedio = filtered.length > 0 ? totalVendas / filtered.length : 0

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
          { label: 'Faturamento', value: fmtR(totalVendas), Icon: TrendingUp },
          { label: 'Qtd. Vendas', value: filtered.length, Icon: ShoppingBag },
          { label: 'Ticket Médio', value: fmtR(ticketMedio), Icon: BarChart2 },
          { label: 'Pgto + usado', value: topPgto, Icon: CreditCard },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="bg-white border border-[#E6E0F0] rounded-xl p-3 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: theme.primary + '15' }}
              >
                <Icon className="w-3 h-3" style={{ color: theme.primary }} />
              </div>
              <span className="text-xs font-medium text-[#7B7390] truncate">{label}</span>
            </div>
            <p className="text-base font-bold text-[#16101F] truncate">{value}</p>
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
