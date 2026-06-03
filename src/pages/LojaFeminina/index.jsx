import { useState, useEffect } from 'react'
import { ShoppingBag, Clock, Target, Wallet, BarChart2, Settings, AlertCircle } from 'lucide-react'
import { useLojaData } from './useLojaData'
import NovaVenda from './NovaVenda'
import Historico from './Historico'
import Meta from './Meta'
import Fechamento from './Fechamento'
import Faturamento from './Faturamento'
import LojaConfig from './LojaConfig'

const ALL_TABS = [
  { id: 'venda',      label: 'Nova Venda',   Icon: ShoppingBag, featureKey: 'vendas' },
  { id: 'historico',  label: 'Histórico',    Icon: Clock,       featureKey: 'historico' },
  { id: 'meta',       label: 'Meta',         Icon: Target,      featureKey: 'metas' },
  { id: 'caixa',      label: 'Fechamento',   Icon: Wallet,      featureKey: 'fechamento_caixa' },
  { id: 'faturamento',label: 'Faturamento',  Icon: BarChart2,   featureKey: 'relatorios' },
  { id: 'config',     label: 'Config. Loja', Icon: Settings,    featureKey: null }, // always visible
]

export default function LojaFeminina() {
  const data = useLojaData()
  const [tab, setTab] = useState('venda')
  const [initDone, setInitDone] = useState(false)

  const theme = {
    primary: data.config?.cor_primaria || '#5E2BD0',
    accent:  data.config?.cor_secundaria || '#FF6F5E',
    nome:    data.config?.nome || 'Loja Feminina',
  }

  useEffect(() => {
    if (!data.loading && !initDone) {
      data.ensureDefaults()
      setInitDone(true)
    }
  }, [data.loading])

  // Keep tab valid if features change
  const visibleTabs = ALL_TABS.filter(t => t.featureKey === null || data.features[t.featureKey])
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === tab)) {
      setTab(visibleTabs[0].id)
    }
  }, [data.features])

  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${data.config?.cor_primaria || '#5E2BD0'} transparent transparent transparent` }}
        />
      </div>
    )
  }

  if (data.dbError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-700">Erro ao conectar com o banco de dados</p>
          <p className="text-xs text-red-500 mt-1 font-mono">{data.dbError}</p>
          <p className="text-xs text-red-600 mt-2">
            Verifique se as tabelas foram criadas no Supabase (arquivo{' '}
            <code className="bg-red-100 px-1 rounded">supabase/loja_feminina.sql</code>).
          </p>
        </div>
      </div>
    )
  }

  const panels = {
    venda:       <NovaVenda      {...data} theme={theme} />,
    historico:   <Historico     {...data} theme={theme} />,
    meta:        <Meta          {...data} theme={theme} />,
    caixa:       <Fechamento    {...data} theme={theme} />,
    faturamento: <Faturamento   {...data} theme={theme} />,
    config:      <LojaConfig    {...data} theme={theme} />,
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#16101F]">{theme.nome}</h1>
          <p className="text-[#7B7390] text-sm mt-0.5">Gestão de vendas · loja feminina</p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: theme.primary }}
        >
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Tab bar — only shows enabled features */}
      <div className="flex gap-1 bg-white border border-[#E6E0F0] rounded-2xl p-1.5 mb-6 overflow-x-auto scrollbar-hide">
        {visibleTabs.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={active ? { background: theme.primary, color: '#fff' } : { color: '#7B7390' }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          )
        })}
      </div>

      {/* Active panel */}
      {panels[tab]}
    </div>
  )
}
