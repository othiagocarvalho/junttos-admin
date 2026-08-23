// Lógica pura do catálogo público novo — docs/CATALOGO_SPEC.md.
//
// Tudo que dá para decidir sem DOM mora aqui: normalização do produto vindo
// do banco, matemática do carrinho, copy dinâmica (seção 6), mensagem do
// WhatsApp (seção 8.1) e persistência (seção 8.3). O componente
// CatalogoPublicoV2.jsx só desenha.
//
// Motivo de existir separado: vitest neste projeto roda em environment 'node',
// sem jsdom — teste de componente não é possível hoje, teste de lógica é.

import { fmtR } from './formatters'
import { derivarCategoria } from './categoriaProduto'
import { coresDeVariacoes } from './coresProduto'
import { t, TEXTOS } from '../i18n/catalogo'

/** Tamanho que significa "este produto não tem escolha de tamanho". */
export const TAMANHO_UNICO = 'Único'

/** Carrinho salvo expira em 7 dias (seção 8.3). */
export const TTL_CARRINHO_MS = 7 * 24 * 60 * 60 * 1000

/** Chave de localStorage por loja — nunca tocar na chave de outra loja. */
export function chaveCarrinho(lojaId) {
  return `catalogo:${lojaId}:carrinho`
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalização: linha do banco → produto da spec
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linha de lf_produtos → produto no formato da seção 2.2.
 *
 * Funciona com ou sem a migração aplicada: quando `cores` / `categoria` ainda
 * estão vazios no banco, deriva de `variacoes` / `nome` em memória. Assim o
 * catálogo novo pode ser testado antes de qualquer ALTER TABLE rodar.
 *
 * `tamanhos` é sempre ["Único"] quando o banco não trouxer outra coisa: nenhum
 * produto do sistema tem dimensão de tamanho hoje (só cor + quantidade), e
 * herdar uma grade padrão inventaria tamanho que a loja não vende.
 */
export function normalizarProduto(row) {
  const cores = Array.isArray(row?.cores) && row.cores.length
    ? row.cores.filter(c => c && c.nome).map(c => ({ nome: String(c.nome), hex: c.hex || '#B7B2A6' }))
    : coresDeVariacoes(row?.variacoes).map(({ nome, hex }) => ({ nome, hex }))

  const tamanhos = Array.isArray(row?.tamanhos) && row.tamanhos.length
    ? row.tamanhos.map(String)
    : [TAMANHO_UNICO]

  const categoria = (row?.categoria && String(row.categoria).trim())
    || derivarCategoria(row?.nome)?.label
    || 'Outros'

  return {
    id: row?.id,
    nome: row?.nome ?? '',
    preco: Number(row?.preco_venda) || 0,
    categoria,
    selo: (row?.selo && String(row.selo).trim()) || '',
    fotos: (row?.fotos || []).filter(Boolean),
    cores,
    tamanhos,
    ativo: row?.ativo !== false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy dinâmica — seção 6
// ─────────────────────────────────────────────────────────────────────────────

/** O produto oferece escolha de cor? Uma cor só não é escolha. */
export function temCor(produto) {
  return (produto?.cores?.length || 0) > 1
}

/** O produto oferece escolha de tamanho? ["Único"] não é escolha. */
export function temTamanho(produto) {
  const tam = produto?.tamanhos || []
  return tam.length > 1 || (tam.length === 1 && tam[0] !== TAMANHO_UNICO)
}

/**
 * Legenda do card = [parte1, parte2].join(" · ").
 * Produto sem cor nenhuma não gera parte1 — nada de " · " solto na frente.
 */
export function legendaCard(produto) {
  const cores = produto?.cores || []
  const partes = []

  if (temCor(produto)) partes.push(t('legendaCores', { n: cores.length }))
  else if (cores.length === 1) partes.push(cores[0].nome)

  partes.push(temTamanho(produto)
    ? (produto.tamanhos || []).join(' ')
    : t('legendaTamanhoUnico'))

  return partes.join(' · ')
}

/** Pergunta do modal — tabela da seção 6. Nunca cita o que o produto não tem. */
export function perguntaModal(produto) {
  const c = temCor(produto)
  const s = temTamanho(produto)
  if (c && s) return t('perguntaCorETamanho')
  if (c) return t('perguntaCor')
  if (s) return t('perguntaTamanho')
  return t('perguntaSimples')
}

/** Rótulo da célula do stepper: o tamanho, ou "Quantidade" quando não há. */
export function rotuloCelula(produto, tamanho) {
  return temTamanho(produto) ? tamanho : t('quantidade')
}

// ─────────────────────────────────────────────────────────────────────────────
// Carrinho — seção 9
// ─────────────────────────────────────────────────────────────────────────────

/** Chave `${produtoId}|${cor}|${tamanho}`; cor/tamanho = "" quando não existem. */
export function chaveItem(produtoId, cor, tamanho) {
  return `${produtoId}|${cor || ''}|${tamanho || ''}`
}

/** Desmonta a chave de volta em suas 3 partes. */
export function partesDaChave(chave) {
  const [produtoId, cor = '', tamanho = ''] = String(chave).split('|')
  return { produtoId, cor, tamanho }
}

/**
 * Carrinho (mapa chave→qtd) → linhas prontas para desenhar e somar.
 * Item cujo produto sumiu do catálogo é descartado: não dá para mostrar preço
 * nem nome de algo que não existe mais, e mantê-lo quebraria o total.
 */
export function linhasDoCarrinho(carrinho, produtosPorId) {
  const linhas = []
  for (const [chave, qtd] of Object.entries(carrinho || {})) {
    if (!(qtd > 0)) continue
    const { produtoId, cor, tamanho } = partesDaChave(chave)
    const produto = produtosPorId?.[produtoId]
    if (!produto) continue
    linhas.push({
      chave,
      produtoId,
      cor,
      tamanho,
      qtd,
      nome: produto.nome,
      preco: produto.preco,
      foto: produto.fotos?.[0] || null,
      subtotal: produto.preco * qtd,
    })
  }
  return linhas
}

/** Soma de peças e de valor das linhas. */
export function totais(linhas) {
  return (linhas || []).reduce(
    (acc, l) => ({ pecas: acc.pecas + l.qtd, valor: acc.valor + l.subtotal }),
    { pecas: 0, valor: 0 },
  )
}

/** Quantidade total de um produto no carrinho (badge "N no pedido" do card). */
export function qtdPorProduto(carrinho) {
  const mapa = {}
  for (const [chave, qtd] of Object.entries(carrinho || {})) {
    if (!(qtd > 0)) continue
    const { produtoId } = partesDaChave(chave)
    mapa[produtoId] = (mapa[produtoId] || 0) + qtd
  }
  return mapa
}

/**
 * Aplica o rascunho do modal no carrinho (seção 5).
 * Rascunho é `{ "cor|tamanho": qtd }`; quantidades SOMAM ao que já existe.
 * Devolve o carrinho novo e quantas peças entraram.
 */
export function aplicarRascunho(carrinho, produtoId, rascunho) {
  const novo = { ...(carrinho || {}) }
  let adicionadas = 0
  for (const [par, qtd] of Object.entries(rascunho || {})) {
    if (!(qtd > 0)) continue
    const [cor = '', tamanho = ''] = String(par).split('|')
    const chave = chaveItem(produtoId, cor, tamanho)
    novo[chave] = (novo[chave] || 0) + qtd
    adicionadas += qtd
  }
  return { carrinho: novo, adicionadas }
}

/** Define a quantidade de uma chave; zero (ou menos) remove a linha. */
export function definirQtd(carrinho, chave, qtd) {
  const novo = { ...(carrinho || {}) }
  if (qtd > 0) novo[chave] = qtd
  else delete novo[chave]
  return novo
}

// ─────────────────────────────────────────────────────────────────────────────
// Pedido mínimo — seções 4.5 e 7
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado do pedido mínimo.
 *
 * A spec só descreve mínimo por valor; o banco já suporta 'quantidade' e o
 * catálogo atual usa — manter os dois para não tirar o que já funciona.
 *
 * @param {{tipo:'valor'|'quantidade', valor:number, qtd:number}|null} minimo
 */
export function estadoMinimo(minimo, { pecas, valor }) {
  if (!minimo || minimo.tipo === 'nenhum') return null

  const porValor = minimo.tipo === 'valor'
  const alvo = porValor ? Number(minimo.valor) || 0 : Number(minimo.qtd) || 0
  if (alvo <= 0) return null

  const atual = porValor ? valor : pecas
  const falta = Math.max(0, alvo - atual)
  const atingido = falta === 0

  let texto
  if (atingido)        texto = t('minimoAtingido')
  else if (atual === 0) texto = porValor ? t('minimoDe', { valor: fmtR(alvo) }) : t('minimoDeQtd', { qtd: alvo })
  else                  texto = porValor
    ? t('minimoFaltam', { valor: fmtR(falta), min: fmtR(alvo) })
    : t('minimoFaltamQtd', { qtd: falta, min: alvo })

  return {
    tipo: minimo.tipo,
    alvo,
    atual,
    falta,
    atingido,
    texto,
    // Barra de progresso: nunca passa de 100%.
    progresso: Math.min(100, (atual / alvo) * 100),
    aviso: atingido ? '' : (porValor
      ? t('avisoMinimo', { valor: fmtR(falta) })
      : t('avisoMinimoQtd', { qtd: falta })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Busca, filtro e ordenação — seções 4.6 e 9
// ─────────────────────────────────────────────────────────────────────────────

const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Categorias distintas dos produtos ativos, na ordem de cadastro. */
export function categoriasDe(produtos) {
  const vistas = new Set()
  const lista = [t('chipTudo')]
  for (const p of produtos || []) {
    if (!p.categoria || vistas.has(p.categoria)) continue
    vistas.add(p.categoria)
    lista.push(p.categoria)
  }
  return lista
}

/** Busca por nome OU categoria, sem acento e sem caixa; "Tudo" não filtra. */
export function filtrarProdutos(produtos, busca, categoria) {
  const q = semAcento(busca).trim().toLowerCase()
  const tudo = t('chipTudo')
  return (produtos || []).filter(p => {
    if (categoria && categoria !== tudo && p.categoria !== categoria) return false
    if (!q) return true
    return semAcento(p.nome).toLowerCase().includes(q)
        || semAcento(p.categoria).toLowerCase().includes(q)
  })
}

/** 'destaque' preserva a ordem de cadastro; as demais reordenam uma cópia. */
export function ordenarProdutos(produtos, ordem) {
  const lista = [...(produtos || [])]
  if (ordem === 'menor') return lista.sort((a, b) => a.preco - b.preco)
  if (ordem === 'maior') return lista.sort((a, b) => b.preco - a.preco)
  if (ordem === 'nome')  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  return lista
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp — seção 8.1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uma linha por variação:
 *   "Vestido — Coral / M — 3x R$ 44,90 = R$ 134,70"
 * Omite " / {tamanho}" quando não há tamanho e a cor quando o produto só tem
 * uma — repetir "Preto" numa peça que só existe em preto é ruído.
 */
export function linhaMensagem(linha, produto) {
  const partes = [linha.nome]

  const detalhes = []
  if (linha.cor && temCor(produto)) detalhes.push(linha.cor)
  if (linha.tamanho && linha.tamanho !== TAMANHO_UNICO) detalhes.push(linha.tamanho)
  if (detalhes.length) partes.push(detalhes.join(' / '))

  partes.push(`${linha.qtd}x ${fmtR(linha.preco)} = ${fmtR(linha.subtotal)}`)
  return partes.join(' — ')
}

/** Mensagem completa do pedido. */
export function mensagemWhatsApp({ nomeLoja, linhas, produtosPorId, url }) {
  const { pecas, valor } = totais(linhas)
  const corpo = (linhas || []).map(l => linhaMensagem(l, produtosPorId?.[l.produtoId])).join('\n')
  return [
    t('waSaudacao', { loja: nomeLoja }),
    '',
    corpo,
    '',
    t('waTotal', { pecas, valor: fmtR(valor) }),
    t('waOrigem', { url }),
  ].join('\n')
}

/**
 * Telefone em E.164 sem sinais. Número brasileiro de 10-11 dígitos ganha o
 * DDI 55 — a lojista cadastra "(85) 99999-0000" e não sabe o que é E.164.
 * Devolve '' quando não sobra número utilizável.
 */
export function telefoneE164(bruto) {
  const so = String(bruto ?? '').replace(/\D/g, '')
  if (!so) return ''
  if (so.length === 10 || so.length === 11) return `55${so}`
  return so
}

// ─────────────────────────────────────────────────────────────────────────────
// Identificação da cliente no checkout
//
// O catálogo V1 tinha nome e WhatsApp obrigatórios (CatalogoPublico.jsx:555,
// `disabled={... || !form.nome.trim() || !form.whatsapp.trim()}`). O V2 nasceu
// sem os campos e gravava `cliente_nome: ''` e `cliente_whatsapp: ''` fixos —
// pedido chegava no painel sem nenhum jeito de contatar quem pediu.
//
// A ideia original do V2 era que a cliente se identificasse ao mandar a
// mensagem no WhatsApp. Isso até funciona nesse caminho, mas quebra de vez nos
// dois caminhos de Pix: ela pode pagar e nunca mandar mensagem nenhuma, e aí
// o pedido fica pago e anônimo.
// ─────────────────────────────────────────────────────────────────────────────

/** Nome mínimo aceitável: 2 caracteres depois de aparar. */
export function nomeValido(nome) {
  return String(nome ?? '').trim().length >= 2
}

/**
 * Telefone brasileiro: 10 dígitos (fixo com DDD) ou 11 (celular com DDD).
 *
 * Aceita máscara — `(85) 99999-0000` e `85999990000` são o mesmo número. Não
 * tenta validar operadora nem nono dígito: recusar número real por regra
 * esperta demais custa a venda.
 */
export function whatsappValido(bruto) {
  const so = String(bruto ?? '').replace(/\D/g, '')
  return so.length === 10 || so.length === 11
}

/**
 * Valida os dados da cliente antes de registrar o pedido.
 *
 * Devolve `{ ok, erros: { nome, whatsapp } }` com a mensagem por campo, para a
 * tela marcar exatamente o que falta em vez de um alerta genérico.
 */
export function validarDadosCliente({ nome, whatsapp } = {}) {
  const erros = {}
  if (!nomeValido(nome))         erros.nome     = TEXTOS.erroNomeObrigatorio
  if (!whatsappValido(whatsapp)) erros.whatsapp = TEXTOS.erroWhatsappInvalido
  return { ok: Object.keys(erros).length === 0, erros }
}

/**
 * Normaliza para gravar em lf_pedidos: nome aparado, telefone só com dígitos.
 *
 * Guardar o telefone sem máscara é o que o resto do sistema já espera —
 * telefoneE164 e linkWhatsApp trabalham em cima de dígitos.
 */
export function dadosClienteParaPedido({ nome, whatsapp } = {}) {
  return {
    cliente_nome: String(nome ?? '').trim(),
    cliente_whatsapp: String(whatsapp ?? '').replace(/\D/g, ''),
  }
}

/** URL do wa.me com a mensagem já codificada; '' se não houver telefone. */
export function linkWhatsApp(telefone, mensagem) {
  const fone = telefoneE164(telefone)
  if (!fone) return ''
  const base = `https://wa.me/${fone}`
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistência — seção 8.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lê o carrinho salvo. Devolve {} para qualquer coisa estranha (expirado,
 * JSON quebrado, storage bloqueado no navegador): carrinho vazio é sempre
 * melhor do que a página do cliente não abrir.
 */
export function carregarCarrinho(storage, lojaId, agora = Date.now()) {
  try {
    const bruto = storage?.getItem(chaveCarrinho(lojaId))
    if (!bruto) return {}
    const dados = JSON.parse(bruto)
    if (!dados || typeof dados !== 'object') return {}
    // Number.isFinite e não `!dados.salvoEm`: timestamp 0 é válido e o teste
    // de TTL usa exatamente esse limite.
    if (!Number.isFinite(dados.salvoEm)) return {}
    if (agora - dados.salvoEm > TTL_CARRINHO_MS) return {}
    const itens = dados.itens
    if (!itens || typeof itens !== 'object') return {}
    // Só quantidades positivas e inteiras sobrevivem à leitura.
    const limpo = {}
    for (const [k, v] of Object.entries(itens)) {
      const n = Math.floor(Number(v))
      if (n > 0) limpo[k] = n
    }
    return limpo
  } catch {
    return {}
  }
}

/** Grava o carrinho. Carrinho vazio remove a chave em vez de gravar lixo. */
export function salvarCarrinho(storage, lojaId, carrinho, agora = Date.now()) {
  try {
    const chave = chaveCarrinho(lojaId)
    if (!carrinho || Object.keys(carrinho).length === 0) {
      storage?.removeItem(chave)
      return
    }
    storage?.setItem(chave, JSON.stringify({ salvoEm: agora, itens: carrinho }))
  } catch {
    // Storage cheio ou bloqueado (aba anônima do Safari): o pedido segue
    // funcionando em memória, só não sobrevive ao reload.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Config da loja — seção 2.1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linha de lf_config → loja no formato da seção 2.1.
 *
 * Tolerante à migração não ter rodado: cada campo novo cai no mesmo default
 * que o ALTER TABLE usaria, então o catálogo abre igual antes e depois de
 * migration_catalogo_novo.sql. É isso que permite testar o V2 em produção
 * sem nenhum ALTER TABLE aplicado.
 */
export function lojaDaConfig(config) {
  const video = config?.catalogo_video_topo || {}
  const apre = config?.catalogo_apresentacao || {}

  const minimoTipo = config?.pedido_minimo_tipo
  const pedidoMinimo = minimoTipo && minimoTipo !== 'nenhum'
    ? {
        tipo: minimoTipo,
        valor: Number(config.pedido_minimo_valor) || 0,
        qtd: Number(config.pedido_minimo_qtd) || 0,
      }
    : null

  return {
    nome: config?.nome || 'Catálogo',
    subtitulo: config?.catalogo_subtitulo || TEXTOS.subtituloPadrao,
    logoUrl: config?.logo_url || '',
    publico: config?.catalogo_publico || 'feminino',
    modoVenda: config?.catalogo_modo_venda || 'atacado',
    pedidoMinimo,
    // Guardado já em E.164: o resto do app não precisa saber que a lojista
    // digitou "(85) 99999-0000".
    whatsapp: telefoneE164(config?.whatsapp_loja),
    checkoutOnline: config?.catalogo_checkout_online === true,
    // `!== false`, e NÃO `=== true`: enquanto a coluna não existir no banco o
    // valor chega undefined, e o catálogo das lojas que já estão no ar não
    // pode cair por causa disso. Só um false explícito tira do ar.
    //
    // Atenção ao nome: `catalogo_publicado` é a chave de "loja aberta".
    // `catalogo_publico`, logo acima, é o SEGMENTO ('feminino') — coisa
    // completamente diferente, com nome quase igual.
    publicado: config?.catalogo_publicado !== false,
    // Chave Pix copia-e-cola. String vazia quando não cadastrada — o drawer
    // usa isso para decidir entre mostrar o bloco de Pix e manter o caminho
    // antigo, então nunca pode virar null.
    chavePix: (config?.chave_pix || '').trim(),
    // Só a FLAG, nunca o token: lf_config não tem RLS e é lida pelo catálogo
    // público com select('*'), então qualquer segredo aqui vaza para o
    // visitante. O access token do Mercado Pago mora em
    // lf_credenciais_pagamento, que só a service_role lê (ver
    // supabase/migration_mercadopago_pix.sql).
    mercadopagoAtivo: config?.mercadopago_ativo === true,
    textoEnvio: config?.catalogo_texto_envio || TEXTOS.envioPadrao,
    videoTopo: {
      ativo: video.ativo === true,
      videoUrl: video.videoUrl || '',
      imagemUrl: video.imagemUrl || '',
      etiqueta: video.etiqueta || TEXTOS.etiquetaVideoPadrao,
      titulo: video.titulo || '',
    },
    apresentacao: {
      etiqueta: apre.etiqueta || '',
      titulo: apre.titulo || '',
      descricao: apre.descricao || '',
    },
  }
}
