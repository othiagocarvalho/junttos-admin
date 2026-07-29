import { ExternalLink } from 'lucide-react'
import { T } from '../../theme/tokens'
import ConsultorLayout from './ConsultorLayout'

const DEMO_URL        = `${window.location.origin}/sualoja/dashboard`
const DEMO_URL_MOBILE = `${window.location.origin}/sualoja/dashboard?forceMobile=1`

export default function ConsultorDemo() {
  return (
    <ConsultorLayout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        {/* Header */}
        <div style={{ width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>
            Demo — Sua Loja
          </h1>
          <p style={{ fontSize: 14, color: T.muted, marginBottom: 12 }}>
            Mostre ao cliente como a Junttos funciona na prática.
          </p>
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 44, padding: '0 20px', borderRadius: T.rPill,
              background: T.purple, color: '#fff', textDecoration: 'none',
              fontSize: 14, fontWeight: 700,
              boxShadow: '0 4px 16px rgba(94,43,208,0.28)',
            }}
          >
            <ExternalLink size={15} /> Abrir em nova aba
          </a>
        </div>

        {/* Phone frame — scale(0.78) → cabe em telas a partir de 360px wide */}
        <div style={{ transform: 'scale(0.78)', transformOrigin: 'top center', marginBottom: -196 }}>
          <div style={{
            background: '#141414',
            borderRadius: 52,
            padding: '18px 12px 30px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.06) inset',
          }}>
            {/* Dynamic Island */}
            <div style={{
              width: 116, height: 30, background: '#141414',
              borderRadius: '0 0 20px 20px',
              margin: '-18px auto 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <div style={{ width: 56, height: 5, borderRadius: 99, background: '#2a2a2a' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1e1e1e', border: '1.5px solid #3a3a3a' }} />
            </div>
            {/* Screen */}
            <div style={{ borderRadius: 40, overflow: 'hidden', width: 375, height: 812, background: '#000' }}>
              <iframe
                src={DEMO_URL_MOBILE}
                width={375}
                height={812}
                style={{ border: 'none', display: 'block' }}
                title="Demo — Sua Loja"
              />
            </div>
            {/* Home bar */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <div style={{ width: 120, height: 5, borderRadius: 99, background: '#333' }} />
            </div>
          </div>
        </div>
      </div>
    </ConsultorLayout>
  )
}
