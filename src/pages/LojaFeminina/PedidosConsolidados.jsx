import { useState, useMemo } from 'react'
import { Package } from 'lucide-react'

const UI   = "'Plus Jakarta Sans', sans-serif"
const MONO = "'Space Mono', monospace"

const P      = '#5E2BD0'
const ACCENT = '#F2643C'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function consolidar(pedidos, filtroStatus) {
  const filtrados = pedidos.filter(p => {
    if (p.status === 'cancelado') return false
    if (filtroStatus === 'pago') return p.status === 'pago'
    return true
  })

  const mapa = {}
  for (const pedido of filtrados) {
    for (const item of (pedido.produtos || [])) {
      const nome    = item.nome     || '?'
      const variacao = item.variacao || ''
      const qtd     = Number(item.qtd)   || 0
      const preco   = Number(item.preco) || 0

      if (!mapa[nome]) mapa[nome] = { nome, variacoes: {}, totalQtd: 0, totalValor: 0 }
      if (!mapa[nome].variacoes[variacao]) mapa[nome].variacoes[variacao] = { qtd: 0, valor: 0 }

      mapa[nome].variacoes[variacao].qtd   += qtd
      mapa[nome].variacoes[variacao].valor += qtd * preco
      mapa[nome].totalQtd   += qtd
      mapa[nome].totalValor += qtd * preco
    }
  }

  return Object.values(mapa).sort((a, b) => b.totalQtd - a.totalQtd)
}

export default function PedidosConsolidados({ pedidos = [], theme }) {
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const consolidado = useMemo(() => consolidar(pedidos, filtroStatus), [pedidos, filtroStatus])
  const maxQtd = consolidado.reduce((m, p) => Math.max(m, p.totalQtd), 0)

  const hoje = new Date().toDateString()
  const naoCancel = pedidos.filter(p => p.status !== 'cancelado')
  const aReceber = pedidos.filter(p => p.status === 'aguardando_pagamento')
    .reduce((s, p) => s + Number(p.valor_total), 0)
  const recebidoHoje = pedidos
    .filter(p => p.status === 'pago' && new Date(p.created_at).toDateString() === hoje)
    .reduce((s, p) => s + Number(p.valor_total), 0)
  const ticketMedio = naoCancel.length > 0
    ? naoCancel.reduce((s, p) => s + Number(p.valor_total), 0) / naoCancel.length
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .cons-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 900px) {
          .cons-layout { grid-template-columns: 1fr 296px; }
        }
      `}</style>

      {/* Filtro */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontFamily: UI, fontSize: 16, fontWeight: 700, color: '#18181B' }}>
          Consolidado por produto
        </p>
        <div style={{ display: 'flex', gap: 3, background: '#F6F6F9', border: '1px solid #ECECF1', borderRadius: 10, padding: 3 }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'pago',  label: 'Só pagos' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFiltroStatus(opt.id)}
              style={{
                height: 30, padding: '0 14px', borderRadius: 8, border: 'none',
                background: filtroStatus === opt.id ? P : 'transparent',
                color: filtroStatus === opt.id ? '#fff' : '#8A8A93',
                fontFamily: UI, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
                boxShadow: filtroStatus === opt.id ? '0 10px 22px -10px rgba(94,43,208,.55)' : 'none',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {consolidado.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ECECF1', borderRadius: 16, padding: '56px 24px', textAlign: 'center' }}>
          <Package size={32} color="#ECECF1" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: UI, fontSize: 14, color: '#8A8A93' }}>Nenhum pedido para consolidar.</p>
        </div>
      ) : (
        <div className="cons-layout">
          {/* Esquerda: Peças a separar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{
              background: '#F6F6F9', borderRadius: '16px 16px 0 0',
              padding: '12px 18px', border: '1px solid #ECECF1', borderBottom: 'none',
            }}>
              <p style={{ fontFamily: UI, fontSize: 12, fontWeight: 700, color: '#8A8A93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Peças a separar
              </p>
            </div>
            <div style={{
              background: '#fff', border: '1px solid #ECECF1',
              borderRadius: '0 0 16px 16px', overflow: 'hidden',
            }}>
              {consolidado.map((prod, idx) => {
                const variacoes = Object.entries(prod.variacoes)
                const temVariacao = variacoes.some(([k]) => k !== '')
                const barW = maxQtd > 0 ? (prod.totalQtd / maxQtd) * 100 : 0
                const isMax = prod.totalQtd === maxQtd

                return (
                  <div key={prod.nome} style={{
                    padding: '14px 18px',
                    borderTop: idx > 0 ? '1px solid #ECECF1' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                        background: '#ECE6FB', color: P, fontFamily: UI, flexShrink: 0, marginTop: 2,
                      }}>
                        #{idx + 1}
                      </span>
                      <p style={{ flex: 1, fontFamily: UI, fontSize: 14, fontWeight: 600, color: '#18181B', lineHeight: 1.3 }}>
                        {prod.nome}
                      </p>
                      <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: isMax ? ACCENT : P, flexShrink: 0 }}>
                        {prod.totalQtd}
                      </span>
                    </div>

                    {temVariacao && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                        {variacoes
                          .filter(([k]) => k !== '')
                          .sort((a, b) => b[1].qtd - a[1].qtd)
                          .map(([label, data]) => (
                            <span key={label} style={{
                              fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 7,
                              background: '#ECE6FB', color: P,
                              fontFamily: UI,
                            }}>
                              {label}: <span style={{ fontFamily: MONO }}>{data.qtd}</span>
                            </span>
                          ))}
                      </div>
                    )}

                    {/* Barra de proporção */}
                    <div style={{ height: 4, borderRadius: 99, background: '#ECECF1', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        width: `${barW}%`,
                        background: isMax ? ACCENT : P,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Direita: Resumo financeiro */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff', border: '1px solid #ECECF1', borderRadius: 16, padding: '20px' }}>
              <p style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, color: '#8A8A93', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                A receber
              </p>
              <p style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: '#B7791F', lineHeight: 1 }}>
                {fmtR(aReceber)}
              </p>
            </div>

            <div style={{ background: '#fff', border: '1px solid #ECECF1', borderRadius: 16, padding: '20px' }}>
              <p style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, color: '#8A8A93', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Recebido hoje
              </p>
              <p style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: '#1E7A4D', lineHeight: 1 }}>
                {fmtR(recebidoHoje)}
              </p>
            </div>

            <div style={{
              background: '#18181B', border: 'none', borderRadius: 16, padding: '20px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', right: -20, bottom: -20,
                width: 80, height: 80, borderRadius: '50%',
                background: P, opacity: 0.25,
              }} />
              <p style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Ticket médio
              </p>
              <p style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                {fmtR(ticketMedio)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
