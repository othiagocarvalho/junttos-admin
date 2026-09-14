import { describe, it, expect, vi } from 'vitest'
import { buildVariacoes, variacaoesToGrade, variacoeesToTamanhosSel } from './ProdutosB2BPro.jsx'

// Mesmo motivo de ProdutosB2BPro.fotos.test.js: o módulo importa supabase no
// topo, que chama createClient() e depende das env vars do Vite.
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({}) } }))

// ── buildVariacoes: código manual opcional, por linha da grade ────────────
describe('buildVariacoes — código de barras manual', () => {
  it('inclui `codigo` só na linha que foi preenchida', () => {
    const grade = [
      { tamanho: 'P', quantidade: '5', codigo: '7891234560012' },
      { tamanho: 'M', quantidade: '3', codigo: '' },
    ]
    const variacoes = buildVariacoes(grade)
    expect(variacoes[0]).toEqual({ tamanho: 'P', quantidade: 5, codigo: '7891234560012' })
    expect(variacoes[1]).toEqual({ tamanho: 'M', quantidade: 3 })
    expect(variacoes[1]).not.toHaveProperty('codigo')
  })

  it('campo vazio ou só espaço não gera a chave `codigo` — comportamento automático de sempre', () => {
    const grade = [{ tamanho: 'G', quantidade: '2', codigo: '   ' }]
    expect(buildVariacoes(grade)[0]).toEqual({ tamanho: 'G', quantidade: 2 })
  })

  it('linha sem o campo `codigo` (grade antiga, sem o campo novo) continua funcionando', () => {
    const grade = [{ tamanho: 'GG', quantidade: '1' }]
    expect(buildVariacoes(grade)[0]).toEqual({ tamanho: 'GG', quantidade: 1 })
  })

  it('normaliza o manual (espaço, caixa) do mesmo jeito que a leitura no PDV', () => {
    const grade = [{ tamanho: 'P', quantidade: '1', codigo: ' 789 123 4560012 ' }]
    expect(buildVariacoes(grade)[0].codigo).toBe('7891234560012')
  })
})

// ── variacaoesToGrade: reabrir "Editar Grade" não pode apagar o manual ────
describe('variacaoesToGrade — carrega o código manual de volta pro form', () => {
  it('traz `codigo` de volta quando a variação salva já tinha um', () => {
    const variacoes = [{ tamanho: 'P', quantidade: 5, codigo: '7891234560012' }]
    expect(variacaoesToGrade(variacoes)[0]).toEqual({ tamanho: 'P', quantidade: '5', codigo: '7891234560012' })
  })

  it('variação sem `codigo` volta com string vazia (campo em branco no form)', () => {
    const variacoes = [{ tamanho: 'M', quantidade: 3 }]
    expect(variacaoesToGrade(variacoes)[0].codigo).toBe('')
  })

  it('não confunde `codigo` com o rótulo (tamanho)', () => {
    const variacoes = [{ tamanho: 'G', quantidade: 2, codigo: '123456789012' }]
    expect(variacaoesToGrade(variacoes)[0].tamanho).toBe('G')
  })
})

// ── Round-trip: código manual sobrevive a uma edição de grade ─────────────
describe('round-trip buildVariacoes(variacaoesToGrade(...)) — sobrevive a editar a grade', () => {
  it('reabrir, adicionar um tamanho novo e salvar preserva o código das linhas antigas', () => {
    const salvas = [
      { tamanho: 'P', quantidade: 5, codigo: '7891234560012' },
      { tamanho: 'M', quantidade: 3 },
    ]
    const grade = variacaoesToGrade(salvas)
    // Simula a lojista adicionando um tamanho novo, sem mexer nas linhas existentes.
    grade.push({ tamanho: 'G', quantidade: '4', codigo: '' })

    const resultado = buildVariacoes(grade)
    expect(resultado).toEqual([
      { tamanho: 'P', quantidade: 5, codigo: '7891234560012' },
      { tamanho: 'M', quantidade: 3 },
      { tamanho: 'G', quantidade: 4 },
    ])
  })

  it('reordenar as linhas não perde nem troca o código de lugar', () => {
    const salvas = [
      { tamanho: 'P', quantidade: 5, codigo: '111111111111' },
      { tamanho: 'M', quantidade: 3, codigo: '222222222222' },
    ]
    const grade = variacaoesToGrade(salvas)
    const invertida = [grade[1], grade[0]]

    const resultado = buildVariacoes(invertida)
    expect(resultado.find(v => v.tamanho === 'P').codigo).toBe('111111111111')
    expect(resultado.find(v => v.tamanho === 'M').codigo).toBe('222222222222')
  })
})

// ── variacoeesToTamanhosSel: modo simples não confunde código com tamanho ──
describe('variacoeesToTamanhosSel — ignora `codigo` na busca do rótulo', () => {
  it('devolve só os tamanhos, mesmo quando a variação tem código manual', () => {
    const variacoes = [
      { tamanho: 'P', quantidade: 5, codigo: '7891234560012' },
      { tamanho: 'M', quantidade: 3 },
    ]
    expect(variacoeesToTamanhosSel(variacoes)).toEqual(['P', 'M'])
  })
})
