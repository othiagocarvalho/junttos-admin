import { describe, it, expect } from 'vitest'
import {
  periodoFechado, proximaGeracao, textoProximoResumo, dataPorExtenso, rotuloPeriodo,
  deveMostrarAvisoSocio, variacaoPct, formatarDelta, montarLeituraSocio, fraseAbertura,
  formatarSocioTexto, montarHtmlSocio, escaparHtml,
} from './socioDigital.js'

// ── Período fechado — tem de bater com gerar_relatorios_socio (SQL) ────────
describe('periodoFechado', () => {
  it('dia 16 (dia do cron): fecha 1 a 15 do mesmo mês', () => {
    expect(periodoFechado('2026-09-16')).toEqual({ inicio: '2026-09-01', fim: '2026-09-15' })
  })
  it('dia 1º (dia do cron): fecha 16 ao último dia do mês anterior (30)', () => {
    expect(periodoFechado('2026-10-01')).toEqual({ inicio: '2026-09-16', fim: '2026-09-30' })
  })
  it('mês de 31 dias', () => {
    expect(periodoFechado('2026-08-01')).toEqual({ inicio: '2026-07-16', fim: '2026-07-31' })
  })
  it('fevereiro comum termina no 28', () => {
    expect(periodoFechado('2027-03-01')).toEqual({ inicio: '2027-02-16', fim: '2027-02-28' })
  })
  it('fevereiro bissexto termina no 29', () => {
    expect(periodoFechado('2028-03-01')).toEqual({ inicio: '2028-02-16', fim: '2028-02-29' })
  })
  it('virada de ano: 1º de janeiro fecha 16 a 31 de dezembro do ano anterior', () => {
    expect(periodoFechado('2027-01-01')).toEqual({ inicio: '2026-12-16', fim: '2026-12-31' })
  })
  it('dias entre as gerações apontam para o mesmo período já fechado', () => {
    expect(periodoFechado('2026-09-15')).toEqual({ inicio: '2026-08-16', fim: '2026-08-31' })
    expect(periodoFechado('2026-09-30')).toEqual({ inicio: '2026-09-01', fim: '2026-09-15' })
  })
  it('aceita Date local', () => {
    expect(periodoFechado(new Date(2026, 8, 20))).toEqual({ inicio: '2026-09-01', fim: '2026-09-15' })
  })
})

describe('proximaGeracao / textoProximoResumo', () => {
  it('antes do dia 16 → dia 16 do mesmo mês', () => {
    expect(proximaGeracao('2026-09-05')).toBe('2026-09-16')
    expect(proximaGeracao('2026-09-15')).toBe('2026-09-16')
  })
  it('do dia 16 em diante → dia 1º do mês seguinte', () => {
    expect(proximaGeracao('2026-09-16')).toBe('2026-10-01')
    expect(proximaGeracao('2026-09-30')).toBe('2026-10-01')
  })
  it('dezembro → 1º de janeiro do ano seguinte', () => {
    expect(proximaGeracao('2026-12-20')).toBe('2027-01-01')
  })
  it('texto por extenso com "1º"', () => {
    expect(textoProximoResumo('2026-09-23')).toBe('próximo resumo em 1º de outubro')
    expect(textoProximoResumo('2026-09-02')).toBe('próximo resumo em 16 de setembro')
    expect(dataPorExtenso('2026-03-16')).toBe('16 de março')
  })
})

describe('rotuloPeriodo', () => {
  it('formata as duas quinzenas', () => {
    expect(rotuloPeriodo({ inicio: '2026-09-01', fim: '2026-09-15' })).toBe('01 a 15 de setembro')
    expect(rotuloPeriodo({ inicio: '2026-12-16', fim: '2026-12-31' })).toBe('16 a 31 de dezembro')
  })
  it('período ausente → vazio', () => {
    expect(rotuloPeriodo(null)).toBe('')
  })
})

// ── Aviso do banner ──────────────────────────────────────────────────────────
describe('deveMostrarAvisoSocio', () => {
  it('sem relatório nenhum → não mostra', () => {
    expect(deveMostrarAvisoSocio({ periodoAtual: null, vistoPeriodo: undefined })).toBe(false)
  })
  it('coluna ausente (undefined) → mostra, como o lembrete de meta', () => {
    expect(deveMostrarAvisoSocio({ periodoAtual: '2026-09-01', vistoPeriodo: undefined })).toBe(true)
  })
  it('nunca viu (null) → mostra', () => {
    expect(deveMostrarAvisoSocio({ periodoAtual: '2026-09-01', vistoPeriodo: null })).toBe(true)
  })
  it('já viu este período → some', () => {
    expect(deveMostrarAvisoSocio({ periodoAtual: '2026-09-01', vistoPeriodo: '2026-09-01' })).toBe(false)
  })
  it('viu o anterior e saiu um novo → volta', () => {
    expect(deveMostrarAvisoSocio({ periodoAtual: '2026-09-16', vistoPeriodo: '2026-09-01' })).toBe(true)
  })
  it('visto mais novo que o relatório (não deveria acontecer) → não insiste', () => {
    expect(deveMostrarAvisoSocio({ periodoAtual: '2026-09-01', vistoPeriodo: '2026-09-16' })).toBe(false)
  })
  it('sem argumentos → não mostra', () => {
    expect(deveMostrarAvisoSocio()).toBe(false)
  })
})

describe('variacaoPct / formatarDelta', () => {
  it('calcula e formata alta, queda e estabilidade', () => {
    expect(formatarDelta(variacaoPct(112, 100))).toBe('▲ +12%')
    expect(formatarDelta(variacaoPct(82, 100))).toBe('▼ −18%')
    expect(formatarDelta(variacaoPct(100, 100))).toBe('= 0%')
  })
  it('sem base de comparação → "—"', () => {
    expect(variacaoPct(500, 0)).toBeNull()
    expect(formatarDelta(null)).toBe('—')
  })
})

// ── Leitura "Foi bem / De olho" ──────────────────────────────────────────────
const base = {
  metricas: { faturamento: 11200, vendas: 56, ticket_medio: 200, trocas: 2, pecas: 90 },
  anterior: { faturamento: 10000, vendas: 50, ticket_medio: 200, trocas: 5 },
  melhor_dia_semana: { isodow: 6, total: 4480 },
  top_produtos: [{ nome: 'Vestido Midi', qtd: 12 }],
  recomprar: [], parados: [],
  clientes_inativos: { total: 0, lista: [] },
  caixa: { entradas: 3000, saidas: 1000, saldo: 2000 },
  crediario: { parcelas_atrasadas: 0, valor_atrasado: 0 },
}

describe('montarLeituraSocio', () => {
  it('crescimento: faturamento +12%, produto líder, melhor dia, trocas caindo', () => {
    const r = montarLeituraSocio(base)
    expect(r.tom).toBe('crescimento')
    expect(r.foiBem[0]).toBe('Faturamento subiu 12% sobre a quinzena anterior')
    expect(r.foiBem[1]).toBe('Vestido Midi foi o mais vendido (12 peças)')
    expect(r.foiBem[2]).toBe('Sábado foi o dia mais forte (40% do faturamento)')
    expect(r.deOlho).toEqual([])
  })

  it('no máximo 3 itens por lista', () => {
    const r = montarLeituraSocio({
      ...base,
      metricas: { ...base.metricas, ticket_medio: 260 },
      recomprar: [{ nome: 'A' }], parados: [{ nome: 'B' }, { nome: 'C' }],
      clientes_inativos: { total: 7, lista: [] },
      crediario: { parcelas_atrasadas: 2, valor_atrasado: 300 },
      caixa: { saldo: -50 },
    })
    expect(r.foiBem.length).toBe(3)
    expect(r.deOlho.length).toBe(3)
  })

  it('queda de faturamento vai para "De olho", não para "Foi bem"', () => {
    const r = montarLeituraSocio({ ...base, metricas: { ...base.metricas, faturamento: 8000 } })
    expect(r.tom).toBe('queda')
    expect(r.deOlho[0]).toBe('Faturamento caiu 20% sobre a quinzena anterior')
    expect(r.foiBem.some(t => t.startsWith('Faturamento'))).toBe(false)
  })

  it('variação menor que 5% é estável (ruído, não tendência)', () => {
    const r = montarLeituraSocio({ ...base, metricas: { ...base.metricas, faturamento: 10300 } })
    expect(r.tom).toBe('estavel')
    expect(r.foiBem.some(t => t.startsWith('Faturamento'))).toBe(false)
  })

  it('De olho: crediário, caixa negativo, estoque no fim, inativos e parados', () => {
    const r = montarLeituraSocio({
      ...base,
      anterior: { ...base.anterior, faturamento: 11200 },
      crediario: { parcelas_atrasadas: 1, valor_atrasado: 150 },
      caixa: { saldo: -10 },
      recomprar: [{ nome: 'A' }, { nome: 'B' }],
    })
    expect(r.deOlho[0]).toMatch(/^1 parcela de crediário em atraso \(R\$/)
    expect(r.deOlho[1]).toBe('Contas a pagar dos próximos 15 dias passam das entradas previstas')
    expect(r.deOlho[2]).toBe('2 produtos vendendo bem com estoque no fim')
  })

  it('trocas subindo entram em "De olho"', () => {
    const r = montarLeituraSocio({ ...base, anterior: { ...base.anterior, faturamento: 11200, trocas: 1 }, metricas: { ...base.metricas, trocas: 4 } })
    expect(r.deOlho).toContain('Trocas subiram de 1 para 4')
  })

  it('período sem vendas', () => {
    const r = montarLeituraSocio({ metricas: { faturamento: 0, vendas: 0 }, anterior: {} })
    expect(r.tom).toBe('sem_vendas')
    expect(r.foiBem).toEqual([])
    expect(fraseAbertura(r.tom, { inicio: '2026-09-01', fim: '2026-09-15' })).toMatch(/Não encontrei vendas/)
  })

  it('dados vazios/ausentes não quebram', () => {
    expect(() => montarLeituraSocio(undefined)).not.toThrow()
    expect(montarLeituraSocio({}).tom).toBe('sem_vendas')
  })
})

// ── Compartilhamento ─────────────────────────────────────────────────────────
const relatorio = { periodo_inicio: '2026-09-01', periodo_fim: '2026-09-15', dados: base }

describe('formatarSocioTexto (WhatsApp)', () => {
  it('traz cabeçalho, período, números, leitura e caixa', () => {
    const t = formatarSocioTexto(relatorio, 'Audaz Wear')
    const linhas = t.split('\n')
    expect(linhas[0]).toBe('*Audaz Wear — Sócio Digital*')
    expect(linhas[1]).toBe('Resumo de 01 a 15 de setembro')
    expect(t).toMatch(/Faturamento: R\$\s?11\.200,00 \(▲ \+12%\)/)
    expect(t).toContain('Vendas: 56 (▲ +12%)')
    expect(t).toContain('*Foi bem*')
    expect(t).toContain('• Vestido Midi foi o mais vendido (12 peças)')
    expect(t).toContain('*Caixa — próximos 15 dias*')
    expect(linhas[linhas.length - 1]).toBe('Gerado pelo Junttos')
  })
  it('sem "De olho" quando não há alerta', () => {
    expect(formatarSocioTexto(relatorio, 'X')).not.toContain('*De olho*')
  })
})

describe('montarHtmlSocio (PDF)', () => {
  it('é um documento completo, A4, com o período', () => {
    const html = montarHtmlSocio(relatorio, 'Audaz Wear')
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('@page{size:A4')
    expect(html).toContain('Resumo de 01 a 15 de setembro')
  })
  it('escapa nome de produto/cliente (texto livre)', () => {
    const html = montarHtmlSocio({
      ...relatorio,
      dados: { ...base, recomprar: [{ nome: '<img src=x onerror=alert(1)>', vendidos: 3, estoque: 1 }] },
    }, 'Loja & Cia')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('Loja &amp; Cia')
  })
  it('escaparHtml cobre aspas', () => {
    expect(escaparHtml(`"a" 'b'`)).toBe('&quot;a&quot; &#39;b&#39;')
  })
})
