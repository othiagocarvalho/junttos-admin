// Trava síncrona por chave, contra toque duplo.
//
// Na busca por nome da Pré-venda cada toque RESERVA uma peça de verdade
// (bipar_item_prevenda). Um toque duplo — dedo que treme, clique duplo no
// mouse — não pode virar duas baixas. Desabilitar o botão via setState não
// basta sozinho: o segundo clique pode chegar antes do re-render. A trava
// é lida e escrita na mesma volta síncrona do evento.
//
// Por chave (produto + variação), e não global: tocar em duas variações
// diferentes em sequência rápida é intencional e deve funcionar.

export function criarTravaPorChave() {
  const ocupadas = new Set()

  /**
   * Executa `fn` se a chave estiver livre, e a mantém ocupada até a promessa
   * terminar. Chave já ocupada: não executa e devolve null.
   */
  async function executar(chave, fn) {
    if (ocupadas.has(chave)) return null
    ocupadas.add(chave)
    try {
      return await fn()
    } finally {
      ocupadas.delete(chave)
    }
  }

  return { executar, ocupada: chave => ocupadas.has(chave) }
}
