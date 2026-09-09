// Vídeo de topo do catálogo — a faixa acima do cabeçalho (docs/CATALOGO_SPEC.md
// seção 4.1).
//
// A feature existia no catálogo público desde o início, mas SEM tela: o único
// jeito de ligar era escrever o jsonb `catalogo_video_topo` direto no banco.
// Este arquivo é a parte pura (validação, caminho, forma do jsonb) para que a
// tela nova não precise inventar nada — e para que dê para testar sem DOM.
//
// O client do Supabase entra por PARÂMETRO, como em uploadLogo.js: a tela do
// consultor roda em outro client, com sessão separada, e importar `supabase`
// aqui dentro trocaria em silêncio a identidade de quem faz o upload.

/** Mesmo bucket do vídeo de produto — já existe e já é público para leitura. */
export const VIDEO_BUCKET = 'produtos-videos'
/** A capa é imagem: vai no bucket de fotos, não no de vídeos. */
export const CAPA_BUCKET = 'produtos-fotos'

export const VIDEO_TIPOS = ['video/mp4', 'video/webm']
export const CAPA_TIPOS  = ['image/jpeg', 'image/png', 'image/webp']

/**
 * 15 MB.
 *
 * A faixa é um laço de fundo de 210 a 340px de altura, não um filme: acima
 * disso a cliente paga a espera no celular, no 4G, antes de ver a primeira
 * peça. O limite é do app, não do bucket — serve para a lojista descobrir o
 * problema no painel e não no catálogo dela.
 */
export const VIDEO_TAMANHO_MAX = 15 * 1024 * 1024
export const CAPA_TAMANHO_MAX  = 2 * 1024 * 1024

export const VIDEO_ACCEPT = VIDEO_TIPOS.join(',')
export const CAPA_ACCEPT  = CAPA_TIPOS.join(',')

const EXT_POR_MIME = {
  'video/mp4': 'mp4', 'video/webm': 'webm',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
}

/** Extensão pelo MIME, que é o que a validação já garantiu. */
export function extensaoDe(file) {
  return EXT_POR_MIME[String(file?.type ?? '').toLowerCase()] || 'bin'
}

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',')
}

/** Erro bloqueante do vídeo, ou null. */
export function validarVideo(file) {
  if (!file) return 'Nenhum arquivo selecionado.'
  if (!VIDEO_TIPOS.includes(file.type)) return 'Formato não aceito. Envie um vídeo MP4 ou WEBM.'
  if (file.size > VIDEO_TAMANHO_MAX) {
    return `Vídeo muito grande (${mb(file.size)} MB). O máximo é 15 MB — `
      + 'a faixa é um laço curto de fundo, não um filme.'
  }
  return null
}

/** Erro bloqueante da capa, ou null. */
export function validarCapa(file) {
  if (!file) return 'Nenhum arquivo selecionado.'
  if (!CAPA_TIPOS.includes(file.type)) return 'Formato não aceito. Envie JPG, PNG ou WEBP.'
  if (file.size > CAPA_TAMANHO_MAX) {
    return `Imagem muito grande (${mb(file.size)} MB). O máximo é 2 MB.`
  }
  return null
}

/**
 * Caminho no bucket: {loja_id}/catalogo-topo[-capa].{ext}.
 *
 * A PRIMEIRA PASTA PRECISA SER O loja_id: as policies de storage.objects deste
 * projeto autorizam por
 *   (storage.foldername(name))[1] = auth.jwt() -> 'app_metadata' ->> 'loja_id'
 * (ver supabase/migration_storage_produtos_midia.sql). Com lojaId vazio o
 * caminho viraria "undefined/..." e o Storage recusaria com uma mensagem de
 * RLS que não diz nada sobre a causa. Falhar aqui deixa o motivo explícito.
 *
 * Path FIXO por loja, com upsert: trocar o vídeo substitui o arquivo em vez de
 * acumular um por envio. O preço disso é a URL não mudar — por isso
 * urlComVersao, abaixo.
 */
export function caminhoVideoTopo(lojaId, file, tipo = 'video') {
  if (!lojaId) throw new Error('Loja não identificada. Recarregue a página e tente de novo.')
  const sufixo = tipo === 'capa' ? '-capa' : ''
  return `${lojaId}/catalogo-topo${sufixo}.${extensaoDe(file)}`
}

/**
 * Acrescenta ?v= à URL pública.
 *
 * Com path fixo, o upsert devolve exatamente a mesma URL de antes e o
 * navegador continua servindo o arquivo velho — a lojista trocaria o vídeo e
 * não veria nada mudar. Mesmo motivo de urlComVersao em uploadLogo.js.
 */
export function urlComVersao(url, versao = Date.now()) {
  if (!url) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${versao}`
}

/** Sobe o arquivo e devolve a URL pública já versionada. */
export async function uploadVideoTopo(client, lojaId, file, tipo = 'video') {
  const bucket = tipo === 'capa' ? CAPA_BUCKET : VIDEO_BUCKET
  const path = caminhoVideoTopo(lojaId, file, tipo)
  const { error } = await client.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data: { publicUrl } } = client.storage.from(bucket).getPublicUrl(path)
  return urlComVersao(publicUrl)
}

/** Forma padrão do jsonb, com os campos que a spec define (seção 2.1). */
export const VIDEO_TOPO_VAZIO = {
  ativo: false, videoUrl: '', imagemUrl: '', etiqueta: '', titulo: '',
}

/**
 * Linha do banco -> estado do formulário.
 *
 * Espelha o que lojaDaConfig já faz para o catálogo público, para os dois
 * lados lerem o mesmo jsonb do mesmo jeito.
 */
export function videoTopoDaConfig(config) {
  const v = config?.catalogo_video_topo || {}
  return {
    ativo: v.ativo === true,
    videoUrl: v.videoUrl || '',
    imagemUrl: v.imagemUrl || '',
    etiqueta: v.etiqueta || '',
    titulo: v.titulo || '',
  }
}

/**
 * Estado do formulário -> jsonb para gravar.
 *
 * `ativo` só vai como true se houver mídia: ligado sem vídeo nem capa, a faixa
 * renderiza uma tarja preta vazia de até 340px no topo do catálogo — pior do
 * que não ter faixa. A tela avisa disso antes, mas a regra fica aqui para
 * valer venha de onde vier.
 */
export function videoTopoParaConfig(estado) {
  const videoUrl = (estado?.videoUrl || '').trim()
  const imagemUrl = (estado?.imagemUrl || '').trim()
  return {
    ativo: estado?.ativo === true && !!(videoUrl || imagemUrl),
    videoUrl,
    imagemUrl,
    etiqueta: (estado?.etiqueta || '').trim(),
    titulo: (estado?.titulo || '').trim(),
  }
}

/** Tem mídia suficiente para a faixa aparecer? */
export function temMidia(estado) {
  return !!((estado?.videoUrl || '').trim() || (estado?.imagemUrl || '').trim())
}
