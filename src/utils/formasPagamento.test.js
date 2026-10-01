import { describe, it, expect } from 'vitest'
import {
  FORMAS_PADRAO_MODA, FORMAS_PADRAO_MERCADO, formasCadastradas, opcoesFormaPgto,
  contaComoNoCaixa, validarNovaForma, adicionarForma, removerForma,
} from './formasPagamento'

const config = {
  formas_pagamento: [
    { nome: 'Vale-presente', conta_como: 'nenhum', ativo: true },
    { nome: 'Cheque', conta_como: 'Dinheiro', ativo: false },
  ],
}

describe('formasCadastradas', () => {
  it('tolera config nulo, coluna ausente e lixo', () => {
    expect(formasCadastradas(null)).toEqual([])
    expect(formasCadastradas({})).toEqual([])
    expect(formasCadastradas({ formas_pagamento: 'x' })).toEqual([])
    expect(formasCadastradas({ formas_pagamento: [null, { nome: '  ' }] })).toEqual([])
  })

  it('normaliza conta_como inválido para nenhum e remove repetidas', () => {
    expect(formasCadastradas({ formas_pagamento: [
      { nome: 'Boleto', conta_como: 'Ouro' },
      { nome: 'boleto', conta_como: 'Pix' },
    ] })).toEqual([{ nome: 'Boleto', conta_como: 'nenhum', ativo: true }])
  })
})

describe('opcoesFormaPgto', () => {
  it('padrão + cadastradas ativas', () => {
    expect(opcoesFormaPgto(config)).toEqual([...FORMAS_PADRAO_MODA, 'Vale-presente'])
  })

  it('sem config, só as padrão (comportamento de antes)', () => {
    expect(opcoesFormaPgto(null)).toEqual(FORMAS_PADRAO_MODA)
  })

  it('mantém a forma atual da venda mesmo removida', () => {
    expect(opcoesFormaPgto(config, { atual: 'Cheque' })).toContain('Cheque')
    expect(opcoesFormaPgto(config, { atual: 'Pix' }).filter(f => f === 'Pix')).toHaveLength(1)
  })

  it('aceita a lista padrão do Mercado', () => {
    expect(opcoesFormaPgto(config, { padrao: FORMAS_PADRAO_MERCADO }))
      .toEqual([...FORMAS_PADRAO_MERCADO, 'Vale-presente'])
  })
})

describe('contaComoNoCaixa', () => {
  it('acha pelo nome sem diferenciar maiúscula', () => {
    expect(contaComoNoCaixa('vale-presente', config)).toBe('nenhum')
    expect(contaComoNoCaixa('Cheque', config)).toBe('Dinheiro')
    expect(contaComoNoCaixa('Pix', config)).toBeNull()
  })
})

describe('validarNovaForma', () => {
  it('recusa vazio, nome longo, padrão e já cadastrada', () => {
    expect(validarNovaForma('  ', config)).toMatch(/Informe/)
    expect(validarNovaForma('x'.repeat(41), config)).toMatch(/40/)
    expect(validarNovaForma('pix', config)).toMatch(/padrão/)
    expect(validarNovaForma('Fiado', config)).toMatch(/padrão/)
    expect(validarNovaForma('VALE-PRESENTE', config)).toMatch(/já está/)
  })

  it('aceita nova e a que tinha sido removida', () => {
    expect(validarNovaForma('Boleto', config)).toBeNull()
    expect(validarNovaForma('Cheque', config)).toBeNull()
  })
})

describe('adicionarForma / removerForma', () => {
  it('adiciona no fim', () => {
    expect(adicionarForma(config, ' Boleto ', 'Pix').at(-1)).toEqual({ nome: 'Boleto', conta_como: 'Pix', ativo: true })
  })

  it('reativa a removida com o conta_como novo, sem duplicar', () => {
    const lista = adicionarForma(config, 'cheque', 'Pix')
    expect(lista).toHaveLength(2)
    expect(lista[1]).toEqual({ nome: 'Cheque', conta_como: 'Pix', ativo: true })
  })

  it('remover só desativa', () => {
    const lista = removerForma(config, 'Vale-presente')
    expect(lista[0]).toEqual({ nome: 'Vale-presente', conta_como: 'nenhum', ativo: false })
    expect(lista).toHaveLength(2)
  })
})
