import { describe, it, expect } from 'vitest'
import {
  avancarOcorrencia,
  primeirOcorrenciaAPartirDe,
  gerarLancamentosFaltantes,
  contarLancamentosFuturos,
} from './recorrencia.js'

const toStr = d => d.toISOString().slice(0, 10)

// ── avancarOcorrencia ─────────────────────────────────────────────
describe('avancarOcorrencia', () => {
  it('semanal avança 7 dias', () => {
    expect(toStr(avancarOcorrencia('2026-07-01', 'semanal', '2026-07-01'))).toBe('2026-07-08')
  })

  it('semanal avança de domingo para domingo', () => {
    expect(toStr(avancarOcorrencia('2026-07-05', 'semanal', '2026-07-05'))).toBe('2026-07-12')
  })

  it('mensal avança 1 mês preservando o dia de origem', () => {
    expect(toStr(avancarOcorrencia('2026-07-15', 'mensal', '2026-07-15'))).toBe('2026-08-15')
  })

  it('mensal em dezembro vira janeiro do ano seguinte', () => {
    expect(toStr(avancarOcorrencia('2026-12-15', 'mensal', '2026-12-15'))).toBe('2027-01-15')
  })

  it('mensal clampeia para o último dia do mês (Jan-31 → Fev-28)', () => {
    expect(toStr(avancarOcorrencia('2026-01-31', 'mensal', '2026-01-31'))).toBe('2026-02-28')
  })

  it('anual avança 1 ano preservando mês e dia', () => {
    expect(toStr(avancarOcorrencia('2026-03-15', 'anual', '2026-03-15'))).toBe('2027-03-15')
  })

  it('aceita Date object como entrada', () => {
    const d = new Date('2026-07-01T12:00:00')
    expect(toStr(avancarOcorrencia(d, 'semanal', '2026-07-01'))).toBe('2026-07-08')
  })
})

// ── primeirOcorrenciaAPartirDe ────────────────────────────────────
describe('primeirOcorrenciaAPartirDe', () => {
  it('retorna data_inicio se já é >= minDate', () => {
    expect(toStr(primeirOcorrenciaAPartirDe('2026-08-01', 'mensal', '2026-07-18'))).toBe('2026-08-01')
  })

  it('mensal — avança até primeira ocorrência >= minDate', () => {
    // origem=2026-01-15, hoje=2026-07-18 → próxima >= hoje = 2026-08-15
    expect(toStr(primeirOcorrenciaAPartirDe('2026-01-15', 'mensal', '2026-07-18'))).toBe('2026-08-15')
  })

  it('semanal — avança semanas até alcançar minDate', () => {
    // origem=2026-07-01, minDate=2026-07-15 → 07-08 < 07-15 → 07-15 >= 07-15 ✓
    expect(toStr(primeirOcorrenciaAPartirDe('2026-07-01', 'semanal', '2026-07-15'))).toBe('2026-07-15')
  })

  it('anual — avança anos até alcançar minDate', () => {
    // origem=2025-03-15, minDate=2026-07-18 → 2026-03-15 < minDate → 2027-03-15
    expect(toStr(primeirOcorrenciaAPartirDe('2025-03-15', 'anual', '2026-07-18'))).toBe('2027-03-15')
  })

  it('retorna a própria data_inicio quando já é = minDate', () => {
    expect(toStr(primeirOcorrenciaAPartirDe('2026-07-18', 'mensal', '2026-07-18'))).toBe('2026-07-18')
  })
})

// ── gerarLancamentosFaltantes ─────────────────────────────────────
describe('gerarLancamentosFaltantes', () => {
  const HOJE = '2026-07-18'

  const regra = {
    id: 'rec-1',
    loja_id: 'sualoja',
    descricao: 'Aluguel',
    categoria: 'aluguel',
    valor: 1000,
    frequencia: 'mensal',
    data_inicio: '2026-07-18',
    ativa: true,
    observacoes: null,
  }

  it('gera 6 lançamentos quando não há nenhum existente', () => {
    expect(gerarLancamentosFaltantes(regra, [], HOJE)).toHaveLength(6)
  })

  it('os 6 lançamentos têm datas mensais consecutivas corretas', () => {
    const novos = gerarLancamentosFaltantes(regra, [], HOJE)
    expect(novos[0].data_vencimento).toBe('2026-07-18')
    expect(novos[1].data_vencimento).toBe('2026-08-18')
    expect(novos[2].data_vencimento).toBe('2026-09-18')
    expect(novos[3].data_vencimento).toBe('2026-10-18')
    expect(novos[4].data_vencimento).toBe('2026-11-18')
    expect(novos[5].data_vencimento).toBe('2026-12-18')
  })

  it('gera apenas os que faltam quando já existem 2 futuros', () => {
    const existentes = [
      { recorrencia_id: 'rec-1', data_vencimento: '2026-07-18', status: 'pendente' },
      { recorrencia_id: 'rec-1', data_vencimento: '2026-08-18', status: 'pendente' },
    ]
    const novos = gerarLancamentosFaltantes(regra, existentes, HOJE)
    expect(novos).toHaveLength(4)
    expect(novos[0].data_vencimento).toBe('2026-09-18')
  })

  it('não gera nada quando já existem 6 ou mais futuros', () => {
    const existentes = Array.from({ length: 6 }, (_, i) => ({
      recorrencia_id: 'rec-1',
      data_vencimento: `2026-${String(7 + i).padStart(2, '0')}-18`,
      status: 'pendente',
    }))
    expect(gerarLancamentosFaltantes(regra, existentes, HOJE)).toHaveLength(0)
  })

  it('lançamentos pagos não contam para o total de futuros (3 pagos + 3 pendentes → gera 3)', () => {
    const existentes = Array.from({ length: 6 }, (_, i) => ({
      recorrencia_id: 'rec-1',
      data_vencimento: `2026-${String(7 + i).padStart(2, '0')}-18`,
      status: i < 3 ? 'pago' : 'pendente',
    }))
    expect(gerarLancamentosFaltantes(regra, existentes, HOJE)).toHaveLength(3)
  })

  it('não duplica datas já existentes (mesmo pagas)', () => {
    const existentes = [
      { recorrencia_id: 'rec-1', data_vencimento: '2026-09-18', status: 'pendente' },
    ]
    const datas = gerarLancamentosFaltantes(regra, existentes, HOJE).map(n => n.data_vencimento)
    expect(datas).not.toContain('2026-09-18')
  })

  it('cada lançamento gerado tem os campos obrigatórios corretos', () => {
    const [primeiro] = gerarLancamentosFaltantes(regra, [], HOJE)
    expect(primeiro.loja_id).toBe('sualoja')
    expect(primeiro.descricao).toBe('Aluguel')
    expect(primeiro.categoria).toBe('aluguel')
    expect(primeiro.valor).toBe(1000)
    expect(primeiro.status).toBe('pendente')
    expect(primeiro.recorrencia_id).toBe('rec-1')
  })

  it('frequência semanal gera datas a cada 7 dias', () => {
    const regraS = { ...regra, frequencia: 'semanal' }
    const novos = gerarLancamentosFaltantes(regraS, [], HOJE)
    expect(novos).toHaveLength(6)
    expect(novos[1].data_vencimento).toBe('2026-07-25')
    expect(novos[2].data_vencimento).toBe('2026-08-01')
  })

  it('frequência anual gera datas a cada 1 ano', () => {
    const regraA = { ...regra, frequencia: 'anual' }
    const novos = gerarLancamentosFaltantes(regraA, [], HOJE)
    expect(novos).toHaveLength(6)
    expect(novos[1].data_vencimento).toBe('2027-07-18')
    expect(novos[5].data_vencimento).toBe('2031-07-18')
  })

  it('ignora lançamentos de outras regras ao calcular o total existente', () => {
    const existentes = Array.from({ length: 6 }, (_, i) => ({
      recorrencia_id: 'outra-regra',
      data_vencimento: `2026-${String(7 + i).padStart(2, '0')}-18`,
      status: 'pendente',
    }))
    expect(gerarLancamentosFaltantes(regra, existentes, HOJE)).toHaveLength(6)
  })
})

// ── contarLancamentosFuturos ──────────────────────────────────────
describe('contarLancamentosFuturos', () => {
  const HOJE = '2026-07-18'
  const lancamentos = [
    { recorrencia_id: 'rec-1', data_vencimento: '2026-07-18', status: 'pendente' }, // futuro ✓
    { recorrencia_id: 'rec-1', data_vencimento: '2026-08-18', status: 'pendente' }, // futuro ✓
    { recorrencia_id: 'rec-1', data_vencimento: '2026-06-18', status: 'pago'     }, // pago ✗
    { recorrencia_id: 'rec-1', data_vencimento: '2026-05-18', status: 'pendente' }, // passado ✗
    { recorrencia_id: 'rec-2', data_vencimento: '2026-07-18', status: 'pendente' }, // outra regra ✗
  ]

  it('conta apenas futuros não-pagos da regra especificada', () => {
    expect(contarLancamentosFuturos('rec-1', lancamentos, HOJE)).toBe(2)
  })

  it('não conta lançamentos de outras regras', () => {
    expect(contarLancamentosFuturos('rec-2', lancamentos, HOJE)).toBe(1)
  })

  it('retorna 0 quando não há futuros', () => {
    expect(contarLancamentosFuturos('rec-1', lancamentos, '2026-12-01')).toBe(0)
  })

  it('retorna 0 para recorrencia_id inexistente', () => {
    expect(contarLancamentosFuturos('nao-existe', lancamentos, HOJE)).toBe(0)
  })
})
