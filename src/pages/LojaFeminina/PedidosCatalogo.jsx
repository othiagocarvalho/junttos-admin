import { useState } from 'react'
import {
  ShoppingBag, Copy, Check, Search, MessageCircle,
  ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Send,
} from 'lucide-react'

const PROD_BASE = 'https://junttos-admin.vercel.app'

const UI   = "'Plus Jakarta Sans', sans-serif"
const MONO = "'Space Mono', monospace"

const P = '#5E2BD0'
const ACCENT = '#F2643C'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtDT(s) {
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_MAP = {
  aguardando_pagamento: { label: 'Aguardando pgto.', text: '#B7791F', bg: '#FBEFD6', dot: '#E0A93B' },
  pago:                 { label: 'Pago',              text: '#1E7A4D', bg: '#DCF3E6', dot: '#27A263' },
  enviado:              { label: 'Enviado',            text: '#5E2BD0', bg: '#ECE6FB', dot: '#7C4DEC' },
  cancelado:            { label: 'Cancelado',          text: '#9B3B3B', bg: '#F6E6E2', dot: '#C25A4E' },
}

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.aguardando_pagamento
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      background: s.bg, color: s.text,
      fontFamily: UI, fontSize: 11, fontWeight: 700,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function Avatar({ name }) {
  const initial = (name || '?')[0].toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: '#ECE6FB', color: P,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: UI, fontSize: 14, fontWeight: 700,
    }}>
      {initial}
    </div>
  )
}

export default function PedidosCatalogo({ pedidos = [], updatePedido, theme, lojaId }) {
  const [atualizando, setAtualizando]     = useState(null)
  const [copiado,     setCopiado]         = useState(false)
  const [expanded,    setExpanded]        = useState({})
  const [statusFilter, setStatusFilter]   = useState('todos')
  const [search,      setSearch]          = useState('')

  const linkCatalogo = `${PROD_BASE}/${lojaId}/catalogo`
  const now  = new Date()
  const hoje = now.toDateString()

  const aguardando = pedidos.filter(p => p.status === 'aguardando_pagamento')
  const pagosHoje  = pedidos.filter(p => p.status === 'pago' && new Date(p.created_at).toDateString() === hoje)
  const totalHoje  = pagosHoje.reduce((s, p) => s + Number(p.valor_total), 0)
  const enviados   = pedidos.filter(p => p.status === 'enviado')

  async function marcarPago(id) {
    setAtualizando(id)
    try { await updatePedido(id, { status: 'pago' }) } catch (e) { alert('Erro: ' + e.message) }
    setAtualizando(null)
  }
  async function cancelar(id) {
    setAtualizando(id)
    try { await updatePedido(id, { status: 'cancelado' }) } catch (e) { alert('Erro: ' + e.message) }
    setAtualizando(null)
  }
  function copiarLink() {
    navigator.clipboard.writeText(linkCatalogo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const filteredPedidos = pedidos.filter(p => {
    const matchStatus = statusFilter === 'todos' || p.status === statusFilter
    const matchSearch = !search || (p.cliente_nome || '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts = {
    todos:                pedidos.length,
    aguardando_pagamento: aguardando.length,
    pago:                 pedidos.filter(p => p.status === 'pago').length,
    enviado:              enviados.length,
    cancelado:            pedidos.filter(p => p.status === 'cancelado').length,
  }

  const kpis = [
    { label: 'Aguardando', value: aguardando.length, iconBg: '#FBEFD6', iconColor: '#E0A93B', Icon: Clock },
    { label: 'Pagos hoje',  value: pagosHoje.length,  iconBg: '#DCF3E6', iconColor: '#27A263', Icon: CheckCircle2 },
    { label: 'Recebido hoje', value: fmtR(totalHoje), iconBg: 'rgba(255,255,255,0.22)', iconColor: '#fff', Icon: ShoppingBag, highlight: true },
    { label: 'Enviados',   value: enviados.length,   iconBg: '#ECE6FB', iconColor: '#7C4DEC', Icon: Send },
  ]

  const statusChips = [
    { id: 'todos',                label: 'Todos' },
    { id: 'aguardando_pagamento', label: 'Aguardando' },
    { id: 'pago',                 label: 'Pagos' },
    { id: 'enviado',              label: 'Enviados' },
    { id: 'cancelado',            label: 'Cancelados' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        .kpi-grid { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 600px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        .pc-th { display: flex; }
        @media (max-width: 600px) { .pc-th { display: none !important; } }
        .pc-col-sm { display: flex; }
        @media (max-width: 600px) { .pc-col-sm { display: none !important; } }
      `}</style>

      {/* KPI cards */}
      <div className="kpi-grid" style={{ display: 'grid', gap: 12 }}>
        {kpis.map(({ label, value, iconBg, iconColor, Icon, highlight }) => (
          <div key={label} style={{
            background: highlight ? P : '#fff',
            border: highlight ? 'none' : '1px solid #ECECF1',
            borderRadius: 16, padding: '16px',
            position: 'relative', overflow: 'hidden',
            boxShadow: highlight ? '0 10px 22px -10px rgba(94,43,208,.45)' : 'none',
          }}>
            {highlight && (
              <div style={{
                position: 'absolute', right: -18, top: -18,
                width: 68, height: 68, borderRadius: '50%',
                background: ACCENT, opacity: 0.4,
              }} />
            )}
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12, position: 'relative',
            }}>
              <Icon size={15} color={iconColor} />
            </div>
            <p style={{
              fontFamily: MONO, fontSize: typeof value === 'string' ? 15 : 26,
              fontWeight: 700, color: highlight ? '#fff' : '#18181B',
              lineHeight: 1, marginBottom: 5,
            }}>{value}</p>
            <p style={{ fontFamily: UI, fontSize: 11, fontWeight: 500, color: highlight ? 'rgba(255,255,255,0.72)' : '#8A8A93', lineHeight: 1.2 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Link do catálogo */}
      <div style={{ background: '#fff', border: '1px solid #ECECF1', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, color: '#8A8A93', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Link do catálogo</p>
          <p style={{ fontFamily: MONO, fontSize: 12, color: P, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkCatalogo}</p>
        </div>
        <button
          onClick={copiarLink}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            border: '1px solid #ECECF1',
            background: copiado ? '#DCF3E6' : '#F6F6F9',
            cursor: 'pointer', fontFamily: UI, fontSize: 12, fontWeight: 700,
            color: copiado ? '#1E7A4D' : '#8A8A93', flexShrink: 0,
            transition: 'all .15s',
          }}
        >
          {copiado ? <><Check size={13} />Copiado</> : <><Copy size={13} />Copiar</>}
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statusChips.map(({ id, label }) => {
            const active = statusFilter === id
            return (
              <button key={id} onClick={() => setStatusFilter(id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 10,
                border: active ? 'none' : '1px solid #ECECF1',
                background: active ? P : '#fff',
                color: active ? '#fff' : '#8A8A93',
                fontFamily: UI, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
                boxShadow: active ? '0 10px 22px -10px rgba(94,43,208,.5)' : 'none',
              }}>
                {label}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 18, borderRadius: 999, padding: '0 4px',
                  background: active ? 'rgba(255,255,255,0.22)' : '#F6F6F9',
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  color: active ? '#fff' : '#A1A1AA',
                }}>
                  {counts[id]}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={15} color="#A1A1AA" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            style={{
              width: '100%', height: 42, border: '1px solid #ECECF1',
              borderRadius: 10, padding: '0 14px 0 40px',
              fontFamily: UI, fontSize: 13, color: '#18181B',
              background: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Lista */}
      {filteredPedidos.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ECECF1', borderRadius: 16, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <ShoppingBag size={32} color="#ECECF1" />
          <p style={{ fontFamily: UI, fontSize: 14, color: '#8A8A93', textAlign: 'center' }}>
            {pedidos.length === 0 ? 'Nenhum pedido recebido ainda.' : 'Nenhum pedido encontrado.'}
          </p>
          {pedidos.length === 0 && (
            <p style={{ fontFamily: UI, fontSize: 12, color: '#A1A1AA', textAlign: 'center' }}>Compartilhe o link do catálogo com suas clientes.</p>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #ECECF1', borderRadius: 16, overflow: 'hidden' }}>
          {/* Table header */}
          <div className="pc-th" style={{
            alignItems: 'center', gap: 12,
            padding: '10px 18px', borderBottom: '1px solid #ECECF1',
            background: '#F6F6F9',
          }}>
            <div style={{ width: 36, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: UI, fontSize: 11, fontWeight: 600, color: '#A1A1AA' }}>Cliente</span>
            </div>
            <div style={{ width: 60, textAlign: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: UI, fontSize: 11, fontWeight: 600, color: '#A1A1AA' }}>Itens</span>
            </div>
            <div style={{ width: 100, textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontFamily: UI, fontSize: 11, fontWeight: 600, color: '#A1A1AA' }}>Valor</span>
            </div>
            <div style={{ width: 135, flexShrink: 0 }}>
              <span style={{ fontFamily: UI, fontSize: 11, fontWeight: 600, color: '#A1A1AA' }}>Status</span>
            </div>
            <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontFamily: UI, fontSize: 11, fontWeight: 600, color: '#A1A1AA' }}>Data</span>
            </div>
            <div style={{ width: 20, flexShrink: 0 }} />
          </div>

          {filteredPedidos.map((pedido, idx) => {
            const isOpen = !!expanded[pedido.id]
            const isAguardando = pedido.status === 'aguardando_pagamento'
            const busy = atualizando === pedido.id
            const totalItens = (pedido.produtos || []).reduce((s, p) => s + (Number(p.qtd) || 1), 0)
            const phone = (pedido.cliente_whatsapp || '').replace(/\D/g, '')

            return (
              <div key={pedido.id} style={{ borderTop: idx > 0 ? '1px solid #ECECF1' : 'none' }}>
                <button
                  onClick={() => setExpanded(p => ({ ...p, [pedido.id]: !p[pedido.id] }))}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 18px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F6F6F9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <Avatar name={pedido.cliente_nome} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: UI, fontSize: 14, fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                      {pedido.cliente_nome}
                    </p>
                    {pedido.cliente_whatsapp && (
                      <p style={{ fontFamily: MONO, fontSize: 11, color: '#8A8A93' }}>{pedido.cliente_whatsapp}</p>
                    )}
                  </div>
                  <div className="pc-col-sm" style={{ width: 60, justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#8A8A93' }}>{totalItens}</span>
                  </div>
                  <div style={{ width: 100, textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: '#18181B' }}>{fmtR(pedido.valor_total)}</span>
                  </div>
                  <div className="pc-col-sm" style={{ width: 135, flexShrink: 0 }}>
                    <StatusPill status={pedido.status} />
                  </div>
                  <div className="pc-col-sm" style={{ width: 90, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <span style={{ fontFamily: UI, fontSize: 11, color: '#A1A1AA' }}>{fmtDT(pedido.created_at)}</span>
                  </div>
                  <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                    {isOpen
                      ? <ChevronDown size={16} color="#A1A1AA" />
                      : <ChevronRight size={16} color="#A1A1AA" />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #ECECF1', padding: '14px 18px 16px', background: '#F6F6F9' }}>
                    {/* Mobile status + date */}
                    <div style={{ display: 'none' }} className="pc-mobile-meta">
                      <StatusPill status={pedido.status} />
                      <span style={{ fontFamily: UI, fontSize: 11, color: '#A1A1AA' }}>{fmtDT(pedido.created_at)}</span>
                    </div>
                    <style>{`.pc-mobile-meta { display: none !important; } @media (max-width: 600px) { .pc-mobile-meta { display: flex !important; gap: 8px; align-items: center; margin-bottom: 10px; } }`}</style>

                    {(pedido.produtos || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                        {(pedido.produtos || []).map((p, i) => (
                          <span key={i} style={{
                            fontSize: 12, padding: '3px 9px', borderRadius: 8,
                            background: '#fff', border: '1px solid #ECECF1',
                            color: '#52525B', fontFamily: UI, fontWeight: 500,
                          }}>
                            {p.qtd}× {p.nome}{p.variacao ? ` (${p.variacao})` : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {phone && (
                        <a
                          href={`https://wa.me/55${phone}`}
                          target="_blank" rel="noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '0 14px', height: 38, borderRadius: 10,
                            background: '#25D366', color: '#fff', textDecoration: 'none',
                            fontFamily: UI, fontSize: 12, fontWeight: 700, flexShrink: 0,
                          }}
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      )}
                      {isAguardando && (
                        <>
                          <button
                            onClick={() => marcarPago(pedido.id)}
                            disabled={busy}
                            style={{
                              flex: 1, minWidth: 120, height: 38, borderRadius: 10, border: 'none',
                              background: busy ? '#ECECF1' : '#1E7A4D', color: busy ? '#8A8A93' : '#fff',
                              cursor: busy ? 'not-allowed' : 'pointer',
                              fontFamily: UI, fontSize: 12, fontWeight: 700,
                            }}
                          >
                            {busy ? '...' : 'Marcar como pago'}
                          </button>
                          <button
                            onClick={() => cancelar(pedido.id)}
                            disabled={busy}
                            style={{
                              height: 38, padding: '0 14px', borderRadius: 10,
                              border: '1px solid #ECECF1', background: '#fff',
                              color: '#9B3B3B', cursor: busy ? 'not-allowed' : 'pointer',
                              fontFamily: UI, fontSize: 12, fontWeight: 600,
                            }}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
