// Ordem de uma leitura do CampoScanner, isolada para poder ser testada sem DOM.
//
// O campo é limpo ANTES de esperar aoLer, e nunca depois. Na Pré-venda aoLer
// é rede (fila + RPC); se o campo só fosse limpo no fim, o leitor — que
// digita a próxima etiqueta em rajada — escreveria o segundo código colado
// no primeiro ("111222") e a leitura seguinte não acharia nada. Limpar
// DEPOIS do await seria pior ainda: apagaria no meio o código que o leitor
// já estivesse digitando.
//
// Na Nova Venda aoLer é síncrono: limpar antes ou depois dá o mesmo
// resultado visível.

/**
 * @param codigo   o que estava no campo
 * @param limpar   () => void — zera o campo (setValor(''))
 * @param aoLer    (codigoLimpo) => resultado | Promise<resultado>
 * @returns o resultado de aoLer, ou null se o código veio vazio
 */
export async function lerComCampoLimpo(codigo, { limpar, aoLer }) {
  const limpo = String(codigo || '').trim()
  if (!limpo) return null
  limpar()
  return await aoLer?.(limpo)
}
