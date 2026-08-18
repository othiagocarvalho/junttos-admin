/**
 * Modelo de venda da loja — Varejo ou Atacado.
 *
 * Traduz a escolha do admin (dois botões) para o campo real em
 * lf_config.features.catalogo_b2b, que NÃO é booleano: ele tem três estados.
 *
 *   false       → Varejo. Catálogo público comum, sem pedido mínimo nem grade.
 *   'simples'   → Atacado simples. A aba de catálogo B2B aparece no painel da
 *                 lojista, mas o catálogo público não liga pedido mínimo nem
 *                 grade de tamanho.
 *   'pro'       → Atacado completo. É o ÚNICO valor que liga pedido mínimo e
 *                 grade de tamanho — CatalogoPublico.jsx faz
 *                 `catalogo_b2b === 'pro'` para as duas coisas.
 *
 * Por isso "Atacado" grava 'pro' e nunca `true`: o valor `true` é truthy, então
 * acenderia a aba no painel, mas falharia em todos os `=== 'simples' || === 'pro'`
 * espalhados pelo código — a loja ficaria com a aba visível e o pedido mínimo
 * silenciosamente ignorado.
 *
 * Loja que já está em 'simples' é preservada: enquanto o admin não mexer no
 * seletor, ela continua 'simples'. Trocar Atacado→Varejo→Atacado promove para
 * 'pro', que é o padrão de quem escolhe Atacado hoje.
 */

// Extensão explícita de propósito: além do app (Vite), este módulo é importado
// por scripts/validar-modelo-venda.mjs, que roda em Node puro — e o Node ESM
// não resolve import sem extensão. Mesmo estilo de utils/corrida.js.
import { fmtR } from './formatters.js'

export const MODELO_VAREJO  = 'varejo'
export const MODELO_ATACADO = 'atacado'

/** Valor gravado quando o admin escolhe Atacado numa loja que não era atacado. */
export const NIVEL_ATACADO_PADRAO = 'pro'

/**
 * Níveis de catalogo_b2b que contam como atacado.
 *
 * `true` entra na lista porque existe de verdade no banco (gravado à mão por
 * UPDATE antes desta tela existir) e é truthy: com ele a aba de Catálogo B2B
 * já aparece no painel da lojista. Mostrar essa loja como "Varejo" no seletor
 * seria mentir sobre o que ela está fazendo hoje. Mas `true` falha em todos os
 * `=== 'simples' || === 'pro'` do código, então a loja fica num meio-termo:
 * aba ligada, pedido mínimo e grade sem funcionar. Por isso ele é tratado como
 * atacado para exibir, e normalizado para 'pro' quando o admin confirma.
 */
const NIVEIS_ATACADO = ['simples', 'pro', true]

/**
 * Nível bruto de catalogo_b2b → modelo de venda exibido no seletor.
 * false, null e undefined caem em Varejo, o padrão do catálogo.
 */
export function nivelParaModelo(nivel) {
  return NIVEIS_ATACADO.includes(nivel) ? MODELO_ATACADO : MODELO_VAREJO
}

/**
 * Normaliza features de lf_config para objeto.
 *
 * A coluna é jsonb e quase sempre volta como objeto, mas há linhas antigas
 * gravadas como texto — o DemoPanel já convivia com isso. Ler a string crua
 * daria `undefined` em catalogo_b2b e mostraria "Varejo" numa loja de atacado.
 */
export function normalizarFeatures(features) {
  if (typeof features === 'string') {
    try { return JSON.parse(features) || {} } catch { return {} }
  }
  return features || {}
}

/** Lê o modelo de venda a partir do objeto features de lf_config. */
export function modeloDeFeatures(features) {
  return nivelParaModelo(normalizarFeatures(features).catalogo_b2b)
}

/**
 * Modelo escolhido + nível atual → nível a gravar.
 *
 * Preserva 'simples': se a loja já é atacado simples e o admin não trocou o
 * seletor, ela continua simples em vez de ser promovida sem querer.
 */
export function nivelDoModelo(modelo, nivelAtual) {
  if (modelo !== MODELO_ATACADO) return false
  // 'simples' é preservado; `true` legado é normalizado para 'pro', que é o
  // que a loja já aparentava ser e nunca conseguiu executar.
  return nivelAtual === 'simples' ? 'simples' : NIVEL_ATACADO_PADRAO
}

/**
 * O botão de trocar só deve acender quando gravar muda alguma coisa de fato.
 *
 * Sem isto, loja cujo features nem tem a chave catalogo_b2b (existem três no
 * banco) ofereceria uma "troca" de Varejo para Varejo, e loja com o `true`
 * legado não ofereceria a normalização que ela precisa.
 */
export function precisaGravar(modelo, nivelAtual) {
  const novo = nivelDoModelo(modelo, nivelAtual)
  if (novo === nivelAtual) return false
  // Ausente, null e false são o mesmo varejo — não inventar troca.
  if (novo === false && !nivelAtual) return false
  return true
}

/**
 * Devolve um objeto features novo com o modelo aplicado.
 * Não muta o original e não encosta em nenhuma outra flag.
 */
export function featuresComModelo(features, modelo) {
  const atuais = normalizarFeatures(features)
  return { ...atuais, catalogo_b2b: nivelDoModelo(modelo, atuais.catalogo_b2b) }
}

/** Rótulo humano do nível atual, para o admin ver o que está gravado. */
export function rotuloNivel(nivel) {
  if (nivel === 'pro')     return 'Atacado (completo)'
  if (nivel === 'simples') return 'Atacado (simples)'
  if (nivel === true)      return 'Atacado (valor legado — sem pedido mínimo)'
  return 'Varejo'
}

/**
 * Normaliza os três campos de pedido mínimo de lf_config.
 *
 * Mesma regra que a lojista já usa em CatalogoB2BAdmin.jsx: o tipo manda, e a
 * coluna que não corresponde ao tipo vai a null — assim não sobra valor órfão
 * de uma escolha anterior.
 */
export function pedidoMinimoPayload({ tipo, valor, qtd } = {}) {
  const t = tipo || 'nenhum'
  return {
    pedido_minimo_tipo:  t,
    pedido_minimo_valor: t === 'valor'      ? (parseFloat(String(valor ?? '').replace(',', '.')) || null) : null,
    pedido_minimo_qtd:   t === 'quantidade' ? (parseInt(qtd, 10) || null) : null,
  }
}

/**
 * A lojista precisa ser avisada de que o catálogo está sem piso de pedido?
 *
 * Só faz sentido no nível 'pro' — é o único em que o catálogo público chega a
 * olhar pedido mínimo. Com tipo 'nenhum' (o default da coluna) o cliente final
 * fecha pedido de 1 peça, e hoje a tela não distingue isso de uma escolha
 * deliberada: o select mostra "Nenhum" nos dois casos.
 *
 * Recebe o tipo SELECIONADO na tela, não o salvo no banco, para o aviso sumir
 * assim que ela escolhe outro tipo — antes mesmo de salvar.
 *
 * @param {string|boolean} nivel — features.catalogo_b2b
 * @param {string} tipo — pedido_minimo_tipo em edição
 */
export function precisaAvisarPedidoMinimo(nivel, tipo) {
  if (nivel !== 'pro') return false
  return !tipo || tipo === 'nenhum'
}

/**
 * Resumo do pedido mínimo para leitura do admin.
 *
 * `configurado: false` cobre dois casos que na prática dão no mesmo — o
 * catálogo não trava nada:
 *   - tipo 'nenhum'/ausente;
 *   - tipo escolhido mas sem número (CatalogoPublico faz Number(null) || 0,
 *     e `total >= 0` é sempre verdadeiro).
 * O segundo é invisível na tela da lojista, então vale o admin enxergar.
 */
export function resumoPedidoMinimo(config) {
  const tipo = config?.pedido_minimo_tipo

  if (!tipo || tipo === 'nenhum') {
    return { configurado: false, texto: 'Sem pedido mínimo configurado' }
  }

  if (tipo === 'valor') {
    const valor = Number(config.pedido_minimo_valor) || 0
    return valor > 0
      ? { configurado: true,  texto: `${fmtR(valor)} por pedido` }
      : { configurado: false, texto: 'Tipo "valor" escolhido, sem valor definido — não trava nada' }
  }

  if (tipo === 'quantidade') {
    const qtd = Number(config.pedido_minimo_qtd) || 0
    return qtd > 0
      ? { configurado: true,  texto: `${qtd} ${qtd === 1 ? 'peça' : 'peças'} por pedido` }
      : { configurado: false, texto: 'Tipo "quantidade" escolhido, sem quantidade definida — não trava nada' }
  }

  return { configurado: false, texto: `Tipo não reconhecido: ${tipo}` }
}
