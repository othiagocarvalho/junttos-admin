import { describe, it, expect } from 'vitest'
import {
  MODELO_VAREJO, MODELO_ATACADO,
  nivelParaModelo, modeloDeFeatures, nivelDoModelo,
  featuresComModelo, rotuloNivel, pedidoMinimoPayload, precisaGravar,
  precisaAvisarPedidoMinimo, resumoPedidoMinimo,
} from './modeloVenda.js'

describe('nivelParaModelo', () => {
  it('false / null / undefined são Varejo', () => {
    expect(nivelParaModelo(false)).toBe(MODELO_VAREJO)
    expect(nivelParaModelo(null)).toBe(MODELO_VAREJO)
    expect(nivelParaModelo(undefined)).toBe(MODELO_VAREJO)
  })

  it("'pro' e 'simples' são Atacado", () => {
    expect(nivelParaModelo('pro')).toBe(MODELO_ATACADO)
    expect(nivelParaModelo('simples')).toBe(MODELO_ATACADO)
  })

  it('true legado é Atacado — com ele a aba de catálogo B2B já está ligada', () => {
    expect(nivelParaModelo(true)).toBe(MODELO_ATACADO)
  })
})

describe('modeloDeFeatures', () => {
  it('lê o modelo do objeto features', () => {
    expect(modeloDeFeatures({ catalogo_b2b: 'pro', crm: true })).toBe(MODELO_ATACADO)
    expect(modeloDeFeatures({ catalogo_b2b: false })).toBe(MODELO_VAREJO)
  })

  it('features ausente não quebra', () => {
    expect(modeloDeFeatures(undefined)).toBe(MODELO_VAREJO)
    expect(modeloDeFeatures(null)).toBe(MODELO_VAREJO)
    expect(modeloDeFeatures({})).toBe(MODELO_VAREJO)
  })
})

describe('nivelDoModelo', () => {
  it('Varejo grava false', () => {
    expect(nivelDoModelo(MODELO_VAREJO, 'pro')).toBe(false)
    expect(nivelDoModelo(MODELO_VAREJO, 'simples')).toBe(false)
    expect(nivelDoModelo(MODELO_VAREJO, false)).toBe(false)
  })

  it("Atacado numa loja nova grava 'pro' — é o nível que liga pedido mínimo e grade", () => {
    expect(nivelDoModelo(MODELO_ATACADO, false)).toBe('pro')
    expect(nivelDoModelo(MODELO_ATACADO, undefined)).toBe('pro')
  })

  it("preserva 'simples' de loja que já é atacado simples", () => {
    expect(nivelDoModelo(MODELO_ATACADO, 'simples')).toBe('simples')
  })

  it("mantém 'pro' de quem já é pro", () => {
    expect(nivelDoModelo(MODELO_ATACADO, 'pro')).toBe('pro')
  })
})

describe('featuresComModelo', () => {
  it('criação varejo: catalogo_b2b false', () => {
    expect(featuresComModelo({ crm: false }, MODELO_VAREJO).catalogo_b2b).toBe(false)
  })

  it("criação atacado: catalogo_b2b 'pro'", () => {
    expect(featuresComModelo({ crm: false }, MODELO_ATACADO).catalogo_b2b).toBe('pro')
  })

  it('não mexe nas outras flags', () => {
    const antes = { crm: true, estoque: false, legado: true, catalogo_b2b: false }
    const depois = featuresComModelo(antes, MODELO_ATACADO)
    expect(depois).toEqual({ crm: true, estoque: false, legado: true, catalogo_b2b: 'pro' })
  })

  it('não muta o objeto original', () => {
    const antes = { crm: true, catalogo_b2b: false }
    featuresComModelo(antes, MODELO_ATACADO)
    expect(antes.catalogo_b2b).toBe(false)
  })

  it('edição: troca ida e volta devolve a loja ao estado original', () => {
    const original = { crm: true, catalogo_b2b: false }
    const paraAtacado = featuresComModelo(original, MODELO_ATACADO)
    expect(paraAtacado.catalogo_b2b).toBe('pro')
    const deVolta = featuresComModelo(paraAtacado, MODELO_VAREJO)
    expect(deVolta).toEqual(original)
  })

  it('features ausente não quebra', () => {
    expect(featuresComModelo(undefined, MODELO_ATACADO)).toEqual({ catalogo_b2b: 'pro' })
  })
})

describe('rotuloNivel', () => {
  it('distingue os três estados reais', () => {
    expect(rotuloNivel(false)).toBe('Varejo')
    expect(rotuloNivel('simples')).toBe('Atacado (simples)')
    expect(rotuloNivel('pro')).toBe('Atacado (completo)')
  })
})

describe('pedidoMinimoPayload', () => {
  it('sem argumento vira "nenhum" com as duas colunas nulas', () => {
    expect(pedidoMinimoPayload()).toEqual({
      pedido_minimo_tipo: 'nenhum', pedido_minimo_valor: null, pedido_minimo_qtd: null,
    })
  })

  it('tipo valor preenche só o valor', () => {
    expect(pedidoMinimoPayload({ tipo: 'valor', valor: '500' })).toEqual({
      pedido_minimo_tipo: 'valor', pedido_minimo_valor: 500, pedido_minimo_qtd: null,
    })
  })

  it('aceita vírgula decimal', () => {
    expect(pedidoMinimoPayload({ tipo: 'valor', valor: '499,90' }).pedido_minimo_valor).toBe(499.9)
  })

  it('tipo quantidade preenche só a qtd', () => {
    expect(pedidoMinimoPayload({ tipo: 'quantidade', qtd: '12' })).toEqual({
      pedido_minimo_tipo: 'quantidade', pedido_minimo_valor: null, pedido_minimo_qtd: 12,
    })
  })

  it('zera a coluna que não corresponde ao tipo — sem valor órfão', () => {
    const p = pedidoMinimoPayload({ tipo: 'quantidade', valor: '500', qtd: '12' })
    expect(p.pedido_minimo_valor).toBe(null)
  })

  it('campo em branco vira null, não NaN', () => {
    expect(pedidoMinimoPayload({ tipo: 'valor', valor: '' }).pedido_minimo_valor).toBe(null)
    expect(pedidoMinimoPayload({ tipo: 'quantidade', qtd: '' }).pedido_minimo_qtd).toBe(null)
  })
})

describe('features gravado como string JSON (linhas antigas)', () => {
  it('lê o modelo correto em vez de cair em Varejo por engano', () => {
    expect(modeloDeFeatures('{"catalogo_b2b":"pro","crm":true}')).toBe(MODELO_ATACADO)
    expect(modeloDeFeatures('{"catalogo_b2b":false}')).toBe(MODELO_VAREJO)
  })

  it('string inválida não derruba a tela', () => {
    expect(modeloDeFeatures('isto não é json')).toBe(MODELO_VAREJO)
  })

  it('featuresComModelo devolve objeto de verdade, preservando as outras flags', () => {
    expect(featuresComModelo('{"crm":true,"catalogo_b2b":false}', MODELO_ATACADO))
      .toEqual({ crm: true, catalogo_b2b: 'pro' })
  })
})

// Duas lojas em produção estão com catalogo_b2b: true — gravado à mão por
// UPDATE antes desta tela existir. É o estado meio-quebrado que a tela conserta.
describe('valor legado catalogo_b2b: true', () => {
  it('aparece no seletor como Atacado, não como Varejo', () => {
    expect(modeloDeFeatures({ catalogo_b2b: true })).toBe(MODELO_ATACADO)
  })

  it('o rótulo avisa que o pedido mínimo não funciona nesse estado', () => {
    expect(rotuloNivel(true)).toMatch(/legado/)
  })

  it("confirmar Atacado normaliza para 'pro' — passa a valer pedido mínimo e grade", () => {
    expect(featuresComModelo({ crm: true, catalogo_b2b: true }, MODELO_ATACADO))
      .toEqual({ crm: true, catalogo_b2b: 'pro' })
  })

  it('trocar para Varejo desliga normalmente', () => {
    expect(featuresComModelo({ catalogo_b2b: true }, MODELO_VAREJO).catalogo_b2b).toBe(false)
  })
})

describe('precisaGravar', () => {
  it('loja sem a chave catalogo_b2b não oferece troca Varejo→Varejo', () => {
    expect(precisaGravar(MODELO_VAREJO, undefined)).toBe(false)
    expect(precisaGravar(MODELO_VAREJO, null)).toBe(false)
    expect(precisaGravar(MODELO_VAREJO, false)).toBe(false)
  })

  it('já é pro e escolheu Atacado: nada a gravar', () => {
    expect(precisaGravar(MODELO_ATACADO, 'pro')).toBe(false)
  })

  it('já é simples e escolheu Atacado: nada a gravar (preserva simples)', () => {
    expect(precisaGravar(MODELO_ATACADO, 'simples')).toBe(false)
  })

  it('true legado + Atacado: oferece a normalização para pro', () => {
    expect(precisaGravar(MODELO_ATACADO, true)).toBe(true)
  })

  it('trocas de verdade acendem o botão', () => {
    expect(precisaGravar(MODELO_ATACADO, false)).toBe(true)
    expect(precisaGravar(MODELO_VAREJO, 'pro')).toBe(true)
    expect(precisaGravar(MODELO_VAREJO, true)).toBe(true)
  })
})

// ── Aviso para a lojista (CatalogoB2BAdmin / …Desktop) ───────────────────────

describe('precisaAvisarPedidoMinimo', () => {
  it("aparece em loja 'pro' com tipo 'nenhum' — o default da coluna", () => {
    expect(precisaAvisarPedidoMinimo('pro', 'nenhum')).toBe(true)
  })

  it("aparece em loja 'pro' com tipo ausente ou vazio", () => {
    expect(precisaAvisarPedidoMinimo('pro', null)).toBe(true)
    expect(precisaAvisarPedidoMinimo('pro', undefined)).toBe(true)
    expect(precisaAvisarPedidoMinimo('pro', '')).toBe(true)
  })

  it('some assim que ela escolhe um tipo — antes mesmo de salvar', () => {
    expect(precisaAvisarPedidoMinimo('pro', 'valor')).toBe(false)
    expect(precisaAvisarPedidoMinimo('pro', 'quantidade')).toBe(false)
  })

  it('nunca aparece fora do nível pro — só ele lê pedido mínimo', () => {
    expect(precisaAvisarPedidoMinimo('simples', 'nenhum')).toBe(false)
    expect(precisaAvisarPedidoMinimo(false, 'nenhum')).toBe(false)
    expect(precisaAvisarPedidoMinimo(true, 'nenhum')).toBe(false)
    expect(precisaAvisarPedidoMinimo(undefined, 'nenhum')).toBe(false)
  })
})

// ── Leitura do admin (LojaDetalhe, seção Modelo de venda) ────────────────────

describe('resumoPedidoMinimo', () => {
  it("tipo 'nenhum' → sem configuração, com texto explícito", () => {
    const r = resumoPedidoMinimo({ pedido_minimo_tipo: 'nenhum' })
    expect(r.configurado).toBe(false)
    expect(r.texto).toBe('Sem pedido mínimo configurado')
  })

  it('config ausente não quebra', () => {
    expect(resumoPedidoMinimo(undefined).configurado).toBe(false)
    expect(resumoPedidoMinimo(null).configurado).toBe(false)
    expect(resumoPedidoMinimo({}).configurado).toBe(false)
  })

  it('mínimo por valor mostra o valor formatado (caso catalogob2bdemo)', () => {
    const r = resumoPedidoMinimo({ pedido_minimo_tipo: 'valor', pedido_minimo_valor: 500 })
    expect(r.configurado).toBe(true)
    expect(r.texto).toBe('R$ 500,00 por pedido')
  })

  it('mínimo por quantidade concorda o plural', () => {
    expect(resumoPedidoMinimo({ pedido_minimo_tipo: 'quantidade', pedido_minimo_qtd: 12 }).texto)
      .toBe('12 peças por pedido')
    expect(resumoPedidoMinimo({ pedido_minimo_tipo: 'quantidade', pedido_minimo_qtd: 1 }).texto)
      .toBe('1 peça por pedido')
  })

  it('tipo escolhido sem número não conta como configurado — não trava nada', () => {
    const semValor = resumoPedidoMinimo({ pedido_minimo_tipo: 'valor', pedido_minimo_valor: null })
    expect(semValor.configurado).toBe(false)
    expect(semValor.texto).toMatch(/não trava nada/)

    const zerado = resumoPedidoMinimo({ pedido_minimo_tipo: 'valor', pedido_minimo_valor: 0 })
    expect(zerado.configurado).toBe(false)

    const semQtd = resumoPedidoMinimo({ pedido_minimo_tipo: 'quantidade', pedido_minimo_qtd: 0 })
    expect(semQtd.configurado).toBe(false)
  })

  it('tipo desconhecido é reportado em vez de virar silêncio', () => {
    const r = resumoPedidoMinimo({ pedido_minimo_tipo: 'xpto' })
    expect(r.configurado).toBe(false)
    expect(r.texto).toMatch(/xpto/)
  })
})

// Estado real das lojas na data desta tarefa — serve de âncora de regressão.
describe('lojas reais em pro', () => {
  const casos = [
    { loja: 'hmboutique',       cfg: { pedido_minimo_tipo: 'nenhum', pedido_minimo_valor: 0, pedido_minimo_qtd: 0 }, aviso: true,  configurado: false },
    { loja: 'tropicaleatacado', cfg: { pedido_minimo_tipo: 'nenhum', pedido_minimo_valor: 0, pedido_minimo_qtd: 0 }, aviso: true,  configurado: false },
    { loja: 'sualoja',          cfg: { pedido_minimo_tipo: 'nenhum', pedido_minimo_valor: 0, pedido_minimo_qtd: 0 }, aviso: true,  configurado: false },
    { loja: 'catalogob2bdemo',  cfg: { pedido_minimo_tipo: 'valor',  pedido_minimo_valor: 500, pedido_minimo_qtd: 0 }, aviso: false, configurado: true },
  ]

  casos.forEach(({ loja, cfg, aviso, configurado }) => {
    it(`${loja}: aviso=${aviso}, admin vê configurado=${configurado}`, () => {
      expect(precisaAvisarPedidoMinimo('pro', cfg.pedido_minimo_tipo)).toBe(aviso)
      expect(resumoPedidoMinimo(cfg).configurado).toBe(configurado)
    })
  })
})
