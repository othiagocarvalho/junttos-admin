import { useState, useEffect } from 'react'
import { Home, Plus, Package, MoreHorizontal, Monitor } from 'lucide-react'
import { useLojaData } from './useLojaData'
import { useLojaTheme } from '../../hooks/useLojaTheme'
import { useViewMode } from '../../hooks/useViewMode'
import { gerarLogoDataURL } from '../../utils/gerarLogoSVG'
import Menu from './Menu'
import CadastrarProduto from './CadastrarProduto'
import NovaVenda from './NovaVenda'
import LojaConfig from '../LojaFeminina/LojaConfig'

const BOTTOM_TABS = [
  { id: 'inicio',  label: 'Início',  Icon: Home    },
  { id: 'venda',   label: '',        Icon: Plus, isFAB: true },
  { id: 'estoque', label: 'Estoque', Icon: Package },
  { id: 'mais',    label: 'Mais',    Icon: MoreHorizontal },
]

function AppHeader({ primary, logoUrl, storeName, onSwitchToDesktop }) {
  const [imgErr, setImgErr] = useState(false)
  const fallbackSrc = gerarLogoDataURL({ nome: storeName || 'Mercado', corPrimaria: primary || '#5E2BD0', corSecundaria: '#2A1F1F' })
  const src = logoUrl && !imgErr ? logoUrl : fallbackSrc

  return (
    <header style={{
      background: primary || '#5E2BD0', height: 56,
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
        <img src={src} alt={storeName || 'Mercado'}
          style={{ height: 32, width: 'auto', maxWidth: 90, objectFit: 'contain', display: 'block', flexShrink: 0 }}
          onError={() => setImgErr(true)} />
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

function BottomTabBar({ tab, setTab, primary }) {
  const activeColor = primary || '#5E2BD0'
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--surface)', borderTop: '1px solid var(--line)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        height: 68, width: '100%',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        alignItems: 'center', overflow: 'hidden',
      }}>
        {BOTTOM_TABS.map(({ id, label, Icon, isFAB }) => {
          if (isFAB) {
            return (
              <button key={id} onClick={() => setTab('venda')} aria-label="Nova venda" style={{
                width: 52, height: 52, borderRadius: 16, background: activeColor,
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

export default function LojaMercado({ lojaId = 'mercadodemo' }) {
  const data = useLojaData(lojaId)
  useLojaTheme(data.config)
  const { setViewMode } = useViewMode()
  const [tab, setTab] = useState('inicio')

  const primary = data.config?.cor_primaria || '#5E2BD0'
  const theme = {
    primary,
    accent: data.config?.cor_secundaria || '#F2643C',
    nome: data.config?.nome || 'Mercado',
  }

  useEffect(() => {
    if (!data.loading) data.ensureDefaults?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loading])

  if (data.loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2.5px solid ${primary}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const effectiveLogo = data.config?.logo_url || `/logos/${lojaId}.svg`

  const panels = {
    inicio:  <Menu vendas={data.vendas} theme={theme} setTab={setTab} />,
    venda:   <NovaVenda produtosData={data.produtosData} addVenda={data.addVenda} buscarPorEan={data.buscarPorEan} vendas={data.vendas} theme={theme} fetchAll={data.fetchAll} />,
    estoque: <CadastrarProduto addProduto={data.addProduto} theme={theme} />,
    mais:    <LojaConfig config={data.config} features={data.features} saveConfig={data.saveConfig} theme={theme} />,
  }

  return (
    <div style={{
      background: 'var(--bg)', minHeight: '100dvh',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      overflowX: 'hidden', maxWidth: '100vw', boxSizing: 'border-box',
    }}>
      <AppHeader
        primary={primary}
        logoUrl={effectiveLogo}
        storeName={theme.nome}
        onSwitchToDesktop={() => setViewMode('desktop')}
      />
      <main style={{ padding: '16px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
        {panels[tab] || panels.inicio}
      </main>
      <BottomTabBar tab={tab} setTab={setTab} primary={primary} />
    </div>
  )
}
