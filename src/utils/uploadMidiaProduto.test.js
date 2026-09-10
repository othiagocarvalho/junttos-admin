import { describe, it, expect, vi, beforeEach } from 'vitest'

// renovarSessao é single-flight de verdade contra o Supabase — aqui vira um
// mock para os testes não tocarem rede nem no estado do WeakMap.
vi.mock('../lib/authRefresh', () => ({ renovarSessao: vi.fn() }))
import { renovarSessao } from '../lib/authRefresh'

import {
  BUCKET_FOTOS,
  BUCKET_VIDEOS,
  extensaoDe,
  caminhoMidia,
  erroDeUpload,
  garantirSessao,
  uploadMidiaProduto,
  uploadFotoProduto,
} from './uploadMidiaProduto.js'

// Client falso: nada de rede. Registra cada upload e devolve os resultados na
// ordem passada (para simular erro-e-retry).
function fakeClient({ session = { access_token: 'tok' }, resultados = [{ error: null }], publicUrl = 'https://cdn/x.jpg' } = {}) {
  let i = 0
  const uploads = []
  return {
    uploads,
    auth: { getSession: async () => ({ data: { session } }) },
    storage: {
      from(bucket) {
        return {
          async upload(path, file, opts) {
            uploads.push({ bucket, path, file, opts })
            return resultados[i++] ?? { error: null }
          },
          getPublicUrl(path) {
            return { data: { publicUrl: `${publicUrl}?p=${path}` } }
          },
        }
      },
    },
  }
}

beforeEach(() => {
  renovarSessao.mockReset()
})

describe('constantes de bucket', () => {
  it('são exatamente os buckets do projeto', () => {
    expect(BUCKET_FOTOS).toBe('produtos-fotos')
    expect(BUCKET_VIDEOS).toBe('produtos-videos')
  })
})

describe('extensaoDe', () => {
  it('usa a extensão do nome, minúscula', () => {
    expect(extensaoDe({ name: 'Foto.PNG', type: 'image/png' })).toBe('png')
  })
  it('cai no MIME quando o nome não tem ponto', () => {
    expect(extensaoDe({ name: 'IMG_4567', type: 'image/jpeg' })).toBe('jpg')
  })
  it('nunca devolve vazio', () => {
    expect(extensaoDe({ name: '', type: '' })).toBe('bin')
  })
})

describe('caminhoMidia', () => {
  const jpg = { name: 'foto.jpg', type: 'image/jpeg' }
  it('põe o loja_id como primeira pasta', () => {
    expect(caminhoMidia('hmboutique', 'prod_1', jpg, 42)).toBe('hmboutique/prod_1_42.jpg')
  })
  it('falha claro em vez de montar "undefined/..."', () => {
    for (const vazio of [undefined, null, '']) {
      expect(() => caminhoMidia(vazio, 'p', jpg)).toThrow(/Loja não identificada/)
    }
  })
})

describe('erroDeUpload', () => {
  it('401 fala de sessão, não de policy', () => {
    const r = erroDeUpload({ message: 'Invalid JWT', status: 401 }, BUCKET_FOTOS, 'l')
    expect(r).toMatch(/sess(ã|a)o/i)
    expect(r).not.toMatch(/policy/i)
  })
  it('RLS cita as duas causas', () => {
    const r = erroDeUpload({ message: 'new row violates row-level security policy' }, BUCKET_FOTOS, 'hmboutique')
    expect(r).toContain('produtos-fotos/hmboutique/')
    expect(r).toMatch(/INSERT/)
  })
})

describe('garantirSessao', () => {
  it('devolve a sessão quando já existe, sem renovar', async () => {
    const client = fakeClient({ session: { access_token: 'abc' } })
    await expect(garantirSessao(client)).resolves.toEqual({ access_token: 'abc' })
    expect(renovarSessao).not.toHaveBeenCalled()
  })
  it('renova quando não há sessão', async () => {
    renovarSessao.mockResolvedValue({ data: { session: { access_token: 'novo' } }, error: null })
    const client = fakeClient({ session: null })
    await expect(garantirSessao(client)).resolves.toEqual({ access_token: 'novo' })
    expect(renovarSessao).toHaveBeenCalledWith(client)
  })
  it('lança quando a renovação falha', async () => {
    renovarSessao.mockResolvedValue({ data: null, error: new Error('x') })
    await expect(garantirSessao(fakeClient({ session: null }))).rejects.toThrow(/sess(ã|a)o expirou/i)
  })
})

describe('uploadMidiaProduto', () => {
  const jpg = { name: 'p.jpg', type: 'image/jpeg' }

  it('sobe no bucket certo, no path {loja}/{prefix}_*, e devolve a publicUrl', async () => {
    const client = fakeClient()
    const url = await uploadMidiaProduto(client, 'hmboutique', BUCKET_FOTOS, jpg, 'prod_9')
    expect(client.uploads).toHaveLength(1)
    expect(client.uploads[0].bucket).toBe('produtos-fotos')
    expect(client.uploads[0].path).toMatch(/^hmboutique\/prod_9_\d+\.jpg$/)
    expect(client.uploads[0].opts).toMatchObject({ upsert: true, contentType: 'image/jpeg' })
    expect(url).toContain('https://cdn/x.jpg')
  })

  it('usa o client recebido — nunca um global', async () => {
    const client = fakeClient()
    await uploadFotoProduto(client, 'loja', jpg, 'p')
    expect(client.uploads).toHaveLength(1)
  })

  it('traduz o erro de RLS antes de lançar', async () => {
    const client = fakeClient({ resultados: [{ error: { message: 'new row violates row-level security policy' } }] })
    await expect(uploadMidiaProduto(client, 'hmboutique', BUCKET_FOTOS, jpg, 'p'))
      .rejects.toThrow(/produtos-fotos\/hmboutique\//)
  })

  it('no 401, renova e tenta mais uma vez', async () => {
    renovarSessao.mockResolvedValue({ error: null })
    const client = fakeClient({ resultados: [{ error: { status: 401 } }, { error: null }] })
    await uploadMidiaProduto(client, 'loja', BUCKET_FOTOS, jpg, 'p')
    expect(client.uploads).toHaveLength(2)
    expect(renovarSessao).toHaveBeenCalledTimes(1)
  })

  it('lança claro quando a loja não foi identificada', async () => {
    await expect(uploadMidiaProduto(fakeClient(), '', BUCKET_FOTOS, jpg, 'p'))
      .rejects.toThrow(/Loja não identificada/)
  })
})
