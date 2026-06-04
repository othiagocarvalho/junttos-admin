import { Store } from 'lucide-react'

const RG = {
  primary: '#C9956C',
  border: 'rgba(201,149,108,0.2)',
  muted: '#9B8070',
}

function JunttosWordmark() {
  return (
    <span style={{
      fontFamily: "'Quicksand', sans-serif",
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: '-0.01em',
      textTransform: 'lowercase',
      color: RG.primary,
      lineHeight: 1,
    }}>
      jun<span style={{ color: '#A07050' }}>tt</span>os
    </span>
  )
}

export default function ClientHeader({ config }) {
  const nome = config?.nome || 'Loja'
  const logoUrl = config?.logo_url || null
  const primary = config?.cor_primaria || RG.primary

  return (
    <header style={{
      height: 64,
      background: '#fff',
      borderBottom: `1px solid ${RG.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Left: client branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {logoUrl ? (
          <img src={logoUrl} alt={nome} style={{ height: 36, maxWidth: 160, objectFit: 'contain' }} />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: `${primary}15`,
            border: `1px solid ${primary}30`,
            borderRadius: 10,
            padding: '6px 14px',
          }}>
            <Store size={16} color={primary} />
            <span style={{
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              color: primary,
              letterSpacing: '-0.01em',
            }}>
              {nome}
            </span>
          </div>
        )}
      </div>

      {/* Right: by Junttos badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: `${RG.primary}0d`,
        border: `1px solid ${RG.border}`,
        borderRadius: 20,
        padding: '5px 12px',
      }}>
        <span style={{ fontSize: 11, color: RG.muted, fontWeight: 500 }}>by</span>
        <JunttosWordmark />
      </div>
    </header>
  )
}
