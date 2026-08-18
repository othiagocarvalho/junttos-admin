// Resumo da venda/troca compartilhado entre mobile (LojaFeminina/NovaVenda) e
// desktop (DesktopNovaVenda dentro de ClientDashboardDesktop).
//
// O breakdown (subtotal / ajuste / total, ou crédito / produto novo / saldo) e
// os campos de ajuste estavam duplicados nos dois arquivos e já tinham
// divergido antes — ver o comentário de calcularResumoTroca em utils/venda.js.
// Tudo aqui usa só as CSS vars do tema (--bg, --line, --ink, --muted), então
// renderiza igual nos dois contextos.

import { fmtR } from '../../utils/formatters'

const FONT = 'Plus Jakarta Sans, sans-serif'
const MONO = "'Space Mono', monospace"

const linha = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }

/**
 * Breakdown de valores. Serve os dois modos:
 *  - venda: Subtotal → Ajuste (se houver) → Total
 *  - troca: Crédito devolvido → Produto novo → Ajuste (se houver) → saldo
 */
export function LinhasResumo({
  isTroca, subtotal, creditoTroca, troca,
  ajusteTipo, ajusteModo, ajusteInput, ajusteR,
  ajusteTrocaR = 0,
  totalValor, primary, style,
}) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {isTroca ? (
        <>
          <div style={linha}>
            <span style={{ fontFamily: FONT, fontSize: 12, color: '#D97706' }}>Produto devolvido (crédito)</span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: '#D97706' }}>− {fmtR(creditoTroca)}</span>
          </div>
          <div style={linha}>
            <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--muted)' }}>Produto novo</span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--ink-soft)' }}>{fmtR(subtotal)}</span>
          </div>
          {Math.abs(ajusteTrocaR) > 0.005 && (
            <div style={linha}>
              <span style={{ fontFamily: FONT, fontSize: 12, color: ajusteTrocaR < 0 ? '#dc2626' : '#16a34a' }}>
                {ajusteTrocaR < 0 ? '− Desconto' : '+ Acréscimo'}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: ajusteTrocaR < 0 ? '#dc2626' : '#16a34a' }}>
                {ajusteTrocaR < 0 ? '−' : '+'} {fmtR(Math.abs(ajusteTrocaR))}
              </span>
            </div>
          )}
          <div style={{ ...linha, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{troca.rotulo}</span>
            <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: troca.aCobrar ? primary : troca.saldoAFavor ? '#D97706' : '#16a34a' }}>
              {fmtR(troca.valorExibido)}
            </span>
          </div>
          {troca.zerada && (
            <p style={{ fontFamily: FONT, fontSize: 11, color: '#16a34a', fontWeight: 600, margin: 0 }}>✓ Sem cobrança — troca zerada</p>
          )}
          {troca.saldoAFavor && (
            <>
              <p style={{ fontFamily: FONT, fontSize: 11, color: '#D97706', fontWeight: 700, margin: 0 }}>
                Saldo a favor: {fmtR(troca.valorExibido)} — não reembolsável em dinheiro
              </p>
              <p style={{ fontFamily: FONT, fontSize: 11, color: '#D97706', margin: 0 }}>
                Produto novo mais barato. Adicione outro produto ou prossiga zerando a troca.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <div style={linha}>
            <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--muted)' }}>Subtotal</span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--ink-soft)' }}>{fmtR(subtotal)}</span>
          </div>
          {ajusteR > 0 && (
            <div style={linha}>
              <span style={{ fontFamily: FONT, fontSize: 12, color: ajusteTipo === 'desconto' ? '#dc2626' : '#16a34a' }}>
                {ajusteTipo === 'desconto' ? '− Desconto' : '+ Acréscimo'}
                {ajusteModo === 'percentual' ? ` (${ajusteInput}%)` : ''}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: ajusteTipo === 'desconto' ? '#dc2626' : '#16a34a' }}>
                {ajusteTipo === 'desconto' ? '−' : '+'} {fmtR(ajusteR)}
              </span>
            </div>
          )}
          <div style={{ ...linha, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Total</span>
            <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: primary }}>{fmtR(totalValor)}</span>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Desconto e acréscimo manuais da troca, em R$. São dois campos separados (e
 * não o par tipo+valor da venda normal) porque na troca é comum aplicar os
 * dois na mesma operação: abate a diferença e cobra a taxa de reposição.
 */
export function CamposAjusteTroca({ desconto, setDesconto, acrescimo, setAcrescimo, inputStyle, onFocus, onBlur, labelStyle, style }) {
  const campos = [
    { key: 'desc', label: 'Desconto (−R$)', cor: '#dc2626', valor: desconto,  set: setDesconto  },
    { key: 'acre', label: 'Acréscimo (+R$)', cor: '#16a34a', valor: acrescimo, set: setAcrescimo },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      <label style={labelStyle}>Ajuste manual da troca (opcional)</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {campos.map(({ key, label, cor, valor, set }) => (
          <div key={key} style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: cor, marginBottom: 5 }}>{label}</p>
            <input
              value={valor}
              onChange={e => set(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              aria-label={label}
              style={{ ...inputStyle, width: '100%' }}
              onFocus={onFocus} onBlur={onBlur}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Barra de resumo fixa na base da tela de seleção de produto (mobile).
 *
 * position:fixed, e não sticky: os contêineres acima (main e o wrapper da
 * loja) usam overflow-x:hidden, o que torna o eixo Y "auto" e faz qualquer
 * sticky descendente grudar na caixa do contêiner — que tem a altura toda do
 * conteúdo — em vez da viewport. Fixed é o único que garante o que a barra
 * precisa: nunca sair da tela, mesmo com 141 produtos na lista.
 *
 * Fica acima da BottomTabBar (68px + safe-area) e abaixo dela no empilhamento
 * (zIndex 99 contra 100), então o FAB continua clicável.
 */
export function BarraResumoMobile({ isTroca, qtdItens, totalValor, troca, onAvancar, primary, isDark, gold }) {
  const bgBotao = isDark ? gold : primary
  const rotulo = isTroca ? troca.rotulo : `${qtdItens} item${qtdItens === 1 ? '' : 's'}`
  const valor  = isTroca ? troca.valorExibido : totalValor
  const corValor = !isTroca ? 'var(--ink)' : troca.aCobrar ? primary : troca.saldoAFavor ? '#D97706' : '#16a34a'

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, zIndex: 99,
      bottom: 'calc(68px + env(safe-area-inset-bottom))',
      background: 'var(--surface)', borderTop: '1px solid var(--line)',
      boxShadow: '0 -6px 20px -12px rgba(0,0,0,0.35)',
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto', padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
            {rotulo}
          </p>
          <p style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: corValor, margin: 0, lineHeight: 1.25 }}>
            {fmtR(valor)}
          </p>
        </div>
        <button
          onClick={onAvancar}
          disabled={qtdItens === 0}
          style={{
            flexShrink: 0, height: 44, padding: '0 18px', borderRadius: 'var(--r-pill)', border: 'none',
            background: qtdItens === 0 ? 'var(--line)' : bgBotao,
            color: qtdItens === 0 ? 'var(--muted)' : isDark ? '#0A0A0A' : '#fff',
            cursor: qtdItens === 0 ? 'not-allowed' : 'pointer',
            fontFamily: FONT, fontSize: 13, fontWeight: 700,
          }}
        >
          Ir para pagamento
        </button>
      </div>
    </div>
  )
}

/** Preço de venda ao lado do nome do produto na lista de seleção. */
export function PrecoProduto({ preco, cor }) {
  const n = Number(preco || 0)
  return (
    <span style={{
      fontFamily: MONO, fontSize: 12, fontWeight: 700, flexShrink: 0,
      color: n > 0 ? (cor || 'var(--ink-soft)') : 'var(--muted)',
    }}>
      {n > 0 ? fmtR(n) : '—'}
    </span>
  )
}
