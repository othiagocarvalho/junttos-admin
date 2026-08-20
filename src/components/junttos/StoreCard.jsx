import { useState } from 'react'
import { Copy, ExternalLink, Check, Share2, Trash2, ChevronRight } from 'lucide-react'
import StatusPill from './StatusPill'
import { T } from '../../theme/tokens'

/**
 * onOpen (opcional) — abre a tela de detalhe/contrato da loja.
 *
 * Enquanto não existia, /clientes/:slug só era alcançável digitando a URL na
 * mão: a tela de contrato estava pronta e invisível. Fica opcional para o card
 * seguir servindo a listagens que não têm para onde navegar.
 */
export default function StoreCard({ nome, slug, status, logoUrl, primary = T.purple, link, rede, onDelete, onOpen }) {
  const [copied, setCopied] = useState(false)

  const initials = (nome || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div
      style={{
        background:   T.white,
        borderRadius: T.rCard,
        boxShadow:    T.cardShadow,
        border:       `1px solid ${T.line}`,
        display:      'flex',
        flexDirection:'column',
        transition:   'box-shadow .18s, transform .18s',
        fontFamily:   T.ui,
        overflow:     'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow  = T.cardShadowHover
        e.currentTarget.style.transform  = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow  = T.cardShadow
        e.currentTarget.style.transform  = 'none'
      }}
    >
      {/* Top — vira área clicável para o detalhe quando onOpen é fornecido */}
      <div
        onClick={onOpen}
        onKeyDown={onOpen ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }) : undefined}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        title={onOpen ? `Abrir detalhes de ${nome}` : undefined}
        style={{
          padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 12,
          cursor: onOpen ? 'pointer' : 'default',
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={nome}
            style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'contain', border: `1px solid ${T.line}`, background: T.mist, flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 46, height: 46, borderRadius: 10, flexShrink: 0,
            background: `${primary}18`,
            border: `1px solid ${primary}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: primary,
          }}>
            {initials}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nome}
          </p>
          <p style={{ fontSize: 11.5, color: T.muted2, margin: 0, fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            /{slug}
          </p>
          {rede && (
            <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: T.tintPurple, border: `1px solid ${T.purple}28` }}>
              <Share2 size={9} color={T.purpleText} />
              <span style={{ fontSize: 10, fontWeight: 600, color: T.purpleText, fontFamily: T.ui, whiteSpace: 'nowrap' }}>{rede}</span>
            </div>
          )}
        </div>

        <StatusPill status={status || 'ativo'} />

        {onOpen && (
          <ChevronRight size={16} color={T.muted2} style={{ flexShrink: 0, marginLeft: -2 }} />
        )}
      </div>

      {/* Faixa "Detalhes" — afordância explícita para /clientes/:slug.
          Fica fora do rodapé de propósito: aquele espaço já tem link, copiar,
          abrir e excluir, e espremer mais um botão de 300px derruba tudo. */}
      {onOpen && (
        <button
          onClick={onOpen}
          title={`Abrir detalhes de ${nome}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', minHeight: 44, padding: '0 18px',
            border: 'none', borderTop: `1px solid ${T.line}`,
            background: T.white, cursor: 'pointer',
            fontFamily: T.ui, fontSize: 12.5, fontWeight: 700, color: T.purpleText,
            transition: 'background .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.tintPurple }}
          onMouseLeave={e => { e.currentTarget.style.background = T.white }}
        >
          Detalhes e contrato
          <ChevronRight size={14} />
        </button>
      )}

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${T.line}`,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        background: T.mist,
      }}>
        <span style={{
          flex: 1, fontSize: 11, color: T.muted,
          fontFamily: T.mono,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {link}
        </span>

        {onDelete && (
          <button
            onClick={onDelete}
            title="Excluir loja"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, minWidth: 32, minHeight: 44,
              background: T.white, border: `1px solid ${T.line}`,
              borderRadius: 8, cursor: 'pointer', flexShrink: 0,
              transition: 'border-color .15s, background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.coral; e.currentTarget.style.background = T.tintCoral }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.background = T.white }}
          >
            <Trash2 size={13} color={T.coralText} />
          </button>
        )}

        <button
          onClick={handleCopy}
          title="Copiar link"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, minWidth: 32, minHeight: 44,
            background: T.white, border: `1px solid ${T.line}`,
            borderRadius: 8, cursor: 'pointer', flexShrink: 0,
            transition: 'border-color .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.line }}
        >
          {copied
            ? <Check size={13} color={T.statusAtivoTx} />
            : <Copy size={13} color={T.muted} />
          }
        </button>

        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, minHeight: 44, flexShrink: 0,
            background: T.purple, borderRadius: 8,
            transition: 'background .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.purpleDeep }}
          onMouseLeave={e => { e.currentTarget.style.background = T.purple }}
        >
          <ExternalLink size={13} color={T.white} />
        </a>
      </div>
    </div>
  )
}
