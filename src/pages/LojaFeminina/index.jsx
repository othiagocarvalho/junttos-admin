import { useState, useEffect } from 'react'
import { useLojaTheme } from '../../hooks/useLojaTheme'
import { Home, Plus, ShoppingBag, AlertCircle, Monitor, Package, Users, Lock, BarChart2, Wallet, ChevronRight, MoreHorizontal, Settings, Target, Receipt, CreditCard, Truck, ArrowLeftRight, X } from 'lucide-react'
import { HeroCard } from '../../components/studio/Card'
import { StatGrid } from '../../components/studio/StatCard'
import EmptyState from '../../components/studio/EmptyState'
import { useLojaData } from './useLojaData'
import { useViewMode } from '../../hooks/useViewMode'
import { gerarLogoDataURL } from '../../utils/gerarLogoSVG'
import { temAcesso, PLANOS, isLegado } from '../../utils/planos'
import { calcularPA } from '../../utils/metas'
import UpgradeWall from '../../components/UpgradeWall'
import ClientDashboardDesktop from '../cliente/ClientDashboardDesktop'
import CatalogoB2BAdmin from './CatalogoB2BAdmin'
import CatalogoB2BAdminDesktop from './CatalogoB2BAdminDesktop'
import NovaVenda from './NovaVenda'
import Historico from './Historico'
import Meta from './Meta'
import Fechamento from './Fechamento'
import Faturamento from './Faturamento'
import Relatorios from './Relatorios'
import LojaConfig from './LojaConfig'
import EstoqueMobile from './EstoqueMobile'
import ContasPagar from './ContasPagar'
import WelcomeOnboarding from './WelcomeOnboarding'
import CRM from './CRM'
import Crediario from './Crediario'
import Fornecedores from './Fornecedores'
import PedidosCatalogo from './PedidosCatalogo'
import ProdutosB2BPro from './ProdutosB2BPro'
import Financeiro from './Financeiro'
import AlertaBanner from './AlertaBanner'


function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

const BOTTOM_TABS = [
  { id: 'inicio',   label: 'Início',   Icon: Home          },
  { id: 'catalogo', label: 'Catálogo', Icon: ShoppingBag   },
  { id: 'venda',    label: '',         Icon: Plus, isFAB: true },
  { id: 'estoque',  label: 'Estoque',  Icon: Package       },
  { id: 'mais',     label: 'Mais',     Icon: MoreHorizontal },
]

const MAIS_ITEMS = [
  { id: 'relatorios',   label: 'Relatórios',    Icon: BarChart2,  planoMinimo: null                              },
  { id: 'financeiro',   label: 'Financeiro',    Icon: CreditCard, planoMinimo: 'business', apenasPlano: true     },
  { id: 'crm',          label: 'CRM',           Icon: Users,      planoMinimo: 'starter'                         },
  { id: 'meta',         label: 'Metas & Resultados', Icon: Target, planoMinimo: 'starter'                   },
  { id: 'crediario',    label: 'Crediário',     Icon: Receipt,    planoMinimo: 'pro',      apenasPlano: true     },
  { id: 'conta',        label: 'Fechamento',    Icon: Wallet,     planoMinimo: null                              },
  { id: 'config',       label: 'Configurações', Icon: Settings,   planoMinimo: null                              },
]

// ── Sub-views ──────────────────────────────────────────────

function Inicio({ vendas, metas, setTab, theme = {}, produtosData = [], lojaId, plano }) {
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
  const pa = calcularPA(vendasMes)
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
    { label: 'P.A.', value: pa > 0 ? pa.toFixed(1) : '—', sub: 'peças / atendimento' },
  ]

  return (
    <div style={{ paddingTop: 8, width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <AlertaBanner vendas={vendas} metas={metas} produtosData={produtosData} lojaId={lojaId} plano={plano} setTab={setTab} theme={theme} />
      {/* Hero */}
      <HeroCard tone={isDark ? 'dark' : 'primary'} style={{ marginBottom: 16, borderTop: isDark ? '2px solid #D4A017' : undefined }}>
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700,
          color: isDark ? 'rgba(212,160,23,0.7)' : 'rgba(255,255,255,0.72)', letterSpacing: '0.14em',
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          Total vendido — {now.toLocaleDateString('pt-BR', { month: 'long' })}
        </p>
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 38, fontWeight: 700, color: isDark ? '#F0C040' : '#fff', lineHeight: 1, marginBottom: 4,
        }}>
          {fmtR(totalMes)}
        </p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: isDark ? 'rgba(212,160,23,0.7)' : 'rgba(255,255,255,0.72)', marginTop: 10 }}>
          {vendasMes.length} venda{vendasMes.length !== 1 ? 's' : ''}{' '}
          {meta > 0 ? `· ${pctMeta.toFixed(0)}% da meta` : '· sem meta definida'}
        </p>
        {meta > 0 && (
          <div style={{ marginTop: 16, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: isDark ? '#D4A017' : '#fff', width: `${pctMeta}%`, transition: 'width 0.7s' }} />
          </div>
        )}
      </HeroCard>

      {/* KPI grid */}
      <StatGrid style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
        {kpis.map(({ label, value, sub }, i) => (
          <div key={label} style={{
            background: 'var(--surface)', borderRadius: 'var(--r-card)',
            border: '1px solid var(--line)', padding: '16px 14px',
            gridColumn: 'auto',
            minWidth: 0, boxSizing: 'border-box', overflow: 'hidden',
          }}>
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
              color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
            }}>{label}</p>
            <p style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{sub}</p>
          </div>
        ))}
      </StatGrid>

      {/* Meta card clicável */}
      <div onClick={() => setTab('meta')} style={{
        background: 'var(--surface)', borderRadius: 'var(--r-card)',
        border: '1px solid var(--line)', padding: '16px 18px',
        marginBottom: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Meta Mensal</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
            {meta > 0 ? `${pctMeta.toFixed(0)}%` : '—'}
          </p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
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
          background: 'var(--surface)', borderRadius: 'var(--r-card)',
          border: '1px solid var(--line)', padding: '20px 18px',
        }}>
          <p style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
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
                  <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? (i === 0 ? '#0A0A0A' : '#D4A017') : (i === 0 ? '#fff' : 'var(--rose-deep)'), fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{i + 1}</span>
                </div>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{nome}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: isDark ? '#F0C040' : 'var(--rose-deep)' }}>{qtd}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topProds.length === 0 && vendas.length === 0 && (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhuma venda ainda"
          subtitle="Registre sua primeira venda para acompanhar o desempenho da loja aqui."
          actionLabel="Nova venda"
          onAction={() => setTab('venda')}
        />
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
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
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

const PLANO_BADGE = {
  starter:  { bg: 'rgba(255,255,255,0.2)',  color: 'rgba(255,255,255,0.9)' },
  pro:      { bg: 'rgba(255,255,255,0.25)', color: '#fff' },
  business: { bg: 'rgba(109,40,217,0.5)',   color: '#fff' },
}

function AppHeader({ primary, accent, logoUrl, storeName, plano, legado, onSwitchToDesktop }) {
  const [imgErr, setImgErr] = useState(false)
  const isDarkTheme = primary === '#D4A017'

  const fallbackSrc = gerarLogoDataURL({
    nome: storeName || 'Loja',
    corPrimaria: primary || '#5E2BD0',
    corSecundaria: accent || '#2A1F1F',
  })
  const src = logoUrl && !imgErr ? logoUrl : fallbackSrc
  const planoLabel = PLANOS[plano]?.label || 'Starter'
  const badgeStyle = PLANO_BADGE[plano] || PLANO_BADGE.starter

  return (
    <header style={{
      background: primary || '#CC7870',
      height: 56,
      paddingLeft: 20, paddingRight: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', flexShrink: 0,
      width: '100%', maxWidth: '100vw', overflow: 'hidden', boxSizing: 'border-box',
      borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
      boxShadow: '0 8px 20px -12px rgba(0,0,0,0.25)',
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
        {!legado && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            fontFamily: 'Plus Jakarta Sans, sans-serif', padding: '2px 8px', borderRadius: 99,
            background: badgeStyle.bg, color: badgeStyle.color, flexShrink: 0,
          }}>{planoLabel}</span>
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

function BottomTabBar({ tab, setTab, onFabClick, primary }) {
  const activeColor = primary || 'var(--primary)'
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--surface)',
      borderTop: '1px solid var(--line)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        height: 68, width: '100%',
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        alignItems: 'center',
        overflow: 'hidden',
      }}>
        {BOTTOM_TABS.map(({ id, label, Icon, isFAB }) => {
          if (isFAB) {
            return (
              <button key={id} onClick={() => onFabClick ? onFabClick() : setTab(id)} aria-label="Nova venda" style={{
                width: 52, height: 52, borderRadius: 16,
                background: activeColor,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto', marginTop: -26,
                boxShadow: `0 10px 22px -8px color-mix(in srgb, ${activeColor} 65%, transparent)`,
                minHeight: 44, minWidth: 44,
              }}>
                <Icon size={24} color="#fff" strokeWidth={2.5} />
              </button>
            )
          }
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              height: '100%', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3,
              alignItems: 'center', justifyContent: 'center', minHeight: 44,
            }}>
              <Icon size={20} color={active ? activeColor : 'var(--muted)'} strokeWidth={active ? 2.3 : 1.7} />
              <span style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? activeColor : 'var(--muted)',
              }}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// ── Catálogo B2B como módulo dentro do dashboard completo ────

function CatalogoB2BModulo({ data, theme, lojaId, nivel }) {
  const [subTab, setSubTab] = useState('produtos')
  const primary = theme.primary
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'produtos', label: 'Produtos' },
          { id: 'pedidos',  label: 'Pedidos'  },
        ].map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)} style={{
            flex: 1, padding: '10px', borderRadius: 12, cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
            border: subTab === st.id ? 'none' : '1px solid var(--line)',
            background: subTab === st.id ? primary : 'var(--surface)',
            color: subTab === st.id ? '#fff' : 'var(--muted)',
          }}>{st.label}</button>
        ))}
      </div>
      {subTab === 'produtos'
        ? nivel === 'pro'
          ? <ProdutosB2BPro
              produtosData={data.produtosData}
              updateVariacoes={data.updateVariacoes}
              addProduto={data.addProduto}
              updateProduto={data.updateProduto}
              fetchAll={data.fetchAll}
              theme={theme}
              LOJA_ID={lojaId}
              config={data.config}
            />
          : <EstoqueMobile
              produtosData={data.produtosData}
              updateVariacoes={data.updateVariacoes}
              addProduto={data.addProduto}
              updateProduto={data.updateProduto}
              features={data.features}
              theme={theme}
              LOJA_ID={lojaId}
              fetchAll={data.fetchAll}
            />
        : <PedidosCatalogo
            pedidos={data.pedidos || []}
            updatePedido={data.updatePedido}
            theme={theme}
            lojaId={lojaId}
          />
      }
    </div>
  )
}

// ── Main export ─────────────────────────────────────────────

export default function LojaFeminina({ lojaId = 'estrada' }) {
  const data = useLojaData(lojaId)
  useLojaTheme(data.config)
  const { viewMode, setViewMode } = useViewMode()
  const [tab, setTab] = useState('inicio')
  const [initDone, setInitDone] = useState(false)
  const [showVendaModal, setShowVendaModal] = useState(false)
  const [vendaInitTroca, setVendaInitTroca] = useState(false)

  const primary = data.config?.cor_primaria || '#5E2BD0'
  const isDark = primary === '#D4A017'
  const theme = {
    primary,
    accent:  data.config?.cor_secundaria || '#F2643C',
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
    const catalogoB2BNivelDesktop = data?.config?.features?.catalogo_b2b
    if ((catalogoB2BNivelDesktop === 'simples' || catalogoB2BNivelDesktop === 'pro') && data?.config?.features?.apenas_catalogo_b2b === true) {
      return (
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', ...themeVars }}>
          <CatalogoB2BAdminDesktop
            data={data}
            theme={theme}
            lojaId={lojaId}
            nivel={catalogoB2BNivelDesktop}
            onSwitchToMobile={() => setViewMode('mobile')}
          />
        </div>
      )
    }
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
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Erro de conexão</p>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{data.dbError}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Catálogo B2B — admin reduzido mobile (apenas para lojas SÓ-catálogo, sem o sistema completo)
  const catalogoB2BNivel = data?.config?.features?.catalogo_b2b
  if ((catalogoB2BNivel === 'simples' || catalogoB2BNivel === 'pro') && data?.config?.features?.apenas_catalogo_b2b === true) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', fontFamily: 'Plus Jakarta Sans, sans-serif', overflowX: 'hidden', maxWidth: '100vw', boxSizing: 'border-box', ...themeVars }}>
        <CatalogoB2BAdmin
          data={data}
          theme={theme}
          lojaId={lojaId}
          nivel={catalogoB2BNivel}
          onSwitchToDesktop={() => setViewMode('desktop')}
        />
      </div>
    )
  }

  const effectiveLogo = data.config?.logo_url || `/logos/${lojaId}.svg`
  const features = data.features
  const plano = data.config?.plano || 'starter'
  const legado = isLegado(data.config?.features)

  const panels = {
    inicio: data.produtosData.length === 0
      ? <WelcomeOnboarding theme={theme} storeName={theme.nome} onCadastrarManualmente={() => setTab('estoque')} importarProdutos={data.importarProdutos} />
      : <Inicio vendas={data.vendas} metas={data.metas} setTab={setTab} theme={theme} produtosData={data.produtosData} lojaId={lojaId} plano={plano} />,
    estoque:    <EstoqueMobile {...data} theme={theme} />,
    venda:      <NovaVenda {...data} theme={theme} initialIsTroca={vendaInitTroca} />,
    relatorios: <Relatorios {...data} theme={theme} temAcessoPro={temAcesso(plano, 'pro')} />,
    crediario: temAcesso(plano, 'pro')
      ? <Crediario crediario={data.crediario || []} addCrediario={data.addCrediario} pagarParcela={data.pagarParcela} theme={theme} lojaId={lojaId} />
      : <UpgradeWall planoAtual={plano} planoNecessario="pro" funcionalidade="crediario" theme={theme} onVoltar={() => setTab('inicio')} />,
    meta: (legado || temAcesso(plano, 'starter'))
      ? <Meta {...data} theme={theme} plano={plano} mobile />
      : <UpgradeWall planoAtual={plano} planoNecessario="starter" funcionalidade="meta" theme={theme} onVoltar={() => setTab('inicio')} />,
    crm: (legado || temAcesso(plano, 'starter'))
      ? <CRM clientes={data.clientes || []} vendas={data.vendas} addCliente={data.addCliente} updateCliente={data.updateCliente} deleteCliente={data.deleteCliente} lembretes={data.lembretes || []} addLembrete={data.addLembrete} concluirLembrete={data.concluirLembrete} dispensados={data.dispensados || []} dispensarFollowup={data.dispensarFollowup} theme={theme} lojaId={lojaId} produtosData={data.produtosData} plano={plano} />
      : <UpgradeWall planoAtual={plano} planoNecessario="starter" funcionalidade="clientes" theme={theme} onVoltar={() => setTab('inicio')} />,
    fornecedores: features?.fornecedores === true
      ? <Fornecedores {...data} theme={theme} lojaId={lojaId} />
      : null,
    catalogo: temAcesso(plano, 'business')
      ? <PedidosCatalogo pedidos={data.pedidos || []} updatePedido={data.updatePedido} theme={theme} lojaId={lojaId} />
      : <UpgradeWall planoAtual={plano} planoNecessario="business" funcionalidade="catalogo" theme={theme} onVoltar={() => setTab('inicio')} />,
    catalogo_b2b: catalogoB2BNivel
      ? <CatalogoB2BModulo data={data} theme={theme} lojaId={lojaId} nivel={catalogoB2BNivel} />
      : null,
    financeiro: temAcesso(plano, 'business')
      ? <Financeiro lojaId={lojaId} vendas={data.vendas} theme={theme} />
      : <UpgradeWall planoAtual={plano} planoNecessario="business" funcionalidade="financeiro" theme={theme} onVoltar={() => setTab('inicio')} />,
    conta: <Fechamento {...data} theme={theme} />,
    mais: (
      <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MAIS_ITEMS.map(({ id, label, Icon, planoMinimo, apenasPlano }) => {
          const unlocked = apenasPlano
            ? (!planoMinimo || temAcesso(plano, planoMinimo))
            : (!planoMinimo || legado || temAcesso(plano, planoMinimo))
          return (
            <button
              key={id}
              onClick={unlocked ? () => setTab(id) : undefined}
              style={{
                width: '100%', border: '1px solid var(--line)', background: 'var(--surface)',
                borderRadius: 'var(--r-card)', padding: '14px 16px', textAlign: 'left',
                cursor: unlocked ? 'pointer' : 'not-allowed', minHeight: 44,
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 12,
                color: unlocked ? 'var(--ink)' : 'var(--muted)',
                opacity: unlocked ? 1 : 0.6,
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: `color-mix(in srgb, var(--primary) 12%, white)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={17} color="var(--primary)" strokeWidth={2} />
              </div>
              <span style={{ flex: 1 }}>{label}</span>
              {unlocked
                ? <ChevronRight size={16} color="var(--muted)" />
                : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
                    <Lock size={12} color="var(--muted)" /> {planoMinimo}
                  </span>
              }
            </button>
          )
        })}
        {features?.fornecedores === true && (
          <button
            onClick={() => setTab('fornecedores')}
            style={{
              width: '100%', border: '1px solid var(--line)', background: 'var(--surface)',
              borderRadius: 'var(--r-card)', padding: '14px 16px', textAlign: 'left',
              cursor: 'pointer', minHeight: 44,
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'color-mix(in srgb, var(--primary) 12%, white)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Truck size={17} color="var(--primary)" strokeWidth={2} />
            </div>
            <span style={{ flex: 1 }}>Fornecedores</span>
            <ChevronRight size={16} color="var(--muted)" />
          </button>
        )}
        {features?.atacado && (
          <button
            onClick={() => setTab('contas_pagar')}
            style={{
              width: '100%', background: 'var(--surface)', border: '1px solid var(--status-warn-dot)',
              borderRadius: 'var(--r-card)', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', minHeight: 44,
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--status-warn-tx)', fontWeight: 700,
            }}
          >Contas a Pagar</button>
        )}
        {catalogoB2BNivel && (
          <button
            onClick={() => setTab('catalogo_b2b')}
            style={{
              width: '100%', border: '1px solid var(--line)', background: 'var(--surface)',
              borderRadius: 'var(--r-card)', padding: '14px 16px', textAlign: 'left',
              cursor: 'pointer', minHeight: 44,
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'color-mix(in srgb, var(--primary) 12%, white)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShoppingBag size={17} color="var(--primary)" strokeWidth={2} />
            </div>
            <span style={{ flex: 1 }}>Catálogo B2B</span>
            <ChevronRight size={16} color="var(--muted)" />
          </button>
        )}
      </div>
    ),
    faturamento:   <Faturamento {...data} theme={theme} />,
    config:        <LojaConfig {...data} theme={theme} />,
    contas_pagar:  features?.atacado
      ? <ContasPagar produtosData={data.produtosData} updateProduto={data.updateProduto} theme={theme} lojaId={lojaId} />
      : null,
  }

  const showBottomBar = !['faturamento', 'config', 'meta', 'contas_pagar', 'crm', 'financeiro', 'crediario', 'relatorios', 'conta', 'catalogo_b2b', 'fornecedores'].includes(tab)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', fontFamily: 'Plus Jakarta Sans, sans-serif', overflowX: 'hidden', maxWidth: '100vw', boxSizing: 'border-box', ...themeVars }}>
      <AppHeader primary={theme.primary} accent={theme.accent} logoUrl={effectiveLogo} storeName={theme.nome} plano={plano} legado={legado} onSwitchToDesktop={() => setViewMode('desktop')} />
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 110px', overflowX: 'hidden', boxSizing: 'border-box' }}>
        {panels[tab]}
      </main>
      {showBottomBar
        ? <BottomTabBar tab={tab} setTab={setTab} onFabClick={() => setShowVendaModal(true)} primary={theme.primary} config={data.config} />
        : (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'var(--surface)', borderTop: '1px solid var(--line)', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setTab('mais')}
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: theme.primary, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44 }}
            >
              ← Voltar
            </button>
          </div>
        )
      }

      {/* Modal: selecionar tipo de venda */}
      {showVendaModal && (
        <div
          onClick={() => setShowVendaModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--line)', borderBottom: 'none', padding: '24px 20px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0 }}>O que deseja registrar?</p>
              <button onClick={() => setShowVendaModal(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setVendaInitTroca(false); setTab('venda'); setShowVendaModal(false) }}
                style={{ flex: 1, padding: '20px 12px', borderRadius: 16, cursor: 'pointer', border: `2px solid ${theme.primary}`, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={22} color="#fff" />
                </div>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Nova Venda</span>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.4 }}>Registrar uma venda normalmente</span>
              </button>
              <button
                onClick={() => { setVendaInitTroca(true); setTab('venda'); setShowVendaModal(false) }}
                style={{ flex: 1, padding: '20px 12px', borderRadius: 16, cursor: 'pointer', border: '2px solid #D97706', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowLeftRight size={22} color="#fff" />
                </div>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: '#D97706' }}>Troca</span>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.4 }}>Devolver e escolher outro produto</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
