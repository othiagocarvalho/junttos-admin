import { T } from '../../theme/tokens'

const CONFIG = {
  ativo: {
    bg:   T.statusAtivoBg,
    text: T.statusAtivoTx,
    dot:  T.statusAtivoTx,
    label: 'Ativo',
  },
  trial: {
    bg:   T.statusTrialBg,
    text: T.statusTrialTx,
    dot:  T.statusTrialTx,
    label: 'Trial',
  },
  inativo: {
    bg:   T.mist,
    text: T.muted,
    dot:  T.muted2,
    label: 'Inativo',
  },
  cancelado: {
    bg:   T.tintCoral,
    text: T.coralText,
    dot:  T.coral,
    label: 'Cancelado',
  },
}

export default function StatusPill({ status, label: override }) {
  const key = (status || '').toLowerCase()
  const c   = CONFIG[key] ?? CONFIG.inativo
  const displayLabel = override ?? c.label

  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          5,
      background:   c.bg,
      color:        c.text,
      borderRadius: T.rPill,
      fontSize:     12,
      fontWeight:   600,
      padding:      '4px 10px',
      whiteSpace:   'nowrap',
      fontFamily:   "'DM Sans', sans-serif",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {displayLabel}
    </span>
  )
}
