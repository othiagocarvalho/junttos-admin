import { useData } from '../context/DataContext'
import { DollarSign, TrendingUp, Users, Zap } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts'

const PRODUCTS = ['Sistema de Gestão', 'Catálogo de Vendas', 'Inventário']
const PRODUCT_COLORS = {
  'Sistema de Gestão': '#3b82f6',
  'Catálogo de Vendas': '#7c3aed',
  'Inventário': '#06b6d4',
}

const mrrHistory = [
  { month: 'Jul', mrr: 18200 },
  { month: 'Ago', mrr: 21500 },
  { month: 'Set', mrr: 24800 },
  { month: 'Out', mrr: 28100 },
  { month: 'Nov', mrr: 31400 },
  { month: 'Dez', mrr: 34050 },
]

export default function Finance() {
  const { clients, consultants } = useData()

  const activeClients = clients.filter((c) => c.status === 'Ativo')
  const totalMRR = activeClients.reduce((sum, c) => sum + c.value, 0)
  const totalARR = totalMRR * 12
  const avgTicket = activeClients.length > 0 ? Math.round(totalMRR / activeClients.length) : 0
  const churnRate = clients.length > 0
    ? ((clients.filter((c) => c.status === 'Cancelado').length / clients.length) * 100).toFixed(1)
    : 0

  // By polo
  const polos = ['Fortaleza', 'Belém']
  const mrrByPolo = polos.map((polo) => ({
    polo,
    mrr: activeClients.filter((c) => c.polo === polo).reduce((sum, c) => sum + c.value, 0),
    count: activeClients.filter((c) => c.polo === polo).length,
  }))

  // By product
  const mrrByProduct = PRODUCTS.map((product) => ({
    product: product.replace('Sistema de ', '').replace('Catálogo de ', 'Cat. '),
    fullName: product,
    mrr: activeClients.filter((c) => c.product === product).reduce((sum, c) => sum + c.value, 0),
    count: activeClients.filter((c) => c.product === product).length,
    color: PRODUCT_COLORS[product],
  }))

  // By consultant
  const mrrByConsultant = consultants.map((c) => ({
    name: c.name.split(' ')[0],
    mrr: activeClients.filter((cl) => cl.consultantId === c.id).reduce((sum, cl) => sum + cl.value, 0),
    color: c.id === 1 ? '#3b82f6' : '#7c3aed',
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-[#E6E0F0] rounded-xl p-3 text-sm shadow-xl">
          <p className="text-[#7B7390] mb-1.5 font-medium">{label}</p>
          {payload.map((p) => (
            <p key={p.name} style={{ color: p.color }} className="font-semibold">
              {p.name}: {Number(p.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const PieTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-[#E6E0F0] rounded-xl p-3 text-sm shadow-xl">
          <p style={{ color: payload[0].payload.color }} className="font-semibold">{payload[0].name}</p>
          <p className="text-white font-bold">
            {Number(payload[0].value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#16101F]">Faturamento</h1>
        <p className="text-[#7B7390] text-sm mt-1">Visão completa de receita e métricas financeiras</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={DollarSign}
          label="MRR Total"
          value={`R$ ${totalMRR.toLocaleString('pt-BR')}`}
          sub="Receita recorrente mensal"
          color="from-[#5E2BD0] to-[#7B7390]"
        />
        <KpiCard
          icon={TrendingUp}
          label="ARR"
          value={`R$ ${(totalARR / 1000).toFixed(0)}k`}
          sub="Receita anual recorrente"
          color="bg-[#5E2BD0]"
        />
        <KpiCard
          icon={Users}
          label="Ticket Médio"
          value={`R$ ${avgTicket.toLocaleString('pt-BR')}`}
          sub="Por cliente ativo"
          color="from-emerald-600 to-teal-600"
        />
        <KpiCard
          icon={Zap}
          label="Churn Rate"
          value={`${churnRate}%`}
          sub="Taxa de cancelamento"
          color="from-orange-500 to-amber-500"
        />
      </div>

      {/* MRR History Chart */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6 mb-6">
        <div className="mb-5">
          <h2 className="text-white font-semibold">Evolução do MRR</h2>
          <p className="text-[#7B7390] text-sm">Crescimento da receita recorrente mensal</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={mrrHistory}>
            <defs>
              <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E0F0" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="mrr" name="MRR" stroke="#3b82f6" strokeWidth={2.5} fill="url(#mrrGrad)" dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* By polo and by product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* By polo */}
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">MRR por Polo</h2>
          <p className="text-[#7B7390] text-sm mb-5">Receita recorrente por regional</p>
          <div className="space-y-4 mb-5">
            {mrrByPolo.map((p) => {
              const pct = totalMRR > 0 ? (p.mrr / totalMRR) * 100 : 0
              const color = p.polo === 'Fortaleza' ? 'bg-blue-500' : 'bg-violet-500'
              const textColor = p.polo === 'Fortaleza' ? 'text-[#5E2BD0]' : 'text-[#5E2BD0]'
              return (
                <div key={p.polo}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-white font-medium text-sm">{p.polo}</span>
                      <span className="text-[#7B7390] text-xs ml-2">{p.count} clientes ativos</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold text-sm ${textColor}`}>
                        R$ {p.mrr.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-[#7B7390] text-xs ml-2">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-[#E6E0F0] rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={mrrByPolo} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E0F0" />
              <XAxis dataKey="polo" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="mrr" name="MRR" radius={[6, 6, 0, 0]}>
                {mrrByPolo.map((entry) => (
                  <Cell key={entry.polo} fill={entry.polo === 'Fortaleza' ? '#3b82f6' : '#7c3aed'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By product */}
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">MRR por Produto</h2>
          <p className="text-[#7B7390] text-sm mb-5">Distribuição de receita por produto</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={mrrByProduct}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="mrr"
                nameKey="fullName"
              >
                {mrrByProduct.map((entry) => (
                  <Cell key={entry.fullName} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3 mt-2">
            {mrrByProduct.map((p) => {
              const pct = totalMRR > 0 ? ((p.mrr / totalMRR) * 100).toFixed(0) : 0
              return (
                <div key={p.fullName} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-[#16101F] text-sm">{p.fullName}</span>
                    <span className="text-[#7B7390] text-xs">{p.count} clientes</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-semibold text-sm">R$ {p.mrr.toLocaleString('pt-BR')}</span>
                    <span className="text-[#7B7390] text-xs ml-2">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* By consultant */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-1">MRR por Consultor</h2>
        <p className="text-[#7B7390] text-sm mb-6">Receita recorrente gerada por cada consultor</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mrrByConsultant.map((c) => {
            const pct = totalMRR > 0 ? (c.mrr / totalMRR) * 100 : 0
            return (
              <div key={c.name} className="bg-[#F6F3FA] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-medium">{c.name}</span>
                  <span className="font-bold text-lg" style={{ color: c.color }}>
                    R$ {c.mrr.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="h-2.5 bg-[#E6E0F0] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                </div>
                <p className="text-[#7B7390] text-xs mt-1.5">{pct.toFixed(0)}% do MRR total</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-[#7B7390] text-xs mb-0.5">{label}</p>
      <p className="text-white text-xl font-bold">{value}</p>
      <p className="text-[#7B7390] text-xs mt-1">{sub}</p>
    </div>
  )
}
