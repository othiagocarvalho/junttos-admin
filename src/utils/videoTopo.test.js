import { describe, it, expect } from 'vitest'
import {
  validarVideo, validarCapa, caminhoVideoTopo, extensaoDe, urlComVersao,
  videoTopoDaConfig, videoTopoParaConfig, temMidia,
  VIDEO_BUCKET, CAPA_BUCKET, VIDEO_TAMANHO_MAX,
} from './videoTopo'

const arq = (type, size = 1000, name = 'x') => ({ type, size, name })

describe('validação do vídeo', () => {
  it('aceita MP4 e WEBM', () => {
    expect(validarVideo(arq('video/mp4'))).toBeNull()
    expect(validarVideo(arq('video/webm'))).toBeNull()
  })

  it('recusa o que não é vídeo', () => {
    expect(validarVideo(arq('image/png'))).toMatch(/MP4 ou WEBM/)
    expect(validarVideo(arq('application/pdf'))).toMatch(/MP4 ou WEBM/)
  })

  it('recusa acima de 15 MB, e diz o tamanho que veio', () => {
    // A faixa é um laço de fundo; acima disso a cliente paga a espera no 4G
    // antes de ver a primeira peça.
    const r = validarVideo(arq('video/mp4', VIDEO_TAMANHO_MAX + 1))
    expect(r).toMatch(/muito grande/)
    expect(r).toMatch(/15 MB/)
  })

  it('exatamente no limite passa', () => {
    expect(validarVideo(arq('video/mp4', VIDEO_TAMANHO_MAX))).toBeNull()
  })

  it('sem arquivo não estoura', () => {
    expect(validarVideo(null)).toMatch(/Nenhum arquivo/)
  })
})

describe('validação da capa', () => {
  it('aceita JPG, PNG e WEBP', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validarCapa(arq(t))).toBeNull()
    }
  })
  it('recusa vídeo no campo de capa', () => {
    expect(validarCapa(arq('video/mp4'))).toMatch(/JPG, PNG ou WEBP/)
  })
  it('recusa acima de 2 MB', () => {
    expect(validarCapa(arq('image/png', 3 * 1024 * 1024))).toMatch(/muito grande/)
  })
})

describe('caminho no bucket', () => {
  it('a primeira pasta é o loja_id — é o que a policy exige', () => {
    // As policies de storage.objects autorizam por
    // (storage.foldername(name))[1] = app_metadata.loja_id.
    expect(caminhoVideoTopo('tropicaleatacado', arq('video/mp4')))
      .toBe('tropicaleatacado/catalogo-topo.mp4')
  })

  it('a capa tem sufixo próprio, para não sobrescrever o vídeo', () => {
    expect(caminhoVideoTopo('tropicaleatacado', arq('image/png'), 'capa'))
      .toBe('tropicaleatacado/catalogo-topo-capa.png')
  })

  it('path FIXO: reenviar substitui em vez de acumular', () => {
    const a = caminhoVideoTopo('x', arq('video/mp4'))
    const b = caminhoVideoTopo('x', arq('video/mp4'))
    expect(a).toBe(b)
  })

  it('sem loja_id falha ANTES da rede, com motivo legível', () => {
    // Sem isto o caminho viraria "undefined/..." e o Storage recusaria com uma
    // mensagem de RLS que não diz nada sobre a causa.
    expect(() => caminhoVideoTopo('', arq('video/mp4'))).toThrow(/Loja não identificada/)
    expect(() => caminhoVideoTopo(null, arq('video/mp4'))).toThrow()
  })

  it('a extensão vem do MIME, não do nome do arquivo', () => {
    // Nome sem ponto ou com ponto no fim produziria extensão lixo.
    expect(extensaoDe(arq('video/mp4', 1, 'IMG_4567'))).toBe('mp4')
    expect(extensaoDe(arq('image/webp', 1, 'foto.'))).toBe('webp')
  })

  it('buckets: vídeo e capa vão para lugares diferentes', () => {
    expect(VIDEO_BUCKET).toBe('produtos-videos')
    expect(CAPA_BUCKET).toBe('produtos-fotos')
  })
})

describe('urlComVersao', () => {
  it('acrescenta ?v= para o navegador não servir o arquivo velho', () => {
    // Com path fixo, o upsert devolve a MESMA URL — sem isto a lojista troca o
    // vídeo e não vê nada mudar.
    expect(urlComVersao('https://x/v.mp4', 123)).toBe('https://x/v.mp4?v=123')
  })
  it('usa & quando já existe query', () => {
    expect(urlComVersao('https://x/v.mp4?a=1', 123)).toBe('https://x/v.mp4?a=1&v=123')
  })
  it('url vazia passa intacta', () => {
    expect(urlComVersao('')).toBe('')
  })
})

describe('ida e volta com o jsonb', () => {
  it('config vazia vira formulário vazio, sem undefined', () => {
    expect(videoTopoDaConfig({})).toEqual({
      ativo: false, videoUrl: '', imagemUrl: '', etiqueta: '', titulo: '',
    })
    expect(videoTopoDaConfig(null).ativo).toBe(false)
  })

  it('lê os cinco campos da spec', () => {
    const v = videoTopoDaConfig({ catalogo_video_topo: {
      ativo: true, videoUrl: 'v.mp4', imagemUrl: 'c.jpg', etiqueta: 'Nova', titulo: 'Verão',
    } })
    expect(v).toEqual({ ativo: true, videoUrl: 'v.mp4', imagemUrl: 'c.jpg', etiqueta: 'Nova', titulo: 'Verão' })
  })

  it('ativo só é gravado true quando HÁ mídia', () => {
    // Ligado e vazio, a faixa vira uma tarja preta de até 340px no topo do
    // catálogo — pior do que não ter faixa.
    expect(videoTopoParaConfig({ ativo: true }).ativo).toBe(false)
    expect(videoTopoParaConfig({ ativo: true, videoUrl: 'v.mp4' }).ativo).toBe(true)
    expect(videoTopoParaConfig({ ativo: true, imagemUrl: 'c.jpg' }).ativo).toBe(true)
  })

  it('só imagem, sem vídeo, é combinação válida — a spec prevê', () => {
    // Sem vídeo a spec manda animar a imagem devagar (kenburns).
    expect(videoTopoParaConfig({ ativo: true, imagemUrl: 'c.jpg' }))
      .toEqual({ ativo: true, videoUrl: '', imagemUrl: 'c.jpg', etiqueta: '', titulo: '' })
  })

  it('desmarcado não liga, mesmo com mídia', () => {
    expect(videoTopoParaConfig({ ativo: false, videoUrl: 'v.mp4' }).ativo).toBe(false)
  })

  it('apara espaços dos textos e das urls', () => {
    const r = videoTopoParaConfig({ ativo: true, videoUrl: '  v.mp4 ', etiqueta: ' Nova ', titulo: ' Verão ' })
    expect(r.videoUrl).toBe('v.mp4')
    expect(r.etiqueta).toBe('Nova')
    expect(r.titulo).toBe('Verão')
  })

  it('url só com espaço não conta como mídia', () => {
    expect(videoTopoParaConfig({ ativo: true, videoUrl: '   ' }).ativo).toBe(false)
    expect(temMidia({ videoUrl: '   ' })).toBe(false)
  })

  it('ida e volta preserva o que foi gravado', () => {
    const form = { ativo: true, videoUrl: 'v.mp4', imagemUrl: 'c.jpg', etiqueta: 'Nova', titulo: 'Verão' }
    expect(videoTopoDaConfig({ catalogo_video_topo: videoTopoParaConfig(form) })).toEqual(form)
  })
})
