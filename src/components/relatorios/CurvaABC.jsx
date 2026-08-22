// Tabela da Curva ABC de produtos.
//
// Marcação idêntica à que vivia inline em Relatorios.jsx — só saiu de lá para
// poder ser usada também na gaveta de Metas & Resultados sem duplicar regra
// nem estilo.

import { fmtR } from '../../utils/formatters'
import { calcularCurvaABC } from '../../utils/curvaABC'

const CORES = {
  A: { bg: 'rgba(22,163,74,0.12)',   cor: '#16a34a' },
  B: { bg: 'rgba(202,138,4,0.12)',   cor: '#ca8a04' },
  C: { bg: 'rgba(107,114,128,0.12)', cor: '#6b7280' },
}

const COLUNAS = '1fr auto auto auto'

export default function CurvaABC({ vendas = [], theme, semTitulo = false }) {
  const linhas = calcularCurvaABC(vendas)

  if (linhas.length === 0) {
    return (
      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
        Nenhuma venda com produto no período selecionado.
      </p>
    )
  }

  return (
    <div>
      {!semTitulo && (
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
          color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16,
        }}>
          Curva ABC de produtos
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLUNAS, gap: '0 12px', padding: '0 4px 8px', borderBottom: '1px solid var(--line)', marginBottom: 6 }}>
          {['Produto', 'Qtd', 'Total', 'Classe'].map(h => (
            <span key={h} style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</span>
          ))}
        </div>
        {linhas.map(p => {
          const c = CORES[p.classe] || CORES.C
          return (
            <div key={p.nome} style={{ display: 'grid', gridTemplateColumns: COLUNAS, gap: '0 12px', padding: '8px 4px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
              <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{p.qtd}×</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: theme?.primary, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtR(p.valor)}</span>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: c.bg, color: c.cor, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>{p.classe}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
