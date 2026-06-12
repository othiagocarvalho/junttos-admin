import { T } from '../../theme/tokens'

export default function Card({ children, dark = false, style: extra = {}, ...props }) {
  return (
    <div
      style={{
        background:   dark ? T.darkCard : T.white,
        borderRadius: T.rCard,
        boxShadow:    dark ? T.darkCardShadow : T.cardShadow,
        border:       dark ? `1px solid ${T.darkLine}` : 'none',
        ...extra,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
