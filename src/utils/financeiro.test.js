import { describe, it, expect } from 'vitest'
import {
  calcularStatusReal,
  mesclarContasReceber,
  calcularFluxoCaixa,
  calcularDRE,
  mesAtualRange,
  navegarMes,
} from './financeiro.js'

// ── calcularStatusReal ────────────────────────────────────────────
describe('calcularStatusReal', () => {
  it('item já pago retorna "pago"', () => {
    expect(calcularStatusReal({ status: 'pago', data_vencimento: '2026-01-01' }, 'data_pagamento')).toBe('pago')
  })

  it('item já recebido retorna "recebido"', () => {
    expect(calcularStatusReal({ status: 'recebido', data_vencimento: '2026-01-01' }, 'data_recebimento')).toBe('recebido')
  })

  it('vencimento no passado sem pagamento retorna "atrasado"', () => {
    const item = { status: 'pendente', data_vencimento: '2020-01-01', data_pagamento: null }
    expect(calcularStatusReal(item, 'data_pagamento')).toBe('atrasado')
  })

  it('vencimento no futuro retorna "pendente"', () => {
    const item = { status: 'pendente', data_vencimento: '2099-12-31', data_pagamento: null }
    expect(calcularStatusReal(item, 'data_pagamento')).toBe('pendente')
  })
})

// ── mesclarContasReceber ─────────────────────────────────────────
describe('mesclarContasReceber', () => {
  it('conta manual pendente aparece na lista mesclada com _origem=manual', () => {
    const manual = [{ id: '1', descricao: 'Reembolso', valor: 500, data_vencimento: '2099-12-01', status: 'pendente', origem: 'manual' }]
    const result = mesclarContasReceber(manual, [])
    expect(result).toHaveLength(1)
    expect(result[0]._origem).toBe('manual')
    expect(result[0]._status).toBe('pendente')
  })

  it('parcela de crediário em aberto aparece como linha virtual com _origem=crediario', () => {
    const crediario = [{
      id: 'cr1', cliente_nome: 'Maria', valor_total: 300, parcelas: 3, valor_parcela: 100,
      data_compra: '2099-01-01', parcelas_pagas: 0, status: 'aberto',
    }]
    const result = mesclarContasReceber([], crediario)
    expect(result.length).toBe(3)
    expect(result.every(r => r._origem === 'crediario')).toBe(true)
  })

  it('parcela com data estimada no passado tem _status=atrasado', () => {
    const crediario = [{
      id: 'cr1', cliente_nome: 'Maria', valor_total: 300, parcelas: 1, valor_parcela: 300,
      data_compra: '2020-01-01', parcelas_pagas: 0, status: 'aberto',
    }]
    const result = mesclarContasReceber([], crediario)
    expect(result[0]._status).toBe('atrasado')
  })

  it('parcela com data estimada no futuro tem _status=pendente', () => {
    const crediario = [{
      id: 'cr1', cliente_nome: 'Maria', valor_total: 300, parcelas: 1, valor_parcela: 300,
      data_compra: '2099-01-01', parcelas_pagas: 0, status: 'aberto',
    }]
    const result = mesclarContasReceber([], crediario)
    expect(result[0]._status).toBe('pendente')
  })

  it('crediário quitado NÃO gera nenhuma linha virtual', () => {
    const crediario = [{
      id: 'cr1', cliente_nome: 'Maria', valor_total: 300, parcelas: 3, valor_parcela: 100,
      data_compra: '2026-01-01', parcelas_pagas: 3, status: 'quitado',
    }]
    const result = mesclarContasReceber([], crediario)
    expect(result).toHaveLength(0)
  })

  it('soma das linhas virtuais NÃO recebidas = (parcelas - parcelas_pagas) × valor_parcela', () => {
    const crediario = [{
      id: 'cr1', cliente_nome: 'Maria', valor_total: 600, parcelas: 3, valor_parcela: 200,
      data_compra: '2099-01-01', parcelas_pagas: 1, status: 'aberto',
    }]
    const result = mesclarContasReceber([], crediario)
    const naoPagas = result.filter(r => r._status !== 'recebido')
    const total = naoPagas.reduce((s, r) => s + r.valor, 0)
    // 3 parcelas − 1 paga = 2 pendentes × R$200 = R$400
    expect(total).toBe(400)
  })

  it('mescla manual + crediário e ordena por data_vencimento', () => {
    const manual = [{ id: 'm1', descricao: 'Aluguel', valor: 100, data_vencimento: '2099-06-01', status: 'pendente' }]
    const crediario = [{
      id: 'cr1', cliente_nome: 'João', valor_total: 200, parcelas: 1, valor_parcela: 200,
      data_compra: '2099-01-01', parcelas_pagas: 0, status: 'aberto',
    }]
    const result = mesclarContasReceber(manual, crediario)
    expect(result).toHaveLength(2)
    // devem estar ordenados por data_vencimento
    expect(result[0].data_vencimento <= result[1].data_vencimento).toBe(true)
  })
})

// ── calcularDRE ──────────────────────────────────────────────────
describe('calcularDRE', () => {
  const inicio = '2026-07-01'
  const fim    = '2026-07-31'

  it('receita bruta = soma das vendas no período', () => {
    const vendas = [
      { data: '2026-07-10T10:00:00', valor: 600 },
      { data: '2026-07-20T10:00:00', valor: 400 },
      { data: '2026-06-30T10:00:00', valor: 999 }, // fora do período
    ]
    const { receitaBruta } = calcularDRE(vendas, [], [], inicio, fim)
    expect(receitaBruta).toBe(1000)
  })

  it('crediário NÃO afeta receita bruta (DRE receitaBruta vem só de lf_vendas)', () => {
    const vendas = [{ data: '2026-07-10T10:00:00', valor: 1000 }]
    // Passar linha virtual de crediário em contasReceber não deve alterar receitaBruta
    const crLinha = [{ valor: 999, status: 'recebido', data_recebimento: '2026-07-10', origem: 'crediario' }]
    const { receitaBruta } = calcularDRE(vendas, [], crLinha, inicio, fim)
    expect(receitaBruta).toBe(1000)
  })

  it('despesas agrupadas por categoria corretamente', () => {
    const contas = [
      { status: 'pago', data_pagamento: '2026-07-05', valor: 200, categoria: 'aluguel' },
      { status: 'pago', data_pagamento: '2026-07-10', valor: 100, categoria: 'aluguel' },
      { status: 'pago', data_pagamento: '2026-07-15', valor: 50,  categoria: 'energia' },
    ]
    const { despesasPorCategoria, totalDespesas } = calcularDRE([], contas, [], inicio, fim)
    expect(totalDespesas).toBe(350)
    const aluguel = despesasPorCategoria.find(d => d.categoria === 'aluguel')
    const energia = despesasPorCategoria.find(d => d.categoria === 'energia')
    expect(aluguel.total).toBe(300)
    expect(energia.total).toBe(50)
  })

  it('conta com status=pendente NÃO entra nas despesas do DRE', () => {
    const contas = [
      { status: 'pago',     data_pagamento: '2026-07-05', valor: 300, categoria: 'outros' },
      { status: 'pendente', data_vencimento: '2026-07-20', valor: 700, categoria: 'outros' },
    ]
    const { totalDespesas } = calcularDRE([], contas, [], inicio, fim)
    expect(totalDespesas).toBe(300)
  })

  it('resultado líquido = receita - despesas (caso redondo: 1000 - 300 = 700)', () => {
    const vendas = [{ data: '2026-07-10T10:00:00', valor: 1000 }]
    const contas = [{ status: 'pago', data_pagamento: '2026-07-10', valor: 300, categoria: 'outros' }]
    const { resultadoLiquido, margemPercentual } = calcularDRE(vendas, contas, [], inicio, fim)
    expect(resultadoLiquido).toBe(700)
    expect(margemPercentual).toBeCloseTo(70, 1)
  })

  it('conta fora do período (data_pagamento fora do range) não entra nas despesas', () => {
    const contas = [
      { status: 'pago', data_pagamento: '2026-06-30', valor: 500, categoria: 'outros' }, // fora
      { status: 'pago', data_pagamento: '2026-07-01', valor: 100, categoria: 'outros' }, // dentro
    ]
    const { totalDespesas } = calcularDRE([], contas, [], inicio, fim)
    expect(totalDespesas).toBe(100)
  })

  it('conta a receber manual recebida no período soma em outrasReceitas sem alterar receitaBruta', () => {
    const vendas = [{ data: '2026-07-10T10:00:00', valor: 800 }]
    const contasReceber = [{ valor: 200, status: 'recebido', data_recebimento: '2026-07-15', origem: 'manual' }]
    const { receitaBruta, outrasReceitas, resultadoLiquido } = calcularDRE(vendas, [], contasReceber, inicio, fim)
    expect(receitaBruta).toBe(800)      // vendas não mudam
    expect(outrasReceitas).toBe(200)    // receita manual isolada
    expect(resultadoLiquido).toBe(1000) // 800 + 200 − 0 despesas
  })

  it('conta a receber com origem=crediario NÃO entra em outrasReceitas', () => {
    const contasReceber = [{ valor: 500, status: 'recebido', data_recebimento: '2026-07-15', origem: 'crediario' }]
    const { outrasReceitas } = calcularDRE([], [], contasReceber, inicio, fim)
    expect(outrasReceitas).toBe(0)
  })

  it('outrasReceitas fora do período não contam', () => {
    const contasReceber = [
      { valor: 100, status: 'recebido', data_recebimento: '2026-06-30', origem: 'manual' }, // fora
      { valor: 50,  status: 'recebido', data_recebimento: '2026-07-01', origem: 'manual' }, // dentro
    ]
    const { outrasReceitas } = calcularDRE([], [], contasReceber, inicio, fim)
    expect(outrasReceitas).toBe(50)
  })
})

// ── calcularFluxoCaixa ───────────────────────────────────────────
describe('calcularFluxoCaixa', () => {
  const inicio = '2026-07-01'
  const fim    = '2026-07-31'

  it('vendas no período entram como entradas', () => {
    const vendas = [{ data: '2026-07-10T10:00:00', valor: 500 }]
    const dias = calcularFluxoCaixa(vendas, [], [], inicio, fim)
    const totalEntradas = dias.reduce((s, d) => s + d.entradas, 0)
    expect(totalEntradas).toBe(500)
  })

  it('conta recebida (data_recebimento) no período entra como entrada', () => {
    const cr = [{ data_recebimento: '2026-07-15', valor: 200, _status: 'recebido' }]
    const dias = calcularFluxoCaixa([], [], cr, inicio, fim)
    const totalEntradas = dias.reduce((s, d) => s + d.entradas, 0)
    expect(totalEntradas).toBe(200)
  })

  it('conta paga (data_pagamento) no período entra como saída', () => {
    const cp = [{ data_pagamento: '2026-07-10', valor: 150, status: 'pago' }]
    const dias = calcularFluxoCaixa([], cp, [], inicio, fim)
    const totalSaidas = dias.reduce((s, d) => s + d.saidas, 0)
    expect(totalSaidas).toBe(150)
  })

  it('saldo negativo quando saídas > entradas', () => {
    const vendas = [{ data: '2026-07-10T10:00:00', valor: 100 }]
    const cp     = [{ data_pagamento: '2026-07-10', valor: 300, status: 'pago' }]
    const dias   = calcularFluxoCaixa(vendas, cp, [], inicio, fim)
    const saldoFinal = dias[dias.length - 1].saldoAcumulado
    expect(saldoFinal).toBeLessThan(0)
    expect(saldoFinal).toBe(-200)
  })

  it('conta sem data_recebimento não conta como entrada (só realizado)', () => {
    const cr = [{ valor: 300, _status: 'pendente', data_recebimento: null }]
    const dias = calcularFluxoCaixa([], [], cr, inicio, fim)
    const totalEntradas = dias.reduce((s, d) => s + d.entradas, 0)
    expect(totalEntradas).toBe(0)
  })

  it('retorna array vazio quando não há movimentos no período', () => {
    const dias = calcularFluxoCaixa([], [], [], inicio, fim)
    expect(dias).toHaveLength(0)
  })

  it('saldoAcumulado cresce corretamente ao longo dos dias', () => {
    const vendas = [
      { data: '2026-07-01T10:00:00', valor: 100 },
      { data: '2026-07-02T10:00:00', valor: 200 },
    ]
    const dias = calcularFluxoCaixa(vendas, [], [], inicio, fim)
    expect(dias[0].saldoAcumulado).toBe(100)
    expect(dias[1].saldoAcumulado).toBe(300)
  })
})

// ── mesAtualRange ────────────────────────────────────────────────
describe('mesAtualRange', () => {
  it('retorna o primeiro e último dia do mês corrente', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    const { inicio, fim } = mesAtualRange()
    expect(inicio).toBe(`${y}-${m}-01`)
    expect(fim).toBe(ultimoDia)
  })

  it('label é uma string não vazia', () => {
    const { label } = mesAtualRange()
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
  })
})

// ── navegarMes ───────────────────────────────────────────────────
describe('navegarMes', () => {
  it('avança um mês corretamente', () => {
    const { inicio } = navegarMes('2026-07-01', 1)
    expect(inicio).toBe('2026-08-01')
  })

  it('avança em dezembro (virada de ano: dez → jan)', () => {
    const { inicio, fim } = navegarMes('2026-12-01', 1)
    expect(inicio).toBe('2027-01-01')
    expect(fim).toBe('2027-01-31')
  })

  it('volta um mês corretamente', () => {
    const { inicio } = navegarMes('2026-07-01', -1)
    expect(inicio).toBe('2026-06-01')
  })

  it('volta em janeiro (virada de ano: jan → dez)', () => {
    const { inicio, fim } = navegarMes('2026-01-01', -1)
    expect(inicio).toBe('2025-12-01')
    expect(fim).toBe('2025-12-31')
  })

  it('avança mais de um mês de uma vez', () => {
    const { inicio } = navegarMes('2026-01-01', 6)
    expect(inicio).toBe('2026-07-01')
  })
})
