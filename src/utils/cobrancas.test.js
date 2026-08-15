import { describe, it, expect } from 'vitest'
import {
  diaISO, deISO, vencimentoNoMes, isLojaAtiva, aplicarDesconto, rotuloDesconto,
  valorCheioMensalidade, cobrancasFaltantes, faltantesDeTodas, geracaoAtrasada,
  statusEfetivo, totaisPorPeriodo, calcularMRR, competencia,
  marcoCobrancaAutomatica,
  TIPO_IMPLANTACAO, TIPO_MENSALIDADE,
} from './cobrancas'

const HOJE = new Date(2026, 7, 15, 12) // 15/08/2026

const loja = (over = {}) => ({
  loja_id: 'lojinha',
  nome: 'Lojinha',
  status: 'ativo',
  plano: 'starter',
  segmento: 'moda',
  vencimento_dia: 10,
  cobranca_automatica_desde: '2026-08-01',
  desconto_tipo: null,
  desconto_valor: null,
  ...over,
})

const cob = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  loja_id: 'lojinha',
  tipo: TIPO_MENSALIDADE,
  valor: 99.9,
  valor_cheio: null,
  vencimento: '2026-08-10',
  status: 'pendente',
  data_pagamento: null,
  ...over,
})

describe('datas', () => {
  it('diaISO usa o fuso local, não UTC', () => {
    // 23h de 31/12 no Brasil vira 01/01 em UTC — o bug que deslocava vencimentos.
    expect(diaISO(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31')
  })

  it('deISO devolve a data ao meio-dia local', () => {
    const d = deISO('2026-03-09')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(9)
  })

  it('vencimentoNoMes encurta o dia em mês curto', () => {
    expect(diaISO(vencimentoNoMes(2026, 1, 31))).toBe('2026-02-28') // fevereiro
    expect(diaISO(vencimentoNoMes(2028, 1, 31))).toBe('2028-02-29') // bissexto
    expect(diaISO(vencimentoNoMes(2026, 3, 31))).toBe('2026-04-30') // abril
  })
})

describe('isLojaAtiva', () => {
  it('aceita ativo em qualquer caixa — o banco tem Ativo e ativo', () => {
    expect(isLojaAtiva('ativo')).toBe(true)
    expect(isLojaAtiva('Ativo')).toBe(true)
    expect(isLojaAtiva(' ATIVO ')).toBe(true)
  })

  it('rejeita Trial, demo e excluida', () => {
    expect(isLojaAtiva('Trial')).toBe(false)
    expect(isLojaAtiva('demo')).toBe(false)
    expect(isLojaAtiva('excluida')).toBe(false)
    expect(isLojaAtiva(null)).toBe(false)
  })
})

describe('marcoCobrancaAutomatica', () => {
  it('loja que nasce ativa começa a ser cobrada hoje', () => {
    expect(marcoCobrancaAutomatica('Ativo', HOJE)).toBe('2026-08-15')
    expect(marcoCobrancaAutomatica('ativo', HOJE)).toBe('2026-08-15')
  })

  it('Trial nasce sem marco — não pode acumular dívida durante o trial', () => {
    // O caso que isto protege: loja fica 3 meses em Trial e só então é ativada.
    // Com o marco na data do cadastro, as 3 mensalidades atrasadas nasceriam
    // todas de uma vez no primeiro load da tela.
    expect(marcoCobrancaAutomatica('Trial', HOJE)).toBeNull()
    expect(marcoCobrancaAutomatica('Inativo', HOJE)).toBeNull()
    expect(marcoCobrancaAutomatica('demo', HOJE)).toBeNull()
  })

  it('loja cadastrada em Trial e ativada depois não gera retroativo', () => {
    const l = loja({ status: 'ativo', vencimento_dia: 10, cobranca_automatica_desde: null })
    expect(cobrancasFaltantes(l, [], HOJE)).toHaveLength(0)
  })
})

describe('aplicarDesconto', () => {
  it('sem desconto devolve o valor', () => {
    expect(aplicarDesconto(99.9, null, null)).toBe(99.9)
    expect(aplicarDesconto(99.9, 'percentual', 0)).toBe(99.9)
  })

  it('percentual e fixo', () => {
    expect(aplicarDesconto(100, 'percentual', 10)).toBe(90)
    expect(aplicarDesconto(99.9, 'percentual', 50)).toBe(49.95)
    expect(aplicarDesconto(100, 'fixo', 25.5)).toBe(74.5)
  })

  it('nunca fica negativo', () => {
    expect(aplicarDesconto(100, 'fixo', 500)).toBe(0)
    expect(aplicarDesconto(100, 'percentual', 150)).toBe(0)
  })

  it('arredonda a 2 casas', () => {
    expect(aplicarDesconto(99.9, 'percentual', 33)).toBe(66.93)
  })

  it('rotuloDesconto descreve em pt-BR', () => {
    expect(rotuloDesconto('percentual', 10)).toBe('10% off')
    expect(rotuloDesconto('fixo', 25.5)).toBe('R$ 25,50 off')
    expect(rotuloDesconto(null, 0)).toBe('')
  })
})

describe('valorCheioMensalidade', () => {
  it('sem cobrança nenhuma, cai na tabela de preço do plano', () => {
    expect(valorCheioMensalidade(loja({ plano: 'business', segmento: 'moda' }), [])).toBe(259.9)
    expect(valorCheioMensalidade(loja({ plano: 'starter', segmento: 'mercado' }), [])).toBe(79.9)
  })

  it('preserva preço negociado da última mensalidade', () => {
    const c = [cob({ valor: 149, vencimento: '2026-07-10' })]
    expect(valorCheioMensalidade(loja(), c)).toBe(149)
  })

  it('usa valor_cheio para não descontar duas vezes', () => {
    const c = [cob({ valor: 49.95, valor_cheio: 99.9, vencimento: '2026-07-10' })]
    expect(valorCheioMensalidade(loja(), c)).toBe(99.9)
  })

  it('ignora a taxa de implantação ao decidir o valor mensal', () => {
    const c = [cob({ tipo: TIPO_IMPLANTACAO, valor: 300, vencimento: '2026-08-14' })]
    expect(valorCheioMensalidade(loja({ plano: 'starter' }), c)).toBe(99.9)
  })
})

describe('cobrancasFaltantes', () => {
  it('gera a mensalidade do mês quando ainda não existe', () => {
    const r = cobrancasFaltantes(loja(), [], HOJE)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      loja_id: 'lojinha', tipo: TIPO_MENSALIDADE,
      vencimento: '2026-08-10', status: 'pendente', valor: 99.9,
    })
  })

  it('não duplica quando o mês já tem mensalidade', () => {
    expect(cobrancasFaltantes(loja(), [cob({ vencimento: '2026-08-10' })], HOJE)).toHaveLength(0)
  })

  it('dedupe é por competência, não por data exata', () => {
    // hmboutique: cobrança legada vence 13/09, vencimento_dia é 14. Sem a
    // checagem por mês, setembro seria cobrado duas vezes.
    const l = loja({ vencimento_dia: 14, cobranca_automatica_desde: '2026-08-01' })
    const existente = [cob({ vencimento: '2026-09-13' })]
    const r = cobrancasFaltantes(l, existente, new Date(2026, 8, 10, 12))
    expect(r.filter(f => f.vencimento.startsWith('2026-09'))).toHaveLength(0)
  })

  it('ignora loja que não é ativa — Trial não entra no ciclo', () => {
    expect(cobrancasFaltantes(loja({ status: 'Trial' }), [], HOJE)).toHaveLength(0)
    expect(cobrancasFaltantes(loja({ status: 'demo' }), [], HOJE)).toHaveLength(0)
  })

  it('ignora loja sem vencimento_dia', () => {
    expect(cobrancasFaltantes(loja({ vencimento_dia: null }), [], HOJE)).toHaveLength(0)
  })

  it('ignora loja sem marco de início — não gera dívida retroativa', () => {
    expect(cobrancasFaltantes(loja({ cobranca_automatica_desde: null }), [], HOJE)).toHaveLength(0)
  })

  it('não gera nada antes do marco de início (caso audazwear)', () => {
    const l = loja({ vencimento_dia: 1, cobranca_automatica_desde: '2026-09-01' })
    expect(cobrancasFaltantes(l, [], HOJE)).toHaveLength(0)
  })

  it('gera a partir do marco, quando ele chega', () => {
    const l = loja({ vencimento_dia: 1, cobranca_automatica_desde: '2026-09-01' })
    const r = cobrancasFaltantes(l, [], new Date(2026, 7, 28, 12)) // 28/08, dentro dos 7 dias
    expect(r).toHaveLength(1)
    expect(r[0].vencimento).toBe('2026-09-01')
  })

  it('respeita a antecedência de 7 dias e não gera meses futuros', () => {
    const l = loja({ vencimento_dia: 28, cobranca_automatica_desde: '2026-08-01' })
    expect(cobrancasFaltantes(l, [], HOJE)).toHaveLength(0) // 28/08 ainda está a 13 dias
    expect(cobrancasFaltantes(l, [], new Date(2026, 7, 22, 12))).toHaveLength(1)
  })

  it('gera o atraso acumulado desde o marco', () => {
    const l = loja({ vencimento_dia: 10, cobranca_automatica_desde: '2026-06-01' })
    const r = cobrancasFaltantes(l, [], HOJE)
    expect(r.map(f => f.vencimento)).toEqual(['2026-06-10', '2026-07-10', '2026-08-10'])
  })

  it('aplica o desconto da loja e guarda o valor cheio', () => {
    const l = loja({ desconto_tipo: 'percentual', desconto_valor: 50 })
    const r = cobrancasFaltantes(l, [], HOJE)
    expect(r[0].valor).toBe(49.95)
    expect(r[0].valor_cheio).toBe(99.9)
  })

  it('sem desconto, valor_cheio fica nulo', () => {
    expect(cobrancasFaltantes(loja(), [], HOJE)[0].valor_cheio).toBeNull()
  })

  it('vira o ano corretamente', () => {
    const l = loja({ vencimento_dia: 5, cobranca_automatica_desde: '2026-12-01' })
    const r = cobrancasFaltantes(l, [], new Date(2027, 0, 20, 12))
    expect(r.map(f => f.vencimento)).toEqual(['2026-12-05', '2027-01-05'])
  })
})

describe('faltantesDeTodas e geracaoAtrasada', () => {
  const lojas = [
    loja({ loja_id: 'a', vencimento_dia: 10 }),
    loja({ loja_id: 'b', status: 'Trial', vencimento_dia: 10 }),
    loja({ loja_id: 'c', vencimento_dia: 28 }),
  ]

  it('só as ativas geram', () => {
    const r = faltantesDeTodas(lojas, [], HOJE)
    expect(r.map(f => f.loja_id)).toEqual(['a'])
  })

  it('atrasada é a que já venceu e não existe', () => {
    expect(geracaoAtrasada(lojas, [], HOJE).map(f => f.loja_id)).toEqual(['a'])
  })

  it('depois de gerada, some do atraso', () => {
    const criada = [cob({ loja_id: 'a', vencimento: '2026-08-10' })]
    expect(geracaoAtrasada(lojas, criada, HOJE)).toHaveLength(0)
  })
})

describe('statusEfetivo', () => {
  it('pago manda', () => {
    expect(statusEfetivo(cob({ status: 'pago', vencimento: '2020-01-01' }), HOJE)).toBe('pago')
  })
  it('vencido vira atrasado', () => {
    expect(statusEfetivo(cob({ vencimento: '2026-08-14' }), HOJE)).toBe('atrasado')
  })
  it('vencendo hoje ainda é pendente', () => {
    expect(statusEfetivo(cob({ vencimento: '2026-08-15' }), HOJE)).toBe('pendente')
  })
})

describe('totaisPorPeriodo', () => {
  const dados = [
    cob({ tipo: TIPO_IMPLANTACAO, valor: 300,  status: 'pago', data_pagamento: '2026-08-03' }),
    cob({ tipo: TIPO_MENSALIDADE, valor: 99.9, status: 'pago', data_pagamento: '2026-08-10' }),
    cob({ tipo: TIPO_MENSALIDADE, valor: 259.9, status: 'pago', data_pagamento: '2026-09-02' }),
    cob({ tipo: TIPO_MENSALIDADE, valor: 149, status: 'pendente', data_pagamento: null }),
  ]

  it('separa por tipo dentro do intervalo', () => {
    const r = totaisPorPeriodo(dados, '2026-08-01', '2026-08-31')
    expect(r.implantacao).toBe(300)
    expect(r.mensalidade).toBe(99.9)
    expect(r.total).toBe(399.9)
    expect(r.qtd).toBe(2)
  })

  it('inclui as bordas do intervalo', () => {
    expect(totaisPorPeriodo(dados, '2026-08-03', '2026-08-03').total).toBe(300)
  })

  it('ignora pendente mesmo com o vencimento dentro do período', () => {
    expect(totaisPorPeriodo(dados, '2026-01-01', '2027-01-01').qtd).toBe(3)
  })

  it('ordena por data de pagamento', () => {
    const r = totaisPorPeriodo(dados, '2026-01-01', '2027-01-01')
    expect(r.pagas.map(c => c.data_pagamento)).toEqual(['2026-08-03', '2026-08-10', '2026-09-02'])
  })
})

describe('calcularMRR', () => {
  const lojas = [
    loja({ loja_id: 'a', status: 'Ativo' }),
    loja({ loja_id: 'b', status: 'Trial' }),
  ]

  it('não conta a taxa de implantação como receita recorrente', () => {
    const dados = [
      cob({ loja_id: 'a', tipo: TIPO_IMPLANTACAO, valor: 300, vencimento: '2026-08-15' }),
      cob({ loja_id: 'a', tipo: TIPO_MENSALIDADE, valor: 99.9, vencimento: '2026-08-15' }),
    ]
    expect(calcularMRR(lojas, dados)).toBe(99.9)
  })

  it('usa a mensalidade mais recente de cada loja ativa', () => {
    const dados = [
      cob({ loja_id: 'a', valor: 99.9, vencimento: '2026-07-10' }),
      cob({ loja_id: 'a', valor: 149,  vencimento: '2026-08-10' }),
      cob({ loja_id: 'b', valor: 259.9, vencimento: '2026-08-10' }),
    ]
    expect(calcularMRR(lojas, dados)).toBe(149) // 'b' é Trial, fica de fora
  })
})

describe('competencia', () => {
  it('extrai ano-mês', () => {
    expect(competencia('2026-08-10')).toBe('2026-08')
    expect(competencia(null)).toBe('')
  })
})
