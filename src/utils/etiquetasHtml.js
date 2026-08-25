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

// ─── RESPIRO DENTRO DA CÉLULA ───────────────────────────────────────────────
// As quatro medidas abaixo são a distância entre a TINTA e o PICOTE, e por isso
// vivem aqui, num lugar só: os dois caminhos de impressão (navegador e QZ Tray)
// têm de reservar exatamente o mesmo espaço, senão a etiqueta sai diferente
// dependendo de por onde foi impressa.
//
// Não são simétricas de propósito. Ver ETQ_PAD_BOTTOM_MM.

/**
 * Respiro lateral. Era 1mm, que é menos que a tolerância de posicionamento do
 * rolo — a barra chegava perto demais do picote vertical.
 *
 * O custo está medido e é aceitável: a largura útil do código cai de 31mm para
 * 29mm, e com isso a barra mais estreita passa de 0,256mm para 0,239mm. O piso
 * seguro para leitor de mão é ~0,19mm (a conta inteira está em
 * utils/codigoBarras.js), então ainda sobram 26%. Subir este respiro além de
 * 2mm começa a comer essa folga.
 */
export const ETQ_PAD_X_MM = 2

/** Respiro no topo. */
export const ETQ_PAD_TOP_MM = 1

/**
 * Respiro embaixo — a margem de segurança até a linha de corte.
 *
 * É 3× o do topo, e isso é deliberado. O relato do papel impresso é de código
 * de barras encostando no picote de baixo, com o layout do CSS já simétrico
 * (medido: 3,28mm de folga em cima e embaixo). Assimetria assim, entre o que o
 * CSS desenha e o que o papel mostra, é deslocamento de impressão: a térmica
 * começa a imprimir alguns décimos depois do sensor de picote, e o conteúdo
 * inteiro desce.
 *
 * Não dá para corrigir o sensor pelo CSS, mas dá para ABSORVER o deslocamento:
 * reservando mais espaço embaixo do que em cima, o conteúdo desce dentro de uma
 * área que já tinha sobra, em vez de descer para cima do corte.
 *
 * Barra de código de barras cortada não é um defeito estético: o leitor recusa
 * a leitura, e a peça cai na busca manual — que é o trabalho que a etiqueta
 * existe para eliminar.
 */
export const ETQ_PAD_BOTTOM_MM = 3

/**
 * Altura do bloco de texto acima do código (nome + linha da variação).
 *
 * MEDIDO no Chrome com o CSS de impressão ativo: nome em 6,5pt ocupa 2,75mm e
 * a linha da variação em 6pt ocupa 2,65mm. Não é estimativa.
 */
export const ETQ_TEXTO_MM = 6.1

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
 * ─── A CONTA, E O QUE ELA GARANTE ──────────────────────────────────────────
 *   altura − respiro do topo − texto − respiro de baixo
 *
 * O que sobra é o teto. Como as quatro parcelas somam a altura inteira da
 * célula, vale um invariante: mesmo com o código no tamanho MÁXIMO, a base
 * dele nunca chega a menos de ETQ_PAD_BOTTOM_MM do picote. A margem de
 * segurança deixa de depender da sobra que o "justify-content: center"
 * porventura deixar, e passa a ser estrutural.
 *
 * A folga extra de 1,5mm que existia aqui saiu: ela era um número solto que
 * fazia o mesmo trabalho do respiro de baixo, só que sem dizer o nome.
 *
 * O piso de 4mm existe para uma etiqueta absurdamente baixa não gerar altura
 * negativa e sumir com o código de barras — nesse caso o certo é a barra
 * espremer, não desaparecer.
 */
export function alturaMaxBarrasMm(alturaMm) {
  return Math.max(4, +(alturaMm - ETQ_PAD_TOP_MM - ETQ_TEXTO_MM - ETQ_PAD_BOTTOM_MM).toFixed(2))
}

/**
 * Declarações que deslocam a FILEIRA INTEIRA no papel — ou string vazia quando
 * não há deslocamento configurado.
 *
 * ─── POR QUE "position: relative", E NÃO MARGEM NEM TRANSFORM ──────────────
 * Porque posicionamento relativo move o que é PINTADO sem mexer na caixa de
 * layout. A fileira continua ocupando exatamente os mesmos 100×25mm no fluxo,
 * então a paginação não sente nada — e paginação é justamente a cicatriz desta
 * família de bug: já custou uma etiqueta virando duas folhas e 159 páginas em
 * branco. Margem empurraria a caixa e poderia paginar; transform cria contexto
 * de empilhamento e é tratado como monolítico pelo fragmentador, o que é mexer
 * no que não está quebrado.
 *
 * O preço é que o deslocamento RECORTA no fim do papel em vez de esticá-lo:
 * com +2mm, os 2mm finais da fileira caem fora da página. Isso é aceitável
 * porque a tinta tem folga — medido, o código de barras tem 4,4mm de branco de
 * cada lado dentro da célula. Deslocamento maior que essa folga começa a comer
 * barra, e é o limite prático da constante.
 *
 * Devolver '' quando não há deslocamento não é elegância: é a garantia de que
 * a configuração padrão (0) produz um CSS BYTE A BYTE igual ao de antes desta
 * função existir. Sem regressão possível por acidente.
 */
export function deslocamentoCss(xMm = 0, yMm = 0) {
  if (!xMm && !yMm) return ''
  return 'position: relative; left: ' + xMm + 'mm; top: ' + yMm + 'mm;'
}

/**
 * CSS da fileira térmica.
 *
 * Espelha o bloco `@media print` da térmica em EtiquetasPrint.jsx, com uma
 * diferença deliberada: aqui as regras NÃO ficam dentro de @media print. O
 * documento só existe para ser impresso, e o QZ Tray rasteriza a página como
 * ela está — regra escondida atrás de @media print poderia não ser aplicada.
 */
export function cssTermica({
  larguraMm, alturaMm, papelMm, colunas, gapMm,
  // Compensação de registro da impressora. Chegam por parâmetro como todo o
  // resto: o valor mora nas constantes de EtiquetasPrint.jsx, para o
  // navegador e o QZ Tray deslocarem exatamente igual.
  offsetXMm = 0, offsetYMm = 0,
}) {
  const desloca = deslocamentoCss(offsetXMm, offsetYMm)
  return [
    '@page { size: ' + papelMm + 'mm ' + alturaMm + 'mm; margin: 0; }',
    // O "overflow: hidden" fecha a porta que o deslocamento abre. Com
    // LABEL_OFFSET_X_MM ligado, a fileira passa a PINTAR além da página (com
    // 2mm de deslocamento numa página de 104mm, ela chega a 105,99mm) — e
    // renderizador que "ajusta para caber" encolhe o documento inteiro para
    // conter isso. Medido: o PDF saiu com as barras a 24,57mm em vez de
    // 24,99mm, 1,9% menor, que é 104/106 exatamente.
    //
    // O QZ manda `scaleContent: false` justamente para não encolher, mas
    // depender disso enquanto se pinta fora da página é apostar no
    // comportamento de um renderizador que não é o nosso — e escala silenciosa
    // é a família de bug que custou esta série inteira. Recortar é seguro: o
    // que cai fora da página é o branco da última célula, nunca tinta (a barra
    // tem 2,5mm de folga até a borda).
    'html, body { margin: 0; padding: 0; background: #fff; overflow: hidden; }',
    '* { box-sizing: border-box; }',
    'body { font-family: ' + FONTE + '; }',
    '.etq-fileira {',
    '  display: grid;',
    '  grid-template-columns: repeat(' + colunas + ', ' + larguraMm + 'mm);',
    '  gap: 0 ' + gapMm + 'mm;',
    '  width: ' + papelMm + 'mm; height: ' + alturaMm + 'mm; margin: 0;',
    desloca && '  ' + desloca,
    '}',
    '.etq-item {',
    '  width: ' + larguraMm + 'mm; height: ' + alturaMm + 'mm;',
    '  display: flex; flex-direction: column; justify-content: center;',
    // "align-items: center" é o que centraliza de verdade. Só o
    // "text-align: center" não bastava: ele centraliza o texto DENTRO da
    // caixa, e as caixas nasciam esticadas na largura inteira (o padrão
    // "align-items: stretch"), então nada ficava visivelmente centrado quando
    // o conteúdo era menor que a célula. Com "center", cada caixa encolhe até
    // o conteúdo e é a CAIXA que fica no meio da etiqueta.
    '  align-items: center;',
    '  padding: ' + ETQ_PAD_TOP_MM + 'mm ' + ETQ_PAD_X_MM + 'mm ' + ETQ_PAD_BOTTOM_MM + 'mm;',
    '  text-align: center;',
    // A etiqueta tem altura fixa; sem isto, conteúdo que passar dela não fica
    // contido — vaza para a etiqueta de baixo e estica a fileira além da
    // página. Recortar é o mal menor: perde-se o fim de um texto, não a
    // etiqueta seguinte.
    '  overflow: hidden;',
    // Sem borda e sem raio: no papel a borda de preview viraria tinta gasta em
    // volta de cada etiqueta. É a mesma regra do @media print da térmica.
    '  background: #fff; color: #000; border: none; border-radius: 0;',
    '}',
    // O "max-width: 100%" é o par obrigatório do "align-items: center": sem
    // ele a caixa encolhida cresce até o texto inteiro (o nome é nowrap), passa
    // da célula e o "text-overflow: ellipsis" nunca chega a agir.
    '.etq-nome {',
    '  margin: 0; font-size: 6.5pt; font-weight: 700; line-height: 1.2;',
    '  text-transform: uppercase; max-width: 100%;',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
    '}',
    // Mesma regra do nome: uma linha só. Variação longa ("Rosa Bebê
    // Estampado · R$ 1.234,56") quebrava em duas e comia a altura do código.
    '.etq-var {',
    '  margin: 1px 0 3px; font-size: 6pt; color: #444; max-width: 100%;',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
    '}',
    // "width: 100%" com "align-self: stretch" desfeito pelo align-items do
    // pai: o SVG precisa continuar ocupando a largura útil inteira (é o que
    // mantém a barra estreita acima do piso de leitura), então ele é a única
    // caixa que NÃO encolhe. O "margin: 0 auto" cobre o caso em que o teto de
    // altura entra em ação: o navegador encolhe a largura junto para manter a
    // proporção, e sem a margem o código ficaria encostado à esquerda.
    '.etq-svg {',
    '  display: block; width: 100%; align-self: stretch;',
    '  height: auto; margin: 0 auto;',
    '  max-height: ' + alturaMaxBarrasMm(alturaMm) + 'mm;',
    '}',
    // A régua de calibração usa as mesmas medidas em mm; se um dia a
    // calibração passar pelo QZ, o estilo dela já está aqui.
    '.etq-calib { position: relative; width: ' + larguraMm + 'mm; height: ' + alturaMm + 'mm;',
    '  background: #fff; color: #000; }',
  // filter: a linha do deslocamento é falsy quando não há deslocamento, e sem
  // isto ela viraria uma linha em branco no meio da regra.
  ].filter(Boolean).join('\n')
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

/** Resolução da cabeça térmica da Elgin/Bematech L42PRO Full, em DPI. */
export const DENSIDADE_DPI = 203

/**
 * A MESMA densidade em pontos por MILÍMETRO — que é o que o QZ Tray espera.
 *
 * ⚠️ ARMADILHA DE UNIDADE, conferida na fonte do pacote (qz-tray 2.2.6,
 * qz-tray.js linha 1580):
 *
 *   "density ... Pixel density (DPI, DPMM, or DPCM depending on [options.units])"
 *
 * O `units` do nosso config é 'mm' — porque o tamanho da página é em mm — e
 * isso arrasta a densidade junto. Escrever `density: 203` aqui NÃO diria
 * "203 DPI": diria 203 pontos por milímetro, 25× a resolução real da cabeça.
 *
 * Por isso a conversão é explícita e fica no código, não na cabeça de quem ler
 * depois: 203 ÷ 25,4 = 7,99 pontos/mm.
 *
 * ─── POR QUE FIXAR, SE O PADRÃO É AUTOMÁTICO ──────────────────────────────
 * O padrão do QZ é `density: 0`, que significa "pergunte ao driver". Quando o
 * driver não responde, ou responde "Normal", o QZ rasteriza numa densidade
 * arbitrária — e como o caminho direto manda HTML RASTERIZADO (type 'pixel'),
 * densidade errada é bitmap com outra contagem de pontos para os mesmos
 * milímetros. É a única brecha de escala que sobrou depois de a medição no PDF
 * ter mostrado que o caminho do navegador sai correto a 100%.
 *
 * Fixar não muda a geometria: a página continua declarada em mm com
 * `scaleContent: false`, então o desenho ocupa os mesmos 100×25mm. O que muda
 * é a nitidez — e casar com os 203dpi da cabeça é o que evita reamostragem do
 * código de barras, que é onde meio ponto de borrão custa uma leitura.
 */
export const DENSIDADE_DPMM = +(DENSIDADE_DPI / 25.4).toFixed(2)

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
 *
 * `density` fecha a última porta de escala deste caminho — ver DENSIDADE_DPMM.
 */
export function configQz({ papelMm, alturaMm }) {
  return {
    size: { width: papelMm, height: alturaMm },
    units: 'mm',
    margins: 0,
    density: DENSIDADE_DPMM,
    scaleContent: false,
    rasterize: true,
    colorType: 'blackwhite',
    orientation: 'portrait',
  }
}
