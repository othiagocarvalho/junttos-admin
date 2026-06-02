import { useAuth } from '../context/AuthContext'
import {
  Users,
  DollarSign,
  MapPin,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { statsData, revenueChartData, recentClients } from '../data/mockData'

function StatCard({ title, value, change, icon: Icon, prefix, color }) {
  const isPositive = change >= 0
  return (
    <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6 hover:border-[#5E2BD0]/30 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
          isPositive
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400'
        }`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPositive ? '+' : ''}{change}{typeof change === 'number' && Math.abs(change) < 20 ? '' : ''}%
        </span>
      </div>
      <p className="text-[#7B7390] text-sm mb-1">{title}</p>
      <p className="text-white text-2xl font-bold">
        {prefix}{typeof value === 'number' && value > 999
          ? value.toLocaleString('pt-BR')
          : value}
      </p>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#E6E0F0] rounded-xl p-3 shadow-xl text-sm">
        <p className="text-[#7B7390] mb-2 font-medium">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} className="font-semibold" style={{ color: entry.color }}>
            {entry.name === 'receita' ? 'Receita' : 'Meta'}:{' '}
            {Number(entry.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        ))}
      </div>
    )
  }
  return null
}

const statusConfig = {
  ativo: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  trial: { label: 'Trial', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  inativo: { label: 'Inativo', className: 'bg-slate-500/10 text-[#7B7390] border-slate-500/20' },
}

export default function Dashboard() {
  const { user } = useAuth()

  const now = new Date()
  const hora = now.getHours()
  const greeting = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[#7B7390] text-sm mb-1">{greeting}, {user?.name.split(' ')[0]} 👋</p>
        <h1 className="text-2xl font-bold text-[#16101F]">Dashboard</h1>
        <p className="text-[#7B7390] text-sm mt-1">
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard
          title="Clientes Ativos"
          value={statsData.activeClients}
          change={statsData.activeClientsChange}
          icon={Users}
          prefix=""
          color="bg-[#5E2BD0]"
        />
        <StatCard
          title="Faturamento do Mês"
          value={statsData.monthlyRevenue}
          change={statsData.monthlyRevenueChange}
          icon={DollarSign}
          prefix="R$ "
          color="bg-gradient-to-br from-emerald-600 to-teal-600"
        />
        <StatCard
          title="Visitas Realizadas"
          value={statsData.visitsThisMonth}
          change={statsData.visitsChange}
          icon={MapPin}
          prefix=""
          color="bg-gradient-to-br from-orange-500 to-amber-500"
        />
      </div>

      {/* Chart + Mini stats */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-8">
        {/* Revenue Chart */}
        <div className="xl:col-span-2 bg-white border border-[#E6E0F0] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-white font-semibold">Receita Mensal</h2>
              <p className="text-[#7B7390] text-sm">Receita vs Meta — 2025</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
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
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#7B7390', fontSize: 12 }}>
                    {value === 'receita' ? 'Receita' : 'Meta'}
                  </span>
                )}
              />
              <Area type="monotone" dataKey="meta" stroke="#4f46e5" strokeWidth={2} strokeDasharray="5 5" fill="url(#colorMeta)" dot={false} />
              <Area type="monotone" dataKey="receita" stroke="#7c3aed" strokeWidth={2.5} fill="url(#colorReceita)" dot={false} activeDot={{ r: 5, fill: '#7c3aed' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick stats */}
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-white font-semibold mb-1">Mês Atual</h2>
            <p className="text-[#7B7390] text-sm mb-6">Dezembro 2025</p>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-[#E6E0F0]">
              <span className="text-[#7B7390] text-sm">Novos clientes</span>
              <span className="text-white font-semibold">+14</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-[#E6E0F0]">
              <span className="text-[#7B7390] text-sm">Churn do mês</span>
              <span className="text-red-400 font-semibold">-3</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-[#E6E0F0]">
              <span className="text-[#7B7390] text-sm">Ticket médio</span>
              <span className="text-white font-semibold">R$ 1.240</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-[#E6E0F0]">
              <span className="text-[#7B7390] text-sm">Taxa conversão</span>
              <span className="text-emerald-400 font-semibold">68%</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-[#7B7390] text-sm">NPS médio</span>
              <span className="text-[#5E2BD0] font-semibold">82</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent clients */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E6E0F0]">
          <div>
            <h2 className="text-white font-semibold">Últimos Clientes Fechados</h2>
            <p className="text-[#7B7390] text-sm">Contratos mais recentes</p>
          </div>
          <button className="flex items-center gap-1.5 text-[#5E2BD0] hover:text-[#491FB8] text-sm font-medium transition-colors">
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="divide-y divide-[#E6E0F0]">
          {recentClients.map((client) => {
            const status = statusConfig[client.status]
            return (
              <div key={client.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F6F3FA] transition-colors">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${client.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {client.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{client.name}</p>
                  <p className="text-[#7B7390] text-xs">{client.segment}</p>
                </div>
                <div className="hidden sm:block text-center">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div className="hidden md:block text-center min-w-[80px]">
                  <p className="text-[#7B7390] text-xs font-medium">{client.plan}</p>
                </div>
                <div className="text-right min-w-[90px]">
                  <p className="text-white font-semibold text-sm">
                    R$ {client.value.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[#7B7390] text-xs">
                    {new Date(client.date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
