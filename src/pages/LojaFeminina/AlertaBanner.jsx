import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, CreditCard, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { temAcesso } from '../../utils/planos'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

export default function AlertaBanner({ vendas, metas, produtosData = [], lojaId, plano, setTab, theme = {} }) {
  const [contasData, setContasData] = useState(null)
  const [idx, setIdx] = useState(0)

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
      bg: '#D85A30',
      title: 'Estoque baixo',
      sub: produtosBaixos.length === 1
        ? produtosBaixos[0].nome
        : `${produtosBaixos.length} produtos com estoque baixo`,
      tab: 'estoque',
    })
  }

  if (temAcesso(plano, 'pro') && meta > 0 && totalMes >= meta) {
    alerts.push({
      type: 'meta',
      Icon: TrendingUp,
      bg: '#1F8A5B',
      title: 'Meta batida!',
      sub: `Você atingiu ${fmtR(totalMes)} este mês`,
      tab: 'meta',
    })
  }

  if (contasData && contasData.length > 0) {
    alerts.push({
      type: 'conta',
      Icon: CreditCard,
      bg: '#C0392B',
      title: 'Conta vence em breve',
      sub: contasData.length === 1
        ? contasData[0].descricao
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
        marginBottom: 14,
        borderRadius: 12,
        padding: '14px 16px',
        background: alert.bg,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={16} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {alert.title}
          </div>
          {alert.sub && (
            <div style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 11.5,
              color: 'rgba(255,255,255,0.85)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 1,
            }}>
              {alert.sub}
            </div>
          )}
        </div>
        <ChevronRight size={16} color="rgba(255,255,255,0.65)" style={{ flexShrink: 0 }} />
      </div>
      {alerts.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }}>
          {alerts.map((_, i) => (
            <div
              key={i}
              style={{
                height: 4,
                borderRadius: 99,
                transition: 'all 0.3s',
                width: i === idx ? 16 : 4,
                background: i === idx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
