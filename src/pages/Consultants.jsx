import { useData } from '../context/DataContext'
import { Users, DollarSign, MapPin, TrendingUp, Star, Award } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export default function Consultants() {
  const { consultants, clients, visits } = useData()

  const consultantStats = consultants.map((consultant) => {
    const myClients = clients.filter((c) => c.consultantId === consultant.id)
    const activeClients = myClients.filter((c) => c.status === 'Ativo')
    const trialClients = myClients.filter((c) => c.status === 'Trial')
    const canceledClients = myClients.filter((c) => c.status === 'Cancelado')
    const mrr = activeClients.reduce((sum, c) => sum + c.value, 0)
    const totalRevenue = myClients
      .filter((c) => c.status !== 'Cancelado')
      .reduce((sum, c) => sum + c.value, 0)
    const myVisits = visits.filter((v) => v.consultantId === consultant.id)
    const closedVisits = myVisits.filter((v) => v.result === 'Fechou').length
    const conversionRate = myVisits.length > 0
      ? Math.round((closedVisits / myVisits.length) * 100)
      : 0

    return {
      ...consultant,
      totalClients: myClients.length,
      activeClients: activeClients.length,
      trialClients: trialClients.length,
      canceledClients: canceledClients.length,
      mrr,
      totalRevenue,
      totalVisits: myVisits.length,
      closedVisits,
      conversionRate,
    }
  })

  const productData = ['Sistema de Gestão', 'Catálogo de Vendas', 'Inventário'].map((product) => {
    const entry = { product: product.split(' ')[0] + (product === 'Catálogo de Vendas' ? ' Vendas' : product === 'Sistema de Gestão' ? ' Gestão' : '') }
    consultantStats.forEach((c) => {
      entry[c.name.split(' ')[0]] = clients.filter(
        (cl) => cl.consultantId === c.id && cl.product === product && cl.status === 'Ativo'
      ).length
    })
    return entry
  })

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-[#E6E0F0] rounded-xl p-3 text-sm shadow-xl">
          <p className="text-[#7B7390] mb-1.5 font-medium">{label}</p>
          {payload.map((p) => (
            <p key={p.name} style={{ color: p.color }} className="font-semibold">
              {p.name}: {p.value} clientes
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#16101F]">Consultores</h1>
        <p className="text-[#7B7390] text-sm mt-1">Desempenho e métricas da equipe comercial</p>
      </div>

      {/* Consultant cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {consultantStats.map((c, idx) => (
          <div key={c.id} className="bg-white border border-[#E6E0F0] rounded-2xl p-6">
            {/* Profile */}
            <div className="flex items-start gap-4 mb-6">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg`}>
                {c.avatar}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-bold text-lg">{c.name}</h2>
                  {idx === 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <Award className="w-3 h-3" /> Top
                    </span>
                  )}
                </div>
                <p className="text-[#7B7390] text-sm">{c.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium bg-[#E6E0F0] text-[#16101F] px-2.5 py-0.5 rounded-full">
                    Polo {c.polo}
                  </span>
                  <span className="text-xs text-[#7B7390]">{c.phone}</span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <StatBox
                icon={Users}
                label="Clientes Ativos"
                value={c.activeClients}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
              />
              <StatBox
                icon={DollarSign}
                label="MRR Gerado"
                value={`R$ ${c.mrr.toLocaleString('pt-BR')}`}
                color="text-[#5E2BD0]"
                bg="bg-blue-500/10"
              />
              <StatBox
                icon={MapPin}
                label="Visitas Feitas"
                value={c.totalVisits}
                color="text-[#5E2BD0]"
                bg="bg-violet-500/10"
              />
              <StatBox
                icon={TrendingUp}
                label="Taxa Conversão"
                value={`${c.conversionRate}%`}
                color="text-amber-400"
                bg="bg-amber-500/10"
              />
            </div>

            {/* Status breakdown */}
            <div className="border border-[#E6E0F0] rounded-xl p-4">
              <p className="text-[#7B7390] text-xs font-medium mb-3">Distribuição de Clientes</p>
              <div className="flex gap-3">
                <PillStat label="Ativos" value={c.activeClients} color="bg-emerald-500" />
                <PillStat label="Trial" value={c.trialClients} color="bg-amber-500" />
                <PillStat label="Cancelados" value={c.canceledClients} color="bg-red-500" />
              </div>
              <div className="flex gap-1 mt-3 h-2 rounded-full overflow-hidden bg-[#E6E0F0]">
                {c.activeClients > 0 && (
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${(c.activeClients / c.totalClients) * 100}%` }}
                  />
                )}
                {c.trialClients > 0 && (
                  <div
                    className="bg-amber-500 transition-all"
                    style={{ width: `${(c.trialClients / c.totalClients) * 100}%` }}
                  />
                )}
                {c.canceledClients > 0 && (
                  <div
                    className="bg-red-500 transition-all"
                    style={{ width: `${(c.canceledClients / c.totalClients) * 100}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">Clientes por Produto</h2>
          <p className="text-[#7B7390] text-sm mb-5">Distribuição de produtos ativos por consultor</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={productData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E0F0" />
              <XAxis dataKey="product" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#7B7390', fontSize: 12 }}>{v}</span>} />
              <Bar dataKey="Carlos" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Ana" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">Ranking de Desempenho</h2>
          <p className="text-[#7B7390] text-sm mb-5">Comparativo geral entre consultores</p>
          <div className="space-y-4">
            {[
              { label: 'Clientes Ativos', values: consultantStats.map((c) => c.activeClients), suffix: '' },
              { label: 'MRR Gerado', values: consultantStats.map((c) => c.mrr), prefix: 'R$ ', suffix: '', format: true },
              { label: 'Visitas Realizadas', values: consultantStats.map((c) => c.totalVisits), suffix: '' },
              { label: 'Taxa de Conversão', values: consultantStats.map((c) => c.conversionRate), suffix: '%' },
            ].map((metric) => {
              const max = Math.max(...metric.values)
              return (
                <div key={metric.label}>
                  <p className="text-[#7B7390] text-xs mb-2">{metric.label}</p>
                  {consultantStats.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 mb-1.5">
                      <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${c.color} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                        {c.avatar}
                      </div>
                      <div className="flex-1 bg-[#E6E0F0] rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${i === 0 ? 'bg-blue-500' : 'bg-violet-500'}`}
                          style={{ width: max > 0 ? `${(metric.values[i] / max) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className="text-white text-xs font-semibold min-w-[60px] text-right">
                        {metric.prefix || ''}
                        {metric.format ? metric.values[i].toLocaleString('pt-BR') : metric.values[i]}
                        {metric.suffix}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatBox({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="bg-[#F6F3FA] rounded-xl p-3.5 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-[#7B7390] text-[11px]">{label}</p>
        <p className={`font-bold text-sm ${color}`}>{value}</p>
      </div>
    </div>
  )
}

function PillStat({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[#7B7390] text-xs">{label}</span>
      <span className="text-white text-xs font-bold">{value}</span>
    </div>
  )
}
