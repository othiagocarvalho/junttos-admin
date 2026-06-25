import { useState, useEffect } from 'react'
import { useLojaTheme } from '../../hooks/useLojaTheme'
import { Home, Plus, ShoppingBag, AlertCircle, Monitor, Package, Users, Lock, BarChart2, Wallet, ChevronRight } from 'lucide-react'
import { useLojaData } from './useLojaData'
import { useViewMode } from '../../hooks/useViewMode'
import { gerarLogoDataURL } from '../../utils/gerarLogoSVG'
import ClientDashboardDesktop from '../cliente/ClientDashboardDesktop'
import NovaVenda from './NovaVenda'
import Historico from './Historico'
import Meta from './Meta'
import Fechamento from './Fechamento'
import Faturamento from './Faturamento'
import Relatorios from './Relatorios'
import LojaConfig from './LojaConfig'
import EstoqueMobile from './EstoqueMobile'
import WelcomeOnboarding from './WelcomeOnboarding'


function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

const BOTTOM_TABS = [
  { id: 'inicio',     label: 'Início',    Icon: Home      },
  { id: 'estoque',    label: 'Estoque',   Icon: Package   },
  { id: 'venda',      label: '',          Icon: Plus,     isFAB: true },
  { id: 'relatorios', label: 'Relatórios',Icon: BarChart2 },
  { id: 'conta',      label: 'Fechamento',Icon: Wallet    },
]

// ── Sub-views ──────────────────────────────────────────────

function Inicio({ vendas, metas, setTab, theme = {} }) {
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

  const isDark = !!theme.isDark

  const kpis = [
    { label: 'Hoje', value: fmtR(totalHoje), sub: `${vendasHoje.length} venda${vendasHoje.length !== 1 ? 's' : ''}` },
    { label: 'Ticket médio', value: fmtR(ticketMedio), sub: 'este mês' },
    { label: 'Vendas no mês', value: vendasMes.length, sub: 'transações' },
  ]

  return (
    <div style={{ paddingTop: 8, width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Hero */}
      <div style={{
        background: isDark ? '#0F0E0C' : 'linear-gradient(135deg, var(--primary) 0%, var(--rose-deep) 100%)',
        borderTop: isDark ? '2px solid #D4A017' : undefined,
        borderRadius: 20,
        padding: '28px 24px', marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        <p style={{
          fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700,
          color: isDark ? 'rgba(212,160,23,0.7)' : 'rgba(255,255,255,0.72)', letterSpacing: '0.14em',
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          Total vendido — {now.toLocaleDateString('pt-BR', { month: 'long' })}
        </p>
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 42, fontWeight: 700, color: isDark ? '#F0C040' : '#fff', lineHeight: 1, marginBottom: 4,
        }}>
          {fmtR(totalMes)}
        </p>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: isDark ? 'rgba(212,160,23,0.7)' : 'rgba(255,255,255,0.72)', marginTop: 10 }}>
          {vendasMes.length} venda{vendasMes.length !== 1 ? 's' : ''}{' '}
          {meta > 0 ? `· ${pctMeta.toFixed(0)}% da meta` : '· sem meta definida'}
        </p>
        {meta > 0 && (
          <div style={{ marginTop: 16, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: isDark ? '#D4A017' : '#fff', width: `${pctMeta}%`, transition: 'width 0.7s' }} />
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        {kpis.map(({ label, value, sub }, i) => (
          <div key={label} style={{
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--line)', padding: '16px 14px',
            gridColumn: i === 2 ? '1 / -1' : 'auto',
            minWidth: 0, boxSizing: 'border-box', overflow: 'hidden',
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

      {/* Meta card clicável */}
      <div onClick={() => setTab('meta')} style={{
        background: 'var(--surface)', borderRadius: 16,
        border: '1px solid var(--line)', padding: '16px 18px',
        marginBottom: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Meta Mensal</p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
            {meta > 0 ? `${pctMeta.toFixed(0)}%` : '—'}
          </p>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {meta > 0 ? fmtR(meta) : 'Toque para definir meta'}
          </p>
          {meta > 0 && (
            <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: 'var(--line)', width: 140 }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--rose-deep)', width: `${pctMeta}%`, transition: 'width 0.7s' }} />
            </div>
          )}
        </div>
        <ChevronRight size={16} color="var(--muted)" />
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
                  background: isDark ? (i === 0 ? '#D4A017' : 'rgba(212,160,23,0.15)') : (i === 0 ? 'var(--primary)' : 'var(--rose)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? (i === 0 ? '#0A0A0A' : '#D4A017') : (i === 0 ? '#fff' : 'var(--rose-deep)'), fontFamily: 'Manrope, sans-serif' }}>{i + 1}</span>
                </div>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)', fontFamily: 'Manrope, sans-serif' }}>{nome}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#F0C040' : 'var(--rose-deep)', fontFamily: 'Manrope, sans-serif' }}>{qtd}×</span>
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

// ── Relatórios mobile (Histórico + Faturamento) ─────────────
function RelatoriosMobile({ data, theme }) {
  const [subTab, setSubTab] = useState('historico')
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'historico',   label: 'Histórico'   },
          { id: 'faturamento', label: 'Faturamento'  },
        ].map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)} style={{
            flex: 1, padding: '10px', borderRadius: 12, cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600,
            border: subTab === st.id ? 'none' : '1px solid var(--line)',
            background: subTab === st.id ? theme.primary : 'var(--surface)',
            color: subTab === st.id ? '#fff' : 'var(--muted)',
          }}>{st.label}</button>
        ))}
      </div>
      {subTab === 'historico'
        ? <Historico {...data} theme={theme} />
        : <Faturamento {...data} theme={theme} />
      }
    </div>
  )
}

// ── AppHeader ───────────────────────────────────────────────

function AppHeader({ primary, accent, logoUrl, storeName, onSwitchToDesktop }) {
  const [imgErr, setImgErr] = useState(false)
  const isDarkTheme = primary === '#D4A017'

  const fallbackSrc = gerarLogoDataURL({
    nome: storeName || 'Loja',
    corPrimaria: primary || '#B47A6B',
    corSecundaria: accent || '#2A1F1F',
  })
  const src = logoUrl && !imgErr ? logoUrl : fallbackSrc

  return (
    <header style={{
      background: primary || '#CC7870',
      height: 56,
      paddingLeft: 20, paddingRight: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', flexShrink: 0,
      width: '100%', maxWidth: '100vw', overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="32" height="32" viewBox="18 21 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect x="20" y="55" width="60" height="28" rx="14" fill="rgba(255,255,255,0.9)" />
          <circle cx="40" cy="37" r="14" fill="rgba(255,255,255,0.85)" />
          <circle cx="64" cy="39" r="14" fill="rgba(255,255,255,0.65)" />
        </svg>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
        {isDarkTheme ? (
          <img src="/logos/biastore-black.svg" alt={storeName || 'Loja'}
            style={{ height: 52, width: 'auto', display: 'block', flexShrink: 0 }} />
        ) : (
          <img src={src} alt={storeName || 'Loja'}
            style={{ height: 32, width: 'auto', maxWidth: 90, objectFit: 'contain', display: 'block', flexShrink: 0 }}
            onError={() => setImgErr(true)} />
        )}
      </div>
      <button onClick={onSwitchToDesktop} title="Versão Computador" style={{
        position: 'absolute', right: 16, bottom: 14,
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center',
      }}>
        <Monitor size={16} color="rgba(255,255,255,0.6)" />
      </button>
    </header>
  )
}

// ── BottomTabBar ────────────────────────────────────────────

function BottomTabBar({ tab, setTab, primary, config }) {
  const activeColor = primary || '#CC7870'
  const crmEnabled = config?.features?.crm
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: '#F8F7F5',
      borderTop: '1px solid #e8e4df',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        height: 72, width: '100%',
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        alignItems: 'center',
        overflow: 'hidden',
      }}>
        {BOTTOM_TABS.map(({ id, Icon, isFAB, isCRM }) => {
          if (isFAB) {
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                width: 52, height: 52, borderRadius: '50%',
                background: '#F4613A',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto', marginTop: -26,
                boxShadow: '0 4px 18px rgba(244,97,58,0.38)',
              }}>
                <Icon size={22} color="#fff" strokeWidth={2.5} />
              </button>
            )
          }
          if (isCRM) {
            const locked = !crmEnabled
            return (
              <button key={id}
                onClick={locked ? undefined : () => setTab(id)}
                style={{
                  height: '100%', background: 'none', border: 'none',
                  cursor: locked ? 'default' : 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: locked ? 0.4 : 1,
                }}>
                <div style={{ position: 'relative' }}>
                  <Icon size={19} color={!locked && tab === id ? activeColor : '#bbb'} strokeWidth={1.5} />
                  {locked && <Lock size={9} color="#bbb" style={{ position: 'absolute', top: -4, right: -6 }} />}
                </div>
              </button>
            )
          }
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              height: '100%', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={19} color={active ? activeColor : '#bbb'} strokeWidth={active ? 2.2 : 1.5} />
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 10, color: '#bbb', margin: '0 0 8px', fontFamily: 'Manrope, sans-serif', textAlign: 'center' }}>
        jun<span style={{ color: '#F4613A' }}>tt</span>os
      </p>
    </nav>
  )
}

// ── Main export ─────────────────────────────────────────────

export default function LojaFeminina({ lojaId = 'estrada' }) {
  const data = useLojaData(lojaId)
  useLojaTheme(data.config)
  const { viewMode, setViewMode } = useViewMode()
  const [tab, setTab] = useState('inicio')
  const [initDone, setInitDone] = useState(false)

  const primary = data.config?.cor_primaria || '#B47A6B'
  const isDark = primary === '#D4A017'
  const theme = {
    primary,
    accent:  data.config?.cor_secundaria || '#D9A99B',
    nome:    data.config?.nome || 'Loja Estrada',
    isDark,
  }
  const themeVars = {
    ...(isDark ? {
      '--bg':      '#0A0A0A',
      '--surface': '#0F0E0C',
      '--line':    'rgba(212,160,23,0.18)',
      '--ink':     '#D4A017',
      '--ink-soft':'#A07830',
      '--muted':   '#A07830',
      '--rose-deep':'#F0C040',
      '--rose':    '#D4A017',
    } : {}),
  }

  useEffect(() => {
    if (!data.loading && !initDone) {
      data.ensureDefaults()
      setInitDone(true)
    }
  }, [data.loading])

  // Desktop mode — render before loading check so it handles its own loading
  if (!data.loading && !data.dbError && viewMode === 'desktop') {
    return (
      <ClientDashboardDesktop
        data={data}
        theme={theme}
        onSwitchToMobile={() => setViewMode('mobile')}
      />
    )
  }

  if (data.loading) {
    return (
      <div style={{
        minHeight: '100dvh', background: 'var(--bg)',
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
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
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

  const effectiveLogo = data.config?.logo_url || `/logos/${lojaId}.svg`

  const panels = {
    inicio: data.produtosData.length === 0
      ? <WelcomeOnboarding theme={theme} storeName={theme.nome} onCadastrarManualmente={() => setTab('estoque')} importarProdutos={data.importarProdutos} />
      : <Inicio vendas={data.vendas} metas={data.metas} setTab={setTab} theme={theme} />,
    estoque:    <EstoqueMobile {...data} theme={theme} />,
    venda:      <NovaVenda {...data} theme={theme} />,
    relatorios: <Relatorios {...data} theme={theme} />,
    meta:       <Meta {...data} theme={theme} />,
    conta:      (
      <div>
        <Fechamento {...data} theme={theme} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Mais opções</p>
          <button
            onClick={() => setTab('config')}
            style={{
              width: '100%', background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 14, padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--ink)', fontWeight: 500,
            }}
          >Configurações da loja</button>
        </div>
      </div>
    ),
    faturamento: <Faturamento {...data} theme={theme} />,
    config:      <LojaConfig {...data} theme={theme} />,
  }

  const showBottomBar = !['faturamento', 'config', 'meta'].includes(tab)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', fontFamily: 'Manrope, sans-serif', overflowX: 'hidden', maxWidth: '100vw', boxSizing: 'border-box', ...themeVars }}>
      <AppHeader primary={theme.primary} accent={theme.accent} logoUrl={effectiveLogo} storeName={theme.nome} onSwitchToDesktop={() => setViewMode('desktop')} />
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 110px', overflowX: 'hidden', boxSizing: 'border-box' }}>
        {panels[tab]}
      </main>
      {showBottomBar
        ? <BottomTabBar tab={tab} setTab={setTab} primary={theme.primary} config={data.config} />
        : (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: '#F8F7F5', borderTop: '1px solid #e8e4df', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setTab('conta')}
              style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 600, color: theme.primary, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Voltar
            </button>
          </div>
        )
      }
    </div>
  )
}
