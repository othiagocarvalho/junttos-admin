import { useState } from 'react'
import { supabase } from '../../lib/supabase'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtDate(s) {
  if (!s) return '—'
  return new Date(String(s) + 'T12:00:00').toLocaleDateString('pt-BR')
}

const TERRACOTA = '#B85C38'

export default function ContasPagar({ produtosData = [], updateProduto, theme, lojaId }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>

      {/* Header */}
      <div style={{ background: TERRACOTA, borderRadius: 16, padding: '20px 18px' }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
          Contas a pagar
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 4 }}>
          Du Charme Lingerie
        </p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>
          {mesAtual}
        </p>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 14px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
            Total a pagar
          </p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: '#E53E3E', lineHeight: 1 }}>
            {fmtR(totalPagar)}
          </p>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 14px' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
            Vence esta semana
          </p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: '#B7791F', lineHeight: 1 }}>
            {fmtR(totalSemana)}
          </p>
        </div>
      </div>

      {/* Estado vazio */}
      {pendentes.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 28, marginBottom: 10 }}>✓</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#1F8A5B', marginBottom: 6 }}>
            Nenhuma conta pendente
          </p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)' }}>
            Todos os pagamentos estão em dia.
          </p>
        </div>
      )}

      {/* Seção: Vencido */}
      {vencidos.length > 0 && (
        <div>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: '#E53E3E', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
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
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: '#B7791F', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
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
      background: 'var(--surface)', border: `1px solid ${isVencido ? '#FCA5A5' : 'var(--line)'}`,
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            {produto.nome}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
            background: isVencido ? '#FEE2E2' : '#FFF4E0',
            color: isVencido ? '#DC2626' : '#B7791F',
            border: `1px solid ${isVencido ? '#FCA5A5' : '#F0C870'}`,
            fontFamily: 'Plus Jakarta Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {isVencido ? 'Vencido' : 'A pagar'}
          </span>
        </div>
        {produto.fornecedor && (
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
            {produto.fornecedor}
          </p>
        )}
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: isVencido ? '#DC2626' : 'var(--muted)' }}>
          Vence: {produto.data_vencimento ? new Date(produto.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: isVencido ? '#DC2626' : 'var(--ink)' }}>
          {fmtR(produto.valor_lote)}
        </p>
        <button
          onClick={() => onMarcar(produto)}
          disabled={marking === produto.id}
          style={{
            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: marking === produto.id ? 'not-allowed' : 'pointer',
            background: '#E6F6EE', color: '#1F8A5B',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700,
            opacity: marking === produto.id ? 0.6 : 1,
          }}
        >
          {marking === produto.id ? '...' : '✓ Pago'}
        </button>
      </div>
    </div>
  )
}
