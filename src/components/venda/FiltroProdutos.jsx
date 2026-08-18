// Faixas do Passo 2 da Nova Venda: filtro por categoria e chips do que já
// foi selecionado. Compartilhado entre o mobile (LojaFeminina/NovaVenda) e o
// desktop (DesktopNovaVenda) — mesma regra dos componentes de ResumoVenda.
//
// Só usa CSS vars do tema, então renderiza igual nos dois contextos.

import { X } from 'lucide-react'
import { CHAVE_TODOS } from '../../utils/categoriaProduto'

const FONT = 'Plus Jakarta Sans, sans-serif'

/**
 * Faixa horizontal de categorias derivadas do nome do produto.
 *
 * Não renderiza nada quando `exibir` é false — loja pequena ou sem variedade
 * ganharia só "Todos / Uma categoria / Outros", que atrapalha em vez de
 * ajudar. Ver construirCategorias em utils/categoriaProduto.js.
 */
export function ChipsCategoria({ categorias, exibir, selecionada, onSelecionar, primary }) {
  if (!exibir || !categorias?.length) return null

  return (
    <div style={{
      display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
      WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin',
    }}>
      {categorias.map(c => {
        const ativa = (selecionada || CHAVE_TODOS) === c.chave
        return (
          <button
            key={c.chave}
            type="button"
            onClick={() => onSelecionar(c.chave)}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 14px', borderRadius: 99, cursor: 'pointer',
              fontFamily: FONT, fontSize: 13, fontWeight: 700,
              border: ativa ? 'none' : '1.5px solid var(--line)',
              background: ativa ? primary : 'var(--surface)',
              color: ativa ? '#fff' : 'var(--ink-soft)',
              whiteSpace: 'nowrap', transition: 'background .15s',
            }}
          >
            {c.label}
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: ativa ? 'rgba(255,255,255,0.75)' : 'var(--muted)',
            }}>{c.total}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * O que já está no carrinho, como chip removível.
 *
 * Existe para não obrigar a rolar 141 produtos de volta só para tirar um item
 * da conta. Remove por índice: o mesmo produto pode aparecer duas vezes com
 * variações diferentes, e remover por nome tiraria as duas.
 */
export function ChipsSelecionados({ itens = [], onRemover, primary }) {
  if (!itens.length) return null
  const total = itens.reduce((s, p) => s + (p.quantidade || 1), 0)

  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--line)',
      borderRadius: 14, padding: '10px 12px',
    }}>
      <p style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px',
      }}>
        {itens.length} selecionado{itens.length === 1 ? '' : 's'}
        {total !== itens.length ? ` · ${total} peça${total === 1 ? '' : 's'}` : ''}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {itens.map((p, i) => {
          const variacao = p.variacao && p.variacao !== 'Único' ? p.variacao : (p.obs && p.obs !== 'Único' ? p.obs : '')
          return (
            <span
              key={`${p.nome}-${p.variacao || ''}-${i}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: FONT, fontSize: 12, fontWeight: 600,
                padding: '5px 6px 5px 10px', borderRadius: 8,
                background: 'var(--surface)', border: '1px solid var(--line)',
                color: 'var(--ink)', maxWidth: '100%',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.nome}{variacao ? ` — ${variacao}` : ''}{(p.quantidade || 1) > 1 ? ` ×${p.quantidade}` : ''}
              </span>
              <button
                type="button"
                onClick={() => onRemover(i)}
                aria-label={`Remover ${p.nome}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, height: 20, flexShrink: 0, borderRadius: 6,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: 'var(--muted)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${primary}1A`; e.currentTarget.style.color = primary }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
