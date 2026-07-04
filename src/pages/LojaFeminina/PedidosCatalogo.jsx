import { useState } from 'react'
import { ShoppingBag, Copy, Check } from 'lucide-react'

const PROD_BASE = 'https://junttos-admin.vercel.app'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function fmtDT(s) {
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_BADGE = {
  aguardando_pagamento: { label: 'Aguardando pgto.', bg: 'rgba(202,138,4,0.12)', color: '#ca8a04' },
  pago:                 { label: 'Pago',              bg: 'rgba(22,163,74,0.12)',  color: '#16a34a' },
  cancelado:            { label: 'Cancelado',          bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
}

export default function PedidosCatalogo({ pedidos = [], updatePedido, theme, lojaId }) {
  const [atualizando, setAtualizando] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const linkCatalogo = `${PROD_BASE}/${lojaId}/catalogo`

  const now = new Date()
  const hoje = now.toDateString()

  const aguardando = pedidos.filter(p => p.status === 'aguardando_pagamento')
  const pagosHoje = pedidos.filter(p => p.status === 'pago' && new Date(p.created_at).toDateString() === hoje)
  const totalHoje = pagosHoje.reduce((s, p) => s + Number(p.valor_total), 0)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Pedidos do catálogo</p>
      </div>

      {/* Link copiável */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Link do catálogo</p>
          <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkCatalogo}</p>
        </div>
        <button
          onClick={copiarLink}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--line)', background: copiado ? 'rgba(22,163,74,0.1)' : 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, color: copiado ? '#16a34a' : 'var(--muted)', flexShrink: 0 }}
        >
          {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
        </button>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Aguardando', value: aguardando.length, color: '#ca8a04' },
          { label: 'Pagos hoje', value: pagosHoje.length, color: '#16a34a' },
          { label: 'Recebido hoje', value: fmtR(totalHoje), color: theme.primary },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Lista de pedidos */}
      {pedidos.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <ShoppingBag size={32} color="var(--line)" />
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>Nenhum pedido recebido ainda.</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Compartilhe o link do catálogo com suas clientes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pedidos.map(pedido => {
            const badge = STATUS_BADGE[pedido.status] || STATUS_BADGE.aguardando_pagamento
            const isAguardando = pedido.status === 'aguardando_pagamento'
            const busy = atualizando === pedido.id
            return (
              <div key={pedido.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{pedido.cliente_nome}</p>
                    {pedido.cliente_whatsapp && (
                      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{pedido.cliente_whatsapp}</p>
                    )}
                  </div>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: badge.bg, color: badge.color, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, flexShrink: 0 }}>
                    {badge.label}
                  </span>
                </div>

                {(pedido.produtos || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {(pedido.produtos || []).map((p, i) => (
                      <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                        {p.qtd}× {p.nome}{p.variacao ? ` (${p.variacao})` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: theme.primary }}>{fmtR(pedido.valor_total)}</p>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>{fmtDT(pedido.created_at)}</p>
                </div>

                {isAguardando && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      onClick={() => marcarPago(pedido.id)}
                      disabled={busy}
                      style={{ flex: 2, height: 36, borderRadius: 8, border: 'none', background: busy ? 'var(--line)' : '#16a34a', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700 }}
                    >
                      {busy ? '...' : 'Marcar como pago'}
                    </button>
                    <button
                      onClick={() => cancelar(pedido.id)}
                      disabled={busy}
                      style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: '#ef4444', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600 }}
                    >
                      Cancelar
                    </button>
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
