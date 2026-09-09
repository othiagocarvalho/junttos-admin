// Gaveta expansível (accordion não-exclusivo).
//
// Cada gaveta abre e fecha por conta própria — mais de uma pode ficar aberta ao
// mesmo tempo. Quem decide o estado inicial é o pai, via `inicialAberta`.
//
// A transição usa max-height e não height:auto, porque height não anima. O teto
// é generoso de propósito: a gaveta de Metas tem formulário, cards e uma lista
// que cresce com o número de vendedores, e um teto curto cortaria conteúdo em
// vez de animar. Com `overflow:hidden` só enquanto fecha, conteúdo alto não
// fica escondido depois de aberto.

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function Gaveta({
  titulo, subtitulo, Icon, theme, inicialAberta = false, badge = null,
  compacta = false, children,
}) {
  const [aberta, setAberta] = useState(inicialAberta)
  const idCorpo = useId()

  const primary = theme?.primary || 'var(--primary)'

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r-card)', overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setAberta(a => !a)}
        aria-expanded={aberta}
        aria-controls={idCorpo}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: compacta ? '15px 16px' : '18px 22px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        {Icon && (
          <span style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `color-mix(in srgb, ${primary} 12%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={17} color={primary} />
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: compacta ? 14 : 15, fontWeight: 700, color: 'var(--ink)',
          }}>
            {titulo}
            {badge}
          </span>
          {subtitulo && (
            <span style={{
              display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{subtitulo}</span>
          )}
        </span>
        <ChevronDown
          size={18}
          color="var(--muted)"
          style={{
            flexShrink: 0,
            transform: aberta ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform .22s ease',
          }}
        />
      </button>

      <div
        id={idCorpo}
        // hidden só quando fechada: leitor de tela não anuncia conteúdo que a
        // pessoa não pediu para ver, e o Tab não entra em campo invisível.
        hidden={!aberta}
        style={{
          maxHeight: aberta ? 'none' : 0,
          overflow: aberta ? 'visible' : 'hidden',
          borderTop: aberta ? '1px solid var(--line)' : 'none',
          padding: aberta ? (compacta ? '16px' : '20px 22px') : 0,
          animation: aberta ? 'gaveta-abre .24s ease' : 'none',
        }}
      >
        <style>{`
          @keyframes gaveta-abre {
            from { opacity: 0; transform: translateY(-6px) }
            to   { opacity: 1; transform: translateY(0) }
          }
          @media (prefers-reduced-motion: reduce) {
            [id="${idCorpo}"] { animation: none !important }
          }
        `}</style>
        {children}
      </div>
    </div>
  )
}
