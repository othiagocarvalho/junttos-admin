import { describe, it, expect } from 'vitest'
import { buildLojaPayload, isValidSlug, toSlug } from './useCreateLoja'
import { MODELO_VAREJO, MODELO_ATACADO, featuresComModelo } from '../utils/modeloVenda'

// ── buildLojaPayload ─────────────────────────────────────────────────────────

describe('buildLojaPayload', () => {
  const base = {
    nome: 'Loja Teste',
    slug: 'loja-teste',
    status: 'Trial',
    plano: 'starter',
    cor_primaria: '#5E2BD0',
    cor_secundaria: '#FF6F5E',
  }

  it('inclui campos obrigatórios corretamente', () => {
    const p = buildLojaPayload(base)
    expect(p.loja_id).toBe('loja-teste')
    expect(p.slug).toBe('loja-teste')
    expect(p.nome).toBe('Loja Teste')
    expect(p.status).toBe('Trial')
    expect(p.plano).toBe('starter')
  })

  it('aplica DEFAULT_FEATURES quando nenhuma feature é passada', () => {
    const p = buildLojaPayload(base)
    expect(p.features.vendas).toBe(true)
    expect(p.features.historico).toBe(true)
    expect(p.features.catalogo_b2b).toBe(false)
    expect(p.features.legado).toBe(false)
  })

  it('mescla features extras sem sobrescrever as defaults', () => {
    const p = buildLojaPayload({ ...base, features: { atacado: true, crm: true } })
    expect(p.features.atacado).toBe(true)
    expect(p.features.crm).toBe(true)
    expect(p.features.vendas).toBe(true)
  })

  it('inclui cadastrado_por_consultor_id quando fornecido', () => {
    const consultorId = 'uuid-consultor-123'
    const p = buildLojaPayload({ ...base, cadastrado_por_consultor_id: consultorId })
    expect(p.cadastrado_por_consultor_id).toBe(consultorId)
  })

  it('omite cadastrado_por_consultor_id quando null', () => {
    const p = buildLojaPayload({ ...base, cadastrado_por_consultor_id: null })
    expect('cadastrado_por_consultor_id' in p).toBe(false)
  })

  it('omite cadastrado_por_consultor_id quando não passado', () => {
    const p = buildLojaPayload(base)
    expect('cadastrado_por_consultor_id' in p).toBe(false)
  })

  it('logo_url fica null quando não passada', () => {
    const p = buildLojaPayload(base)
    expect(p.logo_url).toBeNull()
  })

  it('logo_url é preservada quando passada', () => {
    const p = buildLojaPayload({ ...base, logoUrl: 'https://cdn.example.com/logo.png' })
    expect(p.logo_url).toBe('https://cdn.example.com/logo.png')
  })
})

// ── isValidSlug ──────────────────────────────────────────────────────────────

describe('isValidSlug', () => {
  it('aceita slug simples', () => expect(isValidSlug('loja')).toBe(true))
  it('aceita slug com hífens', () => expect(isValidSlug('minha-loja')).toBe(true))
  it('aceita slug com números', () => expect(isValidSlug('loja123')).toBe(true))
  it('rejeita slug com maiúsculas', () => expect(isValidSlug('Loja')).toBe(false))
  it('rejeita slug com underscore', () => expect(isValidSlug('minha_loja')).toBe(false))
  it('rejeita slug com hífen no início', () => expect(isValidSlug('-loja')).toBe(false))
  it('rejeita slug com hífen no fim', () => expect(isValidSlug('loja-')).toBe(false))
  it('rejeita slug com 1 caractere (mínimo é 2)', () => expect(isValidSlug('a')).toBe(false))
  it('rejeita slug vazio', () => expect(isValidSlug('')).toBe(false))
  it('aceita slug no limite mínimo (2 chars)', () => expect(isValidSlug('ab')).toBe(true))
})

// ── toSlug ───────────────────────────────────────────────────────────────────

describe('toSlug', () => {
  it('converte espaços em hífens', () => expect(toSlug('Minha Loja')).toBe('minha-loja'))
  it('remove acentos', () => expect(toSlug('Ação')).toBe('acao'))
  it('lowercase', () => expect(toSlug('LOJA')).toBe('loja'))
  it('colapsa múltiplos espaços', () => expect(toSlug('loja  teste')).toBe('loja-teste'))
  it('remove caracteres especiais', () => expect(toSlug('loja & filha!')).toBe('loja-filha'))
})

// ── Modelo de venda no cadastro ──────────────────────────────────────────────
// Reproduz o caminho real do formulário: CadastroCliente passa
// featuresComModelo(form.features, form.modelo_venda) para o save().

describe('cadastro de loja — modelo de venda', () => {
  const base = {
    nome: 'Loja Teste', slug: 'loja-teste',
    status: 'Trial', plano: 'business',
    cor_primaria: '#5E2BD0', cor_secundaria: '#FF6F5E',
  }
  const criar = (modelo, pedido_minimo = null) => buildLojaPayload({
    ...base,
    features: featuresComModelo({ crm: false }, modelo),
    pedido_minimo,
  })

  it('Varejo é o padrão: catalogo_b2b false', () => {
    expect(criar(MODELO_VAREJO).features.catalogo_b2b).toBe(false)
  })

  it("Atacado grava 'pro' — o único nível que liga pedido mínimo e grade", () => {
    expect(criar(MODELO_ATACADO).features.catalogo_b2b).toBe('pro')
  })

  it('o modelo não interfere nas demais features', () => {
    const p = criar(MODELO_ATACADO)
    expect(p.features.vendas).toBe(true)
    expect(p.features.historico).toBe(true)
    expect(p.features.legado).toBe(false)
    expect(p.features.crm).toBe(false)
  })

  it('varejo não grava nenhuma coluna de pedido mínimo', () => {
    const p = criar(MODELO_VAREJO)
    expect('pedido_minimo_tipo' in p).toBe(false)
    expect('pedido_minimo_valor' in p).toBe(false)
    expect('pedido_minimo_qtd' in p).toBe(false)
  })

  it('atacado com pedido mínimo por valor grava as três colunas', () => {
    const p = criar(MODELO_ATACADO, { tipo: 'valor', valor: '500', qtd: '' })
    expect(p.pedido_minimo_tipo).toBe('valor')
    expect(p.pedido_minimo_valor).toBe(500)
    expect(p.pedido_minimo_qtd).toBeNull()
  })

  it('atacado com pedido mínimo por quantidade', () => {
    const p = criar(MODELO_ATACADO, { tipo: 'quantidade', valor: '', qtd: '12' })
    expect(p.pedido_minimo_tipo).toBe('quantidade')
    expect(p.pedido_minimo_qtd).toBe(12)
    expect(p.pedido_minimo_valor).toBeNull()
  })

  it('atacado deixando o pedido mínimo em branco grava "nenhum" — a lojista completa depois', () => {
    const p = criar(MODELO_ATACADO, { tipo: 'nenhum', valor: '', qtd: '' })
    expect(p.pedido_minimo_tipo).toBe('nenhum')
    expect(p.pedido_minimo_valor).toBeNull()
    expect(p.pedido_minimo_qtd).toBeNull()
  })

  it('quem não passa pedido_minimo (ConsultorNovaLoja) tem o payload de antes, intacto', () => {
    const semModelo = buildLojaPayload(base)
    const chaves = Object.keys(semModelo).filter(k => k.startsWith('pedido_minimo'))
    expect(chaves).toEqual([])
    expect(semModelo.features.catalogo_b2b).toBe(false)
  })
})

// ── Edição do modelo numa loja existente (LojaDetalhe) ───────────────────────
// O modal grava features: featuresComModelo(loja.features, modeloNovo).

describe('edição de loja existente — troca de modelo', () => {
  it('varejo → atacado numa loja business real', () => {
    const antes = {
      crm: true, metas: true, vendas: true, estoque: false,
      legado: false, catalogo_b2b: false, cadastro_completo_cliente: true,
    }
    const depois = featuresComModelo(antes, MODELO_ATACADO)
    expect(depois.catalogo_b2b).toBe('pro')
    expect(depois.crm).toBe(true)
    expect(depois.cadastro_completo_cliente).toBe(true)
  })

  it('atacado → varejo desliga só o catálogo B2B', () => {
    const antes = { crm: true, catalogo_b2b: 'pro', metas: true }
    const depois = featuresComModelo(antes, MODELO_VAREJO)
    expect(depois).toEqual({ crm: true, catalogo_b2b: false, metas: true })
  })

  it('ida e volta devolve a loja exatamente ao estado inicial', () => {
    const original = { crm: true, metas: true, catalogo_b2b: false }
    const volta = featuresComModelo(featuresComModelo(original, MODELO_ATACADO), MODELO_VAREJO)
    expect(volta).toEqual(original)
  })

  it("loja em 'simples' não é promovida sem o admin pedir", () => {
    const antes = { catalogo_b2b: 'simples', crm: false }
    expect(featuresComModelo(antes, MODELO_ATACADO).catalogo_b2b).toBe('simples')
  })
})
