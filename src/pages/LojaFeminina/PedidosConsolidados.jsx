import { useState, useMemo } from 'react'
import { Package } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function consolidar(pedidos, filtroStatus) {
  const filtrados = pedidos.filter(p => {
    if (p.status === 'cancelado') return false
    if (filtroStatus === 'pago') return p.status === 'pago'
    return true // 'todos' = aguardando_pagamento + pago
  })

  const mapa = {}
  for (const pedido of filtrados) {
    for (const item of (pedido.produtos || [])) {
      const nome = item.nome || '?'
      const variacao = item.variacao || ''
      const qtd = Number(item.qtd) || 0
      const preco = Number(item.preco) || 0

      if (!mapa[nome]) mapa[nome] = { nome, variacoes: {}, totalQtd: 0, totalValor: 0 }
      if (!mapa[nome].variacoes[variacao]) mapa[nome].variacoes[variacao] = { qtd: 0, valor: 0 }

      mapa[nome].variacoes[variacao].qtd    += qtd
      mapa[nome].variacoes[variacao].valor  += qtd * preco
      mapa[nome].totalQtd   += qtd
      mapa[nome].totalValor += qtd * preco
    }
  }

  return Object.values(mapa).sort((a, b) => b.totalQtd - a.totalQtd)
}

export default function PedidosConsolidados({ pedidos = [], theme }) {
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const consolidado = useMemo(
    () => consolidar(pedidos, filtroStatus),
    [pedidos, filtroStatus]
  )

  const totalGeralQtd = consolidado.reduce((s, p) => s + p.totalQtd, 0)
  const totalGeralVal = consolidado.reduce((s, p) => s + p.totalValor, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Cabeçalho + filtro */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
          Consolidado por produto
        </p>
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: 3 }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'pago',  label: 'Só pagos' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFiltroStatus(opt.id)}
              style={{
                height: 30, padding: '0 12px', borderRadius: 8, border: 'none',
                background: filtroStatus === opt.id ? theme.primary : 'transparent',
                color: filtroStatus === opt.id ? '#fff' : 'var(--muted)',
                fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Totais gerais */}
      {consolidado.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: theme.primary, borderRadius: 14, padding: '14px 16px' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
              Total de peças
            </p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {totalGeralQtd}
            </p>
          </div>
          <div style={{ background: `${theme.primary}10`, border: `1px solid ${theme.primary}25`, borderRadius: 14, padding: '14px 16px' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: theme.primary, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
              Valor total
            </p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: theme.primary, lineHeight: 1 }}>
              {fmtR(totalGeralVal)}
            </p>
          </div>
        </div>
      )}

      {/* Lista */}
      {consolidado.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <Package size={32} color="var(--line)" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)' }}>
            Nenhum pedido para consolidar.
          </p>
        </div>
      ) : consolidado.map((prod, idx) => {
        const variacoes = Object.entries(prod.variacoes)
        const temVariacao = variacoes.some(([k]) => k !== '')

        return (
          <div key={prod.nome} style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 16, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                    background: `${theme.primary}15`, color: theme.primary,
                    fontFamily: 'Manrope, sans-serif', flexShrink: 0,
                  }}>
                    #{idx + 1}
                  </span>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
                    {prod.nome}
                  </p>
                </div>

                {temVariacao ? (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {variacoes
                      .filter(([k]) => k !== '')
                      .sort((a, b) => b[1].qtd - a[1].qtd)
                      .map(([label, data]) => (
                        <span key={label} style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 7,
                          background: `${theme.primary}10`, color: theme.primary,
                          border: `1px solid ${theme.primary}28`,
                          fontFamily: 'Manrope, sans-serif',
                        }}>
                          {label}: {data.qtd}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
                    {fmtR(prod.totalValor)}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: theme.primary, lineHeight: 1, marginBottom: 3 }}>
                  {prod.totalQtd}
                </p>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                  peças
                </p>
                {temVariacao && (
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                    {fmtR(prod.totalValor)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}

    </div>
  )
}
