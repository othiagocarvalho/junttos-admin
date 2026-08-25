// Etiqueta térmica como documento HTML autocontido, para impressão direta.
//
// ─── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
// A impressão pelo navegador funciona porque a página inteira está lá: o
// @media print de EtiquetasPrint.jsx esconde o resto e o Chrome imprime o que
// sobra. O QZ Tray não tem nada disso — ele recebe uma string de HTML e
// renderiza no motor DELE, sem acesso ao CSS da página.
//
// Então o documento precisa carregar o próprio estilo. O risco óbvio é o
// layout divergir do que já foi calibrado no papel, e a defesa contra isso é
// dupla:
//
//   1. as MEDIDAS chegam por parâmetro, sempre das mesmas constantes de
//      EtiquetasPrint.jsx (LABEL_WIDTH_MM e companhia). Nada de número solto
//      aqui dentro;
//   2. o CONTEÚDO não é remontado: quem chama serializa as fileiras que já
//      estão na tela, com os SVGs que o JsBarcode desenhou. O código de barras
//      impresso pelo QZ Tray é literalmente o mesmo nó que o preview mostra.
//
// O que NÃO dá para garantir igual é a fonte: o QZ Tray rasteriza no motor
// próprio e não enxerga a fonte da aplicação. Por isso a pilha abaixo é
// genérica e termina em sans-serif — o tamanho em mm é que precisa bater com o
// picote, e esse vem das constantes.

/** Pilha de fontes que existe em Windows, macOS e no renderizador do QZ. */
const FONTE = "system-ui, -apple-system, 'Segoe UI', Arial, Helvetica, sans-serif"

/** Padding vertical de cada etiqueta, em mm. Entra na conta do teto abaixo. */
const PAD_Y_MM = 1.5

/**
 * Altura máxima do código de barras dentro de uma etiqueta de `alturaMm`.
 *
 * ─── POR QUE UM TETO, SE O SVG JÁ TEM "height: auto" ───────────────────────
 * Justamente por isso. O SVG que o JsBarcode desenha tem viewBox, então
 * "width: 100%; height: auto" o escala pela PROPORÇÃO — e a proporção muda com
 * o código: menos dígitos = barra mais estreita = SVG mais alto quando
 * esticado na largura da etiqueta. Medido com 12 dígitos numa etiqueta de
 * 33mm, o código sai com ~12mm; um código mais curto passaria disso.
 *
 * Com a etiqueta em altura fixa e overflow visível, esse excesso não fica
 * dentro dela: empurra a fileira para além da página e produz uma segunda
 * etiqueta em branco — a mesma família de bug que a página de 30mm num papel
 * de 25mm produzia. O teto fecha essa porta pelo lado do conteúdo.
 *
 * A conta é o que sobra da célula depois do que é fixo:
 *   altura − padding (2 × 1,5mm) − texto (6,1mm) − folga (1,5mm)
 *
 * O 6,1mm é MEDIDO no Chrome com o CSS de impressão ativo: nome em 6,5pt
 * ocupa 2,75mm e a linha da variação em 6pt ocupa 2,65mm.
 *
 * O piso de 4mm existe para uma etiqueta absurdamente baixa não gerar altura
 * negativa e sumir com o código de barras — nesse caso o certo é a barra
 * espremer, não desaparecer.
 */
export function alturaMaxBarrasMm(alturaMm) {
  const TEXTO_MM = 6.1
  const FOLGA_MM = 1.5
  return Math.max(4, +(alturaMm - 2 * PAD_Y_MM - TEXTO_MM - FOLGA_MM).toFixed(2))
}

/**
 * CSS da fileira térmica.
 *
 * Espelha o bloco `@media print` da térmica em EtiquetasPrint.jsx, com uma
 * diferença deliberada: aqui as regras NÃO ficam dentro de @media print. O
 * documento só existe para ser impresso, e o QZ Tray rasteriza a página como
 * ela está — regra escondida atrás de @media print poderia não ser aplicada.
 */
export function cssTermica({ larguraMm, alturaMm, papelMm, colunas, gapMm }) {
  return [
    '@page { size: ' + papelMm + 'mm ' + alturaMm + 'mm; margin: 0; }',
    'html, body { margin: 0; padding: 0; background: #fff; }',
    '* { box-sizing: border-box; }',
    'body { font-family: ' + FONTE + '; }',
    '.etq-fileira {',
    '  display: grid;',
    '  grid-template-columns: repeat(' + colunas + ', ' + larguraMm + 'mm);',
    '  gap: 0 ' + gapMm + 'mm;',
    '  width: ' + papelMm + 'mm; height: ' + alturaMm + 'mm; margin: 0;',
    '}',
    '.etq-item {',
    '  width: ' + larguraMm + 'mm; height: ' + alturaMm + 'mm;',
    '  display: flex; flex-direction: column; justify-content: center;',
    '  padding: ' + PAD_Y_MM + 'mm 1mm; text-align: center;',
    // A etiqueta tem altura fixa; sem isto, conteúdo que passar dela não fica
    // contido — vaza para a etiqueta de baixo e estica a fileira além da
    // página. Recortar é o mal menor: perde-se o fim de um texto, não a
    // etiqueta seguinte.
    '  overflow: hidden;',
    // Sem borda e sem raio: no papel a borda de preview viraria tinta gasta em
    // volta de cada etiqueta. É a mesma regra do @media print da térmica.
    '  background: #fff; color: #000; border: none; border-radius: 0;',
    '}',
    '.etq-nome {',
    '  margin: 0; font-size: 6.5pt; font-weight: 700; line-height: 1.2;',
    '  text-transform: uppercase;',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
    '}',
    // Mesma regra do nome: uma linha só. Variação longa ("Rosa Bebê
    // Estampado · R$ 1.234,56") quebrava em duas e comia a altura do código.
    '.etq-var {',
    '  margin: 1px 0 3px; font-size: 6pt; color: #444;',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
    '}',
    // O "margin: 0 auto" acompanha o teto: quando o max-height entra em ação,
    // o navegador encolhe a largura junto para manter a proporção, e sem a
    // margem automática o código ficaria encostado na esquerda.
    '.etq-svg {',
    '  display: block; width: 100%; height: auto; margin: 0 auto;',
    '  max-height: ' + alturaMaxBarrasMm(alturaMm) + 'mm;',
    '}',
    // A régua de calibração usa as mesmas medidas em mm; se um dia a
    // calibração passar pelo QZ, o estilo dela já está aqui.
    '.etq-calib { position: relative; width: ' + larguraMm + 'mm; height: ' + alturaMm + 'mm;',
    '  background: #fff; color: #000; }',
  ].join('\n')
}

/**
 * Um documento HTML completo com UMA fileira dentro.
 *
 * Uma fileira por documento, e não um documento com várias, porque o QZ Tray
 * rasteriza cada entrada do array como uma página. Confiar em `break-after:
 * page` dentro de um HTML rasterizado é justamente o tipo de coisa que sai
 * diferente em cada versão do renderizador — e aqui cada página é uma fileira
 * física do rolo, então errar significa etiqueta partida no picote.
 */
export function documentoFileira(conteudoHtml, medidas) {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<style>' + cssTermica(medidas) + '</style>',
    '</head><body>',
    String(conteudoHtml ?? ''),
    '</body></html>',
  ].join('')
}

/**
 * Fileiras serializadas -> array no formato que qz.print() espera.
 *
 * `type: 'pixel'` com `format: 'html'` é o caminho de HTML rasterizado do QZ
 * Tray (confirmado na API 2.2.6). `flavor: 'plain'` diz que `data` é o HTML em
 * si, e não um caminho de arquivo.
 */
export function documentosParaQz(fileiras, medidas) {
  return (fileiras || [])
    .filter(Boolean)
    .map(html => ({
      type: 'pixel',
      format: 'html',
      flavor: 'plain',
      data: documentoFileira(html, medidas),
    }))
}

/**
 * Opções do qz.configs.create.
 *
 * `scaleContent: false` é o ponto da tarefa inteira. Ligado (que é o padrão do
 * QZ), ele redimensiona o conteúdo para caber na página — exatamente o "Escala
 * 100%" que hoje alguém precisa conferir no diálogo do Chrome, e que já saiu
 * errado por não ter sido conferido. Desligado, 40mm declarados são 40mm
 * impressos.
 *
 * `margins: 0` pelo mesmo motivo que o @page da térmica: a impressora de rolo
 * não tem área não-imprimível para absorver margem, então qualquer margem
 * empurra a etiqueta para fora do picote.
 *
 * `colorType: 'blackwhite'` porque o conteúdo é código de barras: meio-tom em
 * barra estreita é o caminho mais curto para o leitor recusar a leitura.
 */
export function configQz({ papelMm, alturaMm }) {
  return {
    size: { width: papelMm, height: alturaMm },
    units: 'mm',
    margins: 0,
    scaleContent: false,
    rasterize: true,
    colorType: 'blackwhite',
    orientation: 'portrait',
  }
}
