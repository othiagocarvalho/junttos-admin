import { Barcode, Camera, Package, CalendarClock, Receipt } from 'lucide-react'

function fmtK(v) {
  if (v === 0) return 'R$ 0'
  if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(1).replace('.', ',').replace(',0', '') + 'k'
  return 'R$ ' + Math.round(v)
}

function JunttosLogo() {
  return (
    <div style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
      <span style={{ position: 'absolute', left: 1, top: 0, width: 15, height: 15, borderRadius: '50%', background: '#F2643C', display: 'block' }} />
      <span style={{ position: 'absolute', right: 1, top: 0, width: 15, height: 15, borderRadius: '50%', background: '#5E2BD0', display: 'block' }} />
      <span style={{ position: 'absolute', left: 1, bottom: 0, width: 36, height: 17, borderRadius: 999, background: '#5E2BD0', display: 'block' }} />
    </div>
  )
}

function IconBox({ children }) {
  return (
    <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </div>
  )
}

export default function Menu({ vendas = [], config = {}, setTab }) {
  const now = new Date()
  const todayStr = now.toDateString()
  const vendasHoje = vendas.filter(v => new Date(v.data).toDateString() === todayStr)
  const totalHoje = vendasHoje.reduce((s, v) => s + Number(v.valor), 0)
  const nomeLoja = config?.nome || 'Mercado'
  const dayStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dayCapitalized = dayStr.charAt(0).toUpperCase() + dayStr.slice(1)

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/* Topo */}
      <div style={{ padding: '14px 22px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <JunttosLogo />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 21, fontWeight: 800, color: '#18181B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeLoja}</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#8A8A93', margin: 0 }}>{dayCapitalized} · caixa aberto</p>
        </div>
      </div>

      {/* Grade 2×3 */}
      <div style={{
        flex: 1, padding: '0 22px 14px', minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1.35fr 1fr 1fr',
        gap: 14,
      }}>
        {/* Vender — span 2 cols */}
        <div style={{
          gridColumn: 'span 2', background: '#17864F', borderRadius: 26, padding: '22px 24px',
          display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 22, right: 24, opacity: .85, pointerEvents: 'none' }}>
            <Barcode size={44} color="#FFFFFF" strokeWidth={1.6} />
          </div>
          <p style={{ fontSize: 34, fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px', lineHeight: 1 }}>Vender</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.88)', margin: '0 0 auto' }}>
            {fmtK(totalHoje)} vendidos hoje · {vendasHoje.length} {vendasHoje.length === 1 ? 'venda' : 'vendas'}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={() => setTab('venda')}
              style={{
                flex: 1.5, height: 64, borderRadius: 18, border: 'none', minHeight: 56,
                background: '#FFFFFF', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 20, fontWeight: 800, color: '#0F5C36',
              }}
            >
              <Camera size={20} color="#0F5C36" strokeWidth={2.2} />
              Bipar agora
            </button>
            <button
              onClick={() => setTab('venda')}
              style={{
                flex: 1, height: 64, borderRadius: 18, border: 'none', minHeight: 56,
                background: 'rgba(255,255,255,.2)', cursor: 'pointer',
                fontSize: 18, fontWeight: 800, color: '#FFFFFF',
              }}
            >
              Digitar
            </button>
          </div>
        </div>

        {/* Cadastrar produto */}
        <div
          onClick={() => setTab('estoque')}
          style={{
            background: '#0E7C86', borderRadius: 24, padding: '20px 18px',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}
        >
          <IconBox>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </IconBox>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
            Cadastrar<br/>produto
          </p>
        </div>

        {/* Estoque */}
        <div style={{
          background: '#1E63C8', borderRadius: 24, padding: '20px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', cursor: 'default',
        }}>
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <span style={{ background: '#FFF', color: '#1E63C8', fontSize: 15, fontWeight: 800, padding: '3px 12px', borderRadius: 999 }}>6</span>
          </div>
          <IconBox><Package size={24} color="#FFF" strokeWidth={2.2} /></IconBox>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Estoque</p>
        </div>

        {/* Validade */}
        <div style={{
          background: '#E07A0C', borderRadius: 24, padding: '20px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', cursor: 'default',
        }}>
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <span style={{ background: '#FFF', color: '#E07A0C', fontSize: 15, fontWeight: 800, padding: '3px 12px', borderRadius: 999 }}>4</span>
          </div>
          <IconBox><CalendarClock size={24} color="#FFF" strokeWidth={2.2} /></IconBox>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Validade</p>
        </div>

        {/* Fiado */}
        <div style={{
          background: '#5E2BD0', borderRadius: 24, padding: '20px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          cursor: 'default',
        }}>
          <IconBox><Receipt size={24} color="#FFF" strokeWidth={2.2} /></IconBox>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Fiado</p>
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ padding: '0 22px 28px', display: 'flex', gap: 12, flexShrink: 0 }}>
        <button style={{
          flex: 1, height: 62, borderRadius: 18, border: 'none', minHeight: 56,
          background: '#3A3A44', color: '#FFFFFF', cursor: 'default',
          fontSize: 18, fontWeight: 800,
        }}>Caixa</button>
        <button style={{
          width: 120, height: 62, borderRadius: 18, border: 'none', minHeight: 56,
          background: '#F4F4F7', color: '#3F3F46', cursor: 'default',
          fontSize: 18, fontWeight: 800,
        }}>Ajuda</button>
      </div>
    </div>
  )
}
