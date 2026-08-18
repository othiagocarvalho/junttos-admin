// Banner discreto na tela inicial: a loja ainda não definiu meta deste mês.
//
// Não é modal e não bloqueia nada. O X esconde até o mês virar — sem toggle
// permanente, porque a intenção é lembrar todo mês, não sumir para sempre.
//
// A decisão de exibir mora em utils/lembreteMeta.js, para ser testável.

import { Target, X, ArrowRight } from 'lucide-react'

const FONT = 'Plus Jakarta Sans, sans-serif'

export default function BannerMeta({ primary = '#5E2BD0', onDefinirMeta, onDispensar }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      background: `${primary}0F`, border: `1px solid ${primary}2E`,
      borderRadius: 16, padding: '14px 14px 14px 16px', marginBottom: 16,
      fontFamily: FONT,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: `${primary}1F`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Target size={19} color={primary} strokeWidth={2.1} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink, #18181B)', margin: '0 0 3px' }}>
          Ainda sem meta este mês
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--muted, #71717A)', lineHeight: 1.5, margin: '0 0 8px' }}>
          Defina um objetivo de faturamento e acompanhe o progresso na tela inicial.
        </p>
        <button
          type="button"
          onClick={onDefinirMeta}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: FONT, fontSize: 13, fontWeight: 800, color: primary,
          }}
        >
          Definir meta <ArrowRight size={14} strokeWidth={2.5} />
        </button>
      </div>

      <button
        type="button"
        onClick={onDispensar}
        aria-label="Esconder lembrete de meta até o mês que vem"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, flexShrink: 0, borderRadius: 8,
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: 'var(--muted, #A1A1AA)',
        }}
      >
        <X size={15} strokeWidth={2.4} />
      </button>
    </div>
  )
}
