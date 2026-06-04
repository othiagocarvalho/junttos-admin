import { useState, useEffect } from 'react'
import { Home, Clock, Plus, Target, User, Bell, ShoppingBag, AlertCircle } from 'lucide-react'
import { useLojaData } from './useLojaData'
import NovaVenda from './NovaVenda'
import Historico from './Historico'
import Meta from './Meta'
import Fechamento from './Fechamento'
import Faturamento from './Faturamento'
import LojaConfig from './LojaConfig'

const METALLIC = 'linear-gradient(135deg, #E8C0AF 0%, #D49E8A 22%, #B97766 42%, #7A3E33 58%, #B97766 72%, #DCAA96 88%, #F0C9B6 100%)'
const METALLIC_SOFT = 'linear-gradient(135deg, #F4DCD0 0%, #E5BCA9 30%, #D19F8C 55%, #E2BAA7 80%, #F4DCD0 100%)'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

const BOTTOM_TABS = [
  { id: 'inicio',    label: 'Início',    Icon: Home   },
  { id: 'historico', label: 'Histórico', Icon: Clock  },
  { id: 'venda',     label: '',          Icon: Plus,  isFAB: true },
  { id: 'meta',      label: 'Meta',      Icon: Target },
  { id: 'conta',     label: 'Conta',     Icon: User   },
]

// ── Sub-views ──────────────────────────────────────────────

function Inicio({ vendas, metas }) {
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayStr = now.toDateString()

  const vendasMes = vendas.filter(v => {
    const d = new Date(v.data)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const vendasHoje = vendas.filter(v => new Date(v.data).toDateString() === todayStr)
  const totalMes = vendasMes.reduce((s, v) => s + Number(v.valor), 0)
  const totalHoje = vendasHoje.reduce((s, v) => s + Number(v.valor), 0)
  const ticketMedio = vendasMes.length > 0 ? totalMes / vendasMes.length : 0
  const meta = metas[currentYM] || 0
  const pctMeta = meta > 0 ? Math.min((totalMes / meta) * 100, 100) : 0

  const prodMap = {}
  vendasMes.forEach(v => (v.produtos || []).forEach(p => {
    prodMap[p.nome] = (prodMap[p.nome] || 0) + 1
  }))
  const topProds = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const kpis = [
    { label: 'Hoje', value: fmtR(totalHoje), sub: `${vendasHoje.length} venda${vendasHoje.length !== 1 ? 's' : ''}` },
    { label: 'Ticket médio', value: fmtR(ticketMedio), sub: 'este mês' },
    { label: 'Vendas no mês', value: vendasMes.length, sub: 'transações' },
    { label: 'Meta mensal', value: meta > 0 ? `${pctMeta.toFixed(0)}%` : '—', sub: meta > 0 ? fmtR(meta) : 'não definida' },
  ]

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Hero */}
      <div style={{
        background: METALLIC, borderRadius: 20,
        padding: '28px 24px', marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        <p style={{
          fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700,
          color: 'rgba(255,255,255,0.72)', letterSpacing: '0.14em',
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          Total vendido — {now.toLocaleDateString('pt-BR', { month: 'long' })}
        </p>
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 42, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 4,
        }}>
          {fmtR(totalMes)}
        </p>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 10 }}>
          {vendasMes.length} venda{vendasMes.length !== 1 ? 's' : ''}{' '}
          {meta > 0 ? `· ${pctMeta.toFixed(0)}% da meta` : '· sem meta definida'}
        </p>
        {meta > 0 && (
          <div style={{ marginTop: 16, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#fff', width: `${pctMeta}%`, transition: 'width 0.7s' }} />
          </div>
        )}
      </div>

      {/* KPI 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {kpis.map(({ label, value, sub }) => (
          <div key={label} style={{
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--line)', padding: '16px 14px',
          }}>
            <p style={{
              fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700,
              color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
            }}>{label}</p>
            <p style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 4,
            }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Top produtos */}
      {topProds.length > 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--line)', padding: '20px 18px',
        }}>
          <p style={{
            fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700,
            color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16,
          }}>Mais vendidos este mês</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {topProds.map(([nome, qtd], i) => (
              <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? METALLIC : METALLIC_SOFT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#fff' : 'var(--rose-deep)', fontFamily: 'Manrope, sans-serif' }}>{i + 1}</span>
                </div>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)', fontFamily: 'Manrope, sans-serif' }}>{nome}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--rose-deep)', fontFamily: 'Manrope, sans-serif' }}>{qtd}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topProds.length === 0 && vendas.length === 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)',
          padding: '40px 24px', textAlign: 'center',
        }}>
          <ShoppingBag size={32} color="var(--line)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--muted)', fontFamily: 'Manrope, sans-serif', fontSize: 14 }}>
            Nenhuma venda registrada ainda.
          </p>
        </div>
      )}
    </div>
  )
}

// ── AppHeader ───────────────────────────────────────────────

function AppHeader({ nome }) {
  return (
    <header style={{
      paddingTop: 54, paddingBottom: 16,
      paddingLeft: 20, paddingRight: 20,
      maxWidth: 480, margin: '0 auto',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{
        fontFamily: "'Playfair Display', serif",
        fontStyle: 'italic', fontWeight: 700, fontSize: 26,
        color: 'var(--ink)', letterSpacing: '-0.02em',
      }}>
        {(nome || 'estrada').toLowerCase()}.
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}>
          <Bell size={20} color="var(--muted)" />
        </button>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: METALLIC,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'Manrope, sans-serif' }}>
            {(nome || 'E')[0].toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  )
}

// ── BottomTabBar ────────────────────────────────────────────

function BottomTabBar({ tab, setTab }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      height: 78,
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      background: 'rgba(255,255,255,0.94)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderTop: '1px solid var(--line)',
      padding: '0 8px',
    }}>
      {BOTTOM_TABS.map(({ id, label, Icon, isFAB }) => {
        if (isFAB) {
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: METALLIC,
                border: 'none', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: -28,
                boxShadow: '0 4px 18px rgba(122,62,51,0.38)',
              }}
            >
              <Icon size={24} color="#fff" strokeWidth={2.5} />
            </button>
          )
        }
        const active = tab === id
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, height: '100%', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <Icon
              size={20}
              color={active ? 'var(--rose-deep)' : 'var(--muted)'}
              strokeWidth={active ? 2.2 : 1.5}
            />
            <span style={{
              fontSize: 10, fontFamily: 'Manrope, sans-serif',
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--rose-deep)' : 'var(--muted)',
              letterSpacing: '0.03em',
            }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ── Main export ─────────────────────────────────────────────

export default function LojaFeminina({ lojaId = 'estrada' }) {
  const data = useLojaData(lojaId)
  const [tab, setTab] = useState('inicio')
  const [initDone, setInitDone] = useState(false)

  const theme = {
    primary: data.config?.cor_primaria || '#B47A6B',
    accent:  data.config?.cor_secundaria || '#D9A99B',
    nome:    data.config?.nome || 'Loja Estrada',
  }

  useEffect(() => {
    if (!data.loading && !initDone) {
      data.ensureDefaults()
      setInitDone(true)
    }
  }, [data.loading])

  if (data.loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '2.5px solid var(--rose)',
          borderTopColor: 'transparent',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (data.dbError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px', maxWidth: 400 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Erro de conexão</p>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{data.dbError}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const panels = {
    inicio:    <Inicio vendas={data.vendas} metas={data.metas} />,
    historico: <Historico {...data} theme={theme} />,
    venda:     <NovaVenda {...data} theme={theme} />,
    meta:      <Meta {...data} theme={theme} />,
    conta:     (
      <div>
        <Fechamento {...data} theme={theme} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Mais opções</p>
          {[
            { label: 'Relatórios de faturamento', component: 'faturamento' },
            { label: 'Configurações da loja', component: 'config' },
          ].map(({ label, component }) => (
            <button
              key={component}
              onClick={() => setTab(component)}
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 14, padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--ink)', fontWeight: 500,
              }}
            >{label}</button>
          ))}
        </div>
      </div>
    ),
    faturamento: <Faturamento {...data} theme={theme} />,
    config:      <LojaConfig {...data} theme={theme} />,
  }

  const showBottomBar = !['faturamento', 'config'].includes(tab)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'Manrope, sans-serif' }}>
      <AppHeader nome={theme.nome} />
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 100px' }}>
        {panels[tab]}
      </main>
      {showBottomBar
        ? <BottomTabBar tab={tab} setTab={setTab} />
        : (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(24px)', borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setTab('conta')}
              style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--rose-deep)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Voltar
            </button>
          </div>
        )
      }
    </div>
  )
}
