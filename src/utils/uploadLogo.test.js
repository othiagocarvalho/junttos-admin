import { describe, it, expect, vi } from 'vitest'
import {
  caminhoLogo, validarArquivoLogo, uploadLogo, urlComVersao,
  LOGO_BUCKET, LOGO_TAMANHO_MAX,
} from './uploadLogo'

/** Dublê de File: só name/type/size interessam aqui. */
const arquivo = (name, type, size = 1024) => ({ name, type, size })

const PNG_OK = arquivo('minha-logo.png', 'image/png')

describe('caminhoLogo', () => {
  it('usa {slug}/logo.{ext} — o mesmo path do cadastro no admin', () => {
    expect(caminhoLogo('hmboutique', PNG_OK)).toBe('hmboutique/logo.png')
  })

  it('normaliza a extensão para minúscula', () => {
    expect(caminhoLogo('estrada', arquivo('LOGO.PNG', 'image/png'))).toBe('estrada/logo.png')
  })

  it('nome com vários pontos usa só a última extensão', () => {
    expect(caminhoLogo('estrada', arquivo('logo.v2.final.webp', 'image/webp')))
      .toBe('estrada/logo.webp')
  })
})

describe('validarArquivoLogo', () => {
  it('aceita png, jpg e webp', () => {
    expect(validarArquivoLogo(PNG_OK)).toBeNull()
    expect(validarArquivoLogo(arquivo('a.jpg', 'image/jpeg'))).toBeNull()
    expect(validarArquivoLogo(arquivo('a.webp', 'image/webp'))).toBeNull()
  })

  it('recusa PDF com mensagem clara', () => {
    expect(validarArquivoLogo(arquivo('contrato.pdf', 'application/pdf')))
      .toMatch(/JPG, PNG ou WEBP/)
  })

  it('recusa SVG — não está na lista de aceitos', () => {
    expect(validarArquivoLogo(arquivo('logo.svg', 'image/svg+xml'))).toBeTruthy()
  })

  it('recusa imagem válida sem extensão: ela é que monta o path', () => {
    expect(validarArquivoLogo(arquivo('logo', 'image/png'))).toMatch(/extensão/)
  })

  it('recusa acima de 2 MB, informando o tamanho', () => {
    const msg = validarArquivoLogo(arquivo('grande.png', 'image/png', 3 * 1024 * 1024))
    expect(msg).toMatch(/3,0 MB/)
    expect(msg).toMatch(/máximo é 2 MB/)
  })

  it('aceita exatamente no limite', () => {
    expect(validarArquivoLogo(arquivo('limite.png', 'image/png', LOGO_TAMANHO_MAX))).toBeNull()
  })

  it('sem arquivo não estoura', () => {
    expect(validarArquivoLogo(null)).toBeTruthy()
  })
})

describe('uploadLogo', () => {
  const clientFake = (uploadResult = { error: null }) => {
    const upload = vi.fn().mockResolvedValue(uploadResult)
    const getPublicUrl = vi.fn(p => ({ data: { publicUrl: `https://cdn.test/${p}` } }))
    const from = vi.fn(() => ({ upload, getPublicUrl }))
    return { client: { storage: { from } }, from, upload, getPublicUrl }
  }

  it('sobe no bucket Logo com upsert e devolve a URL pública', async () => {
    const { client, from, upload } = clientFake()
    const url = await uploadLogo(client, 'hmboutique', PNG_OK)

    expect(from).toHaveBeenCalledWith(LOGO_BUCKET)
    expect(upload).toHaveBeenCalledWith(
      'hmboutique/logo.png', PNG_OK,
      { upsert: true, contentType: 'image/png' },
    )
    expect(url).toBe('https://cdn.test/hmboutique/logo.png')
  })

  it('usa o client recebido — o consultor tem sessão própria', async () => {
    const a = clientFake()
    const b = clientFake()
    await uploadLogo(b.client, 'estrada', PNG_OK)
    expect(b.upload).toHaveBeenCalled()
    expect(a.upload).not.toHaveBeenCalled()
  })

  it('lança quando o Storage recusa (ex: policy bloqueando)', async () => {
    const { client } = clientFake({ error: { message: 'new row violates row-level security policy' } })
    await expect(uploadLogo(client, 'estrada', PNG_OK)).rejects.toThrow(/row-level security/)
  })
})

describe('urlComVersao', () => {
  it('acrescenta ?v= para furar o cache do path fixo', () => {
    expect(urlComVersao('https://cdn.test/e/logo.png', 123)).toBe('https://cdn.test/e/logo.png?v=123')
  })

  it('usa & quando a URL já tem query', () => {
    expect(urlComVersao('https://cdn.test/e/logo.png?x=1', 9)).toBe('https://cdn.test/e/logo.png?x=1&v=9')
  })

  it('URL vazia passa direto', () => {
    expect(urlComVersao(null)).toBeNull()
    expect(urlComVersao('')).toBe('')
  })
})
