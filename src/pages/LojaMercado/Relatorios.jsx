import { useState, useMemo } from 'react'
import { ChevronLeft, TrendingUp, Receipt, ShoppingBag, Calendar } from 'lucide-react'
import { filtrarPorPeriodo, totaisDoPeriodo, porFormaPgto, porDia } from '../../utils/relatorioVendas'
import { fmtR } from '../../utils/formatters'

const GREEN = '#17864F'

// Cor por forma de pagamento. O Mercado tem quatro fixas (Dinheiro, Pix,
// Cartão, Fiado) — qualquer outra que apareça no banco cai no cinza.
const COR_PGTO = {
  Dinheiro: '#17864F',
  Pix:      '#0EA5E9',
  'Cartão': '#8B5CF6',
  Fiado:    '#D97706',
}

/** 'YYYY-MM-DD' de hoje, montado à mão — toISOString() muda o dia. */
function hojeISO(offsetDias = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Kpi({ label, valor, Icon, destaque }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: destaque ? GREEN : '#F4F4F7',
      borderRadius: 18, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Icon size={15} color={destaque ? 'rgba(255,255,255,.85)' : '#71717A'} strokeWidth={2.4} />
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: destaque ? 'rgba(255,255,255,.85)' : '#71717A',
        }}>{label}</span>
      </div>
      <p style={{
        fontFamily: "'Space Mono', monospace", fontSize: destaque ? 30 : 22, fontWeight: 700,
        color: destaque ? '#FFFFFF' : '#18181B', margin: 0, lineHeight: 1.1,
      }}>{valor}</p>
    </div>
  )
}

export default function Relatorios({ vendas = [], setTab }) {
  // Abre já no dia de hoje: é o que o dono do mercado olha ao fechar o dia.
  const [de,  setDe]  = useState(hojeISO)
  const [ate, setAte] = useState(hojeISO)

  const filtradas = useMemo(() => filtrarPorPeriodo(vendas, de, ate), [vendas, de, ate])
  const totais    = useMemo(() => totaisDoPeriodo(filtradas), [filtradas])
  const formas    = useMemo(() => porFormaPgto(filtradas), [filtradas])
  const dias      = useMemo(() => porDia(filtradas), [filtradas])
  const maxDia    = dias.length ? Math.max(...dias.map(d => d.total)) : 0

  const atalhos = [
    { label: 'Hoje',       de: hojeISO(),    ate: hojeISO() },
    { label: '7 dias',     de: hojeISO(-6),  ate: hojeISO() },
    { label: '30 dias',    de: hojeISO(-29), ate: hojeISO() },
  ]

  const inputData = {
    width: '100%', height: 52, background: '#F4F4F7', border: 'none',
    borderRadius: 14, padding: '0 14px', fontSize: 16, fontWeight: 600,
    color: '#18181B', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: GREEN, padding: '14px 22px 24px', flexShrink: 0 }}>
        <button onClick={() => setTab('inicio')} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16,
        }}>
          <ChevronLeft size={24} color="#FFF" strokeWidth={2.5} />
          <span style={{ fontSize: 17, fontWeight: 800, color: '#FFF' }}>Menu</span>
        </button>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.85)', margin: '0 0 4px' }}>
          Vendeu no período
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 52, fontWeight: 700, color: '#FFF', margin: 0, lineHeight: 1 }}>
          {fmtR(totais.total)}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 40px' }}>
        {/* Atalhos de período */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {atalhos.map(a => {
            const ativo = de === a.de && ate === a.ate
            return (
              <button key={a.label} onClick={() => { setDe(a.de); setAte(a.ate) }} style={{
                padding: '9px 16px', borderRadius: 999, cursor: 'pointer',
                border: ativo ? 'none' : '2px solid #E4E4E7',
                background: ativo ? GREEN : '#FFFFFF',
                color: ativo ? '#FFFFFF' : '#3F3F46',
                fontSize: 14, fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>{a.label}</button>
            )
          })}
        </div>

        {/* De / Até */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#71717A', marginBottom: 8 }}>
              <Calendar size={13} /> De
            </label>
            <input type="date" value={de} max={ate || undefined} onChange={e => setDe(e.target.value)} style={inputData} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#71717A', marginBottom: 8 }}>
              <Calendar size={13} /> Até
            </label>
            <input type="date" value={ate} min={de || undefined} onChange={e => setAte(e.target.value)} style={inputData} />
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <Kpi label="Faturamento" valor={fmtR(totais.total)} Icon={TrendingUp} destaque />
          <Kpi label="Vendas"       valor={String(totais.quantidade)} Icon={Receipt} />
          <Kpi label="Ticket médio" valor={fmtR(totais.ticketMedio)} Icon={ShoppingBag} />
          <Kpi label="Itens"        valor={String(totais.itens)} Icon={ShoppingBag} />
        </div>

        {filtradas.length === 0 ? (
          <div style={{ background: '#F4F4F7', borderRadius: 18, padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#3F3F46', margin: '0 0 6px' }}>
              Nenhuma venda no período
            </p>
            <p style={{ fontSize: 14, color: '#71717A', margin: 0 }}>
              Escolha outras datas ou registre uma venda no PDV.
            </p>
          </div>
        ) : (
          <>
            {/* Formas de pagamento */}
            <p style={{ fontSize: 17, fontWeight: 800, color: '#18181B', margin: '0 0 14px' }}>
              Como o cliente pagou
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {formas.map(f => (
                <div key={f.forma} style={{ background: '#F4F4F7', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#18181B' }}>{f.forma}</span>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 17, fontWeight: 700, color: '#18181B' }}>
                      {fmtR(f.valor)}
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: '#E4E4E7', overflow: 'hidden' }}>
                    <div style={{
                      width: `${f.pct}%`, height: '100%', borderRadius: 999,
                      background: COR_PGTO[f.forma] || '#A1A1AA', transition: 'width .3s',
                    }} />
                  </div>
                  <p style={{ fontSize: 13, color: '#71717A', margin: '7px 0 0', fontWeight: 600 }}>
                    {f.pct.toFixed(0).replace('.', ',')}% do período
                  </p>
                </div>
              ))}
            </div>

            {/* Por dia */}
            {dias.length > 1 && (
              <>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#18181B', margin: '0 0 14px' }}>
                  Dia a dia
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dias.map(d => (
                    <div key={d.chave} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#71717A', width: 54, flexShrink: 0 }}>
                        {d.label}
                      </span>
                      <div style={{ flex: 1, height: 30, borderRadius: 8, background: '#F4F4F7', overflow: 'hidden' }}>
                        <div style={{
                          width: maxDia > 0 ? `${(d.total / maxDia) * 100}%` : '0%',
                          height: '100%', background: GREEN, borderRadius: 8, transition: 'width .3s',
                        }} />
                      </div>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: '#18181B', width: 92, textAlign: 'right', flexShrink: 0 }}>
                        {fmtR(d.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
