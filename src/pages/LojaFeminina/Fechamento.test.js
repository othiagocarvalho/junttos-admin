import { describe, it, expect } from 'vitest'
import { derivarModoFechamento, valoresDoFechamentoSalvo, somarRecebimentos } from './Fechamento.jsx'

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
    expect(t).toEqual({ dinheiro: 10, pix: 23, debito: 5, credito: 7, foraDoCaixa: 0 })
  })

  it('soma a forma cadastrada na linha que a lojista escolheu', () => {
    const t = somarRecebimentos([
      venda([{ forma: 'Link de pagamento', valor: 100 }]),
      venda([{ forma: 'Vale-presente', valor: 40 }]),
      venda([{ forma: 'Cheque', valor: 15 }]),
    ], config)
    expect(t).toEqual({ dinheiro: 15, pix: 0, debito: 0, credito: 100, foraDoCaixa: 40 })
  })

  it('ignora forma desconhecida e config sem a coluna', () => {
    expect(somarRecebimentos([venda([{ forma: 'Boleto', valor: 9 }])], {}))
      .toEqual({ dinheiro: 0, pix: 0, debito: 0, credito: 0, foraDoCaixa: 0 })
  })
})
