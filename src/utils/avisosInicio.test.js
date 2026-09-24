import { describe, it, expect } from 'vitest'
import {
  montarAvisos, aplicarDispensa, limiteJanelaContas, quandoVence,
  produtosEstoqueBaixo, estoqueDispensado, COR, ESTOQUE_DISPENSA_DIAS,
} from './avisosInicio'

// 24/09/2026 12:00 local. Datas sempre construídas no fuso local.
const HOJE = new Date(2026, 8, 24, 12, 0, 0)
const MES = '2026-09'

// Base "sem nenhum aviso": meta definida, sem contas, sem produto baixo,
// plano starter (sem Sócio / meta batida).
const base = (extra = {}) => ({
  plano: 'starter',
  metas: { [MES]: 10000 },
  vendas: [],
  produtosData: [],
  contasPagar: [],
  contasReceber: [],
  socioUltimo: null,
  socioIntroVisto: true,
  hoje: HOJE,
  ...extra,
})

// Contas só aparecem no Business (Financeiro é exclusivo do plano).
const baseB = (extra = {}) => base({ plano: 'business', ...extra })

const prod = (id, ...qtds) => ({ id, nome: `Produto ${id}`, variacoes: qtds.map(q => ({ quantidade: q })) })
const conta = (id, data_vencimento, valor = 100, descricao = `Conta ${id}`) => ({ id, data_vencimento, valor, descricao, status: 'pendente' })
const tipos = avisos => avisos.map(a => a.tipo)

// ── Estado neutro ──────────────────────────────────────────────────────────
describe('montarAvisos — base', () => {
  it('nada acontecendo → lista vazia', () => {
    expect(montarAvisos(base())).toEqual([])
  })
  it('sem argumentos não quebra', () => {
    expect(Array.isArray(montarAvisos())).toBe(true)
  })
  it('todo aviso traz tipo, cor, ícone, título, texto, botão e tab', () => {
    const avisos = montarAvisos(base({ metas: {}, produtosData: [prod(1, 2)] }))
    for (const a of avisos) {
      expect(a).toMatchObject({
        tipo: expect.any(String), cor: expect.any(String), icone: expect.any(String),
        titulo: expect.any(String), texto: expect.any(String), botao: expect.any(String), tab: expect.any(String),
      })
      expect(a.dispensa).toBeTruthy()
    }
  })
})

// ── Sem meta ───────────────────────────────────────────────────────────────
describe('aviso sem meta', () => {
  it('sem meta do mês → aparece, na cor da loja, levando a Metas', () => {
    const [a] = montarAvisos(base({ metas: {}, corLoja: '#AA0066' }))
    expect(a).toMatchObject({ tipo: 'sem_meta', cor: '#AA0066', tab: 'meta', botao: 'Definir meta' })
    expect(a.dispensa).toEqual({ campo: 'meta_lembrete_dispensado_em', valor: MES })
  })
  it('vale para Starter (regra de sempre)', () => {
    expect(tipos(montarAvisos(base({ metas: {}, plano: 'starter' })))).toContain('sem_meta')
  })
  it('dispensado neste mês → some; mês passado → volta', () => {
    expect(tipos(montarAvisos(base({ metas: {}, metaDispensadaEm: MES })))).not.toContain('sem_meta')
    expect(tipos(montarAvisos(base({ metas: {}, metaDispensadaEm: '2026-08' })))).toContain('sem_meta')
  })
})

// ── Meta batida ────────────────────────────────────────────────────────────
describe('aviso meta batida', () => {
  const vendas = [
    { data: '2026-09-10T15:00:00', valor: 6000 },
    { data: '2026-09-20T15:00:00', valor: 5000 },
  ]
  it('Pro com vendas do mês ≥ meta → aparece', () => {
    const [a] = montarAvisos(base({ plano: 'pro', vendas }))
    expect(a).toMatchObject({ tipo: 'meta_batida', cor: COR.metaBatida, tab: 'meta' })
    expect(a.texto).toContain('11.000')
  })
  it('Starter não vê (restrição intencional a Pro/Business)', () => {
    expect(montarAvisos(base({ plano: 'starter', vendas }))).toEqual([])
  })
  it('abaixo da meta → não aparece', () => {
    expect(montarAvisos(base({ plano: 'pro', vendas: [vendas[0]] }))).toEqual([])
  })
  it('pré-venda (aguardando_pagamento) não conta para bater a meta', () => {
    const v = [vendas[0], { ...vendas[1], status: 'aguardando_pagamento' }]
    expect(montarAvisos(base({ plano: 'pro', vendas: v }))).toEqual([])
  })
  it('venda de outro mês não conta', () => {
    const v = [...vendas.map(x => ({ ...x, data: x.data.replace('2026-09', '2026-08') }))]
    expect(montarAvisos(base({ plano: 'pro', vendas: v }))).toEqual([])
  })
  it('dispensa grava o mês em avisos_dispensados.meta_batida', () => {
    const [a] = montarAvisos(base({ plano: 'pro', vendas }))
    expect(a.dispensa).toEqual({ campo: 'avisos_dispensados', chave: 'meta_batida', valor: MES })
  })
  it('dispensado neste mês → some; dispensado mês passado → volta', () => {
    expect(montarAvisos(base({ plano: 'pro', vendas, dispensados: { meta_batida: MES } }))).toEqual([])
    expect(tipos(montarAvisos(base({ plano: 'pro', vendas, dispensados: { meta_batida: '2026-08' } })))).toEqual(['meta_batida'])
  })
})

// ── Estoque ────────────────────────────────────────────────────────────────
describe('aviso estoque baixo / esgotado', () => {
  it('1 a 6 peças → estoque baixo; 7+ não', () => {
    expect(tipos(montarAvisos(base({ produtosData: [prod(1, 3, 3)] })))).toEqual(['estoque'])
    expect(montarAvisos(base({ produtosData: [prod(1, 4, 3)] }))).toEqual([])
  })
  it('PROBLEMA 4: produto com 0 peças aparece como esgotado', () => {
    const [a] = montarAvisos(base({ produtosData: [prod(1, 0, 0)] }))
    expect(a.tipo).toBe('estoque')
    expect(a.titulo).toBe('Produto esgotado')
    expect(a.texto).toContain('esgotado')
  })
  it('produto sem variação nenhuma conta como 0 peças', () => {
    expect(produtosEstoqueBaixo([{ id: 9, nome: 'X', variacoes: [] }])).toEqual([{ id: 9, nome: 'X', qtd: 0 }])
  })
  it('esgotado + baixo juntos → título e texto dizem os dois', () => {
    const [a] = montarAvisos(base({ produtosData: [prod(1, 0), prod(2, 2), prod(3, 1)] }))
    expect(a.titulo).toBe('Estoque baixo e produtos esgotados')
    expect(a.texto).toBe('1 esgotado · 2 com estoque baixo')
  })
  it('um produto só → mostra o nome e quantas peças restam', () => {
    const [a] = montarAvisos(base({ produtosData: [prod(7, 1)] }))
    expect(a.texto).toBe('Produto 7 · resta 1 peça')
  })
  it('dispensa grava os ids e o dia', () => {
    const [a] = montarAvisos(base({ produtosData: [prod(2, 1), prod(1, 0)] }))
    expect(a.dispensa).toEqual({ campo: 'avisos_dispensados', chave: 'estoque', valor: { ids: [2, 1], em: '2026-09-24' } })
  })
  it('dispensado há menos de 7 dias com a mesma lista → some', () => {
    const d = { estoque: { ids: [1, 2], em: '2026-09-18' } }   // 6 dias
    expect(montarAvisos(base({ produtosData: [prod(1, 1), prod(2, 0)], dispensados: d }))).toEqual([])
  })
  it(`dispensado há ${ESTOQUE_DISPENSA_DIAS} dias → volta, mesmo sem mudar a lista`, () => {
    const d = { estoque: { ids: [1, 2], em: '2026-09-17' } }   // 7 dias
    expect(tipos(montarAvisos(base({ produtosData: [prod(1, 1), prod(2, 0)], dispensados: d })))).toEqual(['estoque'])
  })
  it('lista mudou (produto novo entrou) → volta antes dos 7 dias', () => {
    const d = { estoque: { ids: [1], em: '2026-09-23' } }
    expect(tipos(montarAvisos(base({ produtosData: [prod(1, 1), prod(2, 0)], dispensados: d })))).toEqual(['estoque'])
  })
  it('lista mudou (produto saiu) → também volta', () => {
    const d = { estoque: { ids: [1, 2], em: '2026-09-23' } }
    expect(tipos(montarAvisos(base({ produtosData: [prod(1, 1)], dispensados: d })))).toEqual(['estoque'])
  })
  it('ordem dos ids não importa', () => {
    expect(estoqueDispensado({ ids: [2, 1], em: '2026-09-23' }, [1, 2], HOJE)).toBe(true)
  })
  it('dispensa malformada (coluna vazia, lixo) conta como não dispensado', () => {
    expect(estoqueDispensado(undefined, [1], HOJE)).toBe(false)
    expect(estoqueDispensado({ ids: 'x' }, [1], HOJE)).toBe(false)
  })
})

// ── Contas ─────────────────────────────────────────────────────────────────
describe('aviso de contas', () => {
  it('plano Starter com conta vencendo NÃO vê o aviso (Financeiro é Business)', () => {
    expect(montarAvisos(base({ plano: 'starter', contasPagar: [conta(1, '2026-09-24')], contasReceber: [conta(2, '2026-09-24')] }))).toEqual([])
  })
  it('plano Pro com conta vencendo NÃO vê o aviso', () => {
    expect(montarAvisos(base({ plano: 'pro', contasPagar: [conta(1, '2026-09-24')], contasReceber: [conta(2, '2026-09-20')] }))).toEqual([])
  })
  it('plano Business vê normalmente, pagar e receber', () => {
    expect(tipos(montarAvisos(base({ plano: 'business', contasPagar: [conta(1, '2026-09-24')], contasReceber: [conta(2, '2026-09-20')] }))))
      .toEqual(['conta_pagar', 'conta_receber'])
  })
  it('plano desconhecido/ausente cai em Starter → sem aviso de conta', () => {
    expect(montarAvisos(base({ plano: undefined, contasPagar: [conta(1, '2026-09-24')] }))).toEqual([])
  })
  it('PROBLEMA 2: pagar e receber viram avisos separados, com textos próprios', () => {
    const avisos = montarAvisos(baseB({
      contasPagar: [conta(1, '2026-09-25', 500, 'Aluguel')],
      contasReceber: [conta(2, '2026-09-26', 300, 'Cliente Ana')],
    }))
    expect(tipos(avisos)).toEqual(['conta_pagar', 'conta_receber'])
    const [p, r] = avisos
    expect(p.titulo).toBe('Conta a pagar vence em breve')
    expect(p.botao).toBe('Ver contas a pagar')
    expect(p.cor).toBe(COR.pagar)
    expect(r.titulo).toBe('Recebimento previsto')
    expect(r.botao).toBe('Ver contas a receber')
    expect(r.cor).toBe(COR.receber)
    // Nunca chama recebimento de "conta a pagar" nem vice-versa
    expect(`${r.titulo} ${r.texto}`).not.toMatch(/pagar/i)
    expect(`${p.titulo} ${p.texto}`).not.toMatch(/receb/i)
  })
  it('PROBLEMA 3: conta vencida e pendente aparece como atrasada', () => {
    const [a] = montarAvisos(baseB({ contasPagar: [conta(1, '2026-09-20', 200, 'Luz')] }))
    expect(a.titulo).toBe('Conta a pagar atrasada')
    expect(a.texto).toBe('Luz · R$ 200,00 · venceu há 4 dias')
  })
  it('PROBLEMA 3: recebimento vencido também aparece', () => {
    const [a] = montarAvisos(baseB({ contasReceber: [conta(1, '2026-09-01')] }))
    expect(a.titulo).toBe('Recebimento atrasado')
  })
  it('várias, vencidas e em dia misturadas → total e quantas já venceram', () => {
    const [a] = montarAvisos(baseB({ contasPagar: [conta(1, '2026-09-20', 100), conta(2, '2026-09-26', 50)] }))
    expect(a.titulo).toBe('2 contas a pagar pendentes')
    expect(a.texto).toContain('R$ 150,00 a pagar')
    expect(a.texto).toContain('1 já venceu')
  })
  it('fora da janela (vence em 4+ dias) → não aparece', () => {
    expect(montarAvisos(baseB({ contasPagar: [conta(1, '2026-09-28')] }))).toEqual([])
  })
  it('limite da janela: hoje + 3 dias entra', () => {
    expect(tipos(montarAvisos(baseB({ contasPagar: [conta(1, '2026-09-27')] })))).toEqual(['conta_pagar'])
  })
  it('conta paga (status diferente de pendente) não aparece', () => {
    expect(montarAvisos(baseB({ contasPagar: [{ ...conta(1, '2026-09-24'), status: 'pago' }] }))).toEqual([])
  })
  it('contas ainda não carregadas (null) → sem aviso de conta, resto normal', () => {
    expect(tipos(montarAvisos(baseB({ contasPagar: null, contasReceber: undefined, metas: {} })))).toEqual(['sem_meta'])
  })
  it('dispensa grava as chaves pagar:ID', () => {
    const [a] = montarAvisos(baseB({ contasPagar: [conta(1, '2026-09-24'), conta(2, '2026-09-25')] }))
    expect(a.dispensa).toEqual({ campo: 'avisos_dispensados', chave: 'conta', valor: ['pagar:1', 'pagar:2'] })
  })
  it('contas já dispensadas não voltam', () => {
    const d = { conta: ['pagar:1', 'pagar:2'] }
    expect(montarAvisos(baseB({ contasPagar: [conta(1, '2026-09-24'), conta(2, '2026-09-25')], dispensados: d }))).toEqual([])
  })
  it('conta NOVA na janela faz o aviso voltar — só com a nova', () => {
    const d = { conta: ['pagar:1'] }
    const [a] = montarAvisos(baseB({ contasPagar: [conta(1, '2026-09-24', 100, 'Velha'), conta(3, '2026-09-25', 80, 'Nova')], dispensados: d }))
    expect(a.tipo).toBe('conta_pagar')
    expect(a.texto).toContain('Nova')
    expect(a.texto).not.toContain('Velha')
  })
  it('dispensar pagar não esconde receber com o mesmo id (chaves separadas)', () => {
    const d = { conta: ['pagar:1'] }
    expect(tipos(montarAvisos(baseB({ contasPagar: [conta(1, '2026-09-24')], contasReceber: [conta(1, '2026-09-24')], dispensados: d }))))
      .toEqual(['conta_receber'])
  })
  it('ao dispensar, preserva as dispensas do outro tipo e limpa as que saíram da janela', () => {
    const d = { conta: ['receber:5', 'pagar:99'] }   // pagar:99 já foi paga
    const [a] = montarAvisos(baseB({ contasPagar: [conta(1, '2026-09-24')], contasReceber: [conta(5, '2026-09-24')], dispensados: d }))
    expect(a.tipo).toBe('conta_pagar')
    expect(a.dispensa.valor).toEqual(['receber:5', 'pagar:1'])
  })
})

// ── PROBLEMA 1: fuso horário ───────────────────────────────────────────────
describe('PROBLEMA 1: datas no dia local (nunca toISOString/UTC)', () => {
  // 22:30 local. No Brasil (UTC-3) toISOString() já daria 25/09 — o bug
  // antigo. O dia certo continua sendo 24/09.
  const NOITE = new Date(2026, 8, 24, 22, 30, 0)

  it('janela de contas calculada a partir do dia local', () => {
    expect(limiteJanelaContas(NOITE)).toBe('2026-09-27')
  })
  it('conta que vence hoje continua "vence hoje" à noite', () => {
    expect(quandoVence('2026-09-24', NOITE)).toBe('vence hoje')
    const [a] = montarAvisos(baseB({ hoje: NOITE, contasPagar: [conta(1, '2026-09-24', 10, 'Luz')] }))
    expect(a.titulo).toBe('Conta a pagar vence em breve')
    expect(a.texto).toContain('vence hoje')
  })
  it('00:30 do dia seguinte já conta como o novo dia', () => {
    const MADRUGADA = new Date(2026, 8, 25, 0, 30, 0)
    expect(quandoVence('2026-09-24', MADRUGADA)).toBe('venceu ontem')
    expect(limiteJanelaContas(MADRUGADA)).toBe('2026-09-28')
  })
  it('estoque dispensado conta os 7 dias pelo dia local', () => {
    const d = { ids: [1], em: '2026-09-17' }
    expect(estoqueDispensado(d, [1], new Date(2026, 8, 23, 23, 59))).toBe(true)    // 6 dias
    expect(estoqueDispensado(d, [1], new Date(2026, 8, 24, 0, 1))).toBe(false)     // 7 dias
  })
  it('virada de mês da meta usa o mês local (31/08 23:30 ainda é agosto)', () => {
    const [a] = montarAvisos(base({ metas: {}, hoje: new Date(2026, 7, 31, 23, 30) }))
    expect(a.dispensa.valor).toBe('2026-08')
  })
})

// ── Sócio Digital ──────────────────────────────────────────────────────────
describe('avisos do Sócio Digital', () => {
  const rel = { periodo_inicio: '2026-09-01', periodo_fim: '2026-09-15' }
  it('Pro sem relatório e sem ter visto → "conhecer", X grava socio_intro_visto', () => {
    const [a] = montarAvisos(base({ plano: 'pro', socioUltimo: null, socioIntroVisto: undefined }))
    expect(a).toMatchObject({ tipo: 'socio_intro', tab: 'socio_digital' })
    expect(a.dispensa).toEqual({ campo: 'socio_intro_visto', valor: true })
  })
  it('Pro com relatório não visto → "pronto", X grava socio_visto_periodo', () => {
    const [a] = montarAvisos(base({ plano: 'pro', socioUltimo: rel, socioVistoPeriodo: '2026-08-16' }))
    expect(a).toMatchObject({ tipo: 'socio_pronto', tab: 'socio_digital' })
    expect(a.texto).toBe('Resumo de 01 a 15 de setembro')
    expect(a.dispensa).toEqual({ campo: 'socio_visto_periodo', valor: '2026-09-01' })
  })
  it('intro e pronto nunca juntos', () => {
    const t = tipos(montarAvisos(base({ plano: 'pro', socioUltimo: rel, socioIntroVisto: false })))
    expect(t).toEqual(['socio_pronto'])
  })
  it('relatório ainda carregando (undefined) → nenhum dos dois', () => {
    expect(montarAvisos(base({ plano: 'pro', socioUltimo: undefined, socioIntroVisto: false }))).toEqual([])
  })
  it('Starter não vê Sócio', () => {
    expect(montarAvisos(base({ plano: 'starter', socioUltimo: null, socioIntroVisto: false }))).toEqual([])
  })
})

// ── Ordem de prioridade ────────────────────────────────────────────────────
describe('ordem de prioridade', () => {
  it('conta > Sócio pronto > estoque > sem meta > meta batida', () => {
    // sem meta e meta batida são exclusivos; testados em duas rodadas.
    const comum = {
      plano: 'business',
      contasPagar: [conta(1, '2026-09-24')],
      contasReceber: [conta(2, '2026-09-24')],
      produtosData: [prod(1, 1)],
      socioUltimo: { periodo_inicio: '2026-09-01', periodo_fim: '2026-09-15' },
    }
    expect(tipos(montarAvisos(base({ ...comum, metas: {} }))))
      .toEqual(['conta_pagar', 'conta_receber', 'socio_pronto', 'estoque', 'sem_meta'])
    expect(tipos(montarAvisos(base({ ...comum, vendas: [{ data: '2026-09-10T12:00:00', valor: 20000 }] }))))
      .toEqual(['conta_pagar', 'conta_receber', 'socio_pronto', 'estoque', 'meta_batida'])
  })
  it('sem meta > Sócio conhecer > (meta batida é exclusiva com sem meta)', () => {
    expect(tipos(montarAvisos(base({ plano: 'pro', metas: {}, socioUltimo: null, socioIntroVisto: false, produtosData: [prod(1, 0)] }))))
      .toEqual(['estoque', 'sem_meta', 'socio_intro'])
  })
  it('Sócio conhecer vem antes de meta batida', () => {
    expect(tipos(montarAvisos(base({ plano: 'pro', socioUltimo: null, socioIntroVisto: false, vendas: [{ data: '2026-09-10T12:00:00', valor: 20000 }] }))))
      .toEqual(['socio_intro', 'meta_batida'])
  })
})

// ── Gerente ────────────────────────────────────────────────────────────────
describe('papel gerente', () => {
  it('só vê o que pode abrir: estoque sim; contas, meta e Sócio não', () => {
    const avisos = montarAvisos(base({
      gerente: true, plano: 'business', metas: {},
      contasPagar: [conta(1, '2026-09-24')], produtosData: [prod(1, 1)],
      socioUltimo: null, socioIntroVisto: false,
    }))
    expect(tipos(avisos)).toEqual(['estoque'])
  })
})

// ── aplicarDispensa ────────────────────────────────────────────────────────
describe('aplicarDispensa', () => {
  it('mescla a chave nova sem apagar as outras', () => {
    expect(aplicarDispensa({ meta_batida: '2026-08' }, { campo: 'avisos_dispensados', chave: 'conta', valor: ['pagar:1'] }))
      .toEqual({ meta_batida: '2026-08', conta: ['pagar:1'] })
  })
  it('coluna ausente/nula/lixo → começa do zero', () => {
    const d = { campo: 'avisos_dispensados', chave: 'meta_batida', valor: MES }
    expect(aplicarDispensa(undefined, d)).toEqual({ meta_batida: MES })
    expect(aplicarDispensa(null, d)).toEqual({ meta_batida: MES })
    expect(aplicarDispensa([1, 2], d)).toEqual({ meta_batida: MES })
  })
  it('dispensa de outra coluna (meta/Sócio) não mexe em avisos_dispensados', () => {
    expect(aplicarDispensa({ a: 1 }, { campo: 'socio_intro_visto', valor: true })).toEqual({ a: 1 })
  })
})
