import { describe, it, expect } from 'vitest'
import {
  normalizeWaPhone,
  diasDesdeUltima,
  isInativo,
  ticketMedioLoja,
  isVip,
  badgeAniversario,
  tamanhoPreferido,
  categoriaFavorita,
  ticketMedioCliente,
  diasParaAniversario,
  gerarSugestoesAuto,
  isDispensado,
  combinarFeed,
} from './crm.js'

// ── normalizeWaPhone ───────────────────────────────────────────
describe('normalizeWaPhone', () => {
  it('retorna null para telefone null', () => {
    expect(normalizeWaPhone(null)).toBeNull()
  })

  it('retorna null para string vazia', () => {
    expect(normalizeWaPhone('')).toBeNull()
  })

  it('formata número formatado "(11) 98765-4321"', () => {
    expect(normalizeWaPhone('(11) 98765-4321')).toBe('5511987654321')
  })

  it('formata número sem formatação "11987654321"', () => {
    expect(normalizeWaPhone('11987654321')).toBe('5511987654321')
  })

  it('preserva número com DDI 55 já incluso (13 dígitos)', () => {
    expect(normalizeWaPhone('5511987654321')).toBe('5511987654321')
  })

  it('preserva número com DDI 55 já incluso (12 dígitos — fixo)', () => {
    expect(normalizeWaPhone('551187654321')).toBe('551187654321')
  })

  it('formata número com + e espaços "+55 (11) 9 8765-4321"', () => {
    expect(normalizeWaPhone('+55 (11) 9 8765-4321')).toBe('5511987654321')
  })

  it('formata número de 10 dígitos (sem nono dígito)', () => {
    expect(normalizeWaPhone('(11) 8765-4321')).toBe('551187654321')
  })
})

// ── diasDesdeUltima ────────────────────────────────────────────
describe('diasDesdeUltima', () => {
  const vendas = [
    { id: 1, cliente_nome: 'Ana Silva', data: '2026-07-01', valor: 100, produtos: [] },
    { id: 2, cliente_nome: 'Ana Silva', data: '2026-06-01', valor: 50,  produtos: [] },
    { id: 3, cliente_nome: 'Bia Costa', data: '2026-07-15', valor: 200, produtos: [] },
  ]

  it('retorna dias corretos desde última compra', () => {
    expect(diasDesdeUltima(vendas, 'Ana Silva', '2026-07-18')).toBe(17)
  })

  it('usa a venda mais recente quando há múltiplas', () => {
    // Ana tem vendas em 07-01 e 06-01; mais recente é 07-01 → 17 dias
    expect(diasDesdeUltima(vendas, 'Ana Silva', '2026-07-18')).toBe(17)
  })

  it('retorna null quando cliente não tem compras', () => {
    expect(diasDesdeUltima(vendas, 'Carlos Ramos', '2026-07-18')).toBeNull()
  })

  it('compara nome de forma case-insensitive', () => {
    expect(diasDesdeUltima(vendas, 'ana silva', '2026-07-18')).toBe(17)
  })

  it('retorna 0 quando última compra é hoje', () => {
    expect(diasDesdeUltima(vendas, 'Bia Costa', '2026-07-15')).toBe(0)
  })
})

// ── isInativo ──────────────────────────────────────────────────
describe('isInativo', () => {
  it('cliente com 47 dias sem compra é inativo', () => {
    const v = [{ id: 1, cliente_nome: 'Ana', data: '2026-06-01', valor: 100 }]
    expect(isInativo(v, 'Ana', '2026-07-18')).toBe(true) // 47 dias
  })

  it('cliente com 8 dias sem compra não é inativo', () => {
    const v = [{ id: 1, cliente_nome: 'Bia', data: '2026-07-10', valor: 200 }]
    expect(isInativo(v, 'Bia', '2026-07-18')).toBe(false) // 8 dias
  })

  it('cliente sem nenhuma compra não é marcado como inativo', () => {
    expect(isInativo([], 'Carlos', '2026-07-18')).toBe(false)
  })

  it('exatamente 45 dias = inativo (limite inclusivo)', () => {
    const v = [{ id: 1, cliente_nome: 'Ana', data: '2026-06-03', valor: 100 }]
    expect(isInativo(v, 'Ana', '2026-07-18')).toBe(true) // 45 dias exatos
  })

  it('44 dias = ativo', () => {
    const v = [{ id: 1, cliente_nome: 'Ana', data: '2026-06-04', valor: 100 }]
    expect(isInativo(v, 'Ana', '2026-07-18')).toBe(false) // 44 dias
  })
})

// ── ticketMedioLoja ────────────────────────────────────────────
describe('ticketMedioLoja', () => {
  const vendas = [
    { id: 1, data: '2026-07-01', valor: 100 },
    { id: 2, data: '2026-07-15', valor: 200 },
    { id: 3, data: '2026-06-20', valor: 50  },
  ]

  it('retorna ticket médio do mês corrente', () => {
    expect(ticketMedioLoja(vendas, '2026-07-18')).toBe(150) // (100+200)/2
  })

  it('retorna 0 quando não há vendas no mês', () => {
    expect(ticketMedioLoja(vendas, '2026-08-01')).toBe(0)
  })

  it('exclui vendas de outros meses', () => {
    expect(ticketMedioLoja(vendas, '2026-06-30')).toBe(50) // só a venda de junho
  })

  it('retorna 0 para array vazio', () => {
    expect(ticketMedioLoja([], '2026-07-18')).toBe(0)
  })
})

// ── isVip ──────────────────────────────────────────────────────
describe('isVip', () => {
  it('totalGasto = 10× ticket médio → VIP', () => {
    expect(isVip(1000, 100)).toBe(true)
  })

  it('totalGasto > 10× ticket médio → VIP', () => {
    expect(isVip(1500, 100)).toBe(true)
  })

  it('totalGasto < 10× ticket médio → não VIP', () => {
    expect(isVip(999, 100)).toBe(false)
  })

  it('ticket médio 0 → não VIP (evita divisão por zero)', () => {
    expect(isVip(99999, 0)).toBe(false)
  })

  it('totalGasto 0 → não VIP', () => {
    expect(isVip(0, 100)).toBe(false)
  })
})

// ── badgeAniversario ───────────────────────────────────────────
describe('badgeAniversario', () => {
  it('retorna "hoje" quando o aniversário é exatamente hoje', () => {
    expect(badgeAniversario('1990-07-18', '2026-07-18')).toBe('hoje')
  })

  it('retorna "mes" quando o aniversário é no mesmo mês mas não hoje', () => {
    expect(badgeAniversario('1990-07-25', '2026-07-18')).toBe('mes')
  })

  it('retorna "mes" para dia anterior ao dia atual (mesmo mês)', () => {
    expect(badgeAniversario('1990-07-01', '2026-07-18')).toBe('mes')
  })

  it('retorna null quando o aniversário é em outro mês', () => {
    expect(badgeAniversario('1990-08-18', '2026-07-18')).toBeNull()
  })

  it('retorna null para data_nascimento null', () => {
    expect(badgeAniversario(null, '2026-07-18')).toBeNull()
  })

  it('retorna null para data_nascimento vazia', () => {
    expect(badgeAniversario('', '2026-07-18')).toBeNull()
  })
})

// ── tamanhoPreferido ───────────────────────────────────────────
describe('tamanhoPreferido', () => {
  const vendas = [
    { id: 1, cliente_nome: 'Ana', data: '2026-01-01', valor: 100, produtos: [
      { nome: 'Blusa', variacao: 'M', quantidade: 2 },
      { nome: 'Calça', variacao: 'P', quantidade: 1 },
    ]},
    { id: 2, cliente_nome: 'Ana', data: '2026-02-01', valor: 80,  produtos: [
      { nome: 'Saia',  variacao: 'M', quantidade: 1 },
    ]},
  ]

  it('retorna a variação mais frequente por quantidade total', () => {
    expect(tamanhoPreferido(vendas, 'Ana')).toBe('M') // M=3, P=1
  })

  it('retorna null quando cliente não tem compras', () => {
    expect(tamanhoPreferido(vendas, 'Bia')).toBeNull()
  })

  it('ignora variação "Único"', () => {
    const v = [{ id: 1, cliente_nome: 'Ana', data: '2026-01-01', valor: 100, produtos: [
      { nome: 'Blusa', variacao: 'Único', quantidade: 10 },
    ]}]
    expect(tamanhoPreferido(v, 'Ana')).toBeNull()
  })

  it('retorna null quando produtos não têm variação', () => {
    const v = [{ id: 1, cliente_nome: 'Ana', data: '2026-01-01', valor: 100, produtos: [
      { nome: 'Blusa', obs: 'rosa', quantidade: 1 },
    ]}]
    expect(tamanhoPreferido(v, 'Ana')).toBeNull()
  })
})

// ── categoriaFavorita ──────────────────────────────────────────
describe('categoriaFavorita', () => {
  const produtosData = [
    { nome: 'Blusa', categoria: 'Blusas' },
    { nome: 'Calça', categoria: 'Calças' },
    { nome: 'Saia',  categoria: 'Blusas' },
  ]
  const vendas = [
    { id: 1, cliente_nome: 'Ana', data: '2026-01-01', valor: 100, produtos: [
      { nome: 'Blusa', quantidade: 2 },
      { nome: 'Calça', quantidade: 1 },
    ]},
    { id: 2, cliente_nome: 'Ana', data: '2026-02-01', valor: 80, produtos: [
      { nome: 'Saia', quantidade: 1 },
    ]},
  ]

  it('retorna a categoria com maior frequência', () => {
    expect(categoriaFavorita(vendas, 'Ana', produtosData)).toBe('Blusas') // Blusas=3, Calças=1
  })

  it('retorna null quando cliente não tem compras', () => {
    expect(categoriaFavorita(vendas, 'Bia', produtosData)).toBeNull()
  })

  it('retorna null quando produtos não têm categoria', () => {
    const pd = [{ nome: 'Blusa', categoria: null }]
    const v = [{ id: 1, cliente_nome: 'Ana', data: '2026-01-01', valor: 100, produtos: [{ nome: 'Blusa', quantidade: 5 }] }]
    expect(categoriaFavorita(v, 'Ana', pd)).toBeNull()
  })

  it('ignora categoria "Outros"', () => {
    const pd = [{ nome: 'Blusa', categoria: 'Outros' }]
    const v = [{ id: 1, cliente_nome: 'Ana', data: '2026-01-01', valor: 100, produtos: [{ nome: 'Blusa', quantidade: 5 }] }]
    expect(categoriaFavorita(v, 'Ana', pd)).toBeNull()
  })

  it('usa correspondência de nome case-insensitive', () => {
    const pd = [{ nome: 'BLUSA', categoria: 'Blusas' }]
    const v  = [{ id: 1, cliente_nome: 'Ana', data: '2026-01-01', valor: 100, produtos: [{ nome: 'blusa', quantidade: 1 }] }]
    expect(categoriaFavorita(v, 'Ana', pd)).toBe('Blusas')
  })
})

// ── ticketMedioCliente ─────────────────────────────────────────
describe('ticketMedioCliente', () => {
  const vendas = [
    { id: 1, cliente_nome: 'Ana',  data: '2026-01-01', valor: 100 },
    { id: 2, cliente_nome: 'Ana',  data: '2026-02-01', valor: 200 },
    { id: 3, cliente_nome: 'Bia',  data: '2026-01-01', valor: 50  },
  ]

  it('calcula ticket médio corretamente', () => {
    expect(ticketMedioCliente(vendas, 'Ana')).toBe(150) // (100+200)/2
  })

  it('retorna 0 para cliente sem compras', () => {
    expect(ticketMedioCliente(vendas, 'Carlos')).toBe(0)
  })

  it('retorna o valor exato quando há apenas uma compra', () => {
    expect(ticketMedioCliente(vendas, 'Bia')).toBe(50)
  })

  it('é case-insensitive no nome', () => {
    expect(ticketMedioCliente(vendas, 'ana')).toBe(150)
  })
})

// ── diasParaAniversario ────────────────────────────────────────
describe('diasParaAniversario', () => {
  it('retorna 0 para aniversário hoje', () => {
    expect(diasParaAniversario('1990-07-18', '2026-07-18')).toBe(0)
  })

  it('retorna 5 para aniversário em 5 dias', () => {
    expect(diasParaAniversario('1990-07-23', '2026-07-18')).toBe(5)
  })

  it('retorna 1 para aniversário amanhã', () => {
    expect(diasParaAniversario('1990-07-19', '2026-07-18')).toBe(1)
  })

  it('salta para o próximo ano se aniversário já passou', () => {
    const dias = diasParaAniversario('1990-07-10', '2026-07-18')
    expect(dias).toBeGreaterThan(300)
    expect(dias).toBeLessThan(366)
  })

  it('retorna null para data_nascimento null', () => {
    expect(diasParaAniversario(null, '2026-07-18')).toBeNull()
  })

  it('retorna null para data sem formato válido', () => {
    expect(diasParaAniversario('', '2026-07-18')).toBeNull()
  })
})

// ── gerarSugestoesAuto ────────────────────────────────────────
describe('gerarSugestoesAuto', () => {
  const hoje = '2026-07-18'

  it('gera sugestão de aniversário para aniversariante de hoje', () => {
    const clientes = [{ nome: 'Ana', telefone: '11999', data_nascimento: '1995-07-18' }]
    const sugs = gerarSugestoesAuto(clientes, [], hoje)
    const s = sugs.find(x => x.subtipo === 'aniversario')
    expect(s).toBeTruthy()
    expect(s.nota).toBe('Aniversário hoje!')
    expect(s.data).toBe('2026-07-18')
    expect(s.data_referencia).toBe('2026-07-18')
  })

  it('gera sugestão para aniversário em 5 dias', () => {
    const clientes = [{ nome: 'Bia', telefone: null, data_nascimento: '1990-07-23' }]
    const sugs = gerarSugestoesAuto(clientes, [], hoje)
    const s = sugs.find(x => x.subtipo === 'aniversario')
    expect(s).toBeTruthy()
    expect(s.nota).toContain('5 dias')
    expect(s.data).toBe('2026-07-23')
  })

  it('não gera sugestão para aniversário há mais de 7 dias no futuro', () => {
    const clientes = [{ nome: 'Cia', telefone: null, data_nascimento: '1990-07-30' }]
    const sugs = gerarSugestoesAuto(clientes, [], hoje)
    expect(sugs.find(x => x.subtipo === 'aniversario')).toBeUndefined()
  })

  it('gera sugestão inativo para cliente sem compras há 50 dias', () => {
    const clientes = [{ nome: 'Dia', telefone: null, data_nascimento: null }]
    const vendas = [{ cliente_nome: 'Dia', data: '2026-05-29', valor: 100 }] // 50 dias antes
    const sugs = gerarSugestoesAuto(clientes, vendas, hoje)
    const s = sugs.find(x => x.subtipo === 'inativo')
    expect(s).toBeTruthy()
    expect(s.data_referencia).toBe('2026-05-29')
  })

  it('não gera inativo para cliente ativo (20 dias)', () => {
    const clientes = [{ nome: 'Eva', telefone: null, data_nascimento: null }]
    const vendas = [{ cliente_nome: 'Eva', data: '2026-06-28', valor: 100 }]
    const sugs = gerarSugestoesAuto(clientes, vendas, hoje)
    expect(sugs.find(x => x.subtipo === 'inativo')).toBeUndefined()
  })

  it('gera sugestão VIP para cliente VIP sem compras há 35 dias', () => {
    const hoje2 = '2026-07-18'
    // 5 vendas no mês corrente para ticket médio = 100
    const vendasBase = Array.from({ length: 5 }, (_, i) => ({
      cliente_nome: null,
      data: `2026-07-${String(i + 1).padStart(2, '0')}`,
      valor: 100,
    }))
    // VIP: 1 venda de 1200 (>= 10×100=1000), última há 35 dias
    const vendas = [...vendasBase, { cliente_nome: 'VIP', data: '2026-06-13', valor: 1200 }]
    const clientes = [{ nome: 'VIP', telefone: null, data_nascimento: null }]
    const sugs = gerarSugestoesAuto(clientes, vendas, hoje2)
    expect(sugs.find(x => x.subtipo === 'vip')).toBeTruthy()
  })

  it('não gera inativo para cliente VIP (VIP tem prioridade)', () => {
    const vendasBase = Array.from({ length: 5 }, (_, i) => ({
      cliente_nome: null,
      data: `2026-07-${String(i + 1).padStart(2, '0')}`,
      valor: 100,
    }))
    const vendas = [...vendasBase, { cliente_nome: 'VIP', data: '2026-05-29', valor: 1200 }] // 50 dias
    const clientes = [{ nome: 'VIP', telefone: null, data_nascimento: null }]
    const sugs = gerarSugestoesAuto(clientes, vendas, hoje)
    expect(sugs.find(x => x.subtipo === 'inativo' && x.cliente_nome === 'VIP')).toBeUndefined()
    expect(sugs.find(x => x.subtipo === 'vip' && x.cliente_nome === 'VIP')).toBeTruthy()
  })

  it('não gera VIP para cliente VIP com última compra há 20 dias', () => {
    const vendasBase = Array.from({ length: 5 }, (_, i) => ({
      cliente_nome: null,
      data: `2026-07-${String(i + 1).padStart(2, '0')}`,
      valor: 100,
    }))
    const vendas = [...vendasBase, { cliente_nome: 'VIP', data: '2026-06-28', valor: 1200 }] // 20 dias
    const clientes = [{ nome: 'VIP', telefone: null, data_nascimento: null }]
    const sugs = gerarSugestoesAuto(clientes, vendas, hoje)
    expect(sugs.find(x => x.subtipo === 'vip')).toBeUndefined()
  })

  it('retorna lista vazia para clientes sem triggers', () => {
    const clientes = [{ nome: 'Ok', telefone: null, data_nascimento: '1990-12-25' }]
    const vendas = [{ cliente_nome: 'Ok', data: hoje, valor: 100 }]
    const sugs = gerarSugestoesAuto(clientes, vendas, hoje)
    expect(sugs).toHaveLength(0)
  })
})

// ── isDispensado ───────────────────────────────────────────────
describe('isDispensado', () => {
  const dispensados = [
    { cliente_nome: 'Ana', tipo: 'aniversario', data_referencia: '2026-07-18' },
  ]

  it('retorna true para dispensa exata', () => {
    expect(isDispensado(dispensados, 'Ana', 'aniversario', '2026-07-18')).toBe(true)
  })

  it('é case-insensitive no nome', () => {
    expect(isDispensado(dispensados, 'ANA', 'aniversario', '2026-07-18')).toBe(true)
  })

  it('retorna false para data_referencia diferente', () => {
    expect(isDispensado(dispensados, 'Ana', 'aniversario', '2027-07-18')).toBe(false)
  })

  it('retorna false para tipo diferente', () => {
    expect(isDispensado(dispensados, 'Ana', 'inativo', '2026-07-18')).toBe(false)
  })

  it('retorna false para nome diferente', () => {
    expect(isDispensado(dispensados, 'Bia', 'aniversario', '2026-07-18')).toBe(false)
  })

  it('retorna false para lista vazia', () => {
    expect(isDispensado([], 'Ana', 'aniversario', '2026-07-18')).toBe(false)
  })

  it('ignora hora na data_referencia (compara apenas YYYY-MM-DD)', () => {
    const d = [{ cliente_nome: 'Ana', tipo: 'inativo', data_referencia: '2026-05-01T00:00:00' }]
    expect(isDispensado(d, 'Ana', 'inativo', '2026-05-01')).toBe(true)
  })
})

// ── combinarFeed ───────────────────────────────────────────────
describe('combinarFeed', () => {
  const hoje = '2026-07-18'

  const auto = [
    { id: 'a1', tipo: 'auto', subtipo: 'aniversario', cliente_nome: 'Ana', cliente_telefone: null, nota: 'test', data: '2026-07-18', data_referencia: '2026-07-18' },
    { id: 'a2', tipo: 'auto', subtipo: 'inativo', cliente_nome: 'Bia', cliente_telefone: null, nota: 'test', data: '2026-07-18', data_referencia: '2026-05-01' },
    { id: 'a3', tipo: 'auto', subtipo: 'aniversario', cliente_nome: 'Cia', cliente_telefone: null, nota: 'test', data: '2026-07-22', data_referencia: '2026-07-22' },
  ]

  const lembretes = [
    { id: 'l1', cliente_nome: 'Dia', nota: 'lembrete futuro', data_lembrete: '2026-07-20', concluido: false },
    { id: 'l2', cliente_nome: 'Eva', nota: 'lembrete vencido', data_lembrete: '2026-07-15', concluido: false },
    { id: 'l3', cliente_nome: 'Fia', nota: 'feito', data_lembrete: '2026-07-18', concluido: true },
  ]

  it('combina auto + lembretes ativos e exclui concluídos', () => {
    const feed = combinarFeed(auto, lembretes, [], hoje)
    expect(feed).toHaveLength(5) // a1+a2+l2 (hoje/vencidos) + a3+l1 (futuros)
    expect(feed.find(f => f.lembrete_id === 'l3')).toBeUndefined()
  })

  it('itens de hoje/vencidos vêm antes dos futuros', () => {
    const feed = combinarFeed(auto, lembretes, [], hoje)
    const idxHoje = feed.findIndex(f => f.data <= hoje)
    const idxFuturo = feed.findIndex(f => f.data > hoje)
    expect(idxHoje).toBeLessThan(idxFuturo)
  })

  it('itens de hoje/vencidos ordenados por data asc', () => {
    const feed = combinarFeed(auto, lembretes, [], hoje)
    const hojeItems = feed.filter(f => f.data <= hoje)
    for (let i = 1; i < hojeItems.length; i++) {
      expect(hojeItems[i - 1].data <= hojeItems[i].data).toBe(true)
    }
  })

  it('exclui sugestões dispensadas', () => {
    const disp = [{ cliente_nome: 'Ana', tipo: 'aniversario', data_referencia: '2026-07-18' }]
    const feed = combinarFeed(auto, lembretes, disp, hoje)
    expect(feed.find(f => f.cliente_nome === 'Ana' && f.subtipo === 'aniversario')).toBeUndefined()
  })

  it('mapeia lembrete corretamente', () => {
    const lem = [{ id: 'x1', cliente_nome: 'Test', nota: 'minha nota', data_lembrete: '2026-07-20', concluido: false }]
    const feed = combinarFeed([], lem, [], hoje)
    expect(feed[0].tipo).toBe('lembrete')
    expect(feed[0].lembrete_id).toBe('x1')
    expect(feed[0].nota).toBe('minha nota')
  })

  it('retorna lista vazia quando não há itens', () => {
    expect(combinarFeed([], [], [], hoje)).toHaveLength(0)
  })
})
