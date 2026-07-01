import { useState } from 'react'
import {
  Home, Plus, Wallet, Settings, BarChart2,
  Trash2, Search, Check, ChevronRight, ChevronDown, X, Pencil,
  User, Phone, CreditCard, ShoppingBag, Lock, Package, Users, FileText, Target, Receipt,
} from 'lucide-react'
import { temAcesso, PLANOS, isLegado } from '../../utils/planos'
import UpgradeWall from '../../components/UpgradeWall'
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
import PedidosCatalogo from '../LojaFeminina/PedidosCatalogo'
import FinanceiroDesktop from './FinanceiroDesktop'

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
  { divider: true },
  { id: 'config',     label: 'Configurações', Icon: Settings  },
]

const PGTOS = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito']

// ── Shared input style ───────────────────────────────────────
const inp = (primary) => ({
  width: '100%', height: 44, boxSizing: 'border-box',
  background: 'var(--bg)', border: '1.5px solid var(--line)',
  borderRadius: 12, padding: '0 14px',
  fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--ink)', outline: 'none',
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
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 7, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Manrope, sans-serif' }

const PLANO_NAV_ITEMS = [
  { id: 'clientes',  label: 'Clientes',        Icon: Users,       planoMinimo: 'starter'  },
  { id: 'meta',      label: 'Metas',            Icon: Target,      planoMinimo: 'pro'      },
  { id: 'crediario', label: 'Crediário',        Icon: Receipt,     planoMinimo: 'pro'      },
  { id: 'catalogo',  label: 'Catálogo online',  Icon: ShoppingBag, planoMinimo: 'business' },
  { id: 'financeiro',label: 'Financeiro',       Icon: CreditCard,  planoMinimo: 'business' },
]

const PLANO_BADGE_DESKTOP = {
  pro:      { bg: '#dbeafe', color: '#1d4ed8', label: 'Pro' },
  business: { bg: '#ede9fe', color: '#6d28d9', label: 'Business' },
}

// ── Sidebar (mini 56px → hover 196px) ────────────────────────
function DesktopSidebar({ tab, setTab, theme, config, logoUrl, plano, legado, onSwitchToMobile }) {
  const [open, setOpen] = useState(false)
  const primary = config?.cor_primaria || theme.primary

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'fixed', left: 0, top: 0,
        width: open ? 196 : 56, height: '100dvh',
        background: '#F8F7F5',
        display: 'flex', flexDirection: 'column',
        zIndex: 50, fontFamily: 'Manrope, sans-serif',
        borderRight: '1px solid #e8e4df',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div style={{
        padding: open ? '18px 14px 16px' : '12px 0',
        borderBottom: '1px solid #e8e4df',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        minHeight: 64, flexShrink: 0,
      }}>
        <svg width="32" height="32" viewBox="18 21 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect x="20" y="55" width="60" height="28" rx="14" fill="#5E2BD0" />
          <circle cx="40" cy="37" r="14" fill="#341780" />
          <circle cx="64" cy="39" r="14" fill="#FF6F5E" />
        </svg>
        {open && logoUrl && (
          <>
            <div style={{ width: 1, height: 22, background: '#ddd', flexShrink: 0 }} />
            <div style={{ background: 'var(--surface)', borderRadius: 7, padding: 2, flexShrink: 0, border: '1px solid var(--line)' }}>
              <img src={logoUrl} alt={config?.nome || 'Loja'}
                style={{ height: 28, width: 'auto', maxWidth: 76, objectFit: 'contain', display: 'block' }} />
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: open ? '12px 10px' : '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV.map((item, i) => {
          if (item.divider) return <div key={`div-${i}`} style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
          const { id, label, Icon, locked: lockedProp } = item
          const isLocked = lockedProp && !config?.features?.crm
          const active = tab === id
          return (
            <button key={id}
              onClick={isLocked ? undefined : () => setTab(id)}
              className={isLocked ? '' : 'cds-nav-btn'}
              title={!open ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: open ? 10 : 0,
                justifyContent: open ? 'flex-start' : 'center',
                padding: open ? '10px 12px 10px 10px' : '10px 0',
                borderRadius: 10, width: '100%',
                background: active ? 'var(--surface)' : 'transparent',
                border: active ? '1px solid var(--line)' : '1px solid transparent',
                borderLeft: `3px solid ${active ? primary : 'transparent'}`,
                cursor: isLocked ? 'default' : 'pointer', textAlign: 'left',
                color: isLocked ? 'var(--muted)' : (active ? 'var(--ink)' : 'var(--ink-soft)'),
                fontSize: 14, fontWeight: active ? 600 : 400,
                fontFamily: 'Manrope, sans-serif', transition: 'all .15s',
              }}>
              <Icon size={16} style={{ flexShrink: 0, opacity: isLocked ? 0.4 : 1 }} />
              {open && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>}
              {open && isLocked && <Lock size={11} style={{ flexShrink: 0, opacity: 0.4 }} />}
            </button>
          )
        })}
        {config?.features?.atacado && (
          <button
            onClick={() => setTab('contas_pagar')}
            className={tab === 'contas_pagar' ? '' : 'cds-nav-btn'}
            title={!open ? 'Contas a Pagar' : undefined}
            style={{
              display: 'flex', alignItems: 'center',
              gap: open ? 10 : 0,
              justifyContent: open ? 'flex-start' : 'center',
              padding: open ? '10px 12px 10px 10px' : '10px 0',
              borderRadius: 10, width: '100%',
              background: tab === 'contas_pagar' ? '#FDEEE8' : 'transparent',
              border: tab === 'contas_pagar' ? '1px solid #F0C870' : '1px solid transparent',
              borderLeft: `3px solid ${tab === 'contas_pagar' ? '#B85C38' : 'transparent'}`,
              cursor: 'pointer', textAlign: 'left',
              color: tab === 'contas_pagar' ? '#B85C38' : 'var(--ink-soft)',
              fontSize: 14, fontWeight: tab === 'contas_pagar' ? 600 : 400,
              fontFamily: 'Manrope, sans-serif', transition: 'all .15s',
            }}
          >
            <FileText size={16} style={{ flexShrink: 0 }} />
            {open && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>Contas a Pagar</span>}
          </button>
        )}
        <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
        {PLANO_NAV_ITEMS.map(({ id, label, Icon, planoMinimo }) => {
          if (legado && ['catalogo', 'financeiro', 'crediario'].includes(id)) return null
          const hasAccess = legado || temAcesso(plano, planoMinimo)
          const active = tab === id
          const badge = !hasAccess ? PLANO_BADGE_DESKTOP[planoMinimo] : null
          return (
            <button key={id}
              onClick={() => setTab(id)}
              className={active ? '' : 'cds-nav-btn'}
              title={!open ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: open ? 10 : 0,
                justifyContent: open ? 'flex-start' : 'center',
                padding: open ? '10px 12px 10px 10px' : '10px 0',
                borderRadius: 10, width: '100%',
                background: active ? 'var(--surface)' : 'transparent',
                border: active ? '1px solid var(--line)' : '1px solid transparent',
                borderLeft: `3px solid ${active ? primary : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left',
                color: active ? 'var(--ink)' : 'var(--ink-soft)',
                fontSize: 14, fontWeight: active ? 600 : 400,
                fontFamily: 'Manrope, sans-serif', transition: 'all .15s',
                opacity: hasAccess ? 1 : 0.5,
              }}>
              {hasAccess
                ? <Icon size={16} style={{ flexShrink: 0 }} />
                : <Lock size={16} style={{ flexShrink: 0 }} />
              }
              {open && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>}
              {open && badge && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                  background: badge.bg, color: badge.color, flexShrink: 0,
                  letterSpacing: '0.08em',
                }}>{badge.label}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: open ? '10px 10px 14px' : '10px 0 14px', borderTop: '1px solid #e8e4df', flexShrink: 0 }}>
        {open ? (
          <>
            <button onClick={onSwitchToMobile} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10, width: '100%',
              border: '1px solid #e8e4df',
              background: 'transparent', cursor: 'pointer',
              color: '#999', fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF6B47', display: 'inline-block', flexShrink: 0 }} />
              Versão Celular
            </button>
            <p style={{ fontSize: 10, color: '#bbb', fontFamily: 'Manrope, sans-serif', textAlign: 'center', margin: '8px 0 0' }}>
              jun<span style={{ color: '#F4613A' }}>tt</span>os
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF6B47', display: 'inline-block' }} />
          </div>
        )}
      </div>

      <style>{`
        .cds-nav-btn:hover { background: #f0ece8 !important; color: #2C1F14 !important; }
      `}</style>
    </aside>
  )
}

// ── Desktop Início ────────────────────────────────────────────
function DesktopInicio({ vendas, metas, theme, setTab }) {
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
      {/* Hero — full width */}
      <div style={{
        background: isDark ? '#0F0E0C' : `linear-gradient(135deg, ${theme.primary}f0 0%, ${theme.primary} 100%)`,
        borderTop: isDark ? '2px solid #D4A017' : undefined,
        borderRadius: 20, padding: '36px 40px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(212,160,23,0.7)' : 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
          Total vendido — {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 56, fontWeight: 700, color: isDark ? '#F0C040' : '#fff', lineHeight: 1, marginBottom: 10 }}>
          {fmtR(totalMes)}
        </p>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: isDark ? 'rgba(212,160,23,0.7)' : 'rgba(255,255,255,0.68)' }}>
          {vendasMes.length} venda{vendasMes.length !== 1 ? 's' : ''}{' '}
          {meta > 0 ? `· ${pct.toFixed(0)}% da meta (${fmtR(meta)})` : '· sem meta definida'}
        </p>
        {meta > 0 && (
          <div style={{ marginTop: 20, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: isDark ? '#D4A017' : '#fff', width: `${pct}%`, transition: 'width 0.7s' }} />
          </div>
        )}
      </div>

      {/* 3-column KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Hoje',           value: fmtR(totalHoje),  sub: `${vendasHoje.length} vendas` },
          { label: 'Ticket Médio',   value: fmtR(ticket),      sub: 'este mês' },
          { label: 'Vendas no Mês',  value: vendasMes.length,  sub: 'transações' },
        ].map(({ label, value, sub }, i) => (
          <div key={label} style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', borderTop: isDark ? '1px solid #D4A017' : (i === 0 ? '2px solid #FF6B47' : '1px solid var(--line)'), padding: '22px 20px' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>{label}</p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>{value}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>{sub}</p>
          </div>
        ))}
      </div>

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
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Meta Mensal</p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>
            {meta > 0 ? `${pct.toFixed(0)}%` : '—'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>
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
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 20 }}>Produtos mais vendidos este mês</p>
          <div style={{ display: 'flex', gap: 16 }}>
            {topProds.map(([nome, qtd], i) => (
              <div key={nome} style={{
                flex: 1, background: i === 0 ? `${theme.primary}10` : 'var(--bg)',
                border: `1px solid ${i === 0 ? theme.primary + '25' : 'var(--line)'}`,
                borderRadius: 14, padding: '18px 16px', textAlign: 'center',
              }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: i === 0 ? theme.primary : 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>{i + 1}°</span>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 8, marginBottom: 4 }}>{nome}</p>
                <p style={{ fontSize: 13, color: theme.primary, fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>{qtd}×</p>
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
            style={{ width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 12, paddingLeft: 40, paddingRight: 14, fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'hoje',  label: 'Hoje' },
          { id: 'semana',label: '7 dias' },
          { id: 'mes',   label: 'Mês' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)} style={{
            padding: '8px 18px', borderRadius: 99, cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
            border: filtro === f.id ? 'none' : '1px solid var(--line)',
            background: filtro === f.id ? theme.primary : 'var(--surface)',
            color: filtro === f.id ? '#fff' : 'var(--muted)',
            boxShadow: filtro === f.id ? `0 2px 8px ${theme.primary}30` : 'none',
          }}>{f.label}</button>
        ))}
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: 4 }}>
          {filtered.length} vendas · <strong style={{ color: theme.primary }}>{fmtR(total)}</strong>
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Manrope, sans-serif' }}>
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
                <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14, fontFamily: 'Manrope, sans-serif' }}>Nenhuma venda encontrada.</td>
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
                <td style={{ padding: '12px 16px', fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: theme.primary, whiteSpace: 'nowrap' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 28px', maxWidth: 380, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', border: '1px solid var(--line)' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>Excluir venda?</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24, fontFamily: 'Manrope, sans-serif' }}>
              Venda de <strong>{fmtR(confirmDel.valor)}</strong>{confirmDel.cliente_nome ? ` para ${confirmDel.cliente_nome}` : ''}. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>Cancelar</button>
              <button onClick={confirmDelete} style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit payment modal */}
      {editVenda && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 28px', maxWidth: 440, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
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
                    style={{ height: 44, flex: '2 1 0', minWidth: 0, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 8px', fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    {PGTOS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'Manrope, sans-serif', pointerEvents: 'none' }}>R$</span>
                    <input
                      value={p.valor}
                      onChange={e => setEditPgtos(prev => prev.map((x, idx) => idx === i ? { ...x, valor: e.target.value } : x))}
                      placeholder="0,00"
                      style={{ width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 10px 0 30px', fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
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
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px dashed var(--line)', background: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}>
              <Plus size={13} /> Adicionar forma
            </button>

            <div style={{
              marginBottom: 20, padding: '8px 12px', borderRadius: 10,
              background: editPgtoOk ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)',
              border: `1px solid ${editPgtoOk ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
              fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
              color: editPgtoOk ? '#16a34a' : '#dc2626',
            }}>
              {editPgtoOk
                ? '✓ Valor alocado corretamente'
                : `Alocado: ${fmtR(editAlloc)} · Total: ${fmtR(editTotal)}`
              }
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditVenda(null)}
                style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving || !editPgtoOk}
                style={{
                  flex: 2, height: 46, borderRadius: 12, border: 'none',
                  background: editPgtoOk && !editSaving ? theme.primary : 'var(--line)',
                  cursor: editPgtoOk && !editSaving ? 'pointer' : 'not-allowed',
                  fontFamily: 'Manrope, sans-serif', fontWeight: 700,
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
const EMPTY_VENDA = { nome: '', tel: '', produtos: [], valor: '', pagamentos: [{ forma: 'Pix', valor: '' }], obs: '', vendedora: '', nome_loja: '', cidade_estado: '', forma_envio: '' }

function DesktopNovaVenda({ produtos, produtosData = [], addVenda, addProduto, features = {}, theme }) {
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

  function getVarLabel(v) {
    const k = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
    return k ? String(v[k]) : null
  }
  function toggleProd(nome) {
    const exists = form.produtos.find(p => p.nome === nome)
    setForm({ ...form, produtos: exists ? form.produtos.filter(p => p.nome !== nome) : [...form.produtos, { nome, obs: '' }] })
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
    const err = await addVenda({
      cliente_nome: form.nome || null,
      cliente_tel:  form.tel  || null,
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      forma_pgto: JSON.stringify(form.pagamentos.map(p => ({
        forma: p.forma,
        valor: parseFloat((p.valor || '0').replace(',', '.')) || 0,
        ...(p.forma === 'Boleto' && p.vencimento ? { vencimento: p.vencimento } : {}),
      }))),
      obs: form.obs || null,
      produtos: form.produtos,
      vendedora: form.vendedora || null,
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
      setTimeout(() => { setDone(false); setForm({ ...EMPTY_VENDA, pagamentos: [{ forma: features?.atacado ? 'PIX Santander' : 'Pix', valor: '' }] }) }, 2200)
    }
  }
  const totalValor = parseFloat((form.valor || '0').replace(',', '.')) || 0
  const alocado = form.pagamentos.reduce((s, p) => s + (parseFloat((p.valor || '0').replace(',', '.')) || 0), 0)
  const pgtoOpts = features?.atacado
    ? ['PIX Santander', 'PIX Banco do Brasil', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto']
    : PGTOS
  const pgtoOk = form.valor.trim() !== '' && form.pagamentos.length > 0 && Math.abs(alocado - totalValor) < 0.005
    && form.pagamentos.every(p => p.forma !== 'Boleto' || !!p.vencimento)

  const inputS = inp(theme.primary)
  const fo = onF(theme.primary)

  if (done) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Check size={26} color="#fff" strokeWidth={2.5} />
        </div>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Venda registrada!</p>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)' }}>Salva com sucesso no histórico.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: Cliente + Pagamento */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px' }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 18 }}>Dados da Cliente</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}><User size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Nome</label>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Maria Silva" style={inputS} onFocus={fo} onBlur={onB} />
            </div>
            <div>
              <label style={lbl}><Phone size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Telefone</label>
              <input value={form.tel} onChange={e => setForm({ ...form, tel: e.target.value })} placeholder="(85) 99999-0000" style={inputS} onFocus={fo} onBlur={onB} />
            </div>
            <div>
              <label style={lbl}>Vendedora</label>
              <input value={form.vendedora} onChange={e => setForm({ ...form, vendedora: e.target.value })} placeholder="Quem realizou a venda" style={inputS} onFocus={fo} onBlur={onB} />
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
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 18 }}>Pagamento</p>
          <div>
            <label style={lbl}><CreditCard size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Valor (R$)</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>R$</span>
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
                    style={{ height: 42, flex: '2 1 0', minWidth: 0, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 8px', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {pgtoOpts.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'Manrope, sans-serif', pointerEvents: 'none' }}>R$</span>
                    <input value={p.valor} onChange={e => setPgto(i, 'valor', e.target.value)} placeholder="0,00"
                      style={{ width: '100%', height: 42, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 10px 0 28px', fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
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
                          fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
                          border: p.vencimento === dias ? 'none' : '1px solid var(--line)',
                          background: p.vencimento === dias ? theme.primary : 'var(--bg)',
                          color: p.vencimento === dias ? '#fff' : 'var(--muted)',
                        }}>{dias} dias</button>
                      ))}
                      {!p.vencimento && <span style={{ fontSize: 11, color: '#dc2626', fontFamily: 'Manrope, sans-serif', alignSelf: 'center' }}>Selecione o vencimento</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addPgto}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '5px 12px', borderRadius: 8, border: '1px dashed var(--line)', background: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
              <Plus size={13} /> Adicionar forma
            </button>
            {form.valor && (
              <div style={{ marginTop: 10, padding: '7px 12px', borderRadius: 10, background: pgtoOk ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${pgtoOk ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`, fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: pgtoOk ? '#16a34a' : '#dc2626' }}>
                {pgtoOk ? '✓ Pagamento completo' : `Alocado: R$ ${alocado.toFixed(2).replace('.', ',')} · Total: R$ ${totalValor.toFixed(2).replace('.', ',')}`}
              </div>
            )}
          </div>
          <button type="button" disabled={saving || !pgtoOk} onClick={handleSave}
            style={{ width: '100%', height: 50, marginTop: 20, border: 'none', borderRadius: 12,
              cursor: saving || !pgtoOk ? 'not-allowed' : 'pointer',
              fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700,
              background: saving || !pgtoOk ? 'var(--line)' : isDark ? 'linear-gradient(135deg, #D4A017, #F0C040)' : 'linear-gradient(135deg, #6B4FBB, #4A2D9C)',
              color: saving || !pgtoOk ? 'var(--muted)' : isDark ? '#0A0A0A' : '#fff',
              boxShadow: saving || !pgtoOk ? 'none' : isDark ? '0 4px 16px rgba(212,160,23,0.4)' : '0 4px 16px rgba(107,79,187,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'box-shadow .18s',
            }}
            onMouseEnter={e => { if (!saving && pgtoOk) e.currentTarget.style.boxShadow = '0 4px 22px rgba(255,107,71,0.45)' }}
            onMouseLeave={e => { if (!saving && pgtoOk) e.currentTarget.style.boxShadow = '0 4px 16px rgba(107,79,187,0.4)' }}
          >
            {saving ? 'Salvando...' : 'Confirmar Venda'} {!saving && <Check size={16} />}
          </button>
        </div>
      </div>

      {/* Right: Produtos */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>Produtos</p>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{form.produtos.length > 0 ? `${form.produtos.length} selecionado(s)` : 'Selecione os produtos'}</p>
          </div>
          <button type="button" onClick={() => setAddingProd(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
            <ShoppingBag size={13} /> Novo produto
          </button>
        </div>

        {addingProd && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={newProd} onChange={e => setNewProd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddProd()}
              placeholder="Nome do produto..." autoFocus style={{ ...inputS, flex: 1 }} onFocus={fo} onBlur={onB} />
            <button type="button" onClick={handleAddProd} style={{ padding: '0 16px', borderRadius: 12, background: theme.primary, border: 'none', color: '#fff', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>OK</button>
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
            const selCount = selItems.length
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
                    fontSize: 14, fontFamily: 'Manrope, sans-serif',
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
                    {selCount > 0 && (
                      <span style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 99,
                        background: isDark ? '#D4A01730' : `${theme.primary}20`,
                        color: isDark ? '#D4A017' : theme.primary, fontWeight: 700,
                      }}>{selCount}×</span>
                    )}
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
                    <p style={{ fontSize: 10, fontWeight: 700, color: isDark ? '#A07830' : '#9C8580', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}>Variações disponíveis</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {vars.map(({ label, qty }, idx) => {
                        const isSel = form.produtos.some(p => p.nome === nome && p.variacao === label)
                        const esgotado = qty === 0 && !isSel
                        return (
                          <div key={idx} role="button" tabIndex={0}
                            onClick={() => {
                              if (isSel) setForm(f => ({ ...f, produtos: f.produtos.filter(p => !(p.nome === nome && p.variacao === label)) }))
                              else if (!esgotado) setForm(f => ({ ...f, produtos: [...f.produtos, { nome, variacao: label, obs: label }] }))
                            }}
                            onKeyDown={e => {
                              if (e.key !== 'Enter') return
                              if (isSel) setForm(f => ({ ...f, produtos: f.produtos.filter(p => !(p.nome === nome && p.variacao === label)) }))
                              else if (!esgotado) setForm(f => ({ ...f, produtos: [...f.produtos, { nome, variacao: label, obs: label }] }))
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: '5px 12px', borderRadius: 8,
                              cursor: esgotado ? 'not-allowed' : 'pointer',
                              fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
                              userSelect: 'none', opacity: esgotado ? 0.5 : 1,
                              ...(isSel ? {
                                border: '1.5px solid #D4A017',
                                background: isDark ? '#D4A01720' : `${theme.primary}18`,
                                color: isDark ? '#D4A017' : theme.primary,
                              } : {
                                border: isDark ? '1px solid #3a3a3a' : '1px solid #EDE2DA',
                                background: isDark ? '#1a1a1a' : '#FFFFFF',
                                color: isDark ? '#D4A017' : '#1a1a1a',
                              }),
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
            <p style={{ fontSize: 10, fontWeight: 700, color: isDark ? '#A07830' : '#9C8580', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}>Selecionados</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {form.produtos.map((p, i) => (
                <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 8, background: isDark ? '#1C1A14' : '#FFFFFF', border: `1px solid ${isDark ? 'rgba(212,160,23,0.25)' : '#EDE2DA'}`, color: isDark ? '#D4A017' : '#2A1F1F', fontFamily: 'Manrope, sans-serif' }}>
                  {p.nome}{p.variacao ? ` — ${p.variacao}` : p.obs ? ` — ${p.obs}` : ''}
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

// ── Main export ───────────────────────────────────────────────
export default function ClientDashboardDesktop({ data, theme, onSwitchToMobile }) {
  const [tab, setTab] = useState('inicio')
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
      : <DesktopInicio vendas={data.vendas} metas={data.metas} theme={theme} setTab={setTab} />,
    venda:      <DesktopNovaVenda {...data} theme={theme} />,
    estoque:    <EstoqueMobile produtosData={data.produtosData} updateVariacoes={data.updateVariacoes} addProduto={data.addProduto} updateProduto={data.updateProduto} features={data.features} theme={theme} LOJA_ID={data.LOJA_ID} fetchAll={data.fetchAll} />,
    relatorios: <DesktopRelatorios data={data} theme={theme} temAcessoPro={temAcesso(plano, 'pro')} />,
    crediario: legado
      ? <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>Funcionalidade não disponível neste plano</div>
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
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif', ...contentVars }}>
      <DesktopSidebar tab={tab} setTab={setTab} theme={theme} config={data.config} logoUrl={effectiveLogo} plano={plano} legado={legado} onSwitchToMobile={onSwitchToMobile} />
      <div style={{ marginLeft: 56, flex: 1, padding: '40px 44px', minHeight: '100dvh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {panels[tab]}
        </div>
      </div>
    </div>
  )
}
