import { describe, it, expect } from 'vitest'
import {
  diaISO, entradasPorForma, participacao, totalSaidas, resumoCaixa,
  conferirContagem, jaFechado, contasDeAmanha, urgenciaConta,
} from './caixa'

const HOJE = new Date(2026, 7, 1) // 01/08/2026
const DIA  = '2026-08-01'
const venda = (pgtos, dia = DIA) => ({
  data: `${dia}T12:00:00`,
  forma_pgto: JSON.stringify(pgtos),
})

describe('diaISO', () => {
  it('monta a data local sem passar por toISOString', () => {
    expect(diaISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('entradasPorForma', () => {
  it('soma por forma de pagamento', () => {
    const e = entradasPorForma([
      venda([{ forma: 'Dinheiro', valor: 100 }]),
      venda([{ forma: 'Pix', valor: 50 }]),
      venda([{ forma: 'Cartão', valor: 30 }]),
    ], DIA)
    expect(e.Dinheiro).toBe(100)
    expect(e.Pix).toBe(50)
    expect(e['Cartão']).toBe(30)
    expect(e.total).toBe(180)
  })

  it('separa fiado e não conta no total do caixa', () => {
    const e = entradasPorForma([
      venda([{ forma: 'Dinheiro', valor: 40 }]),
      venda([{ forma: 'Fiado', valor: 60 }]),
    ], DIA)
    expect(e.fiado).toBe(60)
    expect(e.total).toBe(40)
  })

  it('ignora vendas de outros dias', () => {
    const e = entradasPorForma([
      venda([{ forma: 'Dinheiro', valor: 100 }], '2026-07-31'),
      venda([{ forma: 'Dinheiro', valor: 25 }], DIA),
    ], DIA)
    expect(e.Dinheiro).toBe(25)
  })

  it('aceita venda com mais de uma forma', () => {
    const e = entradasPorForma([venda([
      { forma: 'Dinheiro', valor: 10 }, { forma: 'Pix', valor: 15 },
    ])], DIA)
    expect(e.total).toBe(25)
  })

  it('não quebra sem vendas', () => {
    expect(entradasPorForma([], DIA).total).toBe(0)
    expect(entradasPorForma(null, DIA).total).toBe(0)
  })
})

describe('participacao', () => {
  it('calcula o percentual de cada forma', () => {
    const p = participacao(entradasPorForma([
      venda([{ forma: 'Dinheiro', valor: 50 }]),
      venda([{ forma: 'Pix', valor: 50 }]),
    ], DIA))
    expect(p.find(x => x.forma === 'Dinheiro').pct).toBe(50)
    expect(p.find(x => x.forma === 'Pix').pct).toBe(50)
    expect(p.find(x => x.forma === 'Cartão').pct).toBe(0)
  })

  it('devolve 0% sem vendas, sem dividir por zero', () => {
    expect(participacao(entradasPorForma([], DIA)).every(x => x.pct === 0)).toBe(true)
  })
})

describe('totalSaidas', () => {
  it('soma só as saídas do dia', () => {
    const saidas = [
      { valor: 20, data: DIA }, { valor: 30, data: DIA },
      { valor: 999, data: '2026-07-30' },
    ]
    expect(totalSaidas(saidas, DIA)).toBe(50)
  })

  it('devolve 0 sem saídas', () => {
    expect(totalSaidas([], DIA)).toBe(0)
    expect(totalSaidas(null, DIA)).toBe(0)
  })
})

describe('resumoCaixa', () => {
  it('calcula entrou, saiu e sobrou', () => {
    const r = resumoCaixa(
      [venda([{ forma: 'Dinheiro', valor: 200 }]), venda([{ forma: 'Pix', valor: 100 }])],
      [{ valor: 50, data: DIA }],
      DIA,
    )
    expect(r.entrou).toBe(300)
    expect(r.saiu).toBe(50)
    expect(r.sobrou).toBe(250)
  })

  it('dinheiroEsperado considera só a espécie, menos as saídas', () => {
    const r = resumoCaixa(
      [venda([{ forma: 'Dinheiro', valor: 200 }]), venda([{ forma: 'Pix', valor: 500 }])],
      [{ valor: 50, data: DIA }],
      DIA,
    )
    // Pix não está na gaveta: 200 − 50
    expect(r.dinheiroEsperado).toBe(150)
  })
})

describe('conferirContagem', () => {
  it('acusa sobra e falta', () => {
    expect(conferirContagem(150, 170).diferenca).toBe(20)
    expect(conferirContagem(150, 130).diferenca).toBe(-20)
  })

  it('considera conferido quando bate', () => {
    const r = conferirContagem(150, 150)
    expect(r.diferenca).toBe(0)
    expect(r.bate).toBe(true)
  })

  it('devolve null sem valor contado', () => {
    expect(conferirContagem(150, '').diferenca).toBeNull()
    expect(conferirContagem(150, null).diferenca).toBeNull()
  })
})

describe('jaFechado', () => {
  it('detecta fechamento existente para o dia', () => {
    expect(jaFechado([{ data: DIA }], DIA)).toBe(true)
    expect(jaFechado([{ data: '2026-07-31' }], DIA)).toBe(false)
    expect(jaFechado([], DIA)).toBe(false)
  })
})

describe('contasDeAmanha', () => {
  it('pega só as que vencem amanhã e não estão pagas', () => {
    const contas = [
      { descricao: 'Luz',      data_vencimento: '2026-08-02', status: 'pendente' },
      { descricao: 'Paga',     data_vencimento: '2026-08-02', status: 'pago' },
      { descricao: 'Depois',   data_vencimento: '2026-08-05', status: 'pendente' },
    ]
    const r = contasDeAmanha(contas, HOJE)
    expect(r.map(c => c.descricao)).toEqual(['Luz'])
  })
})

describe('urgenciaConta', () => {
  it('classifica por proximidade do vencimento', () => {
    expect(urgenciaConta({ data_vencimento: '2026-07-30' }, HOJE)).toBe('vencido')
    expect(urgenciaConta({ data_vencimento: '2026-08-01' }, HOJE)).toBe('breve')
    expect(urgenciaConta({ data_vencimento: '2026-08-04' }, HOJE)).toBe('breve')
    expect(urgenciaConta({ data_vencimento: '2026-08-05' }, HOJE)).toBe('normal')
  })

  it('cai em normal sem data', () => {
    expect(urgenciaConta({}, HOJE)).toBe('normal')
  })
})
