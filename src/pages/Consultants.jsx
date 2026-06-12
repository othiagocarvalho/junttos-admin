import { useData } from '../context/DataContext'
import { Users, DollarSign, MapPin, TrendingUp, Award, UserX } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Panel from '../components/junttos/Panel'
import ProgressBar from '../components/junttos/ProgressBar'
import EmptyState from '../components/junttos/EmptyState'
import { T } from '../theme/tokens'

const CONSULTANT_COLORS = [T.purple, T.lilac, T.coral, T.purpleDeep]

export default function Consultants() {
  const { consultants, clients, visits } = useData()

  const consultantStats = consultants.map((consultant, i) => {
    const myClients     = clients.filter((c) => c.consultantId === consultant.id)
    const activeClients = myClients.filter((c) => c.status === 'Ativo')
    const trialClients  = myClients.filter((c) => c.status === 'Trial')
    const canceledClients = myClients.filter((c) => c.status === 'Cancelado')
    const mrr           = activeClients.reduce((sum, c) => sum + c.value, 0)
    const myVisits      = visits.filter((v) => v.consultantId === consultant.id)
    const closedVisits  = myVisits.filter((v) => v.result === 'Fechou').length
    const conversionRate = myVisits.length > 0 ? Math.round((closedVisits / myVisits.length) * 100) : 0
    return {
      ...consultant,
      color: CONSULTANT_COLORS[i % CONSULTANT_COLORS.length],
      totalClients: myClients.length,
      activeClients: activeClients.length,
      trialClients: trialClients.length,
      canceledClients: canceledClients.length,
      mrr, totalVisits: myVisits.length, closedVisits, conversionRate,
    }
  })

  const productData = ['Sistema de Gestão', 'Catálogo de Vendas', 'Inventário'].map((product) => {
    const label = product.split(' ')[0] + (product === 'Catálogo de Vendas' ? ' Vendas' : product === 'Sistema de Gestão' ? ' Gestão' : '')
    const entry = { product: label }
    consultantStats.forEach((c) => {
      entry[c.name.split(' ')[0]] = clients.filter(
        (cl) => cl.consultantId === c.id && cl.product === product && cl.status === 'Ativo'
      ).length
    })
    return entry
  })

  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '10px 14px', fontSize: 13, boxShadow: T.cardShadow, fontFamily: T.ui }}>
        <p style={{ color: T.muted, marginBottom: 6, fontWeight: 600 }}>{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {p.value} clientes</p>
        ))}
      </div>
    )
  }

  if (consultants.length === 0) {
    return (
      <div style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em' }}>Consultores</h1>
          <p style={{ fontSize: 13.5, color: T.muted, marginTop: 4 }}>Desempenho e métricas da equipe comercial</p>
        </div>
        <div style={{ background: T.white, borderRadius: T.rCard, boxShadow: T.cardShadow, border: `1px solid ${T.line}` }}>
          <EmptyState
            title="Nenhum consultor cadastrado"
            description="Os consultores aparecerão aqui quando cadastrados."
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>
          Consultores
        </h1>
        <p style={{ fontSize: 13.5, color: T.muted }}>Desempenho e métricas da equipe comercial</p>
      </div>

      {/* Consultant cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20, marginBottom: 24 }}>
        {consultantStats.map((c, idx) => (
          <div key={c.id} style={{ background: T.white, borderRadius: T.rCard, boxShadow: T.cardShadow, border: `1px solid ${T.line}`, padding: 24 }}>
            {/* Profile */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                background: T.iconGrad,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: T.white,
                boxShadow: '0 4px 12px rgba(94,43,208,0.3)',
              }}>
                {c.avatar}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink, margin: 0 }}>{c.name}</h2>
                  {idx === 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: T.statusTrialBg, color: T.statusTrialTx, fontSize: 10, fontWeight: 700, borderRadius: T.rPill, padding: '2px 8px' }}>
                      <Award style={{ width: 10, height: 10 }} /> Top
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: T.muted, margin: '0 0 5px' }}>{c.email}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, background: T.tintPurple, color: T.purpleText, borderRadius: T.rPill, padding: '2px 9px' }}>
                    Polo {c.polo}
                  </span>
                  <span style={{ fontSize: 12, color: T.muted }}>{c.phone}</span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {[
                { icon: Users,      label: 'Clientes Ativos', value: c.activeClients,                             color: T.statusAtivoTx,  tint: T.statusAtivoBg },
                { icon: DollarSign, label: 'MRR Gerado',      value: `R$ ${c.mrr.toLocaleString('pt-BR')}`,      color: T.purple,         tint: T.tintPurple },
                { icon: MapPin,     label: 'Visitas Feitas',  value: c.totalVisits,                              color: T.lilac,          tint: T.tintLilac },
                { icon: TrendingUp, label: 'Taxa Conversão',  value: `${c.conversionRate}%`,                     color: T.statusTrialTx,  tint: T.statusTrialBg },
              ].map(({ icon: Icon, label, value, color, tint }) => (
                <div key={label} style={{ background: T.mist, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 15, height: 15, color, strokeWidth: 1.9 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color, margin: 0 }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Status breakdown */}
            <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 10 }}>Distribuição de Clientes</p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                {[
                  { label: 'Ativos',     value: c.activeClients,   color: T.statusAtivoTx },
                  { label: 'Trial',      value: c.trialClients,    color: T.statusTrialTx },
                  { label: 'Cancelados', value: c.canceledClients, color: T.coralText },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 8, borderRadius: T.rPill, background: T.line, overflow: 'hidden', display: 'flex' }}>
                {c.activeClients > 0   && <div style={{ background: T.statusAtivoTx, width: `${(c.activeClients   / c.totalClients) * 100}%`, transition: 'width .4s' }} />}
                {c.trialClients > 0    && <div style={{ background: T.statusTrialTx, width: `${(c.trialClients    / c.totalClients) * 100}%`, transition: 'width .4s' }} />}
                {c.canceledClients > 0 && <div style={{ background: T.coral,         width: `${(c.canceledClients / c.totalClients) * 100}%`, transition: 'width .4s' }} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
        <Panel title="Clientes por Produto" subtitle="Distribuição de produtos ativos por consultor">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={productData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
              <XAxis dataKey="product" tick={{ fill: T.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(v) => <span style={{ color: T.muted, fontSize: 12 }}>{v}</span>} />
              {consultantStats.map((c, i) => (
                <Bar key={c.id} dataKey={c.name.split(' ')[0]} fill={CONSULTANT_COLORS[i % CONSULTANT_COLORS.length]} radius={[6, 6, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Ranking de Desempenho" subtitle="Comparativo geral entre consultores">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { label: 'Clientes Ativos',    values: consultantStats.map((c) => c.activeClients),   suffix: '' },
              { label: 'MRR Gerado',         values: consultantStats.map((c) => c.mrr),             format: true },
              { label: 'Visitas Realizadas', values: consultantStats.map((c) => c.totalVisits),     suffix: '' },
              { label: 'Taxa de Conversão',  values: consultantStats.map((c) => c.conversionRate),  suffix: '%' },
            ].map((metric) => {
              const max = Math.max(...metric.values, 1)
              return (
                <div key={metric.label}>
                  <p style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>{metric.label}</p>
                  {consultantStats.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        background: T.iconGrad,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: T.white,
                      }}>
                        {c.avatar}
                      </div>
                      <div style={{ flex: 1, background: T.line, borderRadius: T.rPill, height: 8, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: T.rPill, transition: 'width .4s',
                          background: CONSULTANT_COLORS[i % CONSULTANT_COLORS.length],
                          width: `${(metric.values[i] / max) * 100}%`,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, minWidth: 64, textAlign: 'right', fontFamily: T.mono }}>
                        {metric.format
                          ? `R$ ${metric.values[i].toLocaleString('pt-BR')}`
                          : `${metric.values[i]}${metric.suffix || ''}`
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}
