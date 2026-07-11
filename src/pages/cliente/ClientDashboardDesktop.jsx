import { useState, useEffect } from 'react'
import {
  Home, Plus, Wallet, Settings, BarChart2,
  Trash2, Search, Check, ChevronRight, ChevronDown, X, Pencil,
  User, Phone, CreditCard, ShoppingBag, Lock, Package, Users, FileText, Target, Receipt, Building2, Truck,
} from 'lucide-react'
import { HeroCard } from '../../components/studio/Card'
import { StatGrid } from '../../components/studio/StatCard'
import Logo from '../../components/junttos/Logo'
import { temAcesso, PLANOS, isLegado } from '../../utils/planos'
import { calcularTotalVenda, calcularTotalComAjuste } from '../../utils/venda'
import UpgradeWall from '../../components/UpgradeWall'
import CatalogoB2BAdminDesktop from '../LojaFeminina/CatalogoB2BAdminDesktop'
import Meta from '../LojaFeminina/Meta'
import Fechamento from '../LojaFeminina/Fechamento'
import ContasPagar from '../LojaFeminina/ContasPagar'
import Faturamento from '../LojaFeminina/Faturamento'
import LojaConfig from '../LojaFeminina/LojaConfig'
import RelatoriosDesktop from './RelatoriosDesktop'
import EstoqueMobile from '../LojaFeminina/EstoqueMobile'
import WelcomeOnboarding from '../LojaFeminina/WelcomeOnboarding'
import Clientes from '../LojaFeminina/Clientes'
import Crediario from '../LojaFeminina/Crediario'
import Fornecedores from '../LojaFeminina/Fornecedores'
import PedidosCatalogo from '../LojaFeminina/PedidosCatalogo'
import ProdutosB2BPro from '../LojaFeminina/ProdutosB2BPro'
import FinanceiroDesktop from './FinanceiroDesktop'
import AlertaBanner from '../LojaFeminina/AlertaBanner'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtDT(s) {
  return new Date(s).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
function parsePgtos(v) {
  try {
    const arr = JSON.parse(v.forma_pgto)
    if (Array.isArray(arr)) return arr
  } catch {}
  return v.forma_pgto ? [{ forma: v.forma_pgto, valor: Number(v.valor) }] : []
}
function fmtPgtos(v) {
  return parsePgtos(v).map(p =>
    p.forma === 'Boleto' && p.vencimento ? `Boleto ${p.vencimento}d` : p.forma
  ).join(' + ')
}

const NAV = [
  { id: 'inicio',     label: 'Início',        Icon: Home      },
  { id: 'venda',      label: 'Nova Venda',    Icon: Plus      },
  { id: 'estoque',    label: 'Estoque',       Icon: Package   },
  { id: 'relatorios', label: 'Relatórios',    Icon: BarChart2 },
  { id: 'crm',        label: 'CRM',           Icon: Users,    locked: true },
  { id: 'conta',      label: 'Fechamento',    Icon: Wallet    },
]

const PGTOS = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito']

// ── Shared input style ───────────────────────────────────────
const inp = (primary) => ({
  width: '100%', height: 44, boxSizing: 'border-box',
  background: 'var(--bg)', border: '1.5px solid var(--line)',
  borderRadius: 12, padding: '0 14px',
  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)', outline: 'none',
  transition: 'border-color .18s, box-shadow .18s',
})
const onF = (primary) => (e) => {
  e.target.style.borderColor = primary
  e.target.style.boxShadow = `0 0 0 3px ${primary}20`
  e.target.style.background = 'var(--surface)'
}
const onB = (e) => {
  e.target.style.borderColor = 'var(--line)'
  e.target.style.boxShadow = 'none'
  e.target.style.background = 'var(--bg)'
}
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 7, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Plus Jakarta Sans, sans-serif' }

const PLANO_NAV_ITEMS = [
  { id: 'clientes',    label: 'Clientes',       Icon: Users,       planoMinimo: 'starter'  },
  { id: 'meta',      label: 'Metas',            Icon: Target,      planoMinimo: 'pro'      },
  { id: 'crediario',   label: 'Crediário',        Icon: Receipt,     planoMinimo: 'pro'      },
  { id: 'fornecedores',label: 'Fornecedores',    Icon: Truck,       planoMinimo: 'starter'  },
  { id: 'catalogo',    label: 'Catálogo online', Icon: ShoppingBag, planoMinimo: 'business' },
  { id: 'financeiro',  label: 'Financeiro',      Icon: CreditCard,  planoMinimo: 'business' },
]

const PLANO_BADGE_DESKTOP = {
  pro:      { bg: '#dbeafe', color: '#1d4ed8', label: 'Pro' },
  business: { bg: '#ede9fe', color: '#6d28d9', label: 'Business' },
}

// ── Sidebar (fixo 250px) ──────────────────────────────────────
function DesktopSidebar({ tab, setTab, theme, config, logoUrl, plano, legado, onSwitchToMobile }) {
  const planoBadge = !legado ? PLANO_BADGE_DESKTOP[plano] : null

  function navItemStyle(active) {
    return {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 10, width: '100%',
      background: active ? 'var(--primary)' : 'transparent',
      border: 'none', cursor: 'pointer', textAlign: 'left',
      color: active ? '#fff' : 'var(--ink-soft)',
      fontSize: 13.5, fontWeight: active ? 700 : 500,
      fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all .15s',
      boxShadow: active ? 'var(--shadow-btn-primary)' : 'none',
    }
  }

  return (
    <aside
      style={{
        position: 'fixed', left: 0, top: 0,
        width: 250, height: '100dvh',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
        zIndex: 50, fontFamily: 'Plus Jakarta Sans, sans-serif',
        borderRight: '1px solid var(--line)',
      }}
    >
      {/* Logo area */}
      <div style={{
        padding: '20px 18px 16px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 10,
        minHeight: 64, flexShrink: 0,
      }}>
        {logoUrl
          ? <img src={logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', flexShrink: 0, border: '1px solid var(--line)', background: '#fff' }} />
          : <Logo variant="light" size={26} showWordmark={false} />
        }
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)',
            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{config?.nome || theme.nome || 'Sua Loja'}</p>
          {planoBadge && (
            <span style={{
              display: 'inline-block', marginTop: 2,
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '1px 7px', borderRadius: 99,
              background: planoBadge.bg, color: planoBadge.color,
            }}>{planoBadge.label}</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV.map((item, i) => {
          if (item.divider) return <div key={`div-${i}`} style={{ height: 1, background: 'var(--line)', margin: '8px 4px' }} />
          const { id, label, Icon, locked: lockedProp } = item
          const isLocked = lockedProp && !config?.features?.crm
          const active = tab === id
          return (
            <button key={id}
              onClick={isLocked ? undefined : () => setTab(id)}
              className={isLocked || active ? '' : 'cds-nav-btn'}
              style={{ ...navItemStyle(active), cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
              {isLocked && <Lock size={12} style={{ flexShrink: 0 }} />}
            </button>
          )
        })}
        {config?.features?.atacado && (
          <button
            onClick={() => setTab('contas_pagar')}
            className={tab === 'contas_pagar' ? '' : 'cds-nav-btn'}
            style={navItemStyle(tab === 'contas_pagar')}
          >
            <FileText size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, whiteSpace: 'nowrap' }}>Contas a Pagar</span>
          </button>
        )}
        <div style={{ height: 1, background: 'var(--line)', margin: '8px 4px' }} />
        {PLANO_NAV_ITEMS.map(({ id, label, Icon, planoMinimo }) => {
          if (legado && ['catalogo', 'financeiro', 'crediario', 'fornecedores'].includes(id)) return null
          const hasAccess = legado || temAcesso(plano, planoMinimo)
          const active = tab === id
          const badge = !hasAccess ? PLANO_BADGE_DESKTOP[planoMinimo] : null
          return (
            <button key={id}
              onClick={() => setTab(id)}
              className={active ? '' : 'cds-nav-btn'}
              style={{ ...navItemStyle(active), opacity: hasAccess ? 1 : 0.55 }}>
              {hasAccess
                ? <Icon size={16} style={{ flexShrink: 0 }} />
                : <Lock size={16} style={{ flexShrink: 0 }} />
              }
              <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
              {badge && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                  background: active ? 'rgba(255,255,255,0.25)' : badge.bg,
                  color: active ? '#fff' : badge.color, flexShrink: 0,
                  letterSpacing: '0.08em',
                }}>{badge.label}</span>
              )}
            </button>
          )
        })}
        {config?.features?.catalogo_b2b && (
          <button
            onClick={() => setTab('catalogo_b2b')}
            className={tab === 'catalogo_b2b' ? '' : 'cds-nav-btn'}
            style={navItemStyle(tab === 'catalogo_b2b')}
          >
            <ShoppingBag size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, whiteSpace: 'nowrap' }}>Catálogo B2B</span>
          </button>
        )}
        <button
          onClick={() => setTab('config')}
          className={tab === 'config' ? '' : 'cds-nav-btn'}
          style={navItemStyle(tab === 'config')}
        >
          <Settings size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, whiteSpace: 'nowrap' }}>Configurações</span>
        </button>
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        <button onClick={onSwitchToMobile} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px', borderRadius: 10, width: '100%', minHeight: 40,
          border: '1px solid var(--line)',
          background: 'transparent', cursor: 'pointer',
          color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
          Versão Celular
        </button>
      </div>

      <style>{`
        .cds-nav-btn:hover { background: color-mix(in srgb, var(--primary) 8%, transparent) !important; color: var(--ink) !important; }
      `}</style>
    </aside>
  )
}

// ── Desktop Início ────────────────────────────────────────────
function DesktopInicio({ vendas, metas, theme, setTab, produtosData = [], lojaId, plano }) {
  const isDark = theme.primary === '#D4A017'
  const now  = new Date()
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayStr = now.toDateString()

  const vendasMes  = vendas.filter(v => { const d = new Date(v.data); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() })
  const vendasHoje = vendas.filter(v => new Date(v.data).toDateString() === todayStr)
  const totalMes   = vendasMes.reduce((s, v) => s + Number(v.valor), 0)
  const totalHoje  = vendasHoje.reduce((s, v) => s + Number(v.valor), 0)
  const ticket     = vendasMes.length > 0 ? totalMes / vendasMes.length : 0
  const meta       = metas[curYM] || 0
  const pct        = meta > 0 ? Math.min((totalMes / meta) * 100, 100) : 0

  const prodMap = {}
  vendasMes.forEach(v => (v.produtos || []).forEach(p => { prodMap[p.nome] = (prodMap[p.nome] || 0) + 1 }))
  const topProds = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div>
      <AlertaBanner vendas={vendas} metas={metas} produtosData={produtosData} lojaId={lojaId} plano={plano} setTab={setTab} theme={theme} />
      {/* Hero — full width */}
      <HeroCard tone={isDark ? 'dark' : 'primary'} style={{ padding: '36px 40px', marginBottom: 24, borderTop: isDark ? '2px solid #D4A017' : undefined }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(212,160,23,0.7)' : 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
          Total vendido — {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 48, fontWeight: 700, color: isDark ? '#F0C040' : '#fff', lineHeight: 1, marginBottom: 10 }}>
          {fmtR(totalMes)}
        </p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: isDark ? 'rgba(212,160,23,0.7)' : 'rgba(255,255,255,0.68)' }}>
          {vendasMes.length} venda{vendasMes.length !== 1 ? 's' : ''}{' '}
          {meta > 0 ? `· ${pct.toFixed(0)}% da meta (${fmtR(meta)})` : '· sem meta definida'}
        </p>
        {meta > 0 && (
          <div style={{ marginTop: 20, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: isDark ? '#D4A017' : '#fff', width: `${pct}%`, transition: 'width 0.7s' }} />
          </div>
        )}
      </HeroCard>

      {/* KPIs — auto-fit, never cuts values */}
      <StatGrid style={{ marginBottom: 24 }}>
        {[
          { label: 'Hoje',           value: fmtR(totalHoje),  sub: `${vendasHoje.length} vendas` },
          { label: 'Ticket Médio',   value: fmtR(ticket),      sub: 'este mês' },
          { label: 'Vendas no Mês',  value: vendasMes.length,  sub: 'transações' },
        ].map(({ label, value, sub }, i) => (
          <div key={label} style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', borderTop: isDark ? '1px solid #D4A017' : (i === 0 ? '2px solid var(--accent)' : '1px solid var(--line)'), padding: '22px 20px', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>{label}</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{sub}</p>
          </div>
        ))}
      </StatGrid>

      {/* Meta card clicável */}
      <div
        onClick={() => setTab('meta')}
        onMouseEnter={e => e.currentTarget.style.background = '#f4f1ee'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
        style={{
          cursor: 'pointer', background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--line)', padding: '20px 22px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'background .15s',
        }}>
        <div>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Meta Mensal</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>
            {meta > 0 ? `${pct.toFixed(0)}%` : '—'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {meta > 0 ? fmtR(meta) : 'Clique para definir a meta'}
          </p>
          {meta > 0 && (
            <div style={{ marginTop: 10, width: 200, height: 3, borderRadius: 2, background: 'var(--line)' }}>
              <div style={{ height: '100%', borderRadius: 2, background: theme.primary, width: `${pct}%`, transition: 'width 0.7s' }} />
            </div>
          )}
        </div>
        <ChevronRight size={18} color="var(--muted)" />
      </div>

      {/* Top performers */}
      {topProds.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px 28px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 20 }}>Produtos mais vendidos este mês</p>
          <div style={{ display: 'flex', gap: 16 }}>
            {topProds.map(([nome, qtd], i) => (
              <div key={nome} style={{
                flex: 1, background: i === 0 ? `${theme.primary}10` : 'var(--bg)',
                border: `1px solid ${i === 0 ? theme.primary + '25' : 'var(--line)'}`,
                borderRadius: 14, padding: '18px 16px', textAlign: 'center',
              }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: i === 0 ? theme.primary : 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{i + 1}°</span>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 8, marginBottom: 4 }}>{nome}</p>
                <p style={{ fontSize: 13, color: theme.primary, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700 }}>{qtd}×</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Desktop Histórico (table) ─────────────────────────────────
function DesktopHistorico({ vendas, deleteVenda, updateVenda, theme }) {
  const [search,     setSearch]     = useState('')
  const [filtro,     setFiltro]     = useState('todos')
  const [confirmDel, setConfirmDel] = useState(null)
  const [editVenda,  setEditVenda]  = useState(null)
  const [editPgtos,  setEditPgtos]  = useState([])
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'Escape') return
      if (confirmDel) setConfirmDel(null)
      else if (editVenda) setEditVenda(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [confirmDel, editVenda])

  const now = new Date()

  const editTotal = editVenda ? Number(editVenda.valor) : 0
  const editAlloc = editPgtos.reduce((s, p) => s + (parseFloat((String(p.valor) || '0').replace(',', '.')) || 0), 0)
  const editPgtoOk = editVenda && Math.abs(editAlloc - editTotal) < 0.005

  const filtered = vendas.filter(v => {
    const d = new Date(v.data)
    if (filtro === 'hoje')   return d.toDateString() === now.toDateString()
    if (filtro === 'semana') { const c = new Date(now); c.setDate(now.getDate() - 7); return d >= c }
    if (filtro === 'mes')    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    return true
  }).filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (v.cliente_nome || '').toLowerCase().includes(q) ||
      (v.vendedora || '').toLowerCase().includes(q) ||
      fmtPgtos(v).toLowerCase().includes(q)
  })

  const total = filtered.reduce((s, v) => s + Number(v.valor), 0)

  async function confirmDelete() {
    await deleteVenda(confirmDel.id)
    setConfirmDel(null)
  }

  function openEdit(v) {
    setEditPgtos(parsePgtos(v).map(p => ({ ...p, valor: String(p.valor) })))
    setEditVenda(v)
  }

  async function handleSaveEdit() {
    if (!editPgtoOk) return
    setEditSaving(true)
    await updateVenda(editVenda.id, {
      forma_pgto: JSON.stringify(editPgtos.map(p => ({
        forma: p.forma,
        valor: parseFloat((String(p.valor) || '0').replace(',', '.')) || 0,
      }))),
    })
    setEditSaving(false)
    setEditVenda(null)
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, vendedora, pagamento..."
            style={{ width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 12, paddingLeft: 40, paddingRight: 14, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'hoje',  label: 'Hoje' },
          { id: 'semana',label: '7 dias' },
          { id: 'mes',   label: 'Mês' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)} style={{
            padding: '8px 18px', borderRadius: 99, cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600,
            border: filtro === f.id ? 'none' : '1px solid var(--line)',
            background: filtro === f.id ? theme.primary : 'var(--surface)',
            color: filtro === f.id ? '#fff' : 'var(--muted)',
            boxShadow: filtro === f.id ? `0 2px 8px ${theme.primary}30` : 'none',
          }}>{f.label}</button>
        ))}
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: 4 }}>
          {filtered.length} vendas · <strong style={{ color: theme.primary }}>{fmtR(total)}</strong>
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          <thead>
            <tr style={{ background: theme.primary }}>
              {['Data / Hora', 'Cliente', 'Vendedora', 'Produtos', 'Pagamento', 'Valor', ''].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Nenhuma venda encontrada.</td>
              </tr>
            ) : filtered.map((v, i) => (
              <tr key={v.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDT(v.data)}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{v.cliente_nome || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{v.vendedora || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(v.produtos || []).map(p => p.nome).join(', ') || '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {v.forma_pgto && (
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, background: `${theme.primary}15`, color: theme.primary, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {fmtPgtos(v)}
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: "'Space Mono', monospace", fontSize: 17, fontWeight: 700, color: theme.primary, whiteSpace: 'nowrap' }}>
                  {fmtR(v.valor)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => openEdit(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--line)', padding: 4, display: 'flex', alignItems: 'center', transition: 'color .15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = theme.primary}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--line)'}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setConfirmDel(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--line)', padding: 4, display: 'flex', alignItems: 'center', transition: 'color .15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--line)'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete modal */}
      {confirmDel && (
        <div onClick={() => setConfirmDel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 28px', maxWidth: 380, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', border: '1px solid var(--line)' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>Excluir venda?</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Venda de <strong>{fmtR(confirmDel.valor)}</strong>{confirmDel.cliente_nome ? ` para ${confirmDel.cliente_nome}` : ''}. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>Cancelar</button>
              <button onClick={confirmDelete} style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit payment modal */}
      {editVenda && (
        <div onClick={() => setEditVenda(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 28px', maxWidth: 440, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                Editar Pagamento — {fmtR(editVenda.valor)}
              </p>
              <button onClick={() => setEditVenda(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {editPgtos.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={p.forma}
                    onChange={e => setEditPgtos(prev => prev.map((x, idx) => idx === i ? { ...x, forma: e.target.value } : x))}
                    style={{ height: 44, flex: '2 1 0', minWidth: 0, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 8px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    {PGTOS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', pointerEvents: 'none' }}>R$</span>
                    <input
                      value={p.valor}
                      onChange={e => setEditPgtos(prev => prev.map((x, idx) => idx === i ? { ...x, valor: e.target.value } : x))}
                      placeholder="0,00"
                      style={{ width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 10px 0 30px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  {editPgtos.length > 1 && (
                    <button onClick={() => setEditPgtos(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => setEditPgtos(prev => [...prev, { forma: 'Pix', valor: '' }])}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px dashed var(--line)', background: 'none', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}>
              <Plus size={13} /> Adicionar forma
            </button>

            <div style={{
              marginBottom: 20, padding: '8px 12px', borderRadius: 10,
              background: editPgtoOk ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)',
              border: `1px solid ${editPgtoOk ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600,
              color: editPgtoOk ? '#16a34a' : '#dc2626',
            }}>
              {editPgtoOk
                ? '✓ Valor alocado corretamente'
                : `Alocado: ${fmtR(editAlloc)} · Total: ${fmtR(editTotal)}`
              }
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditVenda(null)}
                style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving || !editPgtoOk}
                style={{
                  flex: 2, height: 46, borderRadius: 12, border: 'none',
                  background: editPgtoOk && !editSaving ? theme.primary : 'var(--line)',
                  cursor: editPgtoOk && !editSaving ? 'pointer' : 'not-allowed',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
                  color: editPgtoOk && !editSaving ? '#fff' : 'var(--muted)', fontSize: 14,
                  boxShadow: editPgtoOk && !editSaving ? `0 4px 16px ${theme.primary}40` : 'none',
                }}>
                {editSaving ? 'Salvando...' : 'Salvar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Desktop Nova Venda (2 colunas) ────────────────────────────
const EMPTY_VENDA = { nome: '', tel: '', produtos: [], valor: '', pagamentos: [{ forma: 'Pix', valor: '' }], obs: '', vendedora: '', fornecedor: '', nome_loja: '', cidade_estado: '', forma_envio: '' }

function DesktopNovaVenda({ produtos, produtosData = [], addVenda, addProduto, features = {}, theme, fornecedores = [], clientes = [] }) {
  const isDark = theme.primary === '#D4A017'
  const [form,       setForm]       = useState(() => ({
    ...EMPTY_VENDA,
    pagamentos: [{ forma: features?.atacado ? 'PIX Santander' : 'Pix', valor: '' }],
  }))
  const [newProd,    setNewProd]    = useState('')
  const [addingProd, setAddingProd] = useState(false)
  const [done,       setDone]       = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [varModal,   setVarModal]   = useState(null)
  const [ajusteTipo,  setAjusteTipo]  = useState('desconto')
  const [ajusteModo,  setAjusteModo]  = useState('valor')
  const [ajusteInput, setAjusteInput] = useState('')
  const [fornOpen, setFornOpen] = useState(false)
  const [cliNomeOpen, setCliNomeOpen] = useState(false)
  const [cliTelOpen, setCliTelOpen] = useState(false)

  const normTelFn = t => (t || '').replace(/[\s\-(). ]/g, '')
  const fornMatches = fornecedores.filter(f =>
    form.fornecedor.trim() === '' || f.nome.toLowerCase().includes(form.fornecedor.toLowerCase())
  ).slice(0, 8)
  const cliNomeMatches = clientes.filter(c =>
    form.nome.trim() === '' || c.nome.toLowerCase().includes(form.nome.toLowerCase())
  ).slice(0, 8)
  const cliTelMatches = clientes.filter(c =>
    form.tel.trim() === '' || (c.telefone && normTelFn(c.telefone).includes(normTelFn(form.tel)))
  ).slice(0, 8)

  useEffect(() => {
    const sub = calcularTotalVenda(form.produtos, produtosData)
    const ajNum = parseFloat(ajusteInput.replace(',', '.')) || 0
    const total = form.produtos.length === 0 ? 0 : calcularTotalComAjuste(sub, ajusteTipo, ajusteModo, ajNum)
    const valStr = form.produtos.length === 0 ? '' : total.toFixed(2).replace('.', ',')
    setForm(prev => ({
      ...prev,
      valor: valStr,
      pagamentos: prev.pagamentos.length === 1
        ? [{ ...prev.pagamentos[0], valor: valStr }]
        : prev.pagamentos,
    }))
  // produtosData excluído intencionalmente — não muda no meio de uma venda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.produtos, ajusteTipo, ajusteModo, ajusteInput])

  function getVarLabel(v) {
    const k = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
    return k ? String(v[k]) : null
  }
  function toggleProd(nome) {
    const exists = form.produtos.find(p => p.nome === nome && !p.variacao)
    setForm({ ...form, produtos: exists ? form.produtos.filter(p => !(p.nome === nome && !p.variacao)) : [...form.produtos, { nome, obs: '', quantidade: 1 }] })
  }
  function setProdObs(nome, obs) {
    setForm({ ...form, produtos: form.produtos.map(p => p.nome === nome ? { ...p, obs } : p) })
  }
  async function handleAddProd() {
    if (!newProd.trim()) return
    await addProduto(newProd.trim())
    setNewProd('')
    setAddingProd(false)
  }
  function handleValorChange(val) {
    setForm(prev => ({
      ...prev, valor: val,
      pagamentos: prev.pagamentos.length === 1 ? [{ ...prev.pagamentos[0], valor: val }] : prev.pagamentos,
    }))
  }
  function addPgto() {
    setForm(prev => ({ ...prev, pagamentos: [...prev.pagamentos, { forma: features?.atacado ? 'PIX Santander' : 'Pix', valor: '' }] }))
  }
  function removePgto(idx) {
    setForm(prev => ({ ...prev, pagamentos: prev.pagamentos.filter((_, i) => i !== idx) }))
  }
  function setPgto(idx, field, val) {
    setForm(prev => ({ ...prev, pagamentos: prev.pagamentos.map((p, i) => i === idx ? { ...p, [field]: val } : p) }))
  }
  async function handleSave() {
    setSaving(true)
    const ajNum = parseFloat(ajusteInput.replace(',', '.')) || 0
    const sub = calcularTotalVenda(form.produtos, produtosData)
    const ajusteR = ajNum === 0 ? 0
      : ajusteModo === 'percentual' ? sub * (ajNum / 100) : ajNum
    const ajusteValor = ajNum === 0 ? 0
      : ajusteTipo === 'desconto' ? -ajusteR : ajusteR
    const err = await addVenda({
      cliente_nome: form.nome || null,
      cliente_tel:  form.tel  || null,
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      ajuste_valor: ajusteValor,
      forma_pgto: JSON.stringify(form.pagamentos.map(p => ({
        forma: p.forma,
        valor: parseFloat((p.valor || '0').replace(',', '.')) || 0,
        ...(p.forma === 'Boleto' && p.vencimento ? { vencimento: p.vencimento } : {}),
      }))),
      obs: form.obs || null,
      produtos: form.produtos,
      vendedora: form.vendedora || null,
      fornecedor: form.fornecedor.trim() || null,
      data: new Date().toISOString(),
      ...(features?.atacado ? {
        nome_loja: form.nome_loja || null,
        cidade_estado: form.cidade_estado || null,
        forma_envio: form.forma_envio || null,
      } : {}),
    })
    setSaving(false)
    if (!err) {
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setForm({ ...EMPTY_VENDA, pagamentos: [{ forma: features?.atacado ? 'PIX Santander' : 'Pix', valor: '' }] })
        setAjusteTipo('desconto')
        setAjusteModo('valor')
        setAjusteInput('')
      }, 2200)
    }
  }
  const totalValor = parseFloat((form.valor || '0').replace(',', '.')) || 0
  const alocado = form.pagamentos.reduce((s, p) => s + (parseFloat((p.valor || '0').replace(',', '.')) || 0), 0)
  const pgtoOpts = features?.atacado
    ? ['PIX Santander', 'PIX Banco do Brasil', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto']
    : PGTOS
  const pgtoOk = form.valor.trim() !== '' && form.pagamentos.length > 0 && Math.abs(alocado - totalValor) < 0.005
    && form.pagamentos.every(p => p.forma !== 'Boleto' || !!p.vencimento)

  const subtotal = calcularTotalVenda(form.produtos, produtosData)
  const ajusteNum = parseFloat(ajusteInput.replace(',', '.')) || 0
  const ajusteR = ajusteNum === 0 ? 0
    : ajusteModo === 'percentual' ? subtotal * (ajusteNum / 100) : ajusteNum

  const inputS = inp(theme.primary)
  const fo = onF(theme.primary)

  if (done) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Check size={26} color="#fff" strokeWidth={2.5} />
        </div>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Venda registrada!</p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--muted)' }}>Salva com sucesso no histórico.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: Cliente + Pagamento */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 18 }}>Dados da Cliente</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <label style={lbl}><User size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Nome</label>
              <input
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                onFocus={e => { setCliNomeOpen(true); fo(e) }}
                onBlur={e => { setTimeout(() => setCliNomeOpen(false), 160); onB(e) }}
                placeholder="Maria Silva"
                style={inputS}
                autoComplete="off"
              />
              {cliNomeOpen && cliNomeMatches.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                  background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 12,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.10)', overflow: 'hidden',
                }}>
                  {cliNomeMatches.map(c => (
                    <button key={c.id} type="button"
                      onMouseDown={() => { setForm(prev => ({ ...prev, nome: c.nome, tel: c.telefone || prev.tel })); setCliNomeOpen(false) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                        borderBottom: '1px solid var(--line)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${theme.primary}14` }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{c.nome}</div>
                      {c.telefone && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{c.telefone}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <label style={lbl}><Phone size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Telefone</label>
              <input
                value={form.tel}
                onChange={e => setForm({ ...form, tel: e.target.value })}
                onFocus={e => { setCliTelOpen(true); fo(e) }}
                onBlur={e => { setTimeout(() => setCliTelOpen(false), 160); onB(e) }}
                placeholder="(85) 99999-0000"
                style={inputS}
                autoComplete="off"
              />
              {cliTelOpen && cliTelMatches.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                  background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 12,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.10)', overflow: 'hidden',
                }}>
                  {cliTelMatches.map(c => (
                    <button key={c.id} type="button"
                      onMouseDown={() => { setForm(prev => ({ ...prev, nome: c.nome || prev.nome, tel: c.telefone || '' })); setCliTelOpen(false) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                        borderBottom: '1px solid var(--line)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${theme.primary}14` }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{c.nome}</div>
                      {c.telefone && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{c.telefone}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={lbl}>Vendedora</label>
              <input value={form.vendedora} onChange={e => setForm({ ...form, vendedora: e.target.value })} placeholder="Quem realizou a venda" style={inputS} onFocus={fo} onBlur={onB} />
            </div>
            <div style={{ position: 'relative' }}>
              <label style={lbl}><Building2 size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Fornecedor</label>
              <input
                value={form.fornecedor}
                onChange={e => setForm({ ...form, fornecedor: e.target.value })}
                onFocus={e => { setFornOpen(true); fo(e) }}
                onBlur={e => { setTimeout(() => setFornOpen(false), 160); onB(e) }}
                placeholder="Selecione ou digite um novo fornecedor"
                style={inputS}
                autoComplete="off"
              />
              {fornOpen && fornMatches.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                  background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 12,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.10)', overflow: 'hidden',
                }}>
                  {fornMatches.map(f => (
                    <button key={f.id} type="button"
                      onMouseDown={() => { setForm(prev => ({ ...prev, fornecedor: f.nome })); setFornOpen(false) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)',
                        borderBottom: '1px solid var(--line)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${theme.primary}14` }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >{f.nome}</button>
                  ))}
                </div>
              )}
            </div>
            {features?.atacado && (<>
              <div>
                <label style={lbl}>Nome da Loja</label>
                <input value={form.nome_loja} onChange={e => setForm({ ...form, nome_loja: e.target.value })} placeholder="Ex: Boutique da Maria" style={inputS} onFocus={fo} onBlur={onB} />
              </div>
              <div>
                <label style={lbl}>Cidade / Estado</label>
                <input value={form.cidade_estado} onChange={e => setForm({ ...form, cidade_estado: e.target.value })} placeholder="Ex: Fortaleza / CE" style={inputS} onFocus={fo} onBlur={onB} />
              </div>
              <div>
                <label style={lbl}>Forma de Envio</label>
                <input value={form.forma_envio} onChange={e => setForm({ ...form, forma_envio: e.target.value })} placeholder="Ex: Transportadora, Motoboy, Retirada" style={inputS} onFocus={fo} onBlur={onB} />
              </div>
            </>)}
            <div>
              <label style={lbl}>Observações</label>
              <input value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} placeholder="Anotações sobre esta venda..." style={inputS} onFocus={fo} onBlur={onB} />
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 18 }}>Pagamento</p>
          <div>
            {/* Breakdown: Subtotal / Ajuste / Total */}
            {form.produtos.length > 0 && (
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>Subtotal</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: 'var(--ink-soft)' }}>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                {ajusteNum > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: ajusteTipo === 'desconto' ? '#dc2626' : '#16a34a' }}>
                      {ajusteTipo === 'desconto' ? '− Desconto' : '+ Acréscimo'}
                      {ajusteModo === 'percentual' ? ` (${ajusteInput}%)` : ''}
                    </span>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: ajusteTipo === 'desconto' ? '#dc2626' : '#16a34a' }}>
                      {ajusteTipo === 'desconto' ? '−' : '+'} R$ {ajusteR.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Total</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: theme.primary }}>R$ {totalValor.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            )}

            {/* Ajuste: Desconto ou Acréscimo (opcional) */}
            {form.produtos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <label style={lbl}>Ajuste (opcional)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['desconto', 'Desconto'], ['acrescimo', 'Acréscimo']].map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setAjusteTipo(val)} style={{
                      flex: 1, height: 34, borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700,
                      border: ajusteTipo === val ? 'none' : '1.5px solid var(--line)',
                      background: ajusteTipo === val ? (val === 'desconto' ? '#dc2626' : '#16a34a') : 'var(--bg)',
                      color: ajusteTipo === val ? '#fff' : 'var(--muted)',
                    }}>{label}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--line)', flexShrink: 0 }}>
                    {[['valor', 'R$'], ['percentual', '%']].map(([val, label]) => (
                      <button key={val} type="button" onClick={() => setAjusteModo(val)} style={{
                        padding: '0 14px', height: 44, cursor: 'pointer', border: 'none',
                        fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
                        background: ajusteModo === val ? theme.primary : 'var(--bg)',
                        color: ajusteModo === val ? '#fff' : 'var(--muted)',
                      }}>{label}</button>
                    ))}
                  </div>
                  <input
                    value={ajusteInput}
                    onChange={e => setAjusteInput(e.target.value)}
                    placeholder="0,00"
                    style={{ ...inputS, flex: 1 }}
                    onFocus={fo} onBlur={onB}
                  />
                </div>
              </div>
            )}

            <label style={lbl}><CreditCard size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Valor (R$)</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>R$</span>
              <input value={form.valor} onChange={e => handleValorChange(e.target.value)} placeholder="0,00"
                style={{ ...inputS, paddingLeft: 36, fontSize: 20, fontWeight: 700 }} onFocus={fo} onBlur={onB} />
            </div>
            <label style={lbl}>Formas de Pagamento</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.pagamentos.map((p, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={p.forma}
                    onChange={e => {
                      const f = e.target.value
                      setForm(prev => ({ ...prev, pagamentos: prev.pagamentos.map((x, idx) => idx === i ? { ...x, forma: f, ...(f !== 'Boleto' ? { vencimento: undefined } : {}) } : x) }))
                    }}
                    style={{ height: 42, flex: '2 1 0', minWidth: 0, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 8px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {pgtoOpts.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', pointerEvents: 'none' }}>R$</span>
                    <input value={p.valor} onChange={e => setPgto(i, 'valor', e.target.value)} placeholder="0,00"
                      style={{ width: '100%', height: 42, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 10px 0 28px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={onF(theme.primary)} onBlur={onB} />
                  </div>
                  {form.pagamentos.length > 1 && (
                    <button onClick={() => removePgto(i)} style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                  </div>
                  {p.forma === 'Boleto' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 2 }}>
                      {[15, 30, 45, 60].map(dias => (
                        <button key={dias} type="button" onClick={() => setPgto(i, 'vencimento', dias)} style={{
                          padding: '4px 12px', borderRadius: 8, cursor: 'pointer',
                          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600,
                          border: p.vencimento === dias ? 'none' : '1px solid var(--line)',
                          background: p.vencimento === dias ? theme.primary : 'var(--bg)',
                          color: p.vencimento === dias ? '#fff' : 'var(--muted)',
                        }}>{dias} dias</button>
                      ))}
                      {!p.vencimento && <span style={{ fontSize: 11, color: '#dc2626', fontFamily: 'Plus Jakarta Sans, sans-serif', alignSelf: 'center' }}>Selecione o vencimento</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addPgto}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '5px 12px', borderRadius: 8, border: '1px dashed var(--line)', background: 'none', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
              <Plus size={13} /> Adicionar forma
            </button>
            {form.valor && (
              <div style={{ marginTop: 10, padding: '7px 12px', borderRadius: 10, background: pgtoOk ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${pgtoOk ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: pgtoOk ? '#16a34a' : '#dc2626' }}>
                {pgtoOk ? '✓ Pagamento completo' : `Alocado: R$ ${alocado.toFixed(2).replace('.', ',')} · Total: R$ ${totalValor.toFixed(2).replace('.', ',')}`}
              </div>
            )}
          </div>
          <button type="button" disabled={saving || !pgtoOk} onClick={handleSave}
            style={{ width: '100%', height: 50, marginTop: 20, border: 'none', borderRadius: 'var(--r-input)',
              cursor: saving || !pgtoOk ? 'not-allowed' : 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700,
              background: saving || !pgtoOk ? 'var(--line)' : isDark ? 'linear-gradient(135deg, #D4A017, #F0C040)' : 'var(--primary)',
              color: saving || !pgtoOk ? 'var(--muted)' : isDark ? '#0A0A0A' : '#fff',
              boxShadow: saving || !pgtoOk ? 'none' : isDark ? '0 4px 16px rgba(212,160,23,0.4)' : 'var(--shadow-btn-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'filter .15s',
            }}
            onMouseEnter={e => { if (!saving && pgtoOk) e.currentTarget.style.filter = 'brightness(0.94)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
          >
            {saving ? 'Salvando...' : 'Confirmar Venda'} {!saving && <Check size={16} />}
          </button>
        </div>
      </div>

      {/* Right: Produtos */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>Produtos</p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{form.produtos.length > 0 ? `${form.produtos.length} selecionado(s)` : 'Selecione os produtos'}</p>
          </div>
          <button type="button" onClick={() => setAddingProd(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
            <ShoppingBag size={13} /> Novo produto
          </button>
        </div>

        {addingProd && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={newProd} onChange={e => setNewProd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddProd()}
              placeholder="Nome do produto..." autoFocus style={{ ...inputS, flex: 1 }} onFocus={fo} onBlur={onB} />
            <button type="button" onClick={handleAddProd} style={{ padding: '0 16px', borderRadius: 12, background: theme.primary, border: 'none', color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>OK</button>
            <button type="button" onClick={() => { setAddingProd(false); setNewProd('') }} style={{ padding: '0 12px', borderRadius: 12, border: '1px solid var(--line)', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={15} /></button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 420, overflowY: 'auto' }}>
          {produtos.map(nome => {
            const pd = produtosData.find(p => p.nome === nome)
            const vars = (pd?.variacoes || []).map(v => {
              const label = getVarLabel(v)
              return label ? { label, qty: Number(v.quantidade || 0) } : null
            }).filter(Boolean)
            const hasVars = vars.length > 0
            const selItems = form.produtos.filter(p => p.nome === nome)
            const selCount = selItems.reduce((s, p) => s + (p.quantidade || 1), 0)
            const isOpen = varModal === nome
            return (
              <div key={nome} style={{ marginBottom: 6 }}>
                {/* Produto item — div em vez de button para evitar Tailwind Preflight color:inherit */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => hasVars ? setVarModal(prev => prev === nome ? null : nome) : toggleProd(nome)}
                  onKeyDown={e => e.key === 'Enter' && (hasVars ? setVarModal(prev => prev === nome ? null : nome) : toggleProd(nome))}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: isOpen ? '10px 10px 0 0' : 10,
                    border: selCount > 0
                      ? (isDark ? '1.5px solid #D4A017' : `1.5px solid ${theme.primary}`)
                      : (isDark ? '1px solid #3a3a3a' : '1px solid #EDE2DA'),
                    background: selCount > 0
                      ? (isDark ? '#2a1f00' : `${theme.primary}18`)
                      : (isDark ? '#1a1a1a' : '#FFFFFF'),
                    color: isDark ? '#D4A017' : (selCount > 0 ? theme.primary : '#1a1a1a'),
                    fontSize: 14, fontFamily: 'Plus Jakarta Sans, sans-serif',
                    cursor: 'pointer', userSelect: 'none',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: selCount > 0 ? (isDark ? '#D4A017' : theme.primary) : 'transparent',
                      border: selCount > 0 ? 'none' : (isDark ? '1.5px solid #3a3a3a' : '1.5px solid #EDE2DA'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selCount > 0 && <Check size={12} color={isDark ? '#1a1a1a' : '#fff'} strokeWidth={2.5} />}
                    </div>
                    <span style={{ fontWeight: selCount > 0 ? 600 : 400 }}>{nome}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!hasVars && selCount > 0 ? (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        borderRadius: 8, overflow: 'hidden', userSelect: 'none',
                        border: `1.5px solid ${theme.primary}`, background: theme.primary,
                      }}>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (selCount <= 1) {
                              setForm(f => ({ ...f, produtos: f.produtos.filter(p => !(p.nome === nome && !p.variacao)) }))
                            } else {
                              setForm(f => ({ ...f, produtos: f.produtos.map(p => p.nome === nome && !p.variacao ? { ...p, quantidade: (p.quantidade || 1) - 1 } : p) }))
                            }
                          }}
                          style={{ padding: '3px 8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1 }}
                        >−</button>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', padding: '0 2px' }}>{selCount}×</span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setForm(f => ({ ...f, produtos: f.produtos.map(p => p.nome === nome && !p.variacao ? { ...p, quantidade: (p.quantidade || 1) + 1 } : p) }))
                          }}
                          style={{ padding: '3px 8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1 }}
                        >+</button>
                      </div>
                    ) : hasVars && selCount > 0 ? (
                      <span style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 99,
                        background: isDark ? '#D4A01730' : `${theme.primary}20`,
                        color: isDark ? '#D4A017' : theme.primary, fontWeight: 700,
                      }}>{selCount}×</span>
                    ) : null}
                    {hasVars && (
                      <ChevronDown size={14} color={isDark ? '#D4A017' : '#9C8580'}
                        style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s' }} />
                    )}
                  </div>
                </div>

                {/* Picker de variações */}
                {hasVars && isOpen && (
                  <div style={{
                    padding: '10px 14px 12px',
                    borderLeft: isDark ? '1px solid #3a3a3a' : '1px solid #EDE2DA',
                    borderRight: isDark ? '1px solid #3a3a3a' : '1px solid #EDE2DA',
                    borderBottom: isDark ? '1px solid #3a3a3a' : '1px solid #EDE2DA',
                    borderRadius: '0 0 10px 10px',
                    background: isDark ? '#111110' : '#F6EFE8',
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: isDark ? '#A07830' : '#9C8580', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Variações disponíveis</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {vars.map(({ label, qty }, idx) => {
                        const isSel = form.produtos.some(p => p.nome === nome && p.variacao === label)
                        const selQty = isSel ? (form.produtos.find(p => p.nome === nome && p.variacao === label)?.quantidade || 1) : 0
                        const esgotado = qty === 0 && !isSel
                        if (isSel) {
                          return (
                            <div key={idx} style={{
                              display: 'inline-flex', alignItems: 'center',
                              borderRadius: 8, overflow: 'hidden', userSelect: 'none',
                              border: `1.5px solid ${theme.primary}`, background: theme.primary,
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                            }}>
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  if (selQty <= 1) {
                                    setForm(f => ({ ...f, produtos: f.produtos.filter(p => !(p.nome === nome && p.variacao === label)) }))
                                  } else {
                                    setForm(f => ({ ...f, produtos: f.produtos.map(p => p.nome === nome && p.variacao === label ? { ...p, quantidade: p.quantidade - 1 } : p) }))
                                  }
                                }}
                                style={{ padding: '5px 9px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1 }}
                              >−</button>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', padding: '0 2px' }}>
                                {label} · {selQty}{selQty >= qty ? `/${qty}` : ''}
                              </span>
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  if (selQty < qty) {
                                    setForm(f => ({ ...f, produtos: f.produtos.map(p => p.nome === nome && p.variacao === label ? { ...p, quantidade: p.quantidade + 1 } : p) }))
                                  }
                                }}
                                title={selQty >= qty ? `Apenas ${qty} em estoque` : undefined}
                                style={{ padding: '5px 9px', background: 'transparent', border: 'none', cursor: selQty >= qty ? 'not-allowed' : 'pointer', color: selQty >= qty ? 'rgba(255,255,255,0.45)' : '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1 }}
                              >+</button>
                            </div>
                          )
                        }
                        return (
                          <div key={idx} role="button" tabIndex={0}
                            onClick={() => { if (!esgotado) setForm(f => ({ ...f, produtos: [...f.produtos, { nome, variacao: label, obs: label, quantidade: 1 }] })) }}
                            onKeyDown={e => { if (e.key === 'Enter' && !esgotado) setForm(f => ({ ...f, produtos: [...f.produtos, { nome, variacao: label, obs: label, quantidade: 1 }] })) }}
                            style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: '5px 12px', borderRadius: 8,
                              cursor: esgotado ? 'not-allowed' : 'pointer',
                              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600,
                              userSelect: 'none', opacity: esgotado ? 0.5 : 1,
                              border: isDark ? '1px solid #3a3a3a' : '1px solid #EDE2DA',
                              background: isDark ? '#1a1a1a' : '#FFFFFF',
                              color: isDark ? '#D4A017' : '#1a1a1a',
                            }}>
                            {label}
                            <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 400, color: isDark ? '#A07830' : '#9C8580' }}>
                              {qty === 0 ? '(esgotado)' : `(${qty})`}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Campo obs para produtos sem variação */}
                {!hasVars && selCount > 0 && (
                  <div style={{ paddingTop: 6 }}>
                    <input value={selItems[0]?.obs || ''} onChange={e => setProdObs(nome, e.target.value)}
                      placeholder="Obs: cor, tamanho..." style={{ ...inputS, height: 36, fontSize: 13 }} onFocus={fo} onBlur={onB} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {form.produtos.length > 0 && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: isDark ? '#050504' : '#F6EFE8', borderRadius: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: isDark ? '#A07830' : '#9C8580', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Selecionados</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {form.produtos.map((p, i) => (
                <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 8, background: isDark ? '#1C1A14' : '#FFFFFF', border: `1px solid ${isDark ? 'rgba(212,160,23,0.25)' : '#EDE2DA'}`, color: isDark ? '#D4A017' : '#2A1F1F', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {p.nome}{p.variacao ? ` — ${p.variacao}` : p.obs ? ` — ${p.obs}` : ''}{(p.quantidade || 1) > 1 ? ` ×${p.quantidade || 1}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ── Desktop Relatórios ────────────────────────────────────────
function DesktopRelatorios({ data, theme, temAcessoPro }) {
  return (
    <RelatoriosDesktop
      vendas={data.vendas}
      deleteVenda={data.deleteVenda}
      updateVenda={data.updateVenda}
      theme={theme}
      temAcessoPro={temAcessoPro}
    />
  )
}

// ── Catálogo B2B como módulo dentro do dashboard completo ─────
function CatalogoB2BModuloDesktop({ data, theme, lojaId, nivel }) {
  const [subTab, setSubTab] = useState('produtos')
  const primary = theme.primary
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'produtos', label: 'Produtos' },
          { id: 'pedidos',  label: 'Pedidos'  },
        ].map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)} style={{
            padding: '10px 24px', borderRadius: 12, cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
            border: subTab === st.id ? 'none' : '1px solid var(--line)',
            background: subTab === st.id ? primary : 'var(--surface)',
            color: subTab === st.id ? '#fff' : 'var(--muted)',
            boxShadow: subTab === st.id ? `0 2px 8px ${primary}30` : 'none',
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

// ── Main export ───────────────────────────────────────────────
export default function ClientDashboardDesktop({ data, theme, onSwitchToMobile }) {
  const [tab, setTab] = useState('inicio')

  const catalogoB2BNivel = data?.config?.features?.catalogo_b2b
  if ((catalogoB2BNivel === 'simples' || catalogoB2BNivel === 'pro') && data?.config?.features?.apenas_catalogo_b2b === true) {
    return (
      <CatalogoB2BAdminDesktop
        data={data}
        theme={theme}
        lojaId={data.LOJA_ID}
        nivel={catalogoB2BNivel}
        onSwitchToMobile={onSwitchToMobile}
      />
    )
  }

  const isDark = theme.isDark || theme.primary === '#D4A017'
  const contentVars = {
    '--primary': theme.primary,
    ...(isDark ? {
      '--bg': '#0A0A0A',
      '--surface': '#0F0E0C',
      '--line': 'rgba(212,160,23,0.18)',
      '--ink': '#D4A017',
      '--ink-soft': '#A07830',
      '--muted': '#A07830',
      '--rose-deep': '#F0C040',
      '--rose': '#D4A017',
    } : {}),
  }

  // logo_url from DB, fallback to static public file /logos/{lojaId}.svg
  const effectiveLogo = data.config?.logo_url || (data.LOJA_ID ? `/logos/${data.LOJA_ID}.svg` : null)
  const plano = data.config?.plano || 'starter'
  const legado = isLegado(data.config?.features || data.features)

  const panels = {
    inicio: data.produtosData.length === 0
      ? <WelcomeOnboarding theme={theme} storeName={theme.nome} onCadastrarManualmente={() => setTab('estoque')} importarProdutos={data.importarProdutos} />
      : <DesktopInicio vendas={data.vendas} metas={data.metas} theme={theme} setTab={setTab} produtosData={data.produtosData} lojaId={data.LOJA_ID} plano={plano} />,
    venda:      <DesktopNovaVenda {...data} theme={theme} />,
    estoque:    <EstoqueMobile produtosData={data.produtosData} updateVariacoes={data.updateVariacoes} addProduto={data.addProduto} updateProduto={data.updateProduto} features={data.features} theme={theme} LOJA_ID={data.LOJA_ID} fetchAll={data.fetchAll} fornecedores={data.fornecedores} />,
    relatorios: <DesktopRelatorios data={data} theme={theme} temAcessoPro={temAcesso(plano, 'pro')} />,
    crediario: legado
      ? <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Funcionalidade não disponível neste plano</div>
      : (temAcesso(plano, 'pro')
          ? <Crediario crediario={data.crediario || []} addCrediario={data.addCrediario} pagarParcela={data.pagarParcela} theme={theme} lojaId={data.LOJA_ID} />
          : <UpgradeWall planoAtual={plano} planoNecessario="pro" funcionalidade="crediario" theme={theme} onVoltar={() => setTab('inicio')} />),
    meta: (legado || temAcesso(plano, 'pro'))
      ? <Meta {...data} theme={theme} />
      : <UpgradeWall planoAtual={plano} planoNecessario="pro" funcionalidade="meta" theme={theme} onVoltar={() => setTab('inicio')} />,
    clientes: (legado || temAcesso(plano, 'starter'))
      ? <Clientes clientes={data.clientes || []} vendas={data.vendas} addCliente={data.addCliente} updateCliente={data.updateCliente} deleteCliente={data.deleteCliente} theme={theme} lojaId={data.LOJA_ID} />
      : <UpgradeWall planoAtual={plano} planoNecessario="starter" funcionalidade="clientes" theme={theme} onVoltar={() => setTab('inicio')} />,
    catalogo: temAcesso(plano, 'business')
      ? <PedidosCatalogo pedidos={data.pedidos || []} updatePedido={data.updatePedido} theme={theme} lojaId={data.LOJA_ID} />
      : <UpgradeWall planoAtual={plano} planoNecessario="business" funcionalidade="catalogo" theme={theme} onVoltar={() => setTab('inicio')} />,
    financeiro: temAcesso(plano, 'business')
      ? <FinanceiroDesktop data={data} theme={theme} />
      : <UpgradeWall planoAtual={plano} planoNecessario="business" funcionalidade="financeiro" theme={theme} onVoltar={() => setTab('inicio')} />,
    conta:        <Fechamento       {...data} theme={theme} />,
    config:       <LojaConfig       {...data} theme={theme} />,
    contas_pagar: data.features?.atacado
      ? <ContasPagar produtosData={data.produtosData} updateProduto={data.updateProduto} theme={theme} lojaId={data.LOJA_ID} />
      : null,
    fornecedores: temAcesso(plano, 'starter')
      ? <Fornecedores {...data} theme={theme} lojaId={data.LOJA_ID} />
      : <UpgradeWall planoAtual={plano} planoNecessario="starter" funcionalidade="fornecedores" theme={theme} onVoltar={() => setTab('inicio')} />,
    catalogo_b2b: catalogoB2BNivel
      ? <CatalogoB2BModuloDesktop data={data} theme={theme} lojaId={data.LOJA_ID} nivel={catalogoB2BNivel} />
      : null,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)', fontFamily: 'Plus Jakarta Sans, sans-serif', ...contentVars }}>
      <DesktopSidebar tab={tab} setTab={setTab} theme={theme} config={data.config} logoUrl={effectiveLogo} plano={plano} legado={legado} onSwitchToMobile={onSwitchToMobile} />
      <div style={{ marginLeft: 250, flex: 1, padding: '32px 40px', minHeight: '100dvh', boxSizing: 'border-box', minWidth: 0 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          {panels[tab]}
        </div>
      </div>
    </div>
  )
}
