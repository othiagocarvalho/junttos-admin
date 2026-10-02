import { describe, it, expect } from 'vitest'
import { derivarModoFechamento, valoresDoFechamentoSalvo, somarRecebimentos } from './Fechamento.jsx'
import {
  camposFormasCadastradas, camposDoFechamentoSalvo, totaisPorLinha, separarFormasDoSalvo,
} from '../../utils/fechamentoFormas'

// Como o Fechamento monta o que cada campo mostra num fechamento salvo.
const valoresExibidosDoSalvo = salvo => separarFormasDoSalvo(valoresDoFechamentoSalvo(salvo), salvo)

const HOJE = '2026-09-20'
const ONTEM = '2026-09-19'

const fechamentoOntem = {
  id: 'c1', data: ONTEM,
  dinheiro: 100, pix: 50, debito: 20, credito: 10,
  saldo_ini: 30, sangria: 5, suprimento: 0,
  valor_contado: 125, diferenca: 0,
  despesas: 8, obs: 'tudo certo', total: 180,
}

describe('derivarModoFechamento', () => {
  it('modo consulta: fechamento salvo para a data + dono (não gerente)', () => {
    const r = derivarModoFechamento([fechamentoOntem], ONTEM, HOJE, false)
    expect(r.jaDuplicado).toBe(true)
    expect(r.modoConsulta).toBe(true)
    expect(r.fechamentoSalvo).toBe(fechamentoOntem)
    expect(r.semFechamentoRetroativo).toBe(false)
  })

  it('aviso de estimativa: data passada SEM fechamento salvo + dono', () => {
    const r = derivarModoFechamento([fechamentoOntem], '2026-09-18', HOJE, false)
    expect(r.jaDuplicado).toBe(false)
    expect(r.modoConsulta).toBe(false)
    expect(r.fechamentoSalvo).toBeNull()
    expect(r.semFechamentoRetroativo).toBe(true)
  })

  it('hoje NUNCA mostra o aviso de estimativa, mesmo sem fechamento salvo', () => {
    const r = derivarModoFechamento([fechamentoOntem], HOJE, HOJE, false)
    expect(r.jaDuplicado).toBe(false)
    expect(r.semFechamentoRetroativo).toBe(false)
  })

  it('hoje não entra em modo consulta mesmo se por algum motivo já tiver um fechamento salvo', () => {
    const fechamentoHoje = { ...fechamentoOntem, id: 'c2', data: HOJE }
    const r = derivarModoFechamento([fechamentoHoje], HOJE, HOJE, false)
    // jaDuplicado é true (existe registro) — o bloqueio de "não pode fechar 2x" continua valendo — mas modoConsulta também liga, pois é sobre EXIBIR o fechamento salvo, não sobre a data ser hoje ou não.
    expect(r.jaDuplicado).toBe(true)
    expect(r.modoConsulta).toBe(true)
  })

  it('gerente NUNCA vê modo consulta, mesmo com fechamento salvo na data', () => {
    const r = derivarModoFechamento([fechamentoOntem], ONTEM, HOJE, true)
    expect(r.jaDuplicado).toBe(true)
    expect(r.modoConsulta).toBe(false)
  })

  it('gerente NUNCA vê o aviso de estimativa em data retroativa sem fechamento', () => {
    const r = derivarModoFechamento([fechamentoOntem], '2026-09-18', HOJE, true)
    expect(r.jaDuplicado).toBe(false)
    expect(r.semFechamentoRetroativo).toBe(false)
  })

  it('sem nenhum caixa cadastrado, não quebra (lista vazia/undefined)', () => {
    expect(derivarModoFechamento([], HOJE, HOJE, false).fechamentoSalvo).toBeNull()
    expect(derivarModoFechamento(undefined, HOJE, HOJE, false).fechamentoSalvo).toBeNull()
  })
})

describe('valoresDoFechamentoSalvo', () => {
  it('retorna os valores REAIS do registro salvo — não é o mesmo caminho do auto-fill de vendas', () => {
    // A função nem recebe `vendas` como argumento: estruturalmente não tem
    // como misturar auto-fill com o fechamento salvo.
    const v = valoresDoFechamentoSalvo(fechamentoOntem)
    expect(v).toEqual({
      dinheiro: 100, pix: 50, debito: 20, credito: 10,
      saldo_ini: 30, sangria: 5, suprimento: 0,
      valor_contado: 125,
      despesas: 8,
    })
  })

  it('valor_contado ausente (fechamento fechado sem conferência de caixa) vira string vazia, não 0', () => {
    const semConferencia = { ...fechamentoOntem, valor_contado: null }
    const v = valoresDoFechamentoSalvo(semConferencia)
    expect(v.valor_contado).toBe('')
  })

  it('campos nulos/ausentes do banco caem para 0, não para NaN', () => {
    const incompleto = { data: ONTEM, dinheiro: null, pix: undefined, debito: 0, credito: 5 }
    const v = valoresDoFechamentoSalvo(incompleto)
    expect(v.dinheiro).toBe(0)
    expect(v.pix).toBe(0)
    expect(v.saldo_ini).toBe(0)
    expect(Number.isNaN(v.dinheiro)).toBe(false)
  })

  it('retorna null quando não há fechamento salvo', () => {
    expect(valoresDoFechamentoSalvo(null)).toBeNull()
  })
})

describe('somarRecebimentos', () => {
  const venda = pgtos => ({ forma_pgto: JSON.stringify(pgtos) })
  const config = {
    formas_pagamento: [
      { nome: 'Link de pagamento', conta_como: 'Cartão de Crédito', ativo: true },
      { nome: 'Vale-presente', conta_como: 'nenhum', ativo: true },
      // Removida: vendas antigas nela continuam somando na linha escolhida.
      { nome: 'Cheque', conta_como: 'Dinheiro', ativo: false },
    ],
  }

  it('soma as formas padrão como sempre', () => {
    const t = somarRecebimentos([
      venda([{ forma: 'Dinheiro', valor: 10 }, { forma: 'Pix', valor: 20 }]),
      venda([{ forma: 'Cartão de Débito', valor: 5 }, { forma: 'Cartão de Crédito', valor: 7 }]),
      venda([{ forma: 'PIX Santander', valor: 3 }]),
    ])
    expect(t).toEqual({ dinheiro: 10, pix: 23, debito: 5, credito: 7, foraDoCaixa: 0, porForma: {} })
  })

  it('cada forma cadastrada fica separada, com o valor só das vendas nela', () => {
    const t = somarRecebimentos([
      venda([{ forma: 'Link de pagamento', valor: 100 }]),
      venda([{ forma: 'Link de pagamento', valor: 0.1 }, { forma: 'Pix', valor: 0.2 }]),
      venda([{ forma: 'Vale-presente', valor: 40 }]),
      venda([{ forma: 'Cheque', valor: 15 }]),
    ], config)
    // As formas padrão não recebem nada das cadastradas.
    expect(t).toEqual({
      dinheiro: 0, pix: 0.2, debito: 0, credito: 0, foraDoCaixa: 40,
      porForma: { 'Link de pagamento': 100.1, 'Vale-presente': 40, Cheque: 15 },
    })
  })

  it('junta a forma pelo nome cadastrado, sem diferenciar maiúscula', () => {
    const t = somarRecebimentos([
      venda([{ forma: 'link de pagamento', valor: 10 }]),
      venda([{ forma: 'LINK DE PAGAMENTO ', valor: 5 }]),
    ], config)
    expect(t.porForma).toEqual({ 'Link de pagamento': 15 })
  })

  it('ignora forma desconhecida e config sem a coluna', () => {
    expect(somarRecebimentos([venda([{ forma: 'Boleto', valor: 9 }])], {}))
      .toEqual({ dinheiro: 0, pix: 0, debito: 0, credito: 0, foraDoCaixa: 0, porForma: {} })
  })

  it('venda com forma_pgto quebrado ou vazio não derruba a soma', () => {
    const t = somarRecebimentos([{ forma_pgto: '{quebrado' }, { forma_pgto: null }, venda([{ forma: 'Pix', valor: '12.5' }])], config)
    expect(t.pix).toBe(12.5)
  })
})

describe('camposFormasCadastradas', () => {
  const config = {
    formas_pagamento: [
      { nome: 'PIX Online', conta_como: 'Pix', ativo: true },
      { nome: 'Vale-presente', conta_como: 'nenhum', ativo: true },
      { nome: 'Cheque', conta_como: 'Dinheiro', ativo: false },
    ],
  }

  it('um campo por forma ativa, na ordem do cadastro', () => {
    expect(camposFormasCadastradas(config, {})).toEqual([
      { nome: 'PIX Online', conta_como: 'Pix', chave: 'fp:PIX Online' },
      { nome: 'Vale-presente', conta_como: 'nenhum', chave: 'fp:Vale-presente' },
    ])
  })

  it('forma removida aparece só se teve venda no dia', () => {
    const campos = camposFormasCadastradas(config, { Cheque: 15 })
    expect(campos.map(c => c.nome)).toEqual(['PIX Online', 'Vale-presente', 'Cheque'])
  })

  it('loja sem forma cadastrada: nenhum campo extra', () => {
    for (const cfg of [null, {}, { formas_pagamento: [] }, { formas_pagamento: 'lixo' }]) {
      expect(camposFormasCadastradas(cfg, {})).toEqual([])
    }
  })
})

describe('totaisPorLinha', () => {
  const campos = [
    { nome: 'PIX Online', conta_como: 'Pix', chave: 'fp:PIX Online' },
    { nome: 'Cheque', conta_como: 'Dinheiro', chave: 'fp:Cheque' },
    { nome: 'Vale', conta_como: 'nenhum', chave: 'fp:Vale' },
  ]
  const valores = { dinheiro: 100, pix: 50, debito: 20, credito: 10, 'fp:PIX Online': 30, 'fp:Cheque': 5, 'fp:Vale': 40 }
  const valorDe = k => valores[k] || 0

  it('cada forma cadastrada soma na linha do conta_como; "nenhum" fica de fora', () => {
    expect(totaisPorLinha(campos, valorDe)).toEqual({ dinheiro: 105, pix: 80, debito: 20, credito: 10 })
  })

  it('sem formas cadastradas é o valor dos quatro campos de sempre', () => {
    expect(totaisPorLinha([], valorDe)).toEqual({ dinheiro: 100, pix: 50, debito: 20, credito: 10 })
  })
})

describe('fechamento salvo com formas cadastradas', () => {
  const salvo = {
    ...fechamentoOntem,
    // colunas = total da linha: pix 50 já inclui os 30 do PIX Online
    formas_extras: [
      { nome: 'PIX Online', conta_como: 'Pix', valor: 30 },
      { nome: 'Vale', conta_como: 'nenhum', valor: 40 },
    ],
  }

  it('lê os campos do próprio registro', () => {
    expect(camposDoFechamentoSalvo(salvo)).toEqual([
      { nome: 'PIX Online', conta_como: 'Pix', chave: 'fp:PIX Online', valor: 30 },
      { nome: 'Vale', conta_como: 'nenhum', chave: 'fp:Vale', valor: 40 },
    ])
  })

  it('o campo Pix mostra só a parte do Pix padrão; cada forma, o seu valor', () => {
    const v = valoresExibidosDoSalvo(salvo)
    expect(v.pix).toBe(20)
    expect(v['fp:PIX Online']).toBe(30)
    expect(v['fp:Vale']).toBe(40)
    expect(v.dinheiro).toBe(100)
  })

  it('registro antigo / sem a coluna / lixo: igual a valoresDoFechamentoSalvo', () => {
    for (const fe of [undefined, null, 'lixo', [null, { nome: '' }]]) {
      const r = { ...fechamentoOntem, formas_extras: fe }
      expect(camposDoFechamentoSalvo(r)).toEqual([])
      expect(valoresExibidosDoSalvo(r)).toEqual(valoresDoFechamentoSalvo(r))
    }
    expect(valoresExibidosDoSalvo(null)).toBeNull()
  })
})
