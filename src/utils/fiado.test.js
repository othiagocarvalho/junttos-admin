import { describe, it, expect } from 'vitest'
import {
  analisarConta,
  agruparPorCliente,
  totaisFiado,
  chaveCliente,
  descricaoLancamento,
  PRAZO_PADRAO_DIAS,
} from './fiado'
import { fmtDiaMes, iniciais } from './datas'

const HOJE = new Date(2026, 7, 1) // 01/08/2026
const emDias = n => {
  const d = new Date(HOJE)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const compra    = (valor, dias, extra = {}) => ({ tipo: 'compra',    valor, data: emDias(dias), ...extra })
const pagamento = (valor, dias, extra = {}) => ({ tipo: 'pagamento', valor, data: emDias(dias), ...extra })

describe('analisarConta', () => {
  it('soma compras e abate pagamentos', () => {
    const c = analisarConta([compra(100, -10), pagamento(30, -5), compra(20, -2)], HOJE)
    expect(c.saldo).toBe(90)
    expect(c.devendo).toBe(true)
  })

  it('trata conta quitada como não devendo', () => {
    const c = analisarConta([compra(50, -10), pagamento(50, -1)], HOJE)
    expect(c.saldo).toBe(0)
    expect(c.devendo).toBe(false)
    expect(c.atrasado).toBe(false)
    expect(c.vencimento).toBeNull()
  })

  it('conta o prazo a partir do dia em que passou a dever', () => {
    // comprou há 40 dias, prazo de 30 → 10 dias de atraso
    const c = analisarConta([compra(100, -(PRAZO_PADRAO_DIAS + 10))], HOJE)
    expect(c.atrasado).toBe(true)
    expect(c.diasAtraso).toBe(10)
  })

  it('não considera atrasado dentro do prazo', () => {
    const c = analisarConta([compra(100, -5)], HOJE)
    expect(c.devendo).toBe(true)
    expect(c.atrasado).toBe(false)
    expect(c.diasAtraso).toBe(0)
    expect(fmtDiaMes(c.vencimento)).toBe('26/08') // 27/07 + 30 dias
  })

  it('no dia exato do vencimento ainda não está atrasado', () => {
    const c = analisarConta([compra(100, -PRAZO_PADRAO_DIAS)], HOJE)
    expect(c.atrasado).toBe(false)
    expect(c.diasAtraso).toBe(0)
  })

  it('quem quitou e comprou de novo não carrega o atraso antigo', () => {
    const c = analisarConta([
      compra(200, -90),      // dívida antiga...
      pagamento(200, -80),   // ...quitada
      compra(50, -3),        // compra nova, dentro do prazo
    ], HOJE)
    expect(c.saldo).toBe(50)
    expect(c.atrasado).toBe(false)
    expect(c.diasAtraso).toBe(0)
  })

  it('pagamento parcial mantém a dívida original em curso', () => {
    const c = analisarConta([
      compra(300, -(PRAZO_PADRAO_DIAS + 5)),
      pagamento(100, -2),
    ], HOJE)
    expect(c.saldo).toBe(200)
    expect(c.atrasado).toBe(true)
    expect(c.diasAtraso).toBe(5)
  })

  it('desempata lançamentos do mesmo dia pelo created_at', () => {
    const c = analisarConta([
      { tipo: 'pagamento', valor: 50, data: emDias(-1), created_at: '2026-07-31T18:00:00Z' },
      { tipo: 'compra',    valor: 50, data: emDias(-1), created_at: '2026-07-31T10:00:00Z' },
    ], HOJE)
    expect(c.saldo).toBe(0)
    expect(c.devendo).toBe(false)
  })

  it('não quebra com lista vazia', () => {
    const c = analisarConta([], HOJE)
    expect(c.saldo).toBe(0)
    expect(c.devendo).toBe(false)
  })

  it('não acumula erro de float em centavos', () => {
    const c = analisarConta([compra(0.1, -2), compra(0.2, -1)], HOJE)
    expect(c.saldo).toBe(0.3)
  })
})

describe('chaveCliente', () => {
  it('agrupa pelo vínculo quando existe', () => {
    expect(chaveCliente({ cliente_id: 'abc', cliente_nome: 'Maria' })).toBe('id:abc')
  })

  it('cai no nome normalizado quando não há vínculo', () => {
    expect(chaveCliente({ cliente_nome: '  Maria  ' })).toBe('nome:maria')
    expect(chaveCliente({ cliente_nome: 'MARIA' })).toBe('nome:maria')
  })
})

describe('agruparPorCliente', () => {
  const dados = [
    compra(100, -50, { cliente_nome: 'Ana',   cliente_id: 'a1' }),
    compra(40,  -2,  { cliente_nome: 'Bruno', cliente_id: 'b1' }),
    compra(80,  -35, { cliente_nome: 'Célia', cliente_id: 'c1' }),
    pagamento(80, -1, { cliente_nome: 'Célia', cliente_id: 'c1' }),
  ]

  it('separa por cliente e calcula cada saldo', () => {
    const contas = agruparPorCliente(dados, HOJE)
    const porNome = Object.fromEntries(contas.map(c => [c.cliente_nome, c]))
    expect(porNome.Ana.saldo).toBe(100)
    expect(porNome.Bruno.saldo).toBe(40)
    expect(porNome['Célia'].saldo).toBe(0)
    expect(porNome['Célia'].devendo).toBe(false)
  })

  it('ordena os mais atrasados primeiro', () => {
    const contas = agruparPorCliente(dados, HOJE)
    expect(contas[0].cliente_nome).toBe('Ana') // 20 dias de atraso
  })

  it('junta lançamentos do mesmo cliente sem vínculo pelo nome', () => {
    const contas = agruparPorCliente([
      compra(10, -3, { cliente_nome: 'Zeca' }),
      compra(15, -2, { cliente_nome: 'zeca' }),
    ], HOJE)
    expect(contas).toHaveLength(1)
    expect(contas[0].saldo).toBe(25)
  })
})

describe('totaisFiado', () => {
  it('soma a receber e separa a parte atrasada', () => {
    const contas = agruparPorCliente([
      compra(100, -50, { cliente_nome: 'Ana' }),   // atrasada
      compra(40,  -2,  { cliente_nome: 'Bruno' }), // em dia
    ], HOJE)
    expect(totaisFiado(contas)).toEqual({ aReceber: 140, atrasado: 100 })
  })

  it('ignora quem não está devendo', () => {
    const contas = agruparPorCliente([
      compra(50, -5, { cliente_nome: 'X' }),
      pagamento(50, -1, { cliente_nome: 'X' }),
    ], HOJE)
    expect(totaisFiado(contas)).toEqual({ aReceber: 0, atrasado: 0 })
  })
})

describe('descricaoLancamento', () => {
  it('usa a descrição salva quando existe', () => {
    expect(descricaoLancamento({ tipo: 'compra', descricao: 'Levou 3 itens' })).toBe('Levou 3 itens')
  })

  it('cai num texto natural quando não há descrição', () => {
    expect(descricaoLancamento({ tipo: 'compra' })).toBe('Levou fiado')
    expect(descricaoLancamento({ tipo: 'pagamento', descricao: '  ' })).toBe('Pagou')
  })
})

describe('iniciais', () => {
  it('usa primeiro e último nome', () => {
    expect(iniciais('Maria Silva')).toBe('MS')
    expect(iniciais('Ana Paula de Souza')).toBe('AS')
  })

  it('usa uma letra para nome único', () => {
    expect(iniciais('Ana')).toBe('A')
  })

  it('não quebra com nome vazio', () => {
    expect(iniciais('')).toBe('?')
    expect(iniciais(null)).toBe('?')
  })
})
