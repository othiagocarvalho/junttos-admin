import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  BUCKET_FOTOS,
  BUCKET_VIDEOS,
  caminhoMidia,
  extensaoDe,
  erroDeUpload,
} from './ProdutosB2BPro.jsx'

// Estes testes existem por causa de um 403 real no painel da TropicaleAtacado:
// "new row violates row-level security policy" ao subir foto pelo "Adicionar
// mais fotos". O Storage devolve exatamente essa mensagem tanto quando falta
// policy quanto quando o caminho não bate com a pasta autorizada, então o
// nome do bucket e o formato do path precisam ser verificáveis sem subir nada.

const FONTE = readFileSync(new URL('./ProdutosB2BPro.jsx', import.meta.url), 'utf8')

describe('bucket do Storage', () => {
  it('usa exatamente "produtos-fotos" — caractere a caractere', () => {
    expect(BUCKET_FOTOS).toBe('produtos-fotos')
    // Blinda contra as trocas silenciosas mais prováveis (underscore, plural,
    // maiúscula), que o Supabase rejeitaria só em runtime.
    expect(BUCKET_FOTOS).not.toBe('produtos_fotos')
    expect(BUCKET_FOTOS).toBe(BUCKET_FOTOS.toLowerCase())
  })

  it('usa exatamente "produtos-videos" para vídeo', () => {
    expect(BUCKET_VIDEOS).toBe('produtos-videos')
  })

  it('não deixou nenhum nome de bucket solto como literal no arquivo', () => {
    // Todo storage.from() precisa receber a constante — um literal reintroduzido
    // escaparia da checagem acima.
    const literais = FONTE.match(/storage\s*\n?\s*\.from\(\s*['"`]/g) || []
    expect(literais).toEqual([])
  })
})

describe('caminhoMidia', () => {
  const jpg = { name: 'foto.JPG', type: 'image/jpeg' }

  it('põe o loja_id como PRIMEIRA pasta — é o que a policy do bucket confere', () => {
    // A policy autoriza por
    // (storage.foldername(name))[1] = auth.jwt()->'app_metadata'->>'loja_id'
    const path = caminhoMidia('tropicaleatacado', 'prod_1', jpg, 1700000000000)
    expect(path.split('/')[0]).toBe('tropicaleatacado')
    expect(path).toBe('tropicaleatacado/prod_1_1700000000000.jpg')
  })

  it('bate com o layout que já existe em produção (produtos-fotos/{loja}/...)', () => {
    const path = caminhoMidia('tropicaleatacado', 'p', jpg, 1)
    expect(`${BUCKET_FOTOS}/${path}`).toMatch(/^produtos-fotos\/tropicaleatacado\//)
  })

  it('falha com mensagem clara em vez de montar "undefined/..."', () => {
    // Sem esta guarda o path viraria "undefined/x.jpg" e o Postgres recusaria
    // com o mesmo 403 genérico, escondendo a causa.
    for (const vazio of [undefined, null, '']) {
      expect(() => caminhoMidia(vazio, 'p', jpg)).toThrow(/Loja não identificada/)
    }
  })

  it('não produz pasta a mais: o path tem exatamente um nível', () => {
    expect(caminhoMidia('loja', 'p', jpg, 1).split('/')).toHaveLength(2)
  })
})

describe('extensaoDe', () => {
  it('usa a extensão do nome, em minúscula', () => {
    expect(extensaoDe({ name: 'Foto.PNG', type: 'image/png' })).toBe('png')
  })

  it('cai no MIME quando o nome não tem ponto', () => {
    // split('.').pop() devolveria "img_4567" como se fosse extensão.
    expect(extensaoDe({ name: 'IMG_4567', type: 'image/jpeg' })).toBe('jpg')
  })

  it('cai no MIME quando o nome termina em ponto', () => {
    expect(extensaoDe({ name: 'foto.', type: 'image/webp' })).toBe('webp')
  })

  it('nunca devolve vazio', () => {
    expect(extensaoDe({ name: '', type: '' })).toBe('bin')
  })
})

describe('erroDeUpload', () => {
  it('troca o texto cru de RLS por um que diz onde olhar', () => {
    const msg = erroDeUpload(
      { message: 'new row violates row-level security policy' },
      BUCKET_FOTOS,
      'tropicaleatacado',
    )
    expect(msg).toContain('produtos-fotos/tropicaleatacado/')
    expect(msg).toMatch(/INSERT/)
  })

  it('preserva qualquer outro erro', () => {
    expect(erroDeUpload({ message: 'Payload too large' }, BUCKET_FOTOS, 'x'))
      .toBe('Payload too large')
  })
})
