import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { SLUGS_RESERVADOS, isSlugReservado } from './rotasReservadas.js'

describe('isSlugReservado', () => {
  // O caso que quebrou em produção: /admin/login virou "Loja não encontrada"
  // porque o App.jsx foi procurar uma loja chamada "admin" em lf_config.
  it('reconhece as rotas do painel que causaram o incidente', () => {
    expect(isSlugReservado('admin')).toBe(true)
    expect(isSlugReservado('login')).toBe(true)
    expect(isSlugReservado('contrato')).toBe(true)
    expect(isSlugReservado('dashboard')).toBe(true)
  })

  it('reconhece o portal do consultor', () => {
    expect(isSlugReservado('c')).toBe(true)
  })

  it('não reserva slug de loja de verdade', () => {
    for (const slug of ['hmboutique', 'audazwear', 'biastore', 'sualoja', 'lojaestrada']) {
      expect(isSlugReservado(slug)).toBe(false)
    }
  })

  it('ignora caixa e espaços em volta', () => {
    expect(isSlugReservado('ADMIN')).toBe(true)
    expect(isSlugReservado('  Login  ')).toBe(true)
  })

  it('vazio e nulo não são reservados', () => {
    expect(isSlugReservado('')).toBe(false)
    expect(isSlugReservado(null)).toBe(false)
    expect(isSlugReservado(undefined)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Trava de arquitetura: impede a lista de divergir das rotas de novo.
//
// A divergência é exatamente o bug: o comentário em useCreateLoja já dizia que
// o App.jsx tratava estes segmentos antes de procurar loja, mas ele nunca leu
// a lista — e a lista tinha 4 dos 16 segmentos. Rota nova no AdminApp sem
// entrada aqui quebra este teste em vez de quebrar o painel em produção.
// ---------------------------------------------------------------------------

describe('cobertura das rotas do AdminApp', () => {
  it('todo primeiro segmento de rota do AdminApp está reservado', () => {
    const fonte = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')

    // Só o corpo do AdminApp: as rotas do LojaClientApp vivem sob o basename
    // da loja (/hmboutique/catalogo), então não disputam o primeiro segmento.
    const bloco = fonte.split(/\nfunction /).find(t => t.startsWith('AdminApp'))
    expect(bloco, 'não achei a função AdminApp em App.jsx').toBeTruthy()

    const segmentos = [...bloco.matchAll(/path="\/([^/"]*)/g)]
      .map(m => m[1])
      .filter(s => s && s !== '*')          // "/" e catch-all não são segmento

    expect(segmentos.length).toBeGreaterThan(10)   // pegou mesmo as rotas

    const faltando = segmentos.filter(s => !isSlugReservado(s))
    expect(faltando, `rotas do AdminApp fora de SLUGS_RESERVADOS: ${faltando.join(', ')}`).toEqual([])
  })

  it('a lista não tem duplicatas', () => {
    expect(new Set(SLUGS_RESERVADOS).size).toBe(SLUGS_RESERVADOS.length)
  })
})
