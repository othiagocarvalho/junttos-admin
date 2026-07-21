import { useData } from '../context/DataContext'
import { DollarSign, TrendingUp, Users, Zap } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import StatCard from '../components/junttos/StatCard'
import Panel from '../components/junttos/Panel'
import EmptyState from '../components/junttos/EmptyState'
import { T } from '../theme/tokens'

const PRODUCTS = ['Sistema de Gestão', 'Catálogo de Vendas', 'Inventário']
const PRODUCT_COLORS = {
  'Sistema de Gestão': T.purple,
  'Catálogo de Vendas': T.lilac,
  'Inventário':         T.coral,
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard,
      padding: '10px 14px', fontSize: 13, boxShadow: T.cardShadow, fontFamily: T.ui,
    }}>
      <p style={{ color: payload[0].payload.color, fontWeight: 700 }}>{payload[0].name}</p>
      <p style={{ color: T.ink, fontWeight: 700 }}>
        {Number(payload[0].value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
    </div>
  )
}

export default function Finance() {
  const { clients } = useData()

  const activeClients = clients.filter((c) => c.status === 'Ativo')
  const totalMRR  = activeClients.reduce((sum, c) => sum + c.value, 0)
  const totalARR  = totalMRR * 12
  const avgTicket = activeClients.length > 0 ? Math.round(totalMRR / activeClients.length) : 0
  const churnRate = clients.length > 0
    ? ((clients.filter((c) => c.status === 'Cancelado').length / clients.length) * 100).toFixed(1)
    : 0

  const mrrByProduct = PRODUCTS.map((product) => ({
    product:  product.replace('Sistema de ', '').replace('Catálogo de ', 'Cat. '),
    fullName: product,
    mrr:   activeClients.filter((c) => c.product === product).reduce((sum, c) => sum + c.value, 0),
    count: activeClients.filter((c) => c.product === product).length,
    color: PRODUCT_COLORS[product],
  }))

  return (
    <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>
          Faturamento
        </h1>
        <p style={{ fontSize: 13.5, color: T.muted }}>Visão completa de receita e métricas financeiras</p>
      </div>

      {/* KPI StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={DollarSign} color="purple" label="MRR Total"    value={`R$ ${totalMRR.toLocaleString('pt-BR')}`} />
        <StatCard icon={TrendingUp} color="lilac"  label="ARR"          value={totalARR >= 1000 ? `R$ ${(totalARR / 1000).toFixed(0)}k` : `R$ ${totalARR.toLocaleString('pt-BR')}`} />
        <StatCard icon={Users}      color="coral"  label="Ticket Médio" value={`R$ ${avgTicket.toLocaleString('pt-BR')}`} />
        <StatCard icon={Zap}        color="deep"   label="Churn Rate"   value={`${churnRate}%`} />
      </div>

      {/* MRR History — empty state */}
      <Panel title="Evolução do MRR" subtitle="Crescimento da receita recorrente mensal" style={{ marginBottom: 24 }}>
        <EmptyState
          title="Nenhum dado disponível"
          description="O histórico de MRR aparecerá aqui quando disponível."
        />
      </Panel>

      {/* By product */}
      <Panel title="MRR por Produto" subtitle="Distribuição de receita por produto" style={{ marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie data={mrrByProduct} cx="50%" cy="50%"
              innerRadius={50} outerRadius={80} paddingAngle={4}
              dataKey="mrr" nameKey="fullName">
              {mrrByProduct.map((entry) => (
                <Cell key={entry.fullName} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {mrrByProduct.map((p) => {
            const pct = totalMRR > 0 ? ((p.mrr / totalMRR) * 100).toFixed(0) : 0
            return (
              <div key={p.fullName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: T.ink }}>{p.fullName}</span>
                  <span style={{ fontSize: 12, color: T.muted }}>{p.count} clientes</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>
                    R$ {p.mrr.toLocaleString('pt-BR')}
                  </span>
                  <span style={{ fontSize: 12, color: T.muted, marginLeft: 7 }}>{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
