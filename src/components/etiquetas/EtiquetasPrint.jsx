// Modal de impressão de etiquetas com código de barras.
//
// Uma etiqueta por VARIAÇÃO (ver a justificativa em src/utils/codigoBarras.js).
// O @media print esconde o resto da página e imprime só a folha de etiquetas —
// sem isso, o navegador levaria junto o cabeçalho, os menus e o modal.
//
// JsBarcode desenha em <svg> e não em <canvas> de propósito: canvas sai
// borrado na impressão (rasteriza na resolução da tela, não na da impressora),
// e código de barras borrado não bipa.

import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { X, Printer } from 'lucide-react'
import { fmtR } from '../../utils/formatters'

/** Uma etiqueta. O SVG é preenchido por efeito, depois do nó existir. */
function Etiqueta({ dados, mostrarPreco }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current || !dados.codigo) return
    try {
      JsBarcode(svgRef.current, dados.codigo, {
        format: 'CODE128',
        // Code128 aceita ASCII inteiro; o código só usa A-Z, 0-9 e hífen.
        width: 1.6,        // largura da barra mais fina, em px
        height: 42,
        displayValue: true,
        fontSize: 11,
        margin: 0,
        textMargin: 2,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch (e) {
      // Defensivo e, na prática, inalcançável: codigoDaVariacao só produz
      // [A-Z0-9-], que o Code128 sempre aceita (coberto em
      // codigoBarras.test.js). Se um dia mudar, a etiqueta sai sem as barras
      // mas com nome e variação legíveis — melhor do que derrubar a folha.
      console.warn('[etiquetas] não foi possível desenhar o código', dados.codigo, e)
    }
  }, [dados.codigo])

  return (
    <div className="etq-item">
      <p className="etq-nome">{dados.nome}</p>
      <p className="etq-var">{dados.rotulo}{mostrarPreco && dados.preco > 0 ? ` · ${fmtR(dados.preco)}` : ''}</p>
      <svg ref={svgRef} className="etq-svg" />
    </div>
  )
}

/**
 * @param etiquetas  saída de etiquetasDoProduto / etiquetasDeProdutos
 * @param aoFechar   fecha o modal
 * @param theme      só para a cor do botão principal
 */
export default function EtiquetasPrint({ etiquetas = [], aoFechar, theme }) {
  // Quantas cópias de cada etiqueta. O padrão é 1; "por quantidade em estoque"
  // é o caso real de quem acabou de receber um lote e vai etiquetar peça a peça.
  const [modo, setModo] = useState('uma')
  const [mostrarPreco, setMostrarPreco] = useState(true)

  useEffect(() => {
    function aoTeclar(e) { if (e.key === 'Escape') aoFechar?.() }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  const expandidas = etiquetas.flatMap(et => {
    const n = modo === 'estoque' ? Math.max(1, et.quantidade || 1) : 1
    return Array.from({ length: n }, (_, i) => ({ ...et, _k: `${et.codigo}-${i}` }))
  })

  const semEtiqueta = etiquetas.length === 0

  return (
    <div className="etq-overlay" onClick={e => e.target === e.currentTarget && aoFechar?.()}>
      <style>{`
        .etq-overlay {
          position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,.5);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .etq-painel {
          background: var(--surface); border-radius: 18px; width: min(880px, 100%);
          max-height: 92vh; display: flex; flex-direction: column; overflow: hidden;
        }
        .etq-topo {
          display: flex; align-items: center; gap: 12px; padding: 18px 20px;
          border-bottom: 1px solid var(--line);
        }
        .etq-corpo { padding: 16px 20px; overflow: auto; background: var(--bg); }
        .etq-folha {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(min(46%, 200px), 200px));
          gap: 8px; justify-content: center;
        }
        .etq-item {
          background: #fff; border: 1px solid #ddd; border-radius: 6px;
          padding: 7px 8px 5px; text-align: center; break-inside: avoid;
          page-break-inside: avoid; color: #000;
        }
        .etq-nome {
          margin: 0; font-size: 10px; font-weight: 700; line-height: 1.2;
          text-transform: uppercase; overflow: hidden; text-overflow: ellipsis;
          white-space: nowrap;
        }
        .etq-var { margin: 1px 0 3px; font-size: 9.5px; color: #444; }
        .etq-svg { display: block; width: 100%; height: auto; }
        .etq-erro { margin: 0; font-family: monospace; font-size: 10px; }

        /* ── Impressão ────────────────────────────────────────────────────
           Sem isto o navegador imprime a página inteira por baixo do modal:
           cabeçalho, menu lateral e o overlay escuro virariam um retângulo
           cinza gastando tinta. */
        @media print {
          body * { visibility: hidden !important; }
          .etq-folha, .etq-folha * { visibility: visible !important; }
          .etq-overlay {
            position: static !important; background: none !important;
            padding: 0 !important; display: block !important;
          }
          .etq-painel {
            max-height: none !important; border-radius: 0 !important;
            width: 100% !important; box-shadow: none !important;
          }
          .etq-topo, .etq-rodape { display: none !important; }
          .etq-corpo { padding: 0 !important; overflow: visible !important; background: #fff !important; }
          .etq-folha {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 4mm !important; justify-content: start !important;
          }
          .etq-item { border: 1px dashed #999 !important; }
          @page { margin: 8mm; }
        }
      `}</style>

      <div className="etq-painel">
        <div className="etq-topo">
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
              Etiquetas
            </p>
            <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--muted)' }}>
              {semEtiqueta
                ? 'Nenhuma variação para etiquetar'
                : `${expandidas.length} etiqueta${expandidas.length > 1 ? 's' : ''} · uma por variação`}
            </p>
          </div>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
              border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><X size={16} /></button>
        </div>

        <div className="etq-corpo">
          {semEtiqueta ? (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--muted)', padding: '30px 10px', textAlign: 'center', lineHeight: 1.5 }}>
              Só é possível etiquetar produto que tenha grade cadastrada — a etiqueta
              carrega a variação, que é o que dá baixa no estoque.
            </p>
          ) : (
            <div className="etq-folha">
              {expandidas.map(et => (
                <Etiqueta key={et._k} dados={et} mostrarPreco={mostrarPreco} />
              ))}
            </div>
          )}
        </div>

        {!semEtiqueta && (
          <div className="etq-rodape" style={{
            display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
            padding: '14px 20px', borderTop: '1px solid var(--line)',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={modo === 'estoque'}
                onChange={e => setModo(e.target.checked ? 'estoque' : 'uma')}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: theme?.primary }}
              />
              Uma por peça em estoque
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={mostrarPreco}
                onChange={e => setMostrarPreco(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: theme?.primary }}
              />
              Mostrar preço
            </label>
            <button
              onClick={() => window.print()}
              style={{
                marginLeft: 'auto', height: 42, padding: '0 20px', borderRadius: 10, border: 'none',
                background: theme?.primary || 'var(--ink)', color: '#fff', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            ><Printer size={15} /> Imprimir</button>
          </div>
        )}
      </div>
    </div>
  )
}
