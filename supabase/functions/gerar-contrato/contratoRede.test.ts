import { describe, it, expect } from 'vitest'
import {
  somaValorMensal, segmentoComum, validarSelecaoLojas, filtroCancelamentoRede,
  DESCONTO_IMPLANTACAO_REDE, valorImplantacaoPorLojaRede, totalImplantacaoRede,
  resumoImplantacao,
  type LojaIncluida,
} from './contratoRede.ts'

const loja = (over: Partial<LojaIncluida> = {}): LojaIncluida => ({
  loja_id: 'loja-1', nome: 'Loja 1', segmento: 'moda', plano: 'pro', valor_mensal: 149.90,
  ...over,
})

describe('somaValorMensal', () => {
  it('soma o valor_mensal de todas as lojas', () => {
    const lojas = [
      loja({ loja_id: 'a', valor_mensal: 259.90 }),
      loja({ loja_id: 'b', valor_mensal: 159.90 }),
      loja({ loja_id: 'c', valor_mensal: 99.90 }),
    ]
    expect(somaValorMensal(lojas)).toBeCloseTo(519.70, 2)
  })

  it('lista vazia soma zero', () => {
    expect(somaValorMensal([])).toBe(0)
  })

  it('valor_mensal inválido (NaN/undefined) conta como zero, não quebra a soma', () => {
    const lojas = [loja({ valor_mensal: 100 }), loja({ valor_mensal: NaN })]
    expect(somaValorMensal(lojas)).toBe(100)
  })
})

describe('segmentoComum', () => {
  it('todas do mesmo segmento devolve esse segmento', () => {
    const lojas = [loja({ segmento: 'moda' }), loja({ segmento: 'moda' })]
    expect(segmentoComum(lojas)).toBe('moda')
  })

  it('segmentos diferentes devolve null — nunca escolhe um dos dois à toa', () => {
    const lojas = [loja({ segmento: 'moda' }), loja({ segmento: 'mercado' })]
    expect(segmentoComum(lojas)).toBeNull()
  })

  it('segmento null é tratado como moda (mesmo default do resto do sistema)', () => {
    const lojas = [loja({ segmento: null }), loja({ segmento: 'moda' })]
    expect(segmentoComum(lojas)).toBe('moda')
  })
})

describe('validarSelecaoLojas', () => {
  const lojasDaRede = [{ loja_id: 'a' }, { loja_id: 'b' }, { loja_id: 'c' }]

  it('seleção vazia é recusada', () => {
    expect(validarSelecaoLojas([], lojasDaRede).ok).toBe(false)
  })

  it('não-array é recusado', () => {
    expect(validarSelecaoLojas(undefined, lojasDaRede).ok).toBe(false)
    expect(validarSelecaoLojas(null, lojasDaRede).ok).toBe(false)
  })

  it('todas as lojas pedidas pertencem à rede — ok', () => {
    expect(validarSelecaoLojas(['a', 'b'], lojasDaRede)).toEqual({ ok: true })
  })

  it('loja fora da rede é recusada, nomeando a loja — barra mistura entre redes/donos', () => {
    const v = validarSelecaoLojas(['a', 'z'], lojasDaRede)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.erro).toContain('z')
  })

  it('duplicata na lista pedida não quebra a validação', () => {
    expect(validarSelecaoLojas(['a', 'a', 'b'], lojasDaRede)).toEqual({ ok: true })
  })
})

describe('filtroCancelamentoRede', () => {
  it('filtra só por rede_id — nunca por loja_id, para não tocar contrato individual', () => {
    const filtro = filtroCancelamentoRede('rede-do-daniel')
    expect(filtro).toEqual({ rede_id: 'rede-do-daniel' })
    expect(filtro).not.toHaveProperty('loja_id')
  })
})

describe('implantação de contrato de rede — desconto padrão de 20%', () => {
  it('o desconto vigente é 20%', () => {
    // Trava o valor negociado: se este teste quebrar, é porque a política
    // mudou em contratoRede.ts sem atualizar o teste — não o contrário.
    expect(DESCONTO_IMPLANTACAO_REDE).toBe(0.20)
  })

  it('valor por loja com taxa cheia de R$300 vira R$240 (20% de desconto)', () => {
    expect(valorImplantacaoPorLojaRede(300)).toBeCloseTo(240, 2)
  })

  it('total do cenário real — 3 lojas do Daniel: 3 × R$240 = R$720', () => {
    expect(totalImplantacaoRede(300, 3)).toBeCloseTo(720, 2)
  })

  it('total para 1 loja é só o valor por loja', () => {
    expect(totalImplantacaoRede(300, 1)).toBeCloseTo(240, 2)
  })

  it('total para 0 lojas é zero (não deveria acontecer na prática, mas não pode dar NaN)', () => {
    expect(totalImplantacaoRede(300, 0)).toBe(0)
  })

  it('funciona para uma taxa base diferente de 300, não fica com o número fixo por acidente', () => {
    expect(valorImplantacaoPorLojaRede(100)).toBeCloseTo(80, 2)
    expect(totalImplantacaoRede(100, 3)).toBeCloseTo(240, 2)
  })
})

describe('resumoImplantacao — usado pela tela pública de resumo (publico-obter)', () => {
  it('contrato de rede (lojas_incluidas com 3 itens): desconto aplicado, total = 3 × R$240', () => {
    const lojasIncluidas = [loja({ loja_id: 'a' }), loja({ loja_id: 'b' }), loja({ loja_id: 'c' })]
    const r = resumoImplantacao(300, lojasIncluidas)
    expect(r.qtd_lojas).toBe(3)
    expect(r.por_loja).toBeCloseTo(240, 2)
    expect(r.total).toBeCloseTo(720, 2)
  })

  it('contrato de rede com 1 loja só: ainda aplica o desconto de rede (240), não vira o fluxo individual', () => {
    const r = resumoImplantacao(300, [loja({ loja_id: 'a' })])
    expect(r.qtd_lojas).toBe(1)
    expect(r.por_loja).toBeCloseTo(240, 2)
    expect(r.total).toBeCloseTo(240, 2)
  })

  it('contrato individual (lojas_incluidas null) — taxa cheia, sem desconto, 1 loja', () => {
    const r = resumoImplantacao(300, null)
    expect(r).toEqual({ por_loja: 300, qtd_lojas: 1, total: 300 })
  })

  it('contrato individual (lojas_incluidas undefined) — mesmo resultado que null', () => {
    const r = resumoImplantacao(300, undefined)
    expect(r).toEqual({ por_loja: 300, qtd_lojas: 1, total: 300 })
  })

  it('contrato individual (lojas_incluidas array vazio) — tratado como individual, não como rede de 0 lojas', () => {
    const r = resumoImplantacao(300, [])
    expect(r).toEqual({ por_loja: 300, qtd_lojas: 1, total: 300 })
  })

  it('por_loja × qtd_lojas sempre bate com total — sem drift de arredondamento pro cenário real', () => {
    const lojasIncluidas = [loja({ loja_id: 'a' }), loja({ loja_id: 'b' }), loja({ loja_id: 'c' })]
    const r = resumoImplantacao(300, lojasIncluidas)
    expect(r.por_loja * r.qtd_lojas).toBeCloseTo(r.total, 2)
  })
})
