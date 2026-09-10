// Upload de foto/vídeo de produto para o Supabase Storage.
//
// Vivia inteiro dentro de ProdutosB2BPro.jsx (garantirSessao + uploadMidia +
// os helpers de path/erro). O cadastro rápido do Estoque (EstoqueMobile.jsx)
// passou a precisar do MESMO mecanismo — mesmo bucket, mesmo formato de path,
// mesma tradução de erro de RLS — então a parte não-visual saiu para cá.
//
// O client do Supabase entra por PARÂMETRO, como em uploadLogo.js e
// videoTopo.js: é a convenção do projeto para os utils de Storage. Hoje os dois
// chamadores passam o mesmo `supabase`, mas manter o padrão deixa a função
// testável sem rede e pronta para qualquer tela que rode em outro client.

import { renovarSessao } from '../lib/authRefresh'

// Os nomes dos buckets ficam em constante exportada, e não como literal solto
// dentro da função de upload, para o teste conseguir afirmar sem rede que o
// bucket usado é exatamente o que existe no projeto. Mesmo motivo do
// LOGO_BUCKET em src/utils/uploadLogo.js.
export const BUCKET_FOTOS  = 'produtos-fotos'
export const BUCKET_VIDEOS = 'produtos-videos'

// Extensão por MIME, usada quando o nome do arquivo não traz uma aproveitável.
const EXT_POR_MIME = {
  'image/jpeg': 'jpg',  'image/jpg': 'jpg',   'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif',   'image/heic': 'heic',
  'image/heif': 'heif', 'image/avif': 'avif',
  'video/mp4': 'mp4',   'video/quicktime': 'mov', 'video/webm': 'webm',
}

/**
 * Extensão do arquivo, com o MIME como fonte de reserva.
 *
 * `file.name.split('.').pop()` devolve o NOME INTEIRO quando não existe ponto
 * (uma foto chamada "IMG_4567" viraria a "extensão" img_4567) e string vazia
 * quando o nome termina em ponto — os dois casos entram no path e produzem um
 * objeto de nome estranho no bucket. O MIME já foi validado antes (as seções
 * de upload só aceitam image/*), então serve bem de fallback.
 */
export function extensaoDe(file) {
  const partes = String(file?.name ?? '').split('.')
  const doNome = partes.length > 1 ? partes.pop().toLowerCase() : ''
  if (/^[a-z0-9]{2,5}$/.test(doNome)) return doNome
  return EXT_POR_MIME[String(file?.type ?? '').toLowerCase()] || 'bin'
}

/**
 * Caminho no bucket: {loja_id}/{prefixo}_{timestamp}.{ext}.
 *
 * A PRIMEIRA PASTA PRECISA SER O loja_id. As policies de storage.objects deste
 * projeto autorizam por
 *   (storage.foldername(name))[1] = auth.jwt() -> 'app_metadata' ->> 'loja_id'
 * (mesmo desenho documentado em supabase/migration_fiscal.sql). Com lojaId
 * vazio o caminho viraria "undefined/..." e o Postgres recusaria o INSERT com
 * "new row violates row-level security policy" — mensagem que não diz nada
 * sobre a causa real. Falhar aqui, antes da rede, deixa o motivo explícito.
 */
export function caminhoMidia(lojaId, prefix, file, agora = Date.now()) {
  if (!lojaId) throw new Error('Loja não identificada. Recarregue a página e tente de novo.')
  return `${lojaId}/${prefix}_${agora}.${extensaoDe(file)}`
}

/**
 * Traduz o erro do Storage para algo acionável.
 *
 * ─── POR QUE A MENSAGEM ANTIGA ATRAPALHOU ───────────────────────────────────
 * Ela afirmava "confira se o bucket tem policy de INSERT", como se a causa
 * fosse certa. Mas "new row violates row-level security policy" é a MESMA
 * resposta em dois cenários diferentes, e a versão anterior não tinha como
 * distinguir:
 *
 *   • sem sessão válida — o supabase-js manda a anon key no lugar do token;
 *   • policy faltando ou errada no bucket.
 *
 * Medido contra o projeto em 23/08/2026: um upload com a anon key devolve
 * HTTP 400 com o corpo
 *   {"statusCode":"403","error":"Unauthorized",
 *    "message":"new row violates row-level security policy"}
 * — ou seja, o 400 do relato NÃO é um erro separado, é a própria recusa de
 * RLS. O 401, esse sim, é outra coisa: é JWT inválido ou expirado.
 *
 * Agora a mensagem usa o STATUS para separar os casos, e quando não dá para
 * ter certeza ela diz as duas possibilidades em vez de apontar uma. Mensagem
 * que afirma a causa errada custou duas investigações neste projeto.
 */
export function erroDeUpload(error, bucket, lojaId) {
  const msg = String(error?.message ?? error ?? '')
  const status = Number(error?.status) || Number(error?.statusCode) || 0

  // 401 = o servidor recusou o token. Não adianta falar de policy.
  if (status === 401 || /jwt|invalid token|token expired/i.test(msg)) {
    return 'sua sessão expirou ou não foi aceita pelo servidor. '
      + 'Saia, entre de novo e repita o envio.'
  }

  if (/row-level security/i.test(msg)) {
    return `permissão negada pelo Storage ao gravar em ${bucket}/${lojaId}/. `
      + 'São duas causas possíveis, e o Storage responde igual nas duas: '
      + 'sessão não aceita (saia e entre de novo) ou o bucket sem policy de '
      + 'INSERT para "authenticated" nessa pasta '
      + '(ver supabase/migration_storage_produtos_midia.sql).'
  }

  // Status no fim de tudo: sem ele, quem investiga não sabe se olhou 400, 401
  // ou 404 — foi exatamente o que faltou no relato original.
  return status ? `${msg} (HTTP ${status})` : msg
}

/**
 * Garante uma sessão viva antes de tocar no Storage.
 *
 * Sem sessão viva o supabase-js NÃO falha: ele manda a anon key no lugar do
 * token (SupabaseClient._getAccessToken → `session?.access_token ?? supabaseKey`).
 * Como as tabelas lf_* estão sem RLS, uma sessão expirada passa despercebida no
 * painel inteiro e só aparece no Storage, como 403 "new row violates row-level
 * security policy" — texto idêntico ao de policy faltando. Conferir (e tentar
 * renovar) antes de subir separa um caso do outro.
 */
export async function garantirSessao(client) {
  const { data: { session } } = await client.auth.getSession()
  if (session?.access_token) return session
  // Single-flight: subir foto logo depois de voltar para a aba não pode
  // disparar um segundo refresh em cima do que já está em voo.
  const { data, error } = await renovarSessao(client)
  if (error || !data?.session) {
    throw new Error('sua sessão expirou. Entre de novo para enviar arquivos.')
  }
  return data.session
}

/**
 * Sobe um arquivo e devolve a URL pública.
 *
 * @param {object} client  — client do Supabase (auth + storage)
 * @param {string} lojaId  — vira a PRIMEIRA pasta do path (a policy confere isso)
 * @param {string} bucket  — BUCKET_FOTOS ou BUCKET_VIDEOS
 * @param {File}   file
 * @param {string} prefix  — prefixo do nome do arquivo (ex: 'prod_1699...')
 * @returns {Promise<string>} publicUrl
 */
export async function uploadMidiaProduto(client, lojaId, bucket, file, prefix) {
  await garantirSessao(client)
  const path = caminhoMidia(lojaId, prefix, file)

  let { error } = await client.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type })

  // 401 = o servidor recusou o token. Pode ser corrida: o token venceu ENTRE o
  // garantirSessao e a chegada da requisição — foto grande sobe devagar, e a
  // janela é real. Renova à força e tenta UMA vez.
  //
  // Uma vez só, de propósito: se o segundo 401 vier, o problema não é corrida,
  // e insistir só empurraria o erro para mais longe de quem precisa lê-lo.
  if (error && (Number(error.status) === 401 || Number(error.statusCode) === 401)) {
    const { error: erroRenov } = await renovarSessao(client)
    if (!erroRenov) {
      ({ error } = await client.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type }))
    }
  }

  if (error) throw new Error(erroDeUpload(error, bucket, lojaId))
  const { data: { publicUrl } } = client.storage.from(bucket).getPublicUrl(path)
  return publicUrl
}

/** Atalho para foto (bucket produtos-fotos). */
export async function uploadFotoProduto(client, lojaId, file, prefix) {
  return uploadMidiaProduto(client, lojaId, BUCKET_FOTOS, file, prefix)
}

/** Atalho para vídeo (bucket produtos-videos). */
export async function uploadVideoProduto(client, lojaId, file, prefix) {
  return uploadMidiaProduto(client, lojaId, BUCKET_VIDEOS, file, prefix)
}
