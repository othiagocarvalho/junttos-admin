import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  acharSegredosNoTexto,
  acharAcessoEnvInteiro,
  acharAcessoEnvInseguro,
  ehJwtServiceRole,
} from './segredosBundle.js'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TRAVA = path.join(raiz, 'scripts', 'verificar-segredos-no-bundle.mjs')

/**
 * Monta um JWT falso com o payload pedido. NÃO é chave de ninguém: a
 * assinatura é literal e o payload tem só o campo `role`. Precisamos de um
 * porque a diferença entre a chave pública (anon) e a chave que ignora RLS
 * (service_role) está no payload, não no formato.
 */
function jwtFalso(role) {
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role })}.assinatura-falsa-de-teste`
}

const JWT_SERVICE = jwtFalso('service_role')
const JWT_ANON    = jwtFalso('anon')

describe('ehJwtServiceRole', () => {
  it('separa a chave que ignora RLS da chave pública', () => {
    expect(ehJwtServiceRole(JWT_SERVICE.split('.')[1])).toBe(true)
    expect(ehJwtServiceRole(JWT_ANON.split('.')[1])).toBe(false)
  })

  it('não estoura em lixo que não é base64 nem JSON', () => {
    expect(ehJwtServiceRole('!!!!')).toBe(false)
    expect(ehJwtServiceRole('')).toBe(false)
    expect(ehJwtServiceRole(Buffer.from('nao é json').toString('base64url'))).toBe(false)
  })
})

describe('acharSegredosNoTexto', () => {
  it('bundle sem segredo passa limpo', () => {
    const bundle = `const u="https://abc.supabase.co",k="${JWT_ANON}";export{u,k};`
    expect(acharSegredosNoTexto(bundle)).toEqual([])
  })

  it('pega a chave secreta nova (sb_secret_) minificada no bundle', () => {
    const bundle = `const k="sb_secret_ABCdef123456_xyz";`
    const achados = acharSegredosNoTexto(bundle)
    expect(achados).toHaveLength(1)
    expect(achados[0].tipo).toBe('chave-secreta-supabase')
  })

  it('pega o JWT service_role e ignora o anon ao lado dele', () => {
    const bundle = `a="${JWT_ANON}";b="${JWT_SERVICE}";`
    const achados = acharSegredosNoTexto(bundle)
    expect(achados).toHaveLength(1)
    expect(achados[0].tipo).toBe('jwt-service-role')
  })

  // A palavra aparece em migration e em comentário sobre RLS o tempo todo.
  // Se ela sozinha reprovasse, a trava viraria ruído e alguém a desligaria.
  it('a palavra service_role solta não é segredo', () => {
    expect(acharSegredosNoTexto('-- policy para service_role bypassar RLS')).toEqual([])
  })

  it('não devolve o segredo inteiro no relatório', () => {
    const bundle = `k="sb_secret_ABCdefGHIjklMNOpqrsTUVwxyz0123456789";`
    expect(acharSegredosNoTexto(bundle)[0].trecho).not.toContain('MNOpqrs')
  })

  it('aponta a linha do achado', () => {
    expect(acharSegredosNoTexto(`linha1\nlinha2\nk="sb_secret_abc"`)[0].linha).toBe(3)
  })

  it('texto vazio ou nulo não quebra', () => {
    expect(acharSegredosNoTexto('')).toEqual([])
    expect(acharSegredosNoTexto(null)).toEqual([])
  })
})

describe('acharAcessoEnvInteiro', () => {
  // O jeito certo: o Vite troca por aquele valor, e só por ele.
  it('ler uma propriedade nomeada é seguro', () => {
    const casos = [
      'const url = import.meta.env.VITE_SUPABASE_URL',
      'const k = import.meta.env?.VITE_SUPABASE_ANON_KEY',
      'if (import.meta.env.DEV) console.log(1)',
    ]
    for (const codigo of casos) {
      const [achado] = acharAcessoEnvInteiro(codigo)
      expect(achado?.seguro, codigo).toBe(true)
    }
  })

  // Todos estes fazem o Vite injetar o objeto INTEIRO de variáveis VITE_ no
  // bundle. É exatamente por aqui que a service key sairia publicada.
  it('qualquer outro formato é inseguro', () => {
    const casos = [
      'const tudo = { ...import.meta.env }',
      'const env = import.meta.env',
      'console.log(import.meta.env)',
      'JSON.stringify(import.meta.env)',
      'const v = import.meta.env[nomeDinamico]',
      "const v = import.meta.env['VITE_SUPABASE_URL']",
      'export default import.meta.env;',
      'fetch(url, { body: JSON.stringify({ env: import.meta.env }) })',
    ]
    for (const codigo of casos) {
      expect(acharAcessoEnvInseguro(codigo), codigo).toHaveLength(1)
    }
  })

  it('espaço e quebra de linha no meio não escondem o acesso', () => {
    expect(acharAcessoEnvInseguro('const e = import\n  . meta . env')).toHaveLength(1)
  })

  it('código sem ambiente nenhum não gera achado', () => {
    expect(acharAcessoEnvInteiro('const a = 1')).toEqual([])
    expect(acharAcessoEnvInteiro(null)).toEqual([])
  })
})

/**
 * Teste de mutação da trava de verdade.
 *
 * Os testes acima provam que o detector reconhece os padrões. Estes provam
 * que o BUILD cai por causa deles: rodam o mesmo script encadeado no `npm run
 * build`, apontado para pastas-isca. Sem isto, a trava poderia estar
 * detectando tudo certo e ainda assim saindo com código 0.
 */
describe('trava de build (scripts/verificar-segredos-no-bundle.mjs)', () => {
  let tmp
  const rodar = args => {
    try {
      const saida = execFileSync('node', [TRAVA, ...args], { encoding: 'utf8', stdio: 'pipe' })
      return { codigo: 0, saida }
    } catch (e) {
      return { codigo: e.status, saida: `${e.stdout ?? ''}${e.stderr ?? ''}` }
    }
  }

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trava-segredos-'))
    for (const nome of ['bundle-limpo', 'bundle-sujo', 'bundle-jwt', 'fonte-limpa', 'fonte-suja']) {
      fs.mkdirSync(path.join(tmp, nome, 'assets'), { recursive: true })
    }
    const escrever = (pasta, arq, txt) => fs.writeFileSync(path.join(tmp, pasta, 'assets', arq), txt)

    escrever('bundle-limpo', 'index-abc.js', `const k="${JWT_ANON}";const u="https://x.supabase.co";`)
    escrever('bundle-sujo',  'index-abc.js', 'const k="sb_secret_VAZOU_NO_BUNDLE_123";')
    escrever('bundle-jwt',   'index-abc.js', `const k="${JWT_SERVICE}";`)
    escrever('fonte-limpa',  'app.js', 'export const url = import.meta.env.VITE_SUPABASE_URL')
    escrever('fonte-suja',   'app.js', 'export const tudo = { ...import.meta.env }')
  })

  afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

  it('passa (código 0) com bundle e fonte limpos', () => {
    const r = rodar([`--bundle=${path.join(tmp, 'bundle-limpo')}`, `--fonte=${path.join(tmp, 'fonte-limpa')}`])
    expect(r.saida).toContain('Nenhum segredo exposto')
    expect(r.codigo).toBe(0)
  })

  it('REPROVA se a chave secreta reaparecer no bundle', () => {
    const r = rodar([`--bundle=${path.join(tmp, 'bundle-sujo')}`, `--fonte=${path.join(tmp, 'fonte-limpa')}`])
    expect(r.codigo).toBe(1)
    expect(r.saida).toContain('sb_secret_')
  })

  it('REPROVA se um JWT service_role reaparecer no bundle', () => {
    const r = rodar([`--bundle=${path.join(tmp, 'bundle-jwt')}`, `--fonte=${path.join(tmp, 'fonte-limpa')}`])
    expect(r.codigo).toBe(1)
    expect(r.saida).toContain('service_role')
  })

  // A mutação que importa: alguém volta a espalhar o ambiente inteiro. O
  // bundle-isca está limpo de propósito — quem reprova aqui é a regra de
  // fonte, que pega o risco ANTES de virar chave publicada.
  it('REPROVA se alguém espalhar o ambiente inteiro no código-fonte', () => {
    const r = rodar([`--bundle=${path.join(tmp, 'bundle-limpo')}`, `--fonte=${path.join(tmp, 'fonte-suja')}`])
    expect(r.codigo).toBe(1)
    expect(r.saida).toContain('sem propriedade nomeada')
  })

  // O repositório de verdade, agora: a trava tem que estar verde no código
  // que está no ar. Se este cair, alguém introduziu o padrão em src/.
  it('o código-fonte atual do repositório passa', () => {
    const r = rodar(['--sem-bundle'])
    expect(r.saida).toContain('Nenhum segredo exposto')
    expect(r.codigo).toBe(0)
  })
})
