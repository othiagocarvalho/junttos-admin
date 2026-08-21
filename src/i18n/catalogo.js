// Textos do catálogo público — seção 2.3 da spec (docs/CATALOGO_SPEC.md).
//
// Tudo que o cliente final lê mora aqui, nada hardcoded no componente. Só
// pt-BR: multi-idioma está explicitamente fora de escopo (seção 14).
//
// Placeholders são {chave} e são resolvidos por `t()`.

export const TEXTOS = {
  // topo
  buscarPlaceholder: 'Buscar peça… ex: vestido',
  botaoPedido: 'Pedido',
  abrirPedido: 'Abrir meu pedido',

  // 3 passos
  passo1: 'Escolha o produto',
  passo2: 'Confira o pedido',
  passo3: 'Pagamento',

  // filtros
  chipTudo: 'Tudo',
  ordenar: '⇅ Ordenar',
  ordemMenorPreco: 'Menor preço',
  ordemMaiorPreco: 'Maior preço',
  ordemNome: 'Nome A–Z',

  // faixa de pedido mínimo
  minimoDe: 'Pedido mínimo de {valor}.',
  minimoFaltam: 'Faltam {valor} para atingir o pedido mínimo de {min}.',
  minimoAtingido: 'Pedido mínimo atingido. Você já pode finalizar.',
  minimoDeQtd: 'Pedido mínimo de {qtd} peças.',
  minimoFaltamQtd: 'Faltam {qtd} peças para atingir o pedido mínimo de {min} peças.',

  // grade vazia — busca/filtro sem resultado
  vazioTitulo: 'Nada encontrado',
  vazioTexto: 'Tente outra palavra ou toque em "Tudo".',

  // loja sem NENHUMA peça publicada: estado diferente de busca vazia, porque
  // não há o que buscar. Mandar "tente outra palavra" aqui seria mentira.
  semCatalogoTitulo: 'Ainda não há peças por aqui',
  semCatalogoTexto: 'Esta loja está montando o catálogo. Assim que publicar, as peças aparecem nesta página.',
  semCatalogoAjuda: 'Falar com a loja no WhatsApp',

  // rodapé
  envio: 'Envio',
  envioPadrao: 'Enviamos para todo o Brasil.',
  ajudaTitulo: 'Precisa de ajuda?',
  ajudaTexto: 'Fale direto com a loja no WhatsApp.',
  chamarWhatsapp: 'Chamar no WhatsApp',

  // drawer
  meuPedido: 'Meu pedido',
  pedidoVazioTitulo: 'Seu pedido está vazio',
  pedidoVazioTexto: 'Toque em uma peça e escolha cor e tamanho.',
  pedidoNenhumaPeca: 'Nenhuma peça ainda',
  pedidoResumo: '{pecas} peças · {variacoes} variações',
  total: 'Total',
  // Identificação da cliente — obrigatória desde que o V2 passou a gravar
  // pedido sem contato nenhum.
  seusDados: 'Seus dados',
  seusDadosTexto: 'A loja precisa disso para falar com você sobre o pedido.',
  campoNome: 'Seu nome',
  campoNomePlaceholder: 'Como a loja deve te chamar',
  campoWhatsapp: 'Seu WhatsApp',
  campoWhatsappPlaceholder: '(85) 99999-0000',
  erroNomeObrigatorio: 'Escreva seu nome.',
  erroWhatsappInvalido: 'Escreva um WhatsApp com DDD.',
  erroDadosIncompletos: 'Preencha seu nome e WhatsApp para finalizar.',
  enviarWhatsapp: 'Enviar pedido no WhatsApp',
  pagarSite: 'Pagar agora pelo site',
  // Pix copia-e-cola — sem gateway e sem QR Code: a cliente copia a chave,
  // paga no banco dela e volta pelo WhatsApp com o comprovante.
  pixTitulo: 'Pague com Pix',
  pixInstrucao: 'Copie a chave, pague no seu banco e mande o comprovante no WhatsApp.',
  pixCopiar: 'Copiar chave Pix',
  pixCopiado: 'Chave copiada!',
  toastPixCopiado: 'Chave Pix copiada',
  // Pix dinâmico (Mercado Pago): QR Code + confirmação automática.
  pixQrTitulo: 'Pague com Pix',
  pixQrInstrucao: 'Abra o app do seu banco, escaneie o QR Code e confirme. A confirmação aparece aqui sozinha.',
  pixQrGerar: 'Gerar QR Code Pix',
  pixQrGerando: 'Gerando QR Code...',
  pixQrCopiar: 'Copiar código Pix',
  pixQrCopiado: 'Código copiado!',
  pixQrAlt: 'QR Code para pagamento via Pix',
  pixQrAguardando: 'Aguardando o pagamento...',
  pixQrPago: 'Pagamento confirmado!',
  pixQrPagoTexto: 'Recebemos seu pagamento. A loja já foi avisada.',
  pixQrErro: 'Não foi possível gerar o QR Code agora.',
  avisoMinimo: 'Faltam {valor} para o pedido mínimo. Adicione mais peças para finalizar.',
  avisoMinimoQtd: 'Faltam {qtd} peças para o pedido mínimo. Adicione mais peças para finalizar.',

  // modal
  ampliar: 'Toque para ampliar',
  adicionar: 'Adicionar ao pedido',
  notaAtacado: 'Você pode misturar cores e tamanhos livremente. Não há grade fechada.',
  notaVarejo: 'Selecione a quantidade desejada de cada tamanho.',
  quantidade: 'Quantidade',
  escolhaQuantidades: 'Escolha as quantidades',
  pecasSelecionadas: '{n} peças selecionadas',
  resumoPecas: '{n} peças',

  // pergunta do modal — seção 6
  perguntaCorETamanho: 'Quantas peças de cada cor e tamanho?',
  perguntaCor: 'Quantas peças de cada cor?',
  perguntaTamanho: 'Quantas peças de cada tamanho?',
  perguntaSimples: 'Quantas peças você quer?',

  // legenda do card — seção 6
  legendaCores: '{n} cores',
  legendaTamanhoUnico: 'Tamanho único',

  // toasts
  toastAdicionado: '{n} peças adicionadas ao pedido',
  toastEscolhaUma: 'Escolha ao menos uma peça',
  toastAbaixoMinimo: 'Adicione mais peças para atingir o mínimo',
  toastSemWhatsapp: 'Esta loja ainda não cadastrou o WhatsApp',

  // mensagem do WhatsApp — seção 8.1
  waSaudacao: 'Olá! Quero fazer um pedido no catálogo da {loja}.',
  waTotal: 'Total: {pecas} peças — {valor}',
  waOrigem: 'Pedido feito em: {url}',

  // acessibilidade
  ariaFechar: 'Fechar',
  ariaAumentar: 'Aumentar quantidade',
  ariaDiminuir: 'Diminuir quantidade',
  ariaVerFoto: 'Ver foto {n}',
  ariaAbrirProduto: 'Abrir {nome}',

  // subtítulo padrão do cabeçalho
  subtituloPadrao: 'Catálogo online',
  etiquetaVideoPadrao: 'Coleção nova',
}

/**
 * Texto com placeholders resolvidos: t('minimoDe', { valor: 'R$ 300,00' }).
 * Chave inexistente devolve a própria chave — erro de tradução aparece na
 * tela como texto estranho em vez de derrubar o catálogo do cliente.
 */
export function t(chave, vars) {
  const base = TEXTOS[chave]
  if (base == null) return chave
  if (!vars) return base
  return base.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}
