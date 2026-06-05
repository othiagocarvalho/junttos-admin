import { useState } from 'react'
import {
  Home, Clock, Plus, Target, Wallet, Settings, BarChart2,
  Smartphone, Trash2, Search, Check, ChevronRight, X,
  User, Phone, CreditCard, ShoppingBag,
} from 'lucide-react'
import Meta from '../LojaFeminina/Meta'
import Fechamento from '../LojaFeminina/Fechamento'
import Faturamento from '../LojaFeminina/Faturamento'
import LojaConfig from '../LojaFeminina/LojaConfig'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtDT(s) {
  return new Date(s).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const NAV = [
  { id: 'inicio',    label: 'Início',     Icon: Home   },
  { id: 'historico', label: 'Histórico',  Icon: Clock  },
  { id: 'venda',     label: 'Nova Venda', Icon: Plus   },
  { id: 'meta',      label: 'Meta',       Icon: Target },
  { id: 'conta',     label: 'Fechamento', Icon: Wallet },
]

const PGTOS = ['Dinheiro', 'Pix', 'Débito', 'Crédito', 'Fiado']

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
  e.target.style.background = '#fff'
}
const onB = (e) => {
  e.target.style.borderColor = 'var(--line)'
  e.target.style.boxShadow = 'none'
  e.target.style.background = 'var(--bg)'
}
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 7, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Manrope, sans-serif' }

function EstradaLogo({ size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: '#CC7870', display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{
        fontSize: size * 0.28, fontWeight: 700, color: '#fff',
        letterSpacing: '-0.5px', fontFamily: 'Georgia, serif', fontStyle: 'italic',
      }}>E</span>
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────────────────
function DesktopSidebar({ tab, setTab, theme, config, logoUrl, onSwitchToMobile }) {

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0,
      width: 220, height: '100vh',
      background: theme.primary,
      display: 'flex', flexDirection: 'column',
      zIndex: 50, fontFamily: 'Manrope, sans-serif',
    }}>
      {/* Logos: Junttos + cliente */}
      <div style={{ padding: '24px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Junttos SVG */}
          <svg width="32" height="32" viewBox="0 0 50 50" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="13" cy="12" r="10" fill="rgba(255,255,255,0.92)" />
            <circle cx="27" cy="15" r="9.5" fill="#FF6B47" />
            <rect x="2" y="27" width="36" height="16" rx="8" fill="rgba(255,255,255,0.92)" />
          </svg>

          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
          <EstradaLogo size={32} />
        </div>

        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: 'Manrope, sans-serif' }}>
          By Junttos
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10, width: '100%',
              background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              color: active ? '#fff' : 'rgba(255,255,255,0.58)',
              fontSize: 14, fontWeight: active ? 600 : 400,
              fontFamily: 'Manrope, sans-serif', transition: 'all .15s',
            }}>
              <Icon size={15} style={{ flexShrink: 0 }} />
              {label}
            </button>
          )
        })}

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {[
            { id: 'faturamento', label: 'Relatórios', Icon: BarChart2 },
            { id: 'config',      label: 'Configurações', Icon: Settings },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', borderRadius: 10, width: '100%',
              background: tab === id ? 'rgba(255,255,255,0.18)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              color: tab === id ? '#fff' : 'rgba(255,255,255,0.45)',
              fontSize: 13, fontFamily: 'Manrope, sans-serif', transition: 'all .15s',
            }}>
              <Icon size={14} style={{ flexShrink: 0 }} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Switch to mobile — coral dot as Junttos icon */}
        <button onClick={onSwitchToMobile} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 14px', borderRadius: 10, width: '100%',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'transparent', cursor: 'pointer',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 500,
        }}>
          {/* Junttos coral dot */}
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6B47', display: 'inline-block', flexShrink: 0 }} />
          Versão Celular
        </button>

        {/* Powered by Junttos */}
        <p style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontSize: 8, fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
          fontFamily: 'Manrope, sans-serif', textAlign: 'center',
        }}>
          powered by junttos
        </p>
      </div>
    </aside>
  )
}

// ── Desktop Início ────────────────────────────────────────────
function DesktopInicio({ vendas, metas, theme }) {
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
        background: `linear-gradient(135deg, ${theme.primary}f0 0%, ${theme.primary} 100%)`,
        borderRadius: 20, padding: '36px 40px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
          Total vendido — {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 56, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 10 }}>
          {fmtR(totalMes)}
        </p>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.68)' }}>
          {vendasMes.length} venda{vendasMes.length !== 1 ? 's' : ''}{' '}
          {meta > 0 ? `· ${pct.toFixed(0)}% da meta (${fmtR(meta)})` : '· sem meta definida'}
        </p>
        {meta > 0 && (
          <div style={{ marginTop: 20, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#fff', width: `${pct}%`, transition: 'width 0.7s' }} />
          </div>
        )}
      </div>

      {/* 4-column KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Hoje',           value: fmtR(totalHoje),  sub: `${vendasHoje.length} vendas` },
          { label: 'Ticket Médio',   value: fmtR(ticket),      sub: 'este mês' },
          { label: 'Vendas no Mês',  value: vendasMes.length,  sub: 'transações' },
          { label: 'Meta Mensal',    value: meta > 0 ? `${pct.toFixed(0)}%` : '—', sub: meta > 0 ? fmtR(meta) : 'não definida' },
        ].map(({ label, value, sub }, i) => (
          <div key={label} style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', borderTop: i === 0 ? '2px solid #FF6B47' : '1px solid var(--line)', padding: '22px 20px' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>{label}</p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>{value}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>{sub}</p>
          </div>
        ))}
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
function DesktopHistorico({ vendas, deleteVenda, theme }) {
  const [search,     setSearch]     = useState('')
  const [filtro,     setFiltro]     = useState('todos')
  const [confirmDel, setConfirmDel] = useState(null)
  const now = new Date()

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
      (v.forma_pgto || '').toLowerCase().includes(q)
  })

  const total = filtered.reduce((s, v) => s + Number(v.valor), 0)

  async function confirmDelete() {
    await deleteVenda(confirmDel.id)
    setConfirmDel(null)
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
              <tr key={v.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? '#fff' : 'var(--bg)' }}>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDT(v.data)}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{v.cliente_nome || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{v.vendedora || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(v.produtos || []).map(p => p.nome).join(', ') || '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {v.forma_pgto && (
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, background: `${theme.primary}15`, color: theme.primary, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {v.forma_pgto}
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: theme.primary, whiteSpace: 'nowrap' }}>
                  {fmtR(v.valor)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button onClick={() => setConfirmDel(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--line)', padding: 4, display: 'flex', alignItems: 'center', transition: 'color .15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--line)'}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete modal */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', maxWidth: 380, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>Excluir venda?</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24, fontFamily: 'Manrope, sans-serif' }}>
              Venda de <strong>{fmtR(confirmDel.valor)}</strong>{confirmDel.cliente_nome ? ` para ${confirmDel.cliente_nome}` : ''}. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>Cancelar</button>
              <button onClick={confirmDelete} style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Desktop Nova Venda (2 colunas) ────────────────────────────
function DesktopNovaVenda({ produtos, addVenda, addProduto, theme }) {
  const [form,       setForm]       = useState({ nome: '', tel: '', produtos: [], valor: '', pgto: 'Pix', obs: '', vendedora: '' })
  const [newProd,    setNewProd]    = useState('')
  const [addingProd, setAddingProd] = useState(false)
  const [done,       setDone]       = useState(false)
  const [saving,     setSaving]     = useState(false)

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
  async function handleSave() {
    setSaving(true)
    const err = await addVenda({
      cliente_nome: form.nome || null,
      cliente_tel:  form.tel  || null,
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      forma_pgto: form.pgto,
      obs: form.obs || null,
      produtos: form.produtos,
      vendedora: form.vendedora || null,
      data: new Date().toISOString(),
    })
    setSaving(false)
    if (!err) {
      setDone(true)
      setTimeout(() => { setDone(false); setForm({ nome: '', tel: '', produtos: [], valor: '', pgto: 'Pix', obs: '', vendedora: '' }) }, 2200)
    }
  }

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
              <input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0,00"
                style={{ ...inputS, paddingLeft: 36, fontSize: 20, fontWeight: 700 }} onFocus={fo} onBlur={onB} />
            </div>
            <label style={lbl}>Forma de Pagamento</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PGTOS.map(p => (
                <button key={p} type="button" onClick={() => setForm({ ...form, pgto: p })}
                  style={{ padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, transition: 'all .15s',
                    background: form.pgto === p ? theme.primary : 'var(--bg)',
                    color: form.pgto === p ? '#fff' : 'var(--ink-soft)',
                    boxShadow: form.pgto === p ? `0 2px 8px ${theme.primary}30` : 'none',
                  }}>{p}</button>
              ))}
            </div>
          </div>
          <button type="button" disabled={saving || !form.valor} onClick={handleSave}
            style={{ width: '100%', height: 50, marginTop: 20, border: 'none', borderRadius: 12,
              cursor: saving || !form.valor ? 'not-allowed' : 'pointer',
              fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700,
              background: saving || !form.valor ? 'var(--line)' : 'linear-gradient(135deg, #6B4FBB, #4A2D9C)',
              color: saving || !form.valor ? 'var(--muted)' : '#fff',
              boxShadow: saving || !form.valor ? 'none' : '0 4px 16px rgba(107,79,187,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'box-shadow .18s',
            }}
            onMouseEnter={e => { if (!saving && form.valor) e.currentTarget.style.boxShadow = '0 4px 22px rgba(255,107,71,0.45)' }}
            onMouseLeave={e => { if (!saving && form.valor) e.currentTarget.style.boxShadow = '0 4px 16px rgba(107,79,187,0.4)' }}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
          {produtos.map(nome => {
            const sel = form.produtos.find(p => p.nome === nome)
            return (
              <div key={nome} style={{ border: `1.5px solid ${sel ? theme.primary : 'var(--line)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color .15s' }}>
                <button type="button" onClick={() => toggleProd(nome)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: sel ? `${theme.primary}06` : '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, background: sel ? theme.primary : '#fff', border: sel ? 'none' : '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sel && <Check size={12} color="#fff" strokeWidth={2.5} />}
                  </div>
                  <span style={{ fontSize: 14, fontFamily: 'Manrope, sans-serif', color: 'var(--ink)', fontWeight: sel ? 600 : 400 }}>{nome}</span>
                </button>
                {sel && (
                  <div style={{ padding: '0 14px 10px' }}>
                    <input value={sel.obs} onChange={e => setProdObs(nome, e.target.value)} onClick={e => e.stopPropagation()}
                      placeholder="Obs: cor, tamanho..." style={{ ...inputS, height: 36, fontSize: 13 }} onFocus={fo} onBlur={onB} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {form.produtos.length > 0 && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg)', borderRadius: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}>Selecionados</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {form.produtos.map(p => (
                <span key={p.nome} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'Manrope, sans-serif' }}>
                  {p.nome}{p.obs ? ` — ${p.obs}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────
export default function ClientDashboardDesktop({ data, theme, onSwitchToMobile }) {
  const [tab, setTab] = useState('inicio')

  // logo_url from DB, fallback to static public file /logos/{lojaId}.svg
  const effectiveLogo = data.config?.logo_url || (data.LOJA_ID ? `/logos/${data.LOJA_ID}.svg` : null)

  const panels = {
    inicio:      <DesktopInicio    vendas={data.vendas} metas={data.metas} theme={theme} />,
    historico:   <DesktopHistorico vendas={data.vendas} deleteVenda={data.deleteVenda} theme={theme} />,
    venda:       <DesktopNovaVenda {...data} theme={theme} />,
    meta:        <Meta             {...data} theme={theme} />,
    conta:       <Fechamento       {...data} theme={theme} />,
    faturamento: <Faturamento      {...data} theme={theme} />,
    config:      <LojaConfig       {...data} theme={theme} />,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif' }}>
      <DesktopSidebar tab={tab} setTab={setTab} theme={theme} config={data.config} logoUrl={effectiveLogo} onSwitchToMobile={onSwitchToMobile} />
      <div style={{ marginLeft: 220, flex: 1, padding: '40px 44px', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {panels[tab]}
        </div>
      </div>
    </div>
  )
}
