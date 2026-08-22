// Ponte para o QZ Tray — impressão direta, sem o diálogo do navegador.
//
// ─── O PROBLEMA QUE ISTO RESOLVE ────────────────────────────────────────────
// Imprimir etiqueta pelo Chrome exige conferir três coisas no diálogo TODA
// VEZ: Escala 100%, Margens Nenhuma e Cabeçalhos e rodapés desmarcado. Já saiu
// errado por não terem sido conferidas. O QZ Tray é um agente que roda na
// máquina da loja e recebe o trabalho pronto: as três configurações viram
// parâmetro no código (ver configQz em utils/etiquetasHtml.js) em vez de
// memória de quem está imprimindo.
//
// ─── O QUE FOI CONFERIDO NA API (25/08/2026, qz-tray 2.2.6 instalado) ──────
// Superfície real do pacote, lida do módulo e não da memória:
//   qz.websocket  connect, disconnect, isActive, getConnectionInfo, ...
//   qz.printers   find, getDefault, details, getStatus, ...
//   qz.configs    create, setDefaults
//   qz.security   setCertificatePromise, setSignaturePromise, ...
//   qz.print(config, data)
//
// ─── SOBRE ASSINATURA DIGITAL, E POR QUE ELA NÃO ESTÁ AQUI ─────────────────
// A documentação do QZ é explícita: "removing pop-ups to achieve silent
// printing requires message signing". Sem assinar, o QZ Tray mostra um aviso
// DELE pedindo permissão para o site — com opção de lembrar a decisão, então é
// uma vez por máquina, não uma por impressão.
//
// Assinar exige uma chave privada. Chave privada NÃO pode morar no bundle: o
// front é público, e quem baixar o JS assina o que quiser em nome da loja.
// O caminho correto é uma Edge Function que receba o desafio e devolva a
// assinatura, com a chave em segredo do Supabase. Ficou de fora desta entrega
// de propósito — é infraestrutura nova, e o ganho desta etapa (nenhum diálogo
// do navegador, nenhuma configuração para conferir) já acontece sem ela.
// Os ganchos setCertificatePromise/setSignaturePromise continuam disponíveis
// no objeto qz para quando isso for feito.
//
// ─── MISTO DE CONTEÚDO (https -> localhost) ────────────────────────────────
// A página roda em https e o agente é local. O próprio qz-tray.js resolve
// isso: ele fala com localhost por wss usando um certificado que o QZ instala,
// então não há bloqueio de conteúdo misto para tratar aqui.

import { configQz } from '../utils/etiquetasHtml'

/** Página oficial de download, mostrada quando o agente não responde. */
export const URL_DOWNLOAD = 'https://qz.io/download/'

/** Onde fica a última impressora escolhida. Só o nome, nada sensível. */
const CHAVE_IMPRESSORA = 'etiquetas:qz:impressora'

let qzPromise = null

/**
 * Carrega o qz-tray sob demanda.
 *
 * import() dinâmico, e não import estático no topo: o pacote entra no bundle
 * de quem realmente escolher esse destino. Import estático somaria a lib ao
 * bundle principal — que já passa de 2,9MB — para TODA visita, inclusive o
 * catálogo público, que nunca imprime etiqueta nenhuma.
 */
export async function carregarQz() {
  if (!qzPromise) {
    qzPromise = import('qz-tray')
      .then(m => m.default || m)
      .catch(e => { qzPromise = null; throw e })
  }
  return qzPromise
}

/** Já existe conexão viva com o agente? */
export async function conectado() {
  try {
    const qz = await carregarQz()
    return qz.websocket.isActive()
  } catch {
    return false
  }
}

/**
 * Conecta ao agente local.
 *
 * `retries` baixo de propósito: quando o QZ Tray não está instalado, ninguém
 * quer esperar. O caso comum de falha aqui é "não instalado", e a resposta
 * certa é avisar rápido e mostrar o link — não insistir.
 */
export async function conectar() {
  const qz = await carregarQz()
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect({ retries: 1, delay: 1 })
  }
  return qz
}

/** Encerra a conexão. Falha aqui é irrelevante: o agente fecha sozinho. */
export async function desconectar() {
  try {
    const qz = await carregarQz()
    if (qz.websocket.isActive()) await qz.websocket.disconnect()
  } catch { /* nada a fazer — não vale estourar erro ao fechar um modal */ }
}

/**
 * Nomes das impressoras que o agente enxerga, com a padrão na frente.
 *
 * A padrão vem primeiro porque é o palpite certo em quase toda loja: quem tem
 * uma térmica só quer que ela já venha escolhida.
 */
export async function listarImpressoras() {
  const qz = await conectar()
  const todas = await qz.printers.find()
  const lista = Array.isArray(todas) ? todas.filter(Boolean) : [todas].filter(Boolean)
  let padrao = null
  try {
    padrao = await qz.printers.getDefault()
  } catch { /* nem todo sistema devolve padrão; a lista sozinha resolve */ }
  if (padrao && lista.includes(padrao)) {
    return [padrao, ...lista.filter(n => n !== padrao)]
  }
  return lista
}

/**
 * localStorage quando ele existe.
 *
 * O acesso é embrulhado porque `window` NÃO existe fora do navegador — o
 * ambiente de teste do repo é 'node', e os testes do modal renderizam o
 * componente com react-dom/server. Tocar em window durante a render derrubava
 * o arquivo de teste inteiro com "window is not defined". O try ainda cobre o
 * outro caso: navegador com storage bloqueado lança só ao ACESSAR.
 */
function storagePadrao() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** Lê a impressora salva. Devolve '' se não houver ou o storage estiver bloqueado. */
export function impressoraSalva(storage = storagePadrao()) {
  try {
    return storage?.getItem(CHAVE_IMPRESSORA) || ''
  } catch {
    return ''
  }
}

/** Guarda a impressora escolhida para a próxima impressão não pedir de novo. */
export function salvarImpressora(storage, nome) {
  // Chamada com um argumento só (o nome) usa o storage do navegador.
  if (arguments.length === 1) { nome = storage; storage = storagePadrao() }
  try {
    if (nome) storage?.setItem(CHAVE_IMPRESSORA, nome)
    else storage?.removeItem(CHAVE_IMPRESSORA)
  } catch { /* modo anônimo / storage bloqueado: só perde a conveniência */ }
}

/**
 * Manda os documentos para a impressora.
 *
 * @param impressora nome exato, como veio de listarImpressoras()
 * @param documentos saída de documentosParaQz()
 * @param medidas    { papelMm, alturaMm } — as MESMAS constantes do preview
 */
export async function imprimir({ impressora, documentos, medidas }) {
  if (!impressora) throw new Error('sem-impressora')
  if (!documentos?.length) throw new Error('sem-documentos')
  const qz = await conectar()
  const config = qz.configs.create(impressora, configQz(medidas))
  await qz.print(config, documentos)
  return documentos.length
}

/**
 * Traduz a falha para uma frase que a lojista consegue agir em cima.
 *
 * Devolve `{ texto, mostrarDownload }`: só o caso "agente não respondeu" ganha
 * o link de download. Nos outros, oferecer o instalador mandaria a pessoa
 * reinstalar um programa que já está lá.
 */
export function mensagemDeErro(e) {
  // Só aproveita `e` cru quando ele é string: um objeto solto viraria
  // "[object Object]" na frente da lojista, que é ruído puro. Sem mensagem
  // reconhecível, a frase genérica no fim é melhor.
  const bruto = typeof e?.message === 'string' ? e.message
    : typeof e === 'string' ? e
    : ''

  if (bruto === 'sem-impressora') {
    return { texto: 'Escolha a impressora antes de imprimir.', mostrarDownload: false }
  }
  if (bruto === 'sem-documentos') {
    return { texto: 'Não há etiqueta para enviar.', mostrarDownload: false }
  }
  // Falha de import(): rede caiu ou o chunk não carregou.
  if (/Failed to fetch dynamically imported|Importing a module script failed/i.test(bruto)) {
    return {
      texto: 'Não foi possível carregar o componente de impressão direta. Verifique a conexão e tente de novo.',
      mostrarDownload: false,
    }
  }
  // O connect() do qz-tray rejeita com "Unable to establish connection with QZ"
  // quando não acha o agente. Cobrimos também erro de socket cru, que é o que
  // aparece quando o serviço está parado.
  if (/unable to establish|connection|websocket|socket|refused|timed? ?out/i.test(bruto)) {
    return {
      texto: 'O QZ Tray não respondeu. Ele precisa estar instalado e aberto nesta máquina para imprimir direto.',
      mostrarDownload: true,
    }
  }
  if (/denied|blocked|permission/i.test(bruto)) {
    return {
      texto: 'O QZ Tray bloqueou o pedido. Abra o ícone dele na barra de tarefas e autorize este site.',
      mostrarDownload: false,
    }
  }
  return {
    texto: bruto ? `Não foi possível imprimir: ${bruto}` : 'Não foi possível imprimir.',
    mostrarDownload: false,
  }
}
