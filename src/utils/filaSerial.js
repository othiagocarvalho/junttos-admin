// Fila que executa tarefas assíncronas UMA POR VEZ, na ordem de chegada.
//
// Nasceu para a bipagem da Pré-venda: antes, um bipe que chegava enquanto o
// anterior ainda estava gravando era RECUSADO ("Aguarde…") e a vendedora
// tinha de bipar a peça de novo. Recusar protegia contra dois INSERT da mesma
// pré-venda; a fila dá a mesma garantia (nunca há duas tarefas rodando ao
// mesmo tempo) sem jogar o bipe fora.
//
// Regras:
//   - toda tarefa enfileirada roda exatamente uma vez;
//   - a próxima só começa quando a anterior terminou (resolveu OU rejeitou);
//   - uma tarefa que rejeita não trava a fila — o erro volta só para quem
//     enfileirou aquela tarefa.

/**
 * @returns {{
 *   enfileirar: <T>(tarefa: () => Promise<T>|T) => Promise<T>,
 *   pendentes: () => number,
 *   aguardarVazia: () => Promise<void>,
 *   assinar: (fn: (pendentes: number) => void) => () => void,
 * }}
 */
export function criarFilaSerial() {
  let cauda = Promise.resolve()
  let pendentes = 0
  const ouvintes = new Set()

  function avisar() {
    for (const fn of ouvintes) fn(pendentes)
  }

  function enfileirar(tarefa) {
    pendentes += 1
    avisar()
    const resultado = cauda.then(() => tarefa())
    const terminou = () => { pendentes -= 1; avisar() }
    cauda = resultado.then(terminou, terminou)
    return resultado
  }

  /** Resolve quando não houver mais nada na fila — inclusive o que for
   *  enfileirado enquanto se espera. */
  async function aguardarVazia() {
    while (pendentes > 0) await cauda
  }

  function assinar(fn) {
    ouvintes.add(fn)
    return () => ouvintes.delete(fn)
  }

  return { enfileirar, pendentes: () => pendentes, aguardarVazia, assinar }
}
