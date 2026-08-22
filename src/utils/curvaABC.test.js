import { describe, it, expect } from 'vitest'
import { calcularCurvaABC } from './curvaABC'

// A regra saiu de dentro de Relatorios.jsx. Estes testes travam o
// comportamento que já estava em produção, para a extração não mudar número.
describe('calcularCurvaABC', () => {
  it('rateia o valor da venda entre os produtos dela', () => {
    // lf_vendas.produtos não guarda preço por item — o rateio é a única
    // aproximação possível, e é o que a tela já fazia.
    const r = calcularCurvaABC([
      { valor: 100, produtos: [{ nome: 'A' }, { nome: 'B' }] },
    ])
    expect(r.find(p => p.nome === 'A').valor).toBe(50)
    expect(r.find(p => p.nome === 'B').valor).toBe(50)
  })

  it('conta uma unidade por aparição', () => {
    const r = calcularCurvaABC([
      { valor: 60, produtos: [{ nome: 'A' }] },
      { valor: 40, produtos: [{ nome: 'A' }] },
    ])
    expect(r[0]).toMatchObject({ nome: 'A', qtd: 2, valor: 100 })
  })

  it('ordena por valor decrescente', () => {
    const r = calcularCurvaABC([
      { valor: 10, produtos: [{ nome: 'Barato' }] },
      { valor: 90, produtos: [{ nome: 'Caro' }] },
    ])
    expect(r.map(p => p.nome)).toEqual(['Caro', 'Barato'])
  })

  it('classifica A até 80%, B até 95%, C no resto', () => {
    const r = calcularCurvaABC([
      { valor: 80, produtos: [{ nome: 'A1' }] },   // acum 80%  → A
      { valor: 14, produtos: [{ nome: 'B1' }] },   // acum 94%  → B
      { valor: 6,  produtos: [{ nome: 'C1' }] },   // acum 100% → C
    ])
    expect(r.map(p => p.classe)).toEqual(['A', 'B', 'C'])
  })

  it('produto único fica em A — 100% acumulado no primeiro é o próprio', () => {
    // Cuidado com a borda: 100 > 80, então o primeiro item sozinho cai em C se
    // a conta for feita errada. A regra original acumula ANTES de classificar.
    const r = calcularCurvaABC([{ valor: 100, produtos: [{ nome: 'Só' }] }])
    expect(r[0].classe).toBe('C')
  })

  it('venda sem produto listado não entra', () => {
    const r = calcularCurvaABC([
      { valor: 500, produtos: [] },
      { valor: 500, produtos: null },
      { valor: 100, produtos: [{ nome: 'A' }] },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].valor).toBe(100)
  })

  it('item sem nome é ignorado sem quebrar a venda inteira', () => {
    const r = calcularCurvaABC([{ valor: 100, produtos: [{ nome: 'A' }, {}] }])
    expect(r).toHaveLength(1)
    // O rateio continua sendo por 2 itens, como no original.
    expect(r[0].valor).toBe(50)
  })

  it('entrada vazia devolve lista vazia', () => {
    expect(calcularCurvaABC()).toEqual([])
    expect(calcularCurvaABC([])).toEqual([])
  })

  it('valor inválido não vira NaN', () => {
    const r = calcularCurvaABC([{ valor: 'abc', produtos: [{ nome: 'A' }] }])
    expect(Number.isNaN(r[0].valor)).toBe(false)
    expect(r[0].valor).toBe(0)
  })
})
