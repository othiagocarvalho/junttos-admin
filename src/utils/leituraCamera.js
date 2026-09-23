// Regras puras da leitura de código de barras pela câmera (BarcodeScanner).
//
// Ficam fora do componente para serem testáveis sem câmera nem DOM — o
// componente só liga o zxing a estas funções.

/** Janela, em ms, em que a MESMA peça não é aceita de novo no modo contínuo. */
export const JANELA_REPETICAO_MS = 1500

/**
 * Controle de aceitação de leituras no modo contínuo.
 *
 * A câmera decodifica vários quadros por segundo: com a etiqueta parada na
 * frente dela, o mesmo código chega dezenas de vezes. Duas regras:
 *
 *   1. Enquanto a leitura anterior está sendo processada (`ocupado`), nada
 *      entra — a Pré-venda consulta o servidor a cada bipe e já recusa bipe
 *      concorrente; aqui a câmera nem chega a pedir.
 *   2. O MESMO código só é aceito de novo depois de `janelaMs`, contados a
 *      partir do FIM do processamento anterior. Contar do início deixaria a
 *      peça ser somada duas vezes quando o servidor demora mais que a janela.
 *      Código DIFERENTE entra assim que o anterior termina.
 *
 * `agora` é injetado (ms) para o teste controlar o relógio.
 */
export function criarControleLeitura({ janelaMs = JANELA_REPETICAO_MS } = {}) {
  let ocupado = false
  let ultimoCodigo = null
  let ultimoFimEm = -Infinity

  return {
    /** true = pode processar; já marca como ocupado. */
    tentar(codigo, agora) {
      if (ocupado || !codigo) return false
      if (codigo === ultimoCodigo && agora - ultimoFimEm < janelaMs) return false
      ocupado = true
      ultimoCodigo = codigo
      return true
    },
    /** Chamar quando o processamento da leitura aceita terminar (ok ou erro). */
    concluir(agora) {
      ocupado = false
      ultimoFimEm = agora
    },
  }
}

/**
 * Mensagem para a tela quando a câmera não abre.
 *
 * Os nomes são os de DOMException que getUserMedia usa, mais os antigos que
 * alguns navegadores ainda mandam (PermissionDeniedError, DevicesNotFoundError,
 * TrackStartError, ConstraintNotSatisfiedError). Sem isto, qualquer erro que
 * não fosse permissão deixava a tela preta, sem explicação.
 *
 * Observação sobre "câmera traseira indisponível": o pedido usa
 * facingMode { ideal: 'environment' }, que CAI na câmera frontal quando não há
 * traseira — então esse erro só aparece se o navegador tratar a preferência
 * como obrigatória. Fica mapeado mesmo assim.
 */
export function mensagemErroCamera(err) {
  const nome = err?.name || ''
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(nome)) {
    return {
      titulo: 'Permissão de câmera negada',
      detalhe: 'Ative o acesso à câmera nas configurações do navegador.',
    }
  }
  if (['NotFoundError', 'DevicesNotFoundError'].includes(nome)) {
    return {
      titulo: 'Nenhuma câmera encontrada',
      detalhe: 'Este aparelho não tem câmera disponível para o navegador.',
    }
  }
  if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(nome)) {
    return {
      titulo: 'Câmera em uso',
      detalhe: 'Outro app está usando a câmera. Feche-o e tente de novo.',
    }
  }
  if (['OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(nome)) {
    return {
      titulo: 'Câmera traseira indisponível',
      detalhe: 'Não foi possível abrir a câmera traseira deste aparelho.',
    }
  }
  return {
    titulo: 'Não foi possível abrir a câmera',
    detalhe: 'Feche e tente de novo. Se continuar, use o leitor ou a busca pelo nome.',
  }
}

/**
 * O navegador expõe câmera? getUserMedia só existe em contexto seguro
 * (HTTPS ou localhost) — em HTTP pelo IP da rede local ele some, e o botão de
 * câmera simplesmente não aparece.
 */
export function cameraDisponivel(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  return typeof nav?.mediaDevices?.getUserMedia === 'function'
}
