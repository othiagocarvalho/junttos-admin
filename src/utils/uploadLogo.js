// Upload do logo da loja para o bucket "Logo" do Storage.
//
// A função vivia duplicada, byte a byte, em admin/CadastroCliente.jsx e em
// consultor/ConsultorNovaLoja.jsx. A tela de Configurações da própria loja
// seria a terceira cópia — daí a extração.
//
// O client do Supabase entra por PARÂMETRO, e não por import aqui dentro,
// porque as telas não usam o mesmo: o consultor roda em `supabaseConsultor`,
// que tem storageKey próprio ('sb-consultor-auth') e portanto sessão de auth
// separada da do admin. Importar `supabase` direto aqui trocaria, em silêncio,
// a identidade de quem faz o upload no fluxo do consultor.

export const LOGO_BUCKET = 'Logo'

/** MIME aceitos. É o filtro que de fato decide se o arquivo é imagem. */
export const LOGO_TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']

/** Extensões aceitas. Guardam o path — ver caminhoLogo. */
export const LOGO_EXTENSOES = ['jpg', 'jpeg', 'png', 'webp']

/** 2 MB. Logo é elemento de header; acima disso é imagem crua, não logo. */
export const LOGO_TAMANHO_MAX = 2 * 1024 * 1024

/** Para o accept do <input type="file">. */
export const LOGO_ACCEPT = LOGO_TIPOS_ACEITOS.join(',')

function extensaoDe(file) {
  return String(file?.name ?? '').split('.').pop().toLowerCase()
}

/**
 * Caminho no bucket: {slug}/logo.{ext}.
 *
 * Path fixo por loja (e upsert:true no upload) é intencional: trocar o logo
 * substitui o arquivo em vez de acumular um por envio. loja_id e slug são o
 * mesmo valor em lf_config, então a pasta bate com a loja nos dois fluxos.
 */
export function caminhoLogo(slug, file) {
  return `${slug}/logo.${extensaoDe(file)}`
}

/**
 * Valida antes de subir. Devolve a mensagem de erro, ou null se estiver ok.
 *
 * É export separado, e não parte do uploadLogo, de propósito: o admin e o
 * consultor nunca validaram nada, e esta extração não é o momento de mudar o
 * comportamento de um fluxo de cadastro que já roda em produção. Quem quiser
 * validar chama antes — hoje só a tela de Configurações da loja chama.
 */
export function validarArquivoLogo(file) {
  if (!file) return 'Nenhum arquivo selecionado.'

  if (!LOGO_TIPOS_ACEITOS.includes(file.type)) {
    return 'Formato não aceito. Envie uma imagem JPG, PNG ou WEBP.'
  }
  // O MIME já garantiu que é imagem; a extensão é conferida porque ela é que
  // monta o caminho no bucket. Arquivo sem extensão viraria "logo.undefined".
  if (!LOGO_EXTENSOES.includes(extensaoDe(file))) {
    return 'Arquivo sem extensão reconhecida. Use .jpg, .png ou .webp.'
  }
  if (file.size > LOGO_TAMANHO_MAX) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace('.', ',')
    return `Imagem muito grande (${mb} MB). O tamanho máximo é 2 MB.`
  }
  return null
}

/**
 * Sobe o arquivo e devolve a URL pública. Lança em caso de erro — os dois
 * chamadores originais já tratavam assim, dentro do try do formulário.
 */
export async function uploadLogo(client, slug, file) {
  const path = caminhoLogo(slug, file)
  const { error } = await client.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(`Upload: ${error.message}`)
  const { data: { publicUrl } } = client.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return publicUrl
}

/**
 * Acrescenta ?v= à URL pública.
 *
 * Necessário só para quem TROCA o logo: como o path é fixo, o upsert devolve
 * exatamente a mesma URL de antes, e o navegador (e o CDN) continuam servindo
 * a imagem velha — o lojista trocaria o logo e não veria nada mudar. No
 * cadastro de loja nova não existe cache anterior, por isso o admin e o
 * consultor seguem gravando a URL limpa.
 */
export function urlComVersao(url, versao = Date.now()) {
  if (!url) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${versao}`
}
