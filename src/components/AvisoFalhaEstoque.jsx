// Aviso de estoque que NÃO foi atualizado numa venda (ou na exclusão dela).
//
// A venda já está gravada; o que falhou foi a baixa/devolução de estoque
// (produto duplicado, não encontrado, variação inexistente...). Precisa ficar
// na cara de quem vendeu — antes isso passava em silêncio. Mesmo visual do
// aviso de fiado não lançado do PDV do Mercado.
//
// `flutuante`: fixo no rodapé da tela, para as telas de histórico/relatório
// em que o aviso aparece depois de fechar o modal de exclusão.

import { AlertTriangle, X } from 'lucide-react'
import { textoAvisoEstoque, descreverFalha } from '../utils/baixaEstoque'

const FONT = 'Plus Jakarta Sans, sans-serif'

export default function AvisoFalhaEstoque({ falhas, contexto = 'venda', onFechar, flutuante = false }) {
  if (!falhas || falhas.length === 0) return null

  const caixa = (
    <div role="alert" style={{
      background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: 16,
      padding: '14px 16px', fontFamily: FONT, textAlign: 'left',
      width: '100%', boxSizing: 'border-box',
      ...(flutuante ? { boxShadow: '0 12px 32px -12px rgba(0,0,0,.35)' } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#DC2626', margin: '0 0 4px' }}>
            Atenção: estoque não atualizado
          </p>
          <p style={{ fontSize: 13.5, color: '#DC2626', margin: 0, lineHeight: 1.5 }}>
            {textoAvisoEstoque(falhas, contexto)}
          </p>
          {falhas.length > 1 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#B91C1C', fontSize: 12.5, lineHeight: 1.5 }}>
              {falhas.map((f, i) => <li key={i}>{descreverFalha(f)}</li>)}
            </ul>
          )}
        </div>
        {onFechar && (
          <button type="button" onClick={onFechar} aria-label="Fechar aviso de estoque"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 2, display: 'flex', flexShrink: 0 }}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )

  if (!flutuante) return caixa
  return (
    <div style={{
      position: 'fixed', left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))',
      zIndex: 500, display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{ width: '100%', maxWidth: 520, pointerEvents: 'auto' }}>{caixa}</div>
    </div>
  )
}
