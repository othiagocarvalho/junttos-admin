// Bloco "Comissão por vendedor(a)" dos Relatórios.
//
// Componente compartilhado porque o mobile (Relatorios.jsx) já tinha o bloco e
// o desktop (RelatoriosDesktop.jsx) NÃO tinha nenhum — a feature existia só em
// metade do produto. Um componente só entrega os dois e evita que o cálculo
// volte a divergir entre as telas.
//
// Busca os vendedores sozinho, pelo mesmo motivo do CRUD: as duas telas de
// relatório recebem props diferentes, e um hook autossuficiente não obriga a
// mexer na assinatura de ninguém.

import { fmtR } from '../../utils/formatters'
import { useVendedores } from './useVendedores'
import { calcularComissoes, totalComissoes } from '../../utils/comissao'

export default function ComissaoVendedores({ lojaId, vendas = [], theme, compacto = false }) {
  // Inativos entram: quem vendeu no período tem comissão a receber mesmo que
  // já tenha saído da loja.
  const { vendedores } = useVendedores(lojaId)
  const linhas = calcularComissoes(vendas, vendedores)

  // Sem ninguém a comissionar não há bloco. Vendas sem vendedor não contam —
  // não existe quem receber.
  if (linhas.length === 0) return null

  const total = totalComissoes(linhas)
  const semPercentual = linhas.every(l => l.pct === 0)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r-card)', padding: compacto ? '20px 18px' : '22px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <p style={{
          margin: 0, flex: 1, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10,
          fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em',
        }}>
          Comissão por vendedor(a)
        </p>
        {total > 0 && (
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
            Total: <strong style={{ color: 'var(--ink)' }}>{fmtR(total)}</strong>
          </span>
        )}
      </div>

      {semPercentual && (
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: '#ca8a04',
          background: 'rgba(202,138,4,0.08)', border: '1px solid rgba(202,138,4,0.2)',
          borderRadius: 'var(--r-input)', padding: '8px 12px', marginBottom: 12, lineHeight: 1.45,
        }}>
          Defina o percentual de cada vendedor em Configurações → Vendedores.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {linhas.map(l => (
          <div key={l.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
                color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{l.nome}</p>
              <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                {fmtR(l.total)} vendido · {l.pct}% comissão
                {/* Nome que aparece em venda mas não está no cadastro: texto
                    livre da época anterior, ou vendedor removido à mão. Some
                    do relatório seria pior — assim a lojista vê o que falta. */}
                {!l.cadastrado && ' · sem cadastro'}
              </p>
            </div>
            <span style={{
              fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700,
              color: theme?.primary, flexShrink: 0,
            }}>{fmtR(l.comissao)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
