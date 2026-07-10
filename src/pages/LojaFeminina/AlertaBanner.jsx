import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, CreditCard, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { temAcesso } from '../../utils/planos'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

export default function AlertaBanner({ vendas, metas, produtosData = [], lojaId, plano, setTab, theme = {} }) {
  const [contasData, setContasData] = useState(null)
  const [idx, setIdx] = useState(0)
  const isDark = !!theme.isDark

  useEffect(() => {
    if (!lojaId) return
    async function fetchContas() {
      const hoje = new Date()
      const em3 = new Date(hoje)
      em3.setDate(hoje.getDate() + 3)
      const h = hoje.toISOString().split('T')[0]
      const e = em3.toISOString().split('T')[0]
      const [{ data: pagar }, { data: receber }] = await Promise.all([
        supabase.from('lf_contas_pagar')
          .select('id,descricao,valor,data_vencimento')
          .eq('loja_id', lojaId).eq('status', 'pendente')
          .gte('data_vencimento', h).lte('data_vencimento', e),
        supabase.from('lf_contas_receber')
          .select('id,descricao,valor,data_vencimento')
          .eq('loja_id', lojaId).eq('status', 'pendente')
          .gte('data_vencimento', h).lte('data_vencimento', e),
      ])
      setContasData([...(pagar || []), ...(receber || [])])
    }
    fetchContas()
  }, [lojaId])

  const now = new Date()
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const vendasMes = (vendas || []).filter(v => {
    const d = new Date(v.data)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const totalMes = vendasMes.reduce((s, v) => s + Number(v.valor), 0)
  const meta = (metas || {})[curYM] || 0

  const alerts = []

  const produtosBaixos = produtosData.filter(p => {
    const qtd = (p.variacoes || []).reduce((s, v) => s + Number(v.quantidade || 0), 0)
    return qtd >= 1 && qtd <= 5
  })
  if (produtosBaixos.length > 0) {
    alerts.push({
      type: 'estoque',
      Icon: AlertTriangle,
      bg: isDark ? 'rgba(255,152,0,0.12)' : 'rgba(255,152,0,0.08)',
      border: isDark ? 'rgba(255,152,0,0.35)' : 'rgba(255,152,0,0.45)',
      color: isDark ? '#FFB74D' : '#BF360C',
      text: produtosBaixos.length === 1
        ? `Estoque baixo: ${produtosBaixos[0].nome}`
        : `${produtosBaixos.length} produtos com estoque baixo`,
      tab: 'estoque',
    })
  }

  if (temAcesso(plano, 'pro') && meta > 0 && totalMes >= meta) {
    alerts.push({
      type: 'meta',
      Icon: TrendingUp,
      bg: isDark ? 'rgba(76,175,80,0.12)' : 'rgba(76,175,80,0.08)',
      border: isDark ? 'rgba(76,175,80,0.35)' : 'rgba(76,175,80,0.45)',
      color: isDark ? '#81C784' : '#1B5E20',
      text: `Meta batida! Você atingiu ${fmtR(totalMes)} este mês`,
      tab: 'meta',
    })
  }

  if (contasData && contasData.length > 0) {
    alerts.push({
      type: 'conta',
      Icon: CreditCard,
      bg: isDark ? 'rgba(244,67,54,0.12)' : 'rgba(244,67,54,0.08)',
      border: isDark ? 'rgba(244,67,54,0.35)' : 'rgba(244,67,54,0.45)',
      color: isDark ? '#EF9A9A' : '#B71C1C',
      text: contasData.length === 1
        ? `Conta vence em breve: ${contasData[0].descricao}`
        : `${contasData.length} contas vencem nos próximos 3 dias`,
      tab: 'financeiro',
    })
  }

  useEffect(() => {
    if (alerts.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % alerts.length), 4000)
    return () => clearInterval(t)
  }, [alerts.length])

  useEffect(() => { setIdx(0) }, [alerts.length])

  if (contasData === null) return null
  if (alerts.length === 0) return null

  const alert = alerts[idx % alerts.length]
  const { Icon } = alert

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setTab(alert.tab)}
      onKeyDown={e => e.key === 'Enter' && setTab(alert.tab)}
      style={{
        marginBottom: 14, borderRadius: 12, padding: '12px 16px',
        background: alert.bg, border: `1.5px solid ${alert.border}`,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={15} color={alert.color} style={{ flexShrink: 0 }} />
        <span style={{
          flex: 1, fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 13, fontWeight: 600, color: alert.color,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {alert.text}
        </span>
        <ChevronRight size={14} color={alert.color} style={{ flexShrink: 0, opacity: 0.6 }} />
      </div>
      {alerts.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          {alerts.map((_, i) => (
            <div
              key={i}
              style={{
                height: 5, borderRadius: 99, transition: 'all 0.3s',
                width: i === idx ? 16 : 5,
                background: i === idx ? alert.color : `${alert.color}55`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
