import { describe, it, expect } from 'vitest'
import { construirSlides, competenciaAtual, temMetaDoMes, labelPlano } from './tourOnboarding'

const ids = s => s.map(x => x.id)

describe('competenciaAtual / temMetaDoMes', () => {
  const hoje = new Date(2026, 7, 18, 12, 0, 0)   // 18/08/2026

  it('monta a competência no fuso local', () => {
    expect(competenciaAtual(hoje)).toBe('2026-08')
  })
  it('mês de um dígito ganha zero à esquerda', () => {
    expect(competenciaAtual(new Date(2026, 0, 5, 12))).toBe('2026-01')
  })
  it('reconhece meta do mês corrente', () => {
    expect(temMetaDoMes({ '2026-08': 5000 }, hoje)).toBe(true)
  })
  it('meta de outro mês não conta', () => {
    expect(temMetaDoMes({ '2026-07': 5000 }, hoje)).toBe(false)
  })
  it('meta zerada ou ausente não conta', () => {
    expect(temMetaDoMes({ '2026-08': 0 }, hoje)).toBe(false)
    expect(temMetaDoMes({}, hoje)).toBe(false)
    expect(temMetaDoMes(undefined, hoje)).toBe(false)
  })
})

describe('construirSlides — filtro por plano', () => {
  it('starter: boas-vindas + 5 funcionalidades', () => {
    const s = construirSlides({ plano: 'starter' })
    expect(s).toHaveLength(6)
    expect(ids(s)).toEqual(['boasvindas', 'venda', 'estoque', 'fechamento', 'clientes', 'meta'])
  })

  it('pro: starter + crediário e relatórios avançados', () => {
    const s = construirSlides({ plano: 'pro' })
    expect(s).toHaveLength(8)
    expect(ids(s)).toContain('crediario')
    expect(ids(s)).toContain('relatorios_avancados')
    expect(ids(s)).not.toContain('financeiro')
  })

  it('business: tudo, 11 slides', () => {
    const s = construirSlides({ plano: 'business' })
    expect(s).toHaveLength(11)
    expect(ids(s)).toContain('catalogo')
    expect(ids(s)).toContain('financeiro')
    expect(ids(s)).toContain('catalogo_b2b')
  })

  it('plano desconhecido cai em starter, sem quebrar', () => {
    expect(construirSlides({ plano: 'inexistente' })).toHaveLength(6)
  })
})

describe('construirSlides — slide de boas-vindas', () => {
  it('traz o nome da loja e o plano no texto', () => {
    const [bv] = construirSlides({ nomeLoja: 'Bia Store', plano: 'pro' })
    expect(bv.tipo).toBe('boasvindas')
    expect(bv.titulo).toContain('Bia Store')
    expect(bv.texto).toContain('Pro')
  })
  it('é sempre o primeiro slide', () => {
    expect(construirSlides({ plano: 'business' })[0].id).toBe('boasvindas')
  })
  it('sem nome informado, usa um genérico em vez de "undefined"', () => {
    expect(construirSlides({}).at(0).titulo).toContain('sua loja')
  })
})

describe('construirSlides — conteúdo condicional pelo uso real', () => {
  const texto = (s, id) => s.find(x => x.id === id).texto

  it('loja vazia: estoque, clientes e metas falam em CADASTRAR', () => {
    const s = construirSlides({ plano: 'starter', temProdutos: false, temClientes: false, temMeta: false })
    expect(texto(s, 'estoque')).toMatch(/Cadastre seus produtos/i)
    expect(texto(s, 'clientes')).toMatch(/Comece cadastrando/i)
    expect(texto(s, 'meta')).toMatch(/Defina uma meta/i)
  })

  it('loja em uso: os mesmos três falam em ACOMPANHAR', () => {
    const s = construirSlides({ plano: 'starter', temProdutos: true, temClientes: true, temMeta: true })
    expect(texto(s, 'estoque')).toMatch(/Acompanhe a quantidade/i)
    expect(texto(s, 'clientes')).toMatch(/veja o histórico/i)
    expect(texto(s, 'meta')).toMatch(/Acompanhe o progresso/i)
  })

  it('condição é por slide, não global', () => {
    const s = construirSlides({ plano: 'starter', temProdutos: true, temClientes: false, temMeta: false })
    expect(texto(s, 'estoque')).toMatch(/Acompanhe a quantidade/i)
    expect(texto(s, 'clientes')).toMatch(/Comece cadastrando/i)
  })

  it('slides sem condição têm o mesmo texto nos dois casos', () => {
    const vazia = construirSlides({ plano: 'starter' })
    const cheia = construirSlides({ plano: 'starter', temProdutos: true, temClientes: true, temMeta: true })
    expect(texto(vazia, 'venda')).toBe(texto(cheia, 'venda'))
    expect(texto(vazia, 'fechamento')).toBe(texto(cheia, 'fechamento'))
  })

  it('todo slide tem título e texto preenchidos', () => {
    for (const s of construirSlides({ plano: 'business' })) {
      expect(s.titulo?.length).toBeGreaterThan(0)
      expect(s.texto?.length).toBeGreaterThan(0)
    }
  })
})

describe('labelPlano', () => {
  it('traduz os três planos', () => {
    expect(labelPlano('starter')).toBe('Starter')
    expect(labelPlano('pro')).toBe('Pro')
    expect(labelPlano('business')).toBe('Business')
  })
  it('desconhecido cai em Starter', () => {
    expect(labelPlano(null)).toBe('Starter')
  })
})
