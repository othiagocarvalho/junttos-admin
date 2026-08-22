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

// ─────────────────────────────────────────────────────────────────────────────
// Impressora térmica de rolo (Elgin / Bematech L42 Pro Full).
//
// Todo o CSS de impressão térmica deriva destas cinco constantes — corrigir
// uma medida é trocar um número, não reescrever layout.
//
// Como ajustar depois de um teste na loja:
//   • etiqueta saindo cortada na largura    → LABEL_WIDTH_MM
//   • etiqueta cortada em cima/embaixo      → LABEL_HEIGHT_MM
//   • colunas desalinhadas do picote        → LABEL_GAP_MM
//   • sobra ou falta papel na lateral       → PAPER_WIDTH_MM
//   • rolo com 2 ou 4 etiquetas por fileira → LABEL_COLUMNS
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ AJUSTE EMPÍRICO DE 23/08/2026, AINDA NÃO CONFIRMADO.
//
// O teste físico na Elgin/Bematech mostrou a etiqueta saindo VISIVELMENTE
// MENOR que a célula pré-cortada do rolo, com sobra de branco em volta — e a
// sobra era em todos os lados, não só num. Encolhimento uniforme assim é
// assinatura de escala: a impressora (ou o driver) reduz a página para caber
// na área imprimível dela, em vez de a nossa medida estar errada por acaso.
//
// Primeira tentativa: subir as três medidas ~21% de forma proporcional. Se o
// driver reduz por um fator fixo, declarar uma página maior faz o resultado
// impresso chegar no tamanho da célula.
//
//   LABEL_WIDTH_MM   33 → 40   (+21,2%)
//   LABEL_HEIGHT_MM  25 → 30   (+20,0%)
//   PAPER_WIDTH_MM  100 → 121  (+21,0%)
//
// A medição anterior (33mm com régua, em 22/08) NÃO foi descartada: ela mede a
// CÉLULA FÍSICA, que continua com 33mm. O 40 daqui é o valor que mandamos
// imprimir para que 33mm cheguem ao papel. São coisas diferentes, e por isso o
// modo "Régua de calibração" abaixo existe: ele imprime uma escala real para
// medir quanto o papel de fato recebeu, e aí estes números param de ser chute.
//
// Se a calibração mostrar que a escala é 1:1 e o problema era outro, o
// caminho é voltar os três para 33/25/100 e investigar o driver.
const LABEL_WIDTH_MM  = 40
const LABEL_HEIGHT_MM = 30
const PAPER_WIDTH_MM  = 121

// ✅ MEDIDO: o rolo tem 3 células por fileira.
const LABEL_COLUMNS   = 3

// Derivado, não medido. A conta tem de fechar com PAPER_WIDTH_MM, senão a
// terceira coluna cai fora do papel:
//   LABEL_COLUMNS × LABEL_WIDTH_MM + (LABEL_COLUMNS - 1) × LABEL_GAP_MM
//   = 3 × 40 + 2 × 0,5 = 121mm ✓
const LABEL_GAP_MM    = 0.5

// Espessura da borda da régua de calibração. Entra numa constante porque as
// marcas precisam compensá-la: elemento posicionado tem como referência a
// caixa de padding, que começa DEPOIS da borda — sem o desconto, a marca do
// "0" cairia a 0,25mm da borda real e a régua mediria tudo deslocado.
const CALIB_BORDA_MM  = 0.25

/** Marcações da régua de calibração: 0, 5, 10... até cobrir a medida. */
function marcasRegua(totalMm, passo = 5) {
  const out = []
  for (let mm = 0; mm <= totalMm; mm += passo) out.push(mm)
  return out
}

/** Quebra a lista em fileiras físicas do rolo — cada fileira vira uma página. */
function emFileiras(lista, porFileira) {
  const out = []
  for (let i = 0; i < lista.length; i += porFileira) out.push(lista.slice(i, i + porFileira))
  return out
}

/** Uma etiqueta. O SVG é preenchido por efeito, depois do nó existir. */
function Etiqueta({ dados, mostrarPreco }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current || !dados.codigo) return
    try {
      JsBarcode(svgRef.current, dados.codigo, {
        format: 'CODE128',
        // O código é só de dígitos (ver src/utils/codigoBarras.js), o que faz
        // o Code128 entrar em modo Code C e empacotar dois dígitos por
        // símbolo — 101 módulos em vez dos 167 de um alfanumérico do mesmo
        // tamanho. É o que mantém a barra estreita acima de 0,19mm dentro dos
        // 33mm da etiqueta térmica.
        width: 1.6,        // largura da barra mais fina, em px
        height: 42,
        displayValue: true,
        fontSize: 11,
        // Quiet zone. Estava em `margin: 0`, o que é um erro clássico: o
        // Code128 exige ~10 módulos de área limpa de cada lado, e sem ela
        // muitos leitores recusam a leitura mesmo com as barras no tamanho
        // certo. 10 × width = 16px, e escala junto com o SVG.
        marginLeft: 16,
        marginRight: 16,
        marginTop: 0,
        marginBottom: 0,
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
 * Etiqueta de calibração: uma régua impressa no tamanho que o código acredita
 * ser a célula do rolo.
 *
 * Existe para tirar a medida do campo do chute. Impressa e posta ao lado da
 * etiqueta pré-cortada de verdade, ela responde duas perguntas de uma vez:
 *   • a borda bate com o picote? (se não, LABEL_WIDTH/HEIGHT estão errados)
 *   • onde cai a marca dos 30mm na régua da própria etiqueta? (se cair nos
 *     25mm, a impressora está reduzindo em ~17%, e aí o problema é escala)
 *
 * As dimensões saem em unidade `mm` do CSS, exatamente como o resto do layout
 * térmico — nenhuma conversão própria de mm→px, senão a régua mediria uma
 * escala diferente da que a etiqueta usa e não serviria de referência.
 */
function ReguaCalibracao() {
  const marcasH = marcasRegua(LABEL_WIDTH_MM)
  const marcasV = marcasRegua(LABEL_HEIGHT_MM)
  return (
    <div className="etq-calib">
      {/* Cantos reforçados: é neles que se compara com o picote. */}
      <span className="etq-calib-canto etq-calib-canto--tl" />
      <span className="etq-calib-canto etq-calib-canto--tr" />
      <span className="etq-calib-canto etq-calib-canto--bl" />
      <span className="etq-calib-canto etq-calib-canto--br" />

      {/* A última marca de cada eixo escreve o número para DENTRO. Solto, ele
          cairia fora da caixa — numa etiqueta física isso é tinta passando do
          picote, na vizinha. */}
      {marcasH.map((mm, i) => (
        <span
          key={`h${mm}`}
          className={`etq-calib-th${i === marcasH.length - 1 ? ' etq-calib-th--fim' : ''}`}
          style={{ left: `calc(${mm}mm - ${CALIB_BORDA_MM}mm)` }}
        ><i>{mm}</i></span>
      ))}
      {marcasV.map((mm, i) => (
        <span
          key={`v${mm}`}
          className={`etq-calib-tv${i === marcasV.length - 1 ? ' etq-calib-tv--fim' : ''}`}
          style={{ top: `calc(${mm}mm - ${CALIB_BORDA_MM}mm)` }}
        ><i>{mm}</i></span>
      ))}

      <span className="etq-calib-centro">
        {LABEL_WIDTH_MM}mm × {LABEL_HEIGHT_MM}mm
        <br />compare com a etiqueta física
      </span>
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
  // Decisão do momento da impressão, não configuração da loja — por isso
  // estado local e nada de persistir no banco.
  const [formato, setFormato] = useState('a4')
  const calibracao = formato === 'calibracao'
  // A calibração imprime no mesmo papel e com o mesmo @page da térmica — ela
  // só troca o CONTEÚDO da etiqueta pela régua. Por isso as duas compartilham
  // todo o CSS de impressão térmica.
  const termica = formato === 'termica' || calibracao

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

        /* Fileira: só existe no modo térmica. Na tela mostra a etiqueta no
           tamanho físico real, para o preview valer alguma coisa. */
        .etq-fileira {
          display: grid;
          grid-template-columns: repeat(${LABEL_COLUMNS}, ${LABEL_WIDTH_MM}mm);
          gap: 0 ${LABEL_GAP_MM}mm;
          justify-content: center;
          width: ${PAPER_WIDTH_MM}mm;
          margin: 0 auto 6px;
        }
        .etq-fileira .etq-item {
          width: ${LABEL_WIDTH_MM}mm; height: ${LABEL_HEIGHT_MM}mm;
          box-sizing: border-box; display: flex; flex-direction: column;
          justify-content: center; padding: 1.5mm 1mm;
        }

        /* ── Régua de calibração ──────────────────────────────────────────
           Tudo em mm, igual ao layout térmico: a régua precisa medir na mesma
           escala que a etiqueta, senão não serve de referência. */
        .etq-calib {
          position: relative; box-sizing: border-box;
          width: ${LABEL_WIDTH_MM}mm; height: ${LABEL_HEIGHT_MM}mm;
          border: ${CALIB_BORDA_MM}mm solid #000; background: #fff; color: #000;
        }
        .etq-calib-canto {
          position: absolute; width: 3mm; height: 3mm; border: 0 solid #000;
        }
        .etq-calib-canto--tl { top: 0; left: 0;  border-top-width: 0.6mm; border-left-width: 0.6mm; }
        .etq-calib-canto--tr { top: 0; right: 0; border-top-width: 0.6mm; border-right-width: 0.6mm; }
        .etq-calib-canto--bl { bottom: 0; left: 0;  border-bottom-width: 0.6mm; border-left-width: 0.6mm; }
        .etq-calib-canto--br { bottom: 0; right: 0; border-bottom-width: 0.6mm; border-right-width: 0.6mm; }
        /* Traço da régua no topo, a cada 5mm, contado da borda esquerda. */
        .etq-calib-th {
          position: absolute; top: calc(0mm - ${CALIB_BORDA_MM}mm);
          width: 0; height: 2mm; border-left: 0.2mm solid #000;
        }
        .etq-calib-th i {
          position: absolute; left: 0.3mm; top: 1.8mm;
          font-family: ui-monospace, Menlo, monospace; font-size: 4pt;
          font-style: normal; line-height: 1;
        }
        /* Idem na borda esquerda, contado do topo. */
        .etq-calib-tv {
          position: absolute; left: calc(0mm - ${CALIB_BORDA_MM}mm);
          height: 0; width: 2mm; border-top: 0.2mm solid #000;
        }
        .etq-calib-tv i {
          position: absolute; top: 0.3mm; left: 2.3mm;
          font-family: ui-monospace, Menlo, monospace; font-size: 4pt;
          font-style: normal; line-height: 1;
        }
        .etq-calib-th--fim i { left: auto; right: 0.3mm; }
        .etq-calib-tv--fim i { top: auto; bottom: 0.3mm; }
        .etq-calib-centro {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center;
          font-family: var(--font-ui); font-size: 5.5pt; line-height: 1.35;
          padding: 0 4mm; color: #000;
        }
        /* A fileira da calibração leva UMA etiqueta, encostada à esquerda —
           é onde fica a primeira célula do rolo. */
        .etq-fileira--calib {
          grid-template-columns: ${LABEL_WIDTH_MM}mm !important;
          justify-content: start !important;
        }

        /* ── Impressão: base comum aos dois formatos ──────────────────────
           Esconde a página que está atrás do modal.

           A versão anterior fazia "body * { visibility: hidden }", e esse era
           o bug das 159 páginas: "visibility: hidden" NÃO tira do fluxo. Os
           37 cards do Estoque continuavam ocupando altura, geravam dezenas de
           páginas em branco, e o modal — que o "position: static" logo abaixo
           tira do "fixed" e joga no fluxo normal — só aparecia DEPOIS de tudo
           isso, lá na última página. No modo térmica era pior ainda: com
           página de 100×25mm, o mesmo fundo virava 75 páginas.

           "display: none" tira do fluxo de verdade. O :has() preserva a cadeia
           de ancestrais do modal, que é onde moram as variáveis de tema
           (--surface, --line, --ink...): escondê-las quebraria as cores da
           etiqueta. Então some tudo, MENOS o overlay, o que está dentro dele e
           quem o contém. */
        @media print {
          /* Margem padrão do html/body some: com @page margin:0 na térmica,
             os 8px do body empurravam a fileira além dos 25mm da página e
             cuspiam uma segunda página em branco a cada etiqueta. */
          html, body {
            margin: 0 !important; padding: 0 !important;
            background: #fff !important; height: auto !important;
          }
          body *:not(.etq-overlay):not(.etq-overlay *):not(:has(.etq-overlay)) {
            display: none !important;
          }
          /* Ancestrais ficam, mas não podem contribuir com espaço nem fundo. */
          body *:has(.etq-overlay) {
            display: block !important;
            margin: 0 !important; padding: 0 !important;
            background: none !important; border: none !important;
            min-height: 0 !important; height: auto !important;
            max-width: none !important; width: auto !important;
          }
          .etq-overlay {
            position: static !important; background: none !important;
            padding: 0 !important; display: block !important;
          }
          .etq-painel {
            max-height: none !important; border-radius: 0 !important;
            width: 100% !important; box-shadow: none !important;
          }
          /* O aviso da calibração é orientação de tela. Impresso, ele ocupava
             duas páginas de 121×30mm antes da régua — a calibração saía com 3
             páginas em vez de 1. */
          .etq-topo, .etq-rodape, .etq-aviso-calib { display: none !important; }
          .etq-corpo { padding: 0 !important; overflow: visible !important; background: #fff !important; }
        }

        ${termica ? `
        /* ── Impressão térmica (rolo pré-cortado) ─────────────────────────
           Uma "página" = uma fileira física do rolo. @page com size exato e
           margin zero: qualquer margem empurraria a etiqueta para fora do
           picote, e a impressora térmica não tem área não-imprimível para
           absorver isso como a laser tem.

           Todas as medidas vêm das constantes no topo do arquivo. */
        @media print {
          @page { size: ${PAPER_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm; margin: 0; }
          .etq-folha { display: block !important; gap: 0 !important; }
          .etq-fileira {
            width: ${PAPER_WIDTH_MM}mm !important;
            height: ${LABEL_HEIGHT_MM}mm !important;
            margin: 0 !important;
            break-after: page; page-break-after: always;
            break-inside: avoid; page-break-inside: avoid;
          }
          /* Sem isto a última fileira cospe uma etiqueta em branco no fim. */
          .etq-fileira:last-child { break-after: auto; page-break-after: auto; }
          .etq-item {
            border: none !important; border-radius: 0 !important;
            background: #fff !important;
          }
          /* Texto encolhe para caber em ${LABEL_WIDTH_MM}mm; o código de
             barras é o mesmo dos dois modos e escala pelo width:100% do SVG. */
          .etq-nome { font-size: 6.5pt !important; }
          .etq-var  { font-size: 6pt !important; }
        }
        ` : `
        /* ── Impressão A4 (padrão) — inalterada ───────────────────────────── */
        @media print {
          .etq-folha {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 4mm !important; justify-content: start !important;
          }
          .etq-item { border: 1px dashed #999 !important; }
          @page { margin: 8mm; }
        }
        `}
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
                : calibracao
                  ? `Régua de teste · ${LABEL_WIDTH_MM}×${LABEL_HEIGHT_MM}mm · 1 página`
                  : `${expandidas.length} etiqueta${expandidas.length > 1 ? 's' : ''} · uma por variação`
                    + (termica ? ` · ${LABEL_WIDTH_MM}×${LABEL_HEIGHT_MM}mm, ${LABEL_COLUMNS} por fileira` : '')}
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
          {/* Deixa claro que NADA de produto está sendo impresso agora — o
              risco desse modo é alguém esquecer nele e achar que mandou as
              etiquetas de verdade. */}
          {calibracao && (
            <p className="etq-aviso-calib" style={{
              fontFamily: 'var(--font-ui)', fontSize: 12.5, lineHeight: 1.5,
              color: '#b45309', background: 'rgba(202,138,4,0.08)',
              border: '1px solid rgba(202,138,4,0.25)', borderRadius: 10,
              padding: '10px 12px', marginBottom: 12,
            }}>
              Modo de teste: imprime <strong>só a régua</strong>, nenhuma etiqueta de
              produto. Imprima, encoste numa etiqueta do rolo e veja se a borda bate
              com o picote — os números marcam milímetros a partir do canto superior
              esquerdo. Para voltar a imprimir etiquetas, troque o formato de novo.
            </p>
          )}
          {semEtiqueta ? (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--muted)', padding: '30px 10px', textAlign: 'center', lineHeight: 1.5 }}>
              Só é possível etiquetar produto que tenha grade cadastrada — a etiqueta
              carrega a variação, que é o que dá baixa no estoque.
            </p>
          ) : (
            <div className="etq-folha">
              {calibracao
                ? (
                  <div className="etq-fileira etq-fileira--calib">
                    <ReguaCalibracao />
                  </div>
                )
                : termica
                // Fileiras explícitas em vez de deixar o grid quebrar sozinho:
                // no rolo, cada fileira precisa cair exatamente numa página, e
                // page-break dentro de grid é inconsistente entre navegadores.
                ? emFileiras(expandidas, LABEL_COLUMNS).map((fileira, i) => (
                    <div className="etq-fileira" key={`f${i}`}>
                      {fileira.map(et => (
                        <Etiqueta key={et._k} dados={et} mostrarPreco={mostrarPreco} />
                      ))}
                    </div>
                  ))
                  : expandidas.map(et => (
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
            {/* Formato de impressão. Não persiste: quem imprime escolhe na
                hora, e a mesma loja pode ter as duas impressoras. */}
            <select
              value={formato}
              onChange={e => setFormato(e.target.value)}
              aria-label="Formato de impressão"
              style={{
                height: 36, borderRadius: 9, cursor: 'pointer', padding: '0 9px',
                border: '1px solid var(--line)', background: 'var(--bg)',
                fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink)',
              }}
            >
              <option value="a4">Folha A4 (padrão)</option>
              <option value="termica">Impressora térmica (rolo {LABEL_COLUMNS} colunas)</option>
              {/* Modo de teste: não imprime produto nenhum, só a régua. Fica
                  na mesma lista para ninguém precisar caçar um botão escondido
                  na hora de calibrar. */}
              <option value="calibracao">Régua de calibração (teste)</option>
            </select>
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
