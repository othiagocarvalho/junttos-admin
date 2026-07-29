import { ShoppingCart } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

export default function Menu({ vendas = [], theme = {}, setTab }) {
  const now = new Date()
  const todayStr = now.toDateString()

  const vendasHoje = vendas.filter(v => new Date(v.data).toDateString() === todayStr)
  const totalHoje = vendasHoje.reduce((s, v) => s + Number(v.valor), 0)

  const vendasMes = vendas.filter(v => {
    const d = new Date(v.data)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const totalMes = vendasMes.reduce((s, v) => s + Number(v.valor), 0)

  const primary = theme.primary || '#5E2BD0'

  const kpis = [
    { label: 'Vendido hoje', value: fmtR(totalHoje), sub: `${vendasHoje.length} venda${vendasHoje.length !== 1 ? 's' : ''}` },
    { label: 'Vendido no mês', value: fmtR(totalMes), sub: `${vendasMes.length} transação${vendasMes.length !== 1 ? 'ões' : ''}` },
  ]

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Hero */}
      <div style={{
        background: primary, borderRadius: 20, padding: '28px 24px 24px',
        marginBottom: 16,
      }}>
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700,
          color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em',
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          Total vendido — {now.toLocaleDateString('pt-BR', { month: 'long' })}
        </p>
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1,
        }}>
          {fmtR(totalMes)}
        </p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
          {vendasMes.length} venda{vendasMes.length !== 1 ? 's' : ''} este mês
        </p>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {kpis.map(({ label, value, sub }) => (
          <div key={label} style={{
            background: 'var(--surface)', borderRadius: 'var(--r-card)',
            border: '1px solid var(--line)', padding: '16px 14px',
          }}>
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
              color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
            }}>{label}</p>
            <p style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{sub}</p>
          </div>
        ))}
      </div>

      {vendas.length === 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-card)',
          border: '1px solid var(--line)', padding: '40px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <ShoppingCart size={32} color="var(--muted)" strokeWidth={1.5} />
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            Nenhuma venda ainda
          </p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
            Registre sua primeira venda tocando no botão + abaixo.
          </p>
          <button
            onClick={() => setTab('venda')}
            style={{
              marginTop: 4, height: 42, paddingInline: 24, borderRadius: 12, border: 'none',
              background: primary, color: '#fff', cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700,
            }}
          >
            Nova Venda
          </button>
        </div>
      )}
    </div>
  )
}
