import { useState } from 'react'
import { ShoppingBag, Copy, Check, ChevronDown, MessageCircle, Search, Clock, CheckCircle2, Package } from 'lucide-react'
import StatCard, { StatGrid } from '../../components/studio/StatCard'
import { HeroCard } from '../../components/studio/Card'
import StatusPill from '../../components/studio/StatusPill'
import Button from '../../components/studio/Button'
import Input from '../../components/studio/Input'
import Chip, { ChipRow } from '../../components/studio/Chip'
import EmptyState from '../../components/studio/EmptyState'


function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function fmtDT(s) {
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function iniciais(nome) {
  return (nome || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const STATUS_MAP = {
  aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'warn' },
  pago:                 { label: 'Pago',                 tone: 'ok' },
  cancelado:            { label: 'Cancelado',            tone: 'bad' },
}

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'aguardando_pagamento', label: 'Aguardando' },
  { key: 'pago', label: 'Pagos' },
  { key: 'cancelado', label: 'Cancelados' },
]

export default function PedidosCatalogo({ pedidos = [], updatePedido, theme, lojaId }) {
  const [atualizando, setAtualizando] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')

  const linkCatalogo = `${window.location.origin}/${lojaId}/catalogo`

  const now = new Date()
  const hoje = now.toDateString()

  const aguardando = pedidos.filter(p => p.status === 'aguardando_pagamento')
  const pagos = pedidos.filter(p => p.status === 'pago')
  const cancelados = pedidos.filter(p => p.status === 'cancelado')
  const pagosHoje = pedidos.filter(p => p.status === 'pago' && new Date(p.created_at).toDateString() === hoje)
  const totalHoje = pagosHoje.reduce((s, p) => s + Number(p.valor_total), 0)

  const COUNTS = { todos: pedidos.length, aguardando_pagamento: aguardando.length, pago: pagos.length, cancelado: cancelados.length }

  const buscaNorm = busca.trim().toLowerCase()
  const filtrados = pedidos.filter(p => {
    if (filtro !== 'todos' && p.status !== filtro) return false
    if (buscaNorm && !(p.cliente_nome || '').toLowerCase().includes(buscaNorm)) return false
    return true
  })

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

  function limparFiltros() {
    setFiltro('todos')
    setBusca('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Pedidos do catálogo</p>
      </div>

      <Button
        variant="secondary"
        icon={copiado ? Check : Copy}
        onClick={copiarLink}
        style={{ alignSelf: 'flex-start', color: copiado ? 'var(--status-ok-tx)' : 'var(--ink)' }}
      >
        {copiado ? 'Copiado!' : 'Copiar link do catálogo'}
      </Button>

      {/* Cards de resumo */}
      <StatGrid>
        <StatCard label="Aguardando" value={aguardando.length} icon={Clock} iconColor="var(--status-warn-dot)" />
        <StatCard label="Pagos" value={pagos.length} icon={CheckCircle2} iconColor="var(--status-ok-dot)" />
        <HeroCard tone="primary">
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Recebido hoje</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{fmtR(totalHoje)}</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 10 }}>
            {pagosHoje.length} {pagosHoje.length === 1 ? 'pedido pago' : 'pedidos pagos'} hoje
          </p>
        </HeroCard>
        <StatCard label="Total de pedidos" value={pedidos.length} icon={Package} iconColor="var(--status-info-dot)" />
      </StatGrid>

      {pedidos.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhum pedido ainda"
          subtitle="Compartilhe o link do catálogo para receber pedidos com pagamento."
        />
      ) : (
        <>
          {/* Filtros por status + busca */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ChipRow>
              {FILTROS.map(f => (
                <Chip key={f.key} label={f.label} count={COUNTS[f.key]} active={filtro === f.key} onClick={() => setFiltro(f.key)} />
              ))}
            </ChipRow>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <Input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por cliente..."
                style={{ paddingLeft: 38 }}
              />
            </div>
          </div>

          {/* Lista de pedidos */}
          {filtrados.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title={buscaNorm ? `Nada encontrado para "${busca.trim()}"` : 'Nenhum pedido com esse status'}
              subtitle={buscaNorm ? 'Tente buscar por outro nome de cliente.' : 'Experimente outro filtro ou veja todos os pedidos.'}
              actionLabel={buscaNorm ? 'Limpar busca' : 'Ver todos'}
              onAction={limparFiltros}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtrados.map(pedido => {
                const statusInfo = STATUS_MAP[pedido.status] || STATUS_MAP.aguardando_pagamento
                const isAguardando = pedido.status === 'aguardando_pagamento'
                const busy = atualizando === pedido.id
                const isOpen = expandido === pedido.id
                const itens = pedido.produtos || []
                const qtdItens = itens.reduce((s, p) => s + Number(p.qtd || 0), 0)
                const waDigits = (pedido.cliente_whatsapp || '').replace(/\D/g, '')

                return (
                  <div key={pedido.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setExpandido(isOpen ? null : pedido.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box' }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: `color-mix(in srgb, ${theme.primary} 14%, white)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: theme.primary,
                      }}>
                        {iniciais(pedido.cliente_nome)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pedido.cliente_nome}
                        </p>
                        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} · {fmtDT(pedido.created_at)}
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(pedido.valor_total)}</p>
                        <StatusPill tone={statusInfo.tone} label={statusInfo.label} />
                      </div>

                      <ChevronDown size={18} color="var(--muted)" style={{ flexShrink: 0, transition: 'transform .15s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    {isOpen && (
                      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }} />

                        {itens.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: -12 }}>
                            {itens.map((p, i) => (
                              <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r-chip)', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                                {p.qtd}× {p.nome}{p.variacao ? ` (${p.variacao})` : ''}
                              </span>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {waDigits && (
                            <a
                              href={`https://wa.me/55${waDigits}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{
                                flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                height: 40, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', background: 'var(--bg)',
                                color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                              }}
                            >
                              <MessageCircle size={15} /> WhatsApp
                            </a>
                          )}
                          {isAguardando && (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); marcarPago(pedido.id) }}
                                disabled={busy}
                                style={{
                                  flex: '1 1 140px', height: 40, borderRadius: 'var(--r-input)', border: 'none',
                                  background: busy ? 'var(--line)' : 'var(--status-ok-dot)', color: '#fff',
                                  cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700,
                                }}
                              >
                                {busy ? '...' : 'Marcar como pago'}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); cancelar(pedido.id) }}
                                disabled={busy}
                                style={{
                                  flex: '1 1 100px', height: 40, borderRadius: 'var(--r-input)', border: '1px solid var(--line)',
                                  background: 'var(--bg)', color: 'var(--status-bad-tx)',
                                  cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
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
        </>
      )}
    </div>
  )
}
