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
// A matemática dos três modos mora fora daqui: é a regra que decide o que a
// impressora cospe, e o ambiente de teste do repo não tem DOM para simular a
// troca de modo dentro do componente.
import {
  ROTULO_MODO, QTD_MAX, normalizarQtd, copiasDe, expandirEtiquetas, qtdsIniciais,
} from '../../utils/etiquetasQtd'
import { X, Printer } from 'lucide-react'
// Impressão direta pelo agente local. Tudo aqui é carregado sob demanda —
// ver a nota sobre import() dinâmico no cabeçalho de lib/qzTray.js.
import {
  URL_DOWNLOAD, conectar, desconectar, listarImpressoras,
  impressoraSalva, salvarImpressora, imprimir as imprimirNoQz, mensagemDeErro,
} from '../../lib/qzTray'
import { documentosParaQz, alturaMaxBarrasMm } from '../../utils/etiquetasHtml'
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
//   • rolo com 2 ou 4 etiquetas por fileira → LABEL_COLUMNS
//
// PAPER_WIDTH_MM não está nessa lista de propósito: ele é DERIVADO das outras
// duas. Papel e colunas que não fecham a conta é o que corta a última coluna.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ 25/08/2026 — O AJUSTE EMPÍRICO DE 23/08 FOI REVERTIDO. Ele era o bug.
//
// O ajuste anterior subiu as três medidas ~21% (33→40, 25→30, 100→121)
// apostando que o driver reduzia a página para caber na área imprimível. A
// aposta estava documentada aqui mesmo como NÃO CONFIRMADA, e o teste seguinte
// a derrubou: com o driver da Elgin L42PRO Full configurado em 33×25mm,
// imprimir UMA etiqueta pedia DUAS folhas ao Chrome — inclusive com um nome
// curtíssimo ("p. teste"), o que já descartava conteúdo como causa.
//
// MEDIDO, e não deduzido: o componente foi renderizado no Chrome com o CSS de
// impressão ativo e o PDF teve as páginas contadas, com o papel em 33×25mm.
//
//   40 / 30 / 121  →  2 páginas para 1 etiqueta
//                     a fileira mede 30mm de altura numa página de 25mm; os
//                     5mm que sobram transbordam e viram a segunda página.
//   33 / 25 /  33  →  1 página para 1 etiqueta
//
// O CONTEÚDO nunca foi o problema. Medido dentro da etiqueta, com a fonte de
// impressão: nome 2,75mm + variação 2,65mm + código de barras 14,69mm =
// 21,15mm, mais 3mm de padding = 24,15mm. Cabia com folga até na caixa antiga.
// Quem estourava era a PÁGINA declarada, não o texto.
//
// A regra que fica: estas constantes descrevem O PAPEL QUE O DRIVER TEM.
// Declarar aqui uma página maior que a da impressora não faz sair maior — só
// faz o Chrome paginar a sobra.
const LABEL_WIDTH_MM  = 33
const LABEL_HEIGHT_MM = 25

// Espaço entre as células do rolo, quando há mais de uma coluna.
const LABEL_GAP_MM    = 0.5

// ✅ MEDIDO: o rolo da Tropicale tem 3 células por fileira, e a fileira INTEIRA
// é a página. Confirmado em 25/08/2026, com o driver configurado em 100×25mm.
//
// Esta constante e o papel do driver são UM PAR — mudar uma sem a outra é o
// modo de falha caro deste arquivo, nos dois sentidos:
//
//   colunas > papel   fileira de 100mm numa página de 33mm não vira 3 páginas.
//                     Vira 1 página com as colunas 2 e 3 CORTADAS FORA: a
//                     etiqueta some em silêncio, sem erro nenhum na tela.
//   colunas < papel   sai 1 etiqueta por fileira e as outras 2 células do rolo
//                     avançam em branco. Não perde etiqueta, só gasta rolo.
//
// Por isso o aviso do rodapé do modal diz, em números, qual papel o driver
// precisa ter: é a única metade do par que não mora neste arquivo.
const LABEL_COLUMNS   = 3

// DERIVADO da conta, nunca digitado à mão: é a largura da PÁGINA, e ela tem de
// fechar com as colunas, senão a última cai fora do papel. Foi justamente um
// PAPER_WIDTH_MM solto (121) que sobreviveu ao ajuste de 23/08 sem ninguém
// refazer a conta.
//   3 × 33 + 2 × 0,5 = 100mm ✓ (o papel configurado no driver)
const PAPER_WIDTH_MM  = LABEL_COLUMNS * LABEL_WIDTH_MM + (LABEL_COLUMNS - 1) * LABEL_GAP_MM

// Teto de altura do código de barras dentro da etiqueta, derivado da altura da
// célula — ver alturaMaxBarrasMm() em utils/etiquetasHtml.js para a conta e o
// motivo. Resumo: o SVG do JsBarcode tem viewBox, então "width: 100%;
// height: auto" o escala pela PROPORÇÃO dele, e a proporção depende do
// tamanho do código. Sem teto, é o conteúdo mandando na altura da página de
// novo — exatamente a família de bug que esta correção fecha.
const BARRAS_MAX_MM   = alturaMaxBarrasMm(LABEL_HEIGHT_MM)

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
  // Quantas cópias de cada etiqueta. Três modos mutuamente exclusivos:
  //   'uma'           1 por variação — o padrão
  //   'estoque'       1 por peça em estoque, para quem acabou de receber lote
  //   'personalizada' a lojista digita a quantidade de cada variação
  const [modo, setModo] = useState('uma')
  // Só o modo 'personalizada' usa isto. Chaveado pelo código da variação, que
  // é único por (loja, produto, rótulo) — índice do array não serve, porque a
  // ordem pode mudar se a seleção do Estoque mudar.
  const [qtdPorVariacao, setQtdPorVariacao] = useState({})
  const [mostrarPreco, setMostrarPreco] = useState(true)
  // Decisão do momento da impressão, não configuração da loja — por isso
  // estado local e nada de persistir no banco.
  const [formato, setFormato] = useState('a4')
  const calibracao = formato === 'calibracao'
  // Destino "direto": o trabalho vai para o QZ Tray e o navegador nem abre
  // diálogo. O LAYOUT é o mesmo da térmica, e é isso que a linha abaixo diz.
  const qzDireto = formato === 'qz'
  // A calibração imprime no mesmo papel e com o mesmo @page da térmica — ela
  // só troca o CONTEÚDO da etiqueta pela régua. Por isso as duas compartilham
  // todo o CSS de impressão térmica. O destino direto entra na mesma família:
  // reaproveitar o preview e as medidas é o que garante que sai igual.
  const termica = formato === 'termica' || calibracao || qzDireto

  // ── Estado do agente local ──────────────────────────────────────────────
  // 'ocioso' | 'procurando' | 'pronto' | 'falhou'
  const [qz, setQz] = useState({ fase: 'ocioso', impressoras: [], erro: null })
  const [impressora, setImpressora] = useState(() => impressoraSalva())
  const [enviando, setEnviando] = useState(false)
  // Serializa as fileiras que JÁ estão na tela: o SVG que o QZ Tray imprime é
  // o mesmo nó que o JsBarcode desenhou no preview, não um redesenho.
  const folhaRef = useRef(null)

  const MEDIDAS = {
    larguraMm: LABEL_WIDTH_MM, alturaMm: LABEL_HEIGHT_MM,
    papelMm: PAPER_WIDTH_MM, colunas: LABEL_COLUMNS, gapMm: LABEL_GAP_MM,
  }

  /**
   * Procura o agente e lista as impressoras.
   *
   * Roda a partir do evento (troca do destino ou clique em "Procurar de
   * novo"), nunca de um efeito: efeito que chama setState no meio da render é
   * exatamente o que a regra react-hooks/set-state-in-effect proíbe, e aqui
   * não há motivo — a conexão é consequência de uma ação da pessoa.
   */
  async function procurarAgente(preferida) {
    setQz({ fase: 'procurando', impressoras: [], erro: null })
    try {
      await conectar()
      const lista = await listarImpressoras()
      setQz({ fase: 'pronto', impressoras: lista, erro: null })
      // Mantém a escolha anterior se ela ainda existe; senão cai na primeira,
      // que listarImpressoras já devolve como a padrão do sistema.
      const escolhida = lista.includes(preferida) ? preferida : (lista[0] || '')
      setImpressora(escolhida)
    } catch (e) {
      setQz({ fase: 'falhou', impressoras: [], erro: mensagemDeErro(e) })
    }
  }

  function trocarFormato(novo) {
    setFormato(novo)
    // Só procura o agente quando o destino direto é escolhido. Quem usa A4 ou
    // térmica pelo navegador não pode nem perceber que o QZ Tray existe.
    if (novo === 'qz' && qz.fase !== 'pronto') {
      procurarAgente(impressoraSalva())
    }
  }

  // Fecha a conexão ao desmontar. Sem setState aqui — é só limpeza.
  useEffect(() => () => { desconectar() }, [])

  /**
   * Manda as etiquetas pelo agente.
   *
   * Falhar aqui NÃO fecha o modal nem apaga o preview: a pessoa continua a um
   * clique de trocar o destino para "via navegador" e imprimir do jeito
   * antigo. Esse é o requisito de não travar a tela.
   */
  async function imprimirDireto() {
    const fileiras = [...(folhaRef.current?.querySelectorAll('.etq-fileira') || [])]
      .map(el => el.outerHTML)
    setEnviando(true)
    try {
      await imprimirNoQz({
        impressora,
        documentos: documentosParaQz(fileiras, MEDIDAS),
        medidas: MEDIDAS,
      })
      salvarImpressora(impressora)
      setQz(q => ({ ...q, erro: null, enviado: fileiras.length }))
    } catch (e) {
      setQz(q => ({ ...q, erro: mensagemDeErro(e) }))
    } finally {
      setEnviando(false)
    }
  }

  useEffect(() => {
    function aoTeclar(e) { if (e.key === 'Escape') aoFechar?.() }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  /**
   * Troca de modo SEMPRE parte do zero.
   *
   * Entrar em 'personalizada' semeia 1 para cada variação; sair descarta o
   * mapa inteiro. Sem isso, mexer nas quantidades, voltar para "1 por
   * variação" e retornar traria os números antigos de volta em silêncio — e a
   * lojista imprimiria uma quantidade que não pediu nesta sessão.
   */
  function trocarModo(novo) {
    setModo(novo)
    setQtdPorVariacao(qtdsIniciais(etiquetas, novo))
  }

  function definirQtd(codigo, bruto) {
    setQtdPorVariacao(prev => ({ ...prev, [codigo]: normalizarQtd(bruto) }))
  }

  const expandidas = expandirEtiquetas(etiquetas, modo, qtdPorVariacao)

  const semEtiqueta = etiquetas.length === 0
  const nadaParaImprimir = !calibracao && expandidas.length === 0
  // No destino direto o botão também espera o agente responder e uma
  // impressora existir — mandar trabalho sem destino só produziria erro.
  const travado = nadaParaImprimir || enviando
    || (qzDireto && (qz.fase !== 'pronto' || !impressora))

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
        /* Painel de quantidades do modo personalizado. Some na impressão pela
           regra geral de "esconde tudo que não é .etq-folha" mais abaixo. */
        .etq-qtds {
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 12px; padding: 10px; margin-bottom: 14px;
        }
        .etq-qtds-lista { display: grid; gap: 6px; max-height: 260px; overflow: auto; }
        .etq-qtd-linha {
          display: flex; align-items: center; gap: 10px;
          padding: 6px 4px; border-radius: 8px;
          /* Item de grid nasce com "min-width: auto", que é o min-content da
             linha — e o min-content inclui o nome inteiro, porque ele é
             "white-space: nowrap". Resultado medido no celular: linha de 322px
             dentro de caixa de 288px, rolagem lateral no painel e os três
             botões "+" cortados na borda. O "min-width: 0" solta a linha para
             encolher até a faixa, e aí o flex reduz o texto (que já tem o seu
             próprio min-width: 0) e o ellipsis do nome funciona como devia. */
          min-width: 0;
        }
        .etq-qtd-linha + .etq-qtd-linha { border-top: 1px solid var(--line); }
        .etq-qtd-txt { flex: 1; min-width: 0; }
        .etq-qtd-nome {
          margin: 0; font-family: var(--font-ui); font-size: 13px; font-weight: 600;
          color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .etq-qtd-var { margin: 0; font-family: var(--font-ui); font-size: 12px; color: var(--muted); }
        .etq-stepper { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .etq-stepper button {
          width: 34px; height: 34px; border-radius: 8px; cursor: pointer;
          border: 1px solid var(--line); background: var(--bg); color: var(--ink);
          font-family: var(--font-ui); font-size: 17px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
        }
        .etq-stepper button:disabled { opacity: .4; cursor: default; }
        .etq-stepper input {
          width: 58px; height: 34px; border-radius: 8px; text-align: center;
          border: 1px solid var(--line); background: var(--bg); color: var(--ink);
          font-family: var(--font-ui); font-size: 14px; font-weight: 700;
        }
        /* Some o spinner nativo: ele encavala no stepper e, no mobile, é
           pequeno demais para acertar com o dedo. */
        .etq-stepper input::-webkit-outer-spin-button,
        .etq-stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .etq-stepper input { -moz-appearance: textfield; appearance: textfield; }
        @media (max-width: 560px) {
          .etq-qtd-linha { gap: 8px; }
          .etq-stepper input { width: 50px; }
        }
        /* Preview do A4: grid que quebra em várias linhas sozinho, nunca
           rolagem horizontal. Com dezenas de etiquetas (o caso do modo
           "quantidade personalizada") ler em linhas é mais limpo do que
           arrastar uma tira lateral, e a rolagem vertical do .etq-corpo já
           existe e é a que a pessoa espera num modal.

           "safe center" no lugar de "center": se um dia um card ficar mais
           largo que o container, "center" puro o faz transbordar para os DOIS
           lados e a metade esquerda vira inalcançável pela rolagem. Com
           "safe", nesse caso o alinhamento cai para o início e nada some. */
        .etq-folha {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(min(46%, 200px), 200px));
          gap: 8px; justify-content: safe center;
          /* Respiro para a borda do card não encostar no fim do container. 4px
             é de propósito: acima disso o grid perde uma coluna em 880px. */
          padding: 2px 4px;
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
          /* A célula tem altura fixa. Sem isto, conteúdo que passar dela não
             fica contido: vaza para a etiqueta de baixo e ESTICA A FILEIRA
             além da página — que é como uma etiqueta vira duas. Recortar é o
             mal menor: perde-se o fim de um texto, não a etiqueta seguinte.
             Só dentro de .etq-fileira, ou seja, só na térmica: no A4 o card
             cresce à vontade e continua crescendo. */
          overflow: hidden;
        }
        /* Teto do código de barras — a conta e o motivo estão em
           alturaMaxBarrasMm(), em utils/etiquetasHtml.js. Sem ele, um código
           mais curto (SVG mais estreito, logo mais alto quando esticado na
           largura) volta a mandar na altura da etiqueta.

           O "margin: 0 auto" acompanha: quando o teto entra em ação, o
           navegador encolhe a largura junto para manter a proporção, e sem a
           margem o código ficaria encostado à esquerda. */
        .etq-fileira .etq-svg { max-height: ${BARRAS_MAX_MM}mm; margin: 0 auto; }
        /* Mesma regra do nome, e pelo mesmo motivo: variação longa
           ("Rosa Bebê Estampado · R$ 1.234,56") quebrava em duas linhas e
           comia a altura reservada ao código. No A4 ela continua podendo
           quebrar — lá sobra espaço. */
        .etq-fileira .etq-var {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
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
          /* .etq-qtds é controle de tela: impresso, empurraria as etiquetas
             para baixo e gastaria fileira de rolo térmico. */
          .etq-topo, .etq-rodape, .etq-aviso-calib, .etq-qtds { display: none !important; }
          .etq-corpo { padding: 0 !important; overflow: visible !important; background: #fff !important; }
        }

        ${termica ? `
        /* ── Impressão térmica (rolo pré-cortado) ─────────────────────────
           Uma "página" = uma fileira física do rolo. @page com size exato e
           margin zero: qualquer margem empurraria a etiqueta para fora do
           picote, e a impressora térmica não tem área não-imprimível para
           absorver isso como a laser tem.

           Todas as medidas vêm das constantes no topo do arquivo.

           ─── SOBRE A FILEIRA VAZIA COM O LINK DA JUNTTOS ───────────────
           Relato do Daniel: a cada N fileiras saía uma faixa em branco com a
           URL da página e "página X/Y". Medido aqui com 60 etiquetas / 20
           fileiras, em quatro configurações de papel: o número de páginas bate
           sempre com o número de fileiras (20), e nenhuma quebra espontânea
           aparece. Ou seja, não é o nosso layout gerando página extra.

           Esse texto é o CABEÇALHO/RODAPÉ AUTOMÁTICO DO CHROME. Ele é
           desenhado na margem da página FÍSICA do driver, e o CSS da página
           não alcança isso — "@page { margin: 0 }" só suprime o rodapé quando
           o Chrome está usando o nosso tamanho de página. Se o driver da
           térmica impõe um papel maior que os 30mm da fileira, sobra papel em
           cada avanço, e é nessa sobra que o Chrome escreve. Quem desliga é a
           pessoa, no diálogo de impressão — está escrito no rodapé do modal.

           O "break-after: page" que havia em cada fileira foi REMOVIDO. Ele
           forçava uma quebra por fileira independentemente do papel: com papel
           A4, cada página saía com 30mm de etiqueta e 267mm de branco. Sem
           ele o @page continua paginando igual quando é respeitado (medido:
           mesmas 20 páginas), e quando não é, as fileiras fluem e aproveitam
           o papel em vez de desperdiçar uma folha por fileira. O
           "break-inside: avoid" fica: fileira cortada ao meio é etiqueta
           partida em duas. */
        /* ── Preview em tela do modo térmica ──────────────────────────────
           O corte vinha daqui. Em tela, .etq-folha continuava com o grid do
           A4 (auto-fill de 200px), mas no térmico os filhos não são etiquetas
           soltas: são FILEIRAS de ${PAPER_WIDTH_MM}mm (~457px). Oito fileiras
           dessas entravam num grid de quatro colunas de 200px e vazavam para
           fora do container — medido em 1109px de conteúdo dentro de 880px de
           caixa, com seis cards cortados e o pior deles 249px para fora.

           Com 3 etiquetas o sintoma some (uma fileira só, centrada), que é
           por que o problema aparecia "às vezes".

           Na impressão isso nunca aconteceu porque o bloco abaixo já faz
           "display: block". A tela é que nunca recebeu o mesmo tratamento.
           Agora recebe: uma fileira por linha, empilhadas, igual ao papel. */
        .etq-folha {
          display: flex; flex-direction: column; gap: 6px;
          /* "safe" é o que impede o corte quando a fileira é mais larga que a
             tela (celular): com "center" puro ela transborda para os dois
             lados e a metade esquerda fica inalcançável pela rolagem. */
          align-items: safe center;
          /* A rolagem horizontal passa a ser DESTE elemento, não do
             .etq-corpo. Além de isolar o eixo X do resto do modal, um
             container flex respeita o padding no fim da rolagem — um
             container de bloco não respeita, e a etiqueta encostaria na borda
             direita exatamente como no relato. */
          overflow-x: auto;
          padding: 2px 20px;
          /* Fileira tem largura fixa; a rolagem para alinhada nela em vez de
             parar no meio de uma etiqueta. "proximity" e não "mandatory":
             mandatory sequestraria a rolagem quando tudo já cabe. */
          scroll-snap-type: x proximity;
          scroll-padding-inline: 20px;
        }
        .etq-fileira {
          flex: none;
          /* O "margin: 0 auto" da regra base tem de sair: margem automática em
             flex absorve o espaço livre e ANULA o align-items, inclusive o
             "safe" — o corte à esquerda voltaria. O espaçamento vertical agora
             é o gap. */
          margin: 0;
        }
        /* O snap prende em cada ETIQUETA, não na fileira inteira. No celular a
           fileira de ${PAPER_WIDTH_MM}mm não cabe na tela, e prender só nas
           pontas dela deixaria a rolagem parar no meio de um card — que é
           exatamente a aparência de bagunça do relato.

           "start" e não "center": com "center", o primeiro card seria puxado
           para o meio e a metade esquerda dele sumiria na borda. Com "start"
           mais o scroll-padding, cada parada encosta a etiqueta na margem de
           20px, inteira. */
        .etq-fileira .etq-item { scroll-snap-align: start; }

        /* A calibração tem UMA etiqueta de ${LABEL_WIDTH_MM}mm, mas herdava a
           largura de fileira de ${PAPER_WIDTH_MM}mm — no celular isso criava
           rolagem horizontal para arrastar espaço vazio. No papel a largura
           volta pelo bloco de impressão abaixo, que é quem manda no @page. */
        .etq-fileira--calib { width: auto !important; }

        @media print {
          @page { size: ${PAPER_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm; margin: 0; }
          .etq-folha {
            display: block !important; gap: 0 !important;
            /* Desfaz o container de rolagem da tela: overflow no papel corta
               conteúdo, e o padding empurraria a fileira para fora do picote. */
            overflow: visible !important; padding: 0 !important;
          }
          .etq-fileira {
            width: ${PAPER_WIDTH_MM}mm !important;
            height: ${LABEL_HEIGHT_MM}mm !important;
            margin: 0 !important;
            /* SEM break-after aqui, de propósito — ver a nota abaixo.
               break-inside continua: fileira cortada ao meio é etiqueta
               partida em duas, o pior desfecho possível. */
            break-inside: avoid; page-break-inside: avoid;
          }
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
            /* O respiro é de tela; no papel ele comeria margem útil. */
            padding: 0 !important;
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
                  : `${expandidas.length} etiqueta${expandidas.length === 1 ? '' : 's'} · ${ROTULO_MODO[modo]}`
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
            <>
            {/* Só no modo personalizado, e nunca na calibração — lá não sai
                etiqueta de produto nenhuma, então quantidade não significa
                nada e o painel só confundiria. */}
            {modo === 'personalizada' && !calibracao && (
              <div className="etq-qtds">
                <p style={{
                  margin: '0 4px 8px', fontFamily: 'var(--font-ui)',
                  fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5,
                }}>
                  Quantas etiquetas de cada variação. Deixe em <strong>0</strong> para
                  pular a variação.
                </p>
                <div className="etq-qtds-lista">
                  {etiquetas.map(et => {
                    const n = copiasDe(et, modo, qtdPorVariacao)
                    return (
                      <div className="etq-qtd-linha" key={et.codigo}>
                        <div className="etq-qtd-txt">
                          <p className="etq-qtd-nome" title={et.nome}>{et.nome}</p>
                          <p className="etq-qtd-var">
                            {et.rotulo} · {et.quantidade} em estoque
                          </p>
                        </div>
                        <div className="etq-stepper">
                          <button
                            type="button"
                            onClick={() => definirQtd(et.codigo, n - 1)}
                            disabled={n <= 0}
                            aria-label={`Menos uma etiqueta de ${et.nome} ${et.rotulo}`}
                          >−</button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={QTD_MAX}
                            value={n}
                            aria-label={`Quantidade de etiquetas de ${et.nome} ${et.rotulo}`}
                            /* Campo controlado lendo de e.target.value, não do
                               estado: se o blur chegasse antes de o React
                               reprocessar a última tecla, a digitação sumiria. */
                            onChange={e => definirQtd(et.codigo, e.target.value)}
                            /* Apagar o campo inteiro deixa '' -> vira 0 pelo
                               definirQtd. Ao sair, normaliza para o número. */
                            onFocus={e => e.target.select()}
                          />
                          <button
                            type="button"
                            onClick={() => definirQtd(et.codigo, n + 1)}
                            disabled={n >= QTD_MAX}
                            aria-label={`Mais uma etiqueta de ${et.nome} ${et.rotulo}`}
                          >+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="etq-folha" ref={folhaRef}>
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
            </>
          )}
        </div>

        {!semEtiqueta && (
          <div className="etq-rodape" style={{
            display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
            padding: '14px 20px', borderTop: '1px solid var(--line)',
          }}>
            {/* Era um checkbox "Uma por peça em estoque" — dois estados. Com
                três modos exclusivos o checkbox não serve mais: viraria uma
                combinação impossível de marcar. As duas opções antigas
                continuam aqui, com os mesmos valores de estado. */}
            <select
              value={modo}
              onChange={e => trocarModo(e.target.value)}
              aria-label="Quantidade de etiquetas"
              style={{
                height: 36, borderRadius: 9, cursor: 'pointer', padding: '0 9px',
                border: '1px solid var(--line)', background: 'var(--bg)',
                fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink)',
              }}
            >
              <option value="uma">1 por variação</option>
              <option value="estoque">1 por peça em estoque</option>
              <option value="personalizada">Quantidade personalizada</option>
            </select>
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
              onChange={e => trocarFormato(e.target.value)}
              aria-label="Formato de impressão"
              style={{
                height: 36, borderRadius: 9, cursor: 'pointer', padding: '0 9px',
                border: '1px solid var(--line)', background: 'var(--bg)',
                fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink)',
              }}
            >
              <option value="a4">Folha A4 (padrão)</option>
              <option value="termica">Impressora térmica (rolo {LABEL_COLUMNS} colunas, {LABEL_WIDTH_MM}×{LABEL_HEIGHT_MM}mm)</option>
              {/* Destino ADICIONAL, não substituto: quem não instalou o QZ
                  Tray continua com as opções acima, iguais ao que sempre
                  foram. Ver o cabeçalho de lib/qzTray.js. */}
              <option value="qz">Impressora térmica (direto, sem diálogo)</option>
              {/* Modo de teste: não imprime produto nenhum, só a régua. Fica
                  na mesma lista para ninguém precisar caçar um botão escondido
                  na hora de calibrar. */}
              <option value="calibracao">Régua de calibração (teste)</option>
            </select>
            {/* Orientação de impressão para o modo térmica. Fica aqui, junto
                do botão, porque é o último momento antes de a pessoa abrir o
                diálogo — e as duas opções abaixo são do CHROME, não nossas:
                nenhuma linha de CSS consegue desligá-las. */}
            {termica && !qzDireto && (
              <p style={{
                flexBasis: '100%', order: 9, margin: '4px 0 0',
                fontFamily: 'var(--font-ui)', fontSize: 12, lineHeight: 1.5,
                color: 'var(--muted)',
              }}>
                No diálogo de impressão, abra <strong>Mais configurações</strong> e
                desmarque <strong>Cabeçalhos e rodapés</strong> — é o que faz sair uma
                fileira em branco com o link do site a cada tantas etiquetas. Deixe
                também <strong>Margens: Nenhuma</strong> e <strong>Escala: 100%</strong>.
                {' '}O papel da impressora precisa estar em{' '}
                <strong>{PAPER_WIDTH_MM}×{LABEL_HEIGHT_MM}mm</strong> — a fileira
                inteira, não uma etiqueta: papel mais baixo que isso faz cada
                fileira sair em duas folhas, e mais estreito corta as colunas da
                direita sem avisar.
              </p>
            )}
            {/* ── Painel do destino direto ─────────────────────────────────
                Ocupa a linha inteira abaixo dos seletores. Some por completo
                nos outros destinos: quem imprime em A4 não precisa saber que
                existe um agente. */}
            {qzDireto && (
              <div className="etq-qz" style={{
                flexBasis: '100%', order: 8, margin: '4px 0 0',
                fontFamily: 'var(--font-ui)', fontSize: 12.5, lineHeight: 1.5,
              }}>
                {qz.fase === 'procurando' && (
                  <p style={{ margin: 0, color: 'var(--muted)' }}>Procurando o QZ Tray nesta máquina…</p>
                )}

                {qz.fase === 'pronto' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--muted)' }}>Impressora:</span>
                    <select
                      value={impressora}
                      onChange={e => { setImpressora(e.target.value); salvarImpressora(e.target.value) }}
                      aria-label="Impressora do QZ Tray"
                      style={{
                        height: 32, borderRadius: 8, cursor: 'pointer', padding: '0 8px',
                        maxWidth: 300,
                        border: '1px solid var(--line)', background: 'var(--bg)',
                        fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink)',
                      }}
                    >
                      {qz.impressoras.length === 0 && <option value="">Nenhuma impressora encontrada</option>}
                      {qz.impressoras.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                    </select>
                    <span style={{ color: 'var(--muted)' }}>
                      Sai direto, sem diálogo e sem configuração para conferir.
                    </span>
                  </div>
                )}

                {/* Agente ausente. NÃO trava nada: os outros destinos seguem
                    na lista acima e imprimem como sempre. */}
                {qz.fase === 'falhou' && qz.erro && (
                  <div style={{
                    color: '#b45309', background: 'rgba(202,138,4,0.08)',
                    border: '1px solid rgba(202,138,4,0.25)', borderRadius: 10,
                    padding: '10px 12px',
                  }}>
                    <p style={{ margin: 0 }}>{qz.erro.texto}</p>
                    <p style={{ margin: '6px 0 0' }}>
                      {qz.erro.mostrarDownload && (
                        <>
                          <a
                            href={URL_DOWNLOAD}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#b45309', fontWeight: 700 }}
                          >Baixar o QZ Tray</a>
                          {' · '}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => procurarAgente(impressora)}
                        style={{
                          border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                          font: 'inherit', color: '#b45309', textDecoration: 'underline',
                        }}
                      >Procurar de novo</button>
                      {' · '}
                      <button
                        type="button"
                        onClick={() => trocarFormato('termica')}
                        style={{
                          border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                          font: 'inherit', color: '#b45309', textDecoration: 'underline',
                        }}
                      >Imprimir pelo navegador</button>
                    </p>
                  </div>
                )}

                {/* Erro DEPOIS de conectar (impressora recusou, agente
                    bloqueou o site). Fica separado do estado 'falhou' porque
                    aqui a lista de impressoras continua válida na tela. */}
                {qz.fase === 'pronto' && qz.erro && (
                  <p style={{ margin: '6px 0 0', color: '#b4381f' }}>{qz.erro.texto}</p>
                )}

                {qz.fase === 'pronto' && !qz.erro && qz.enviado > 0 && (
                  <p style={{ margin: '6px 0 0', color: 'var(--muted)' }} role="status">
                    {qz.enviado} fileira{qz.enviado === 1 ? '' : 's'} enviada{qz.enviado === 1 ? '' : 's'} para {impressora}.
                  </p>
                )}
              </div>
            )}

            {/* Zerar tudo no modo personalizado mandaria uma folha vazia
                para a impressora. Na calibração não vale: lá a régua sai
                sempre, independente de etiqueta. */}
            <button
              onClick={qzDireto ? imprimirDireto : () => window.print()}
              disabled={travado}
              style={{
                marginLeft: 'auto', height: 42, padding: '0 20px', borderRadius: 10, border: 'none',
                background: theme?.primary || 'var(--ink)', color: '#fff',
                cursor: travado ? 'default' : 'pointer',
                opacity: travado ? 0.5 : 1,
                fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            ><Printer size={15} /> {qzDireto ? (enviando ? 'Enviando…' : 'Imprimir direto') : 'Imprimir'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
