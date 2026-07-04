import { useState, useMemo } from 'react'
import { Package, Wallet } from 'lucide-react'
import Card, { HeroCard } from '../../components/studio/Card'
import StatCard, { StatGrid } from '../../components/studio/StatCard'
import EmptyState from '../../components/studio/EmptyState'

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
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
          Consolidado por produto
        </p>
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--r-input)', padding: 3 }}>
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
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600,
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
        <StatGrid style={{ gridTemplateColumns: '1fr 1fr' }}>
          <HeroCard tone="primary" style={{ padding: '14px 16px' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
              Total de peças
            </p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {totalGeralQtd}
            </p>
          </HeroCard>
          <StatCard
            label="Valor total"
            value={fmtR(totalGeralVal)}
            icon={Wallet}
            iconColor="var(--primary)"
          />
        </StatGrid>
      )}

      {/* Lista */}
      {consolidado.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum pedido para consolidar"
          subtitle={
            filtroStatus === 'pago'
              ? 'Ainda não há pedidos pagos para consolidar.'
              : 'Assim que houver pedidos, o consolidado por produto e tamanho aparece aqui.'
          }
          actionLabel={filtroStatus === 'pago' ? 'Ver todos os pedidos' : undefined}
          onAction={filtroStatus === 'pago' ? () => setFiltroStatus('todos') : undefined}
        />
      ) : consolidado.map((prod, idx) => {
        const variacoes = Object.entries(prod.variacoes)
        const temVariacao = variacoes.some(([k]) => k !== '')

        return (
          <Card key={prod.nome} padding="16px 18px">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 'var(--r-chip)',
                    background: `${theme.primary}15`, color: theme.primary,
                    fontFamily: 'Plus Jakarta Sans, sans-serif', flexShrink: 0,
                  }}>
                    #{idx + 1}
                  </span>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
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
                          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--r-chip)',
                          background: `${theme.primary}10`, color: theme.primary,
                          border: `1px solid ${theme.primary}28`,
                          fontFamily: 'Plus Jakarta Sans, sans-serif',
                        }}>
                          {label}: {data.qtd}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
                    {fmtR(prod.totalValor)}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: theme.primary, lineHeight: 1, marginBottom: 3 }}>
                  {prod.totalQtd}
                </p>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                  peças
                </p>
                {temVariacao && (
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                    {fmtR(prod.totalValor)}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )
      })}

    </div>
  )
}
