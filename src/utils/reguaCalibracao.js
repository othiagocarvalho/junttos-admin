// Geometria da régua de calibração da etiqueta térmica.
//
// ─── POR QUE ISTO NÃO MORA NO COMPONENTE ────────────────────────────────────
// Porque é REGRA, não desenho — e regra precisa de teste. A régua não tem como
// ser renderizada no ambiente 'node' do vitest (trocar o formato de impressão
// exige DOM), então a única forma de travar o comportamento dela é testando as
// funções direto. É a mesma razão de etiquetasQtd.js existir separado do modal.
//
// ─── O QUE ESTA RÉGUA RESPONDE ──────────────────────────────────────────────
// Ela é impressa e encostada numa etiqueta do rolo para responder duas coisas:
// a borda bate com o picote, e onde cai cada milímetro. É o instrumento que
// tira a calibração do chute — então erro AQUI custa caro: uma régua que mede
// errado manda a investigação inteira para o lado errado.

/**
 * Espessura da borda da régua, em mm.
 *
 * Entra numa constante porque as marcas precisam compensá-la: elemento
 * posicionado tem como referência a caixa de padding, que começa DEPOIS da
 * borda — sem o desconto, a marca do "0" cairia a 0,25mm da borda real e a
 * régua mediria tudo deslocado.
 */
export const CALIB_BORDA_MM = 0.25

/** Espessura do traço de cada marca. Entra na conta de recuoDaMarca(). */
export const CALIB_TRACO_MM = 0.2

/**
 * A partir de que distância do fim o número é escrito para DENTRO, à esquerda
 * do próprio traço.
 *
 * Duas marcas próximas (30 e 33) escreveriam os números um por cima do outro:
 * medido, "30" ocupava 30,3→32,0mm e o "33" alinhado para dentro ocupa
 * 31,0→32,7mm. Jogando os dois para a esquerda do respectivo traço, o "30" vai
 * para 28,3→30,0 e a sobreposição some, sem perder número nenhum.
 *
 * 4,2mm = dois rótulos de 2 dígitos em 4pt (1,7mm cada) mais os 0,3mm de
 * afastamento de cada um. Marca mais longe que isso do fim usa o lado normal.
 */
export const CALIB_ROTULO_DENTRO_MM = 4.2

/**
 * Marcações da régua: 0, 5, 10... e SEMPRE a medida total no fim.
 *
 * ─── POR QUE A MEDIDA TOTAL ENTRA À FORÇA ──────────────────────────────────
 * Porque sem ela a régua mente por omissão, e já mentiu. A versão anterior só
 * andava de 5 em 5 e parava na última marca que coubesse: numa etiqueta de
 * 33mm isso era o "30", e os 3mm finais ficavam sem marcação nenhuma. Na
 * etiqueta impressa isso lê como "o conteúdo não alcança o picote", e foi
 * diagnosticado como encolhimento de escala — uma investigação inteira gasta
 * atrás de um bug que não existia. A medição no PDF de impressão mostrou
 * depois que a fileira sai a 100,2% do nominal.
 *
 * O disfarce era bom porque o eixo VERTICAL não tem o problema: 25 é múltiplo
 * de 5, então lá a última marca encosta na borda. Régua que fecha num eixo e
 * para antes no outro parece exatamente uma imagem espremida na largura.
 *
 * Com a total no fim, a pergunta que a régua responde deixa de ser
 * interpretativa: a marca "33" caiu no picote ou não?
 */
export function marcasRegua(totalMm, passo = 5) {
  const out = []
  for (let mm = 0; mm <= totalMm; mm += passo) out.push(mm)
  if (out[out.length - 1] !== totalMm) out.push(totalMm)
  return out
}

/**
 * Quanto o traço recua do ponto que ele marca, em mm.
 *
 * O traço tem espessura e é desenhado para a DIREITA (ou para baixo) do ponto:
 * o do "0" ocupa 0,0→0,2mm, dentro da etiqueta. Na marca do fim isso se
 * inverte — o traço dos 33mm ocuparia 33,0→33,2mm, ou seja, 0,2mm de tinta
 * passando do picote, na etiqueta vizinha. Medido antes desta correção: o
 * traço da última marca começava em 33,01mm numa caixa de 33mm.
 *
 * Recuando a espessura, a marca do fim fica em 32,8→33,0mm: simétrica à do
 * "0" e com a tinta toda dentro.
 */
export function recuoDaMarca(mm, totalMm) {
  return mm === totalMm ? CALIB_BORDA_MM + CALIB_TRACO_MM : CALIB_BORDA_MM
}

/** O número desta marca é escrito para dentro, à esquerda do próprio traço? */
export function rotuloParaDentro(mm, totalMm) {
  return totalMm - mm < CALIB_ROTULO_DENTRO_MM
}
