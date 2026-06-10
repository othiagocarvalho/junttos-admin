import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { supabase } from '../lib/supabase'
import { Users, DollarSign, MapPin, Building2, ExternalLink, BarChart2 } from 'lucide-react'

const PROD_BASE = 'https://junttos-admin.vercel.app'

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-[#7B7390] text-sm mb-1">{title}</p>
      <p className="text-[#16101F] text-2xl font-bold">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { visits } = useData()
  const [lojas, setLojas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('lf_config')
      .select('id, nome, slug, loja_id, cor_primaria, logo_url, status')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setLojas(data || [])
        setLoading(false)
      })
  }, [])

  const now = new Date()
  const hora = now.getHours()
  const greeting = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const activeLojas = lojas.filter((l) => l.status === 'ativo')
  const mesAtual = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

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
          value={loading ? '...' : activeLojas.length}
          icon={Users}
          color="bg-[#6C3CE1]"
        />
        <StatCard
          title="Faturamento do Mês"
          value="R$ 0,00"
          icon={DollarSign}
          color="bg-gradient-to-br from-emerald-600 to-teal-600"
        />
        <StatCard
          title="Visitas Realizadas"
          value={visits.length}
          icon={MapPin}
          color="bg-gradient-to-br from-orange-500 to-amber-500"
        />
      </div>

      {/* Receita Mensal — sem dados */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-6 mb-8">
        <div className="mb-5">
          <h2 className="text-[#16101F] font-semibold">Receita Mensal</h2>
          <p className="text-[#7B7390] text-sm">Receita vs Meta</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart2 className="w-10 h-10 text-[#E6E0F0] mb-3" />
          <p className="text-[#7B7390] font-medium text-sm">Nenhum dado disponível</p>
          <p className="text-[#7B7390] text-xs mt-1">Os dados financeiros aparecerão aqui quando disponíveis.</p>
        </div>
      </div>

      {/* Últimos Clientes (lf_config) */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl">
        <div className="px-6 py-5 border-b border-[#E6E0F0]">
          <h2 className="text-[#16101F] font-semibold">Clientes Cadastrados</h2>
          <p className="text-[#7B7390] text-sm">
            {loading ? 'Carregando...' : `${lojas.length} ${lojas.length === 1 ? 'loja' : 'lojas'} na plataforma`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[#7B7390] text-sm">Carregando clientes...</p>
          </div>
        ) : lojas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-10 h-10 text-[#E6E0F0] mb-3" />
            <p className="text-[#7B7390] font-medium">Nenhum cliente cadastrado</p>
            <p className="text-[#7B7390] text-sm mt-1">
              Acesse <span className="font-semibold text-[#6C3CE1]">Clientes</span> para adicionar o primeiro painel.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E6E0F0]">
            {lojas.map((loja) => {
              const slug = loja.slug || loja.loja_id
              const initials = (loja.nome || 'L').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
              const primary = loja.cor_primaria || '#6C3CE1'
              const link = `${PROD_BASE}/${slug}/`

              return (
                <div key={loja.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F6F3FA] transition-colors">
                  {loja.logo_url ? (
                    <img
                      src={loja.logo_url}
                      alt={loja.nome}
                      className="w-10 h-10 rounded-xl object-contain border border-[#E6E0F0] bg-[#F6F3FA] flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `${primary}18`, color: primary, border: `1px solid ${primary}30` }}
                    >
                      {initials}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-[#16101F] font-medium text-sm truncate">{loja.nome}</p>
                    <p className="text-[#7B7390] text-xs font-mono">/{slug}</p>
                  </div>

                  <div
                    className="w-5 h-5 rounded-md flex-shrink-0 hidden sm:block"
                    title={`Cor primária: ${primary}`}
                    style={{ background: primary, border: '1px solid #E6E0F0' }}
                  />

                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg hidden md:inline ${
                    loja.status === 'ativo'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-[#F6F3FA] text-[#7B7390]'
                  }`}>
                    {loja.status || 'ativo'}
                  </span>

                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-[#6C3CE1] hover:underline flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Acessar</span>
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
