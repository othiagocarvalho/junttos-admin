import { useState } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { HeroCard } from '../../components/studio/Card'
import StatCard, { StatGrid } from '../../components/studio/StatCard'
import StatusPill from '../../components/studio/StatusPill'
import EmptyState from '../../components/studio/EmptyState'
import Button from '../../components/studio/Button'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

export default function ContasPagar({ produtosData = [], updateProduto, lojaId }) {
  const [marking, setMarking] = useState(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const em7dias = new Date(today)
  em7dias.setDate(em7dias.getDate() + 7)

  const pendentes = produtosData.filter(p =>
    p.valor_lote && p.status_pgto && p.status_pgto !== 'pago'
  )

  const vencidos = pendentes.filter(p => {
    if (!p.data_vencimento) return false
    return new Date(p.data_vencimento + 'T12:00:00') < today
  })

  const aVencer = pendentes.filter(p => {
    if (!p.data_vencimento) return true
    return new Date(p.data_vencimento + 'T12:00:00') >= today
  })

  const totalPagar = pendentes.reduce((s, p) => s + Number(p.valor_lote || 0), 0)
  const totalVencido = vencidos.reduce((s, p) => s + Number(p.valor_lote || 0), 0)
  const totalSemana = pendentes
    .filter(p => {
      if (!p.data_vencimento) return false
      const d = new Date(p.data_vencimento + 'T12:00:00')
      return d >= today && d <= em7dias
    })
    .reduce((s, p) => s + Number(p.valor_lote || 0), 0)

  async function marcarPago(produto) {
    setMarking(produto.id)
    await supabase
      .from('lf_produtos')
      .update({ status_pgto: 'pago' })
      .eq('id', produto.id)
      .eq('loja_id', lojaId)
    if (updateProduto) await updateProduto(produto.id, { status_pgto: 'pago' })
    setMarking(null)
  }

  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Hero: total a pagar */}
      <HeroCard tone="dark">
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
          Total a pagar
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 8 }}>
          {fmtR(totalPagar)}
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,255,255,0.65)', textTransform: 'capitalize' }}>
          {pendentes.length} conta{pendentes.length !== 1 ? 's' : ''} pendente{pendentes.length !== 1 ? 's' : ''} · {mesAtual}
        </p>
      </HeroCard>

      {/* KPIs */}
      <StatGrid>
        <StatCard
          label="Vencido"
          value={fmtR(totalVencido)}
          sub={`${vencidos.length} conta${vencidos.length !== 1 ? 's' : ''}`}
          style={{ borderLeft: '3px solid var(--negative)' }}
        />
        <StatCard
          label="Vence esta semana"
          value={fmtR(totalSemana)}
          style={{ borderLeft: '3px solid var(--status-warn-tx)' }}
        />
      </StatGrid>

      {/* Estado vazio */}
      {pendentes.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)' }}>
          <EmptyState
            icon={CheckCircle2}
            title="Nenhuma conta pendente"
            subtitle="Todos os pagamentos estão em dia."
          />
        </div>
      )}

      {/* Seção: Vencido */}
      {vencidos.length > 0 && (
        <div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'var(--negative)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Vencido — {vencidos.length} conta{vencidos.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vencidos.map(p => (
              <ContaItem key={p.id} produto={p} isVencido marking={marking} onMarcar={marcarPago} />
            ))}
          </div>
        </div>
      )}

      {/* Seção: A vencer */}
      {aVencer.length > 0 && (
        <div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'var(--status-warn-tx)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            A pagar — {aVencer.length} conta{aVencer.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aVencer.map(p => (
              <ContaItem key={p.id} produto={p} isVencido={false} marking={marking} onMarcar={marcarPago} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ContaItem({ produto, isVencido, marking, onMarcar }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderLeft: isVencido ? '3px solid var(--negative)' : '3px solid var(--status-warn-tx)',
      borderRadius: 'var(--r-card)', padding: '14px 16px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            {produto.nome}
          </span>
          <StatusPill tone={isVencido ? 'bad' : 'warn'} label={isVencido ? 'Vencido' : 'A pagar'} />
        </div>
        {produto.fornecedor && (
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
            {produto.fornecedor}
          </p>
        )}
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: isVencido ? 'var(--negative)' : 'var(--muted)' }}>
          Vence: {produto.data_vencimento ? new Date(produto.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: isVencido ? 'var(--negative)' : 'var(--ink)' }}>
          {fmtR(produto.valor_lote)}
        </p>
        <Button
          variant="ghost"
          icon={Check}
          onClick={() => onMarcar(produto)}
          disabled={marking === produto.id}
          style={{
            padding: '6px 12px', minHeight: 32, fontSize: 11,
            background: 'var(--status-ok-bg)', color: 'var(--status-ok-tx)',
          }}
        >
          {marking === produto.id ? '...' : 'Pago'}
        </Button>
      </div>
    </div>
  )
}
