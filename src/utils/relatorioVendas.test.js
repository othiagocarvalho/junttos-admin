import { describe, it, expect } from 'vitest'
import { filtrarPorPeriodo, totaisDoPeriodo, porFormaPgto, porDia } from './relatorioVendas'

const v = (data, valor, forma, produtos = []) => ({
  data, valor,
  forma_pgto: forma === null ? null : JSON.stringify([{ forma, valor }]),
  produtos,
})

const VENDAS = [
  v('2026-08-18T09:00:00', 100, 'Dinheiro', [{ nome: 'Arroz', quantidade: 2 }]),
  v('2026-08-18T15:30:00',  50, 'Pix',      [{ nome: 'Feijão', quantidade: 1 }]),
  v('2026-08-19T10:00:00',  30, 'Fiado',    [{ nome: 'Nescau', quantidade: 3 }]),
  v('2026-08-25T10:00:00', 999, 'Cartão',   [{ nome: 'Fora do período', quantidade: 1 }]),
]

describe('filtrarPorPeriodo', () => {
  it('inclui o dia final inteiro, não só a meia-noite', () => {
    const r = filtrarPorPeriodo(VENDAS, '2026-08-18', '2026-08-18')
    expect(r).toHaveLength(2)          // 09:00 e 15:30 do mesmo dia
  })

  it('inclui as duas pontas do intervalo', () => {
    expect(filtrarPorPeriodo(VENDAS, '2026-08-18', '2026-08-19')).toHaveLength(3)
  })

  it('período incompleto devolve vazio, não a lista toda', () => {
    expect(filtrarPorPeriodo(VENDAS, '', '2026-08-19')).toEqual([])
    expect(filtrarPorPeriodo(VENDAS, '2026-08-18', '')).toEqual([])
    expect(filtrarPorPeriodo(VENDAS)).toEqual([])
  })

  it('lista vazia não quebra', () => {
    expect(filtrarPorPeriodo([], '2026-08-18', '2026-08-19')).toEqual([])
  })
})

describe('totaisDoPeriodo', () => {
  it('soma faturamento, conta vendas e calcula ticket médio', () => {
    const r = totaisDoPeriodo(filtrarPorPeriodo(VENDAS, '2026-08-18', '2026-08-19'))
    expect(r.total).toBe(180)
    expect(r.quantidade).toBe(3)
    expect(r.ticketMedio).toBe(60)
  })

  it('conta itens pela quantidade, não pelo número de linhas', () => {
    const r = totaisDoPeriodo(filtrarPorPeriodo(VENDAS, '2026-08-18', '2026-08-19'))
    expect(r.itens).toBe(6)            // 2 + 1 + 3
  })

  it('período sem venda: tudo zero e sem divisão por zero', () => {
    const r = totaisDoPeriodo([])
    expect(r).toEqual({ total: 0, quantidade: 0, ticketMedio: 0, itens: 0 })
  })

  it('item sem quantidade conta como 1', () => {
    expect(totaisDoPeriodo([v('2026-08-18T09:00:00', 10, 'Pix', [{ nome: 'X' }])]).itens).toBe(1)
  })
})

describe('porFormaPgto', () => {
  it('agrupa por forma e ordena da maior para a menor', () => {
    const r = porFormaPgto(filtrarPorPeriodo(VENDAS, '2026-08-18', '2026-08-19'))
    expect(r.map(x => x.forma)).toEqual(['Dinheiro', 'Pix', 'Fiado'])
    expect(r[0].valor).toBe(100)
  })

  it('percentual fecha em 100', () => {
    const r = porFormaPgto(filtrarPorPeriodo(VENDAS, '2026-08-18', '2026-08-19'))
    expect(Math.round(r.reduce((s, x) => s + x.pct, 0))).toBe(100)
  })

  it('soma a mesma forma vinda de vendas diferentes', () => {
    const r = porFormaPgto([
      v('2026-08-18T09:00:00', 10, 'Pix'),
      v('2026-08-18T10:00:00', 15, 'Pix'),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].valor).toBe(25)
  })

  it('venda com forma_pgto em string solta (formato antigo) entra igual', () => {
    const r = porFormaPgto([{ data: '2026-08-18T09:00:00', valor: 40, forma_pgto: 'Dinheiro' }])
    expect(r[0]).toMatchObject({ forma: 'Dinheiro', valor: 40 })
  })

  it('venda sem forma de pagamento não quebra nem inventa linha', () => {
    expect(porFormaPgto([v('2026-08-18T09:00:00', 40, null)])).toEqual([])
  })

  it('aceita as formas do Mercado, que são diferentes das da Moda', () => {
    const r = porFormaPgto([
      v('2026-08-18T09:00:00', 10, 'Fiado'),
      v('2026-08-18T10:00:00', 20, 'Cartão'),
    ])
    expect(r.map(x => x.forma).sort()).toEqual(['Cartão', 'Fiado'])
  })
})

describe('porDia', () => {
  it('agrupa por dia em ordem cronológica', () => {
    const r = porDia(filtrarPorPeriodo(VENDAS, '2026-08-18', '2026-08-19'))
    expect(r).toHaveLength(2)
    expect(r[0].total).toBe(150)     // duas vendas do dia 18
    expect(r[1].total).toBe(30)
    expect(r[0].chave < r[1].chave).toBe(true)
  })

  it('sem venda, devolve vazio', () => {
    expect(porDia([])).toEqual([])
  })
})
