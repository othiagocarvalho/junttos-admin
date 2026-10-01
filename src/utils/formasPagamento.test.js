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

describe('casos extremos', () => {
  it('descarta forma gravada com nome de forma padrão (evita soma em dobro)', () => {
    const cfg = { formas_pagamento: [{ nome: ' pix ', conta_como: 'Dinheiro' }, { nome: 'Fiado', conta_como: 'Dinheiro' }] }
    expect(formasCadastradas(cfg)).toEqual([])
    expect(opcoesFormaPgto(cfg)).toEqual(FORMAS_PADRAO_MODA)
    expect(contaComoNoCaixa('Pix', cfg)).toBeNull()
  })

  it('recusa < e > no nome (o recibo impresso é HTML)', () => {
    expect(validarNovaForma('Vale <b>', null)).toMatch(/< e >/)
  })

  it('aceita acentos, números e símbolos comuns', () => {
    for (const n of ['Cartão Elo 3x', 'Vale-troca', 'PicPay', 'Crédito loja (50%)', 'R$ fiado & cia']) {
      expect(validarNovaForma(n, null)).toBeNull()
    }
  })

  it('nomes antigos que existem nas vendas reais', () => {
    // "Cartão" já é padrão (Mercado); "Débito", "Crédito", "Troca" podem ser
    // cadastrados e passam a somar no caixa na linha escolhida.
    expect(validarNovaForma('Cartão', null)).toMatch(/padrão/)
    expect(validarNovaForma('Troca', null)).toBeNull()
  })

  it('opção da venda sendo editada em forma antiga aparece no seletor', () => {
    expect(opcoesFormaPgto(null, { atual: 'Cartão' })).toEqual([...FORMAS_PADRAO_MODA, 'Cartão'])
  })

  it('ciclo completo: adiciona, remove, readiciona com outra linha', () => {
    let cfg = { formas_pagamento: [] }
    cfg = { formas_pagamento: adicionarForma(cfg, 'Vale', 'nenhum') }
    cfg = { formas_pagamento: adicionarForma(cfg, 'Boleto', 'Pix') }
    cfg = { formas_pagamento: removerForma(cfg, 'vale') }
    expect(opcoesFormaPgto(cfg)).toEqual([...FORMAS_PADRAO_MODA, 'Boleto'])
    expect(contaComoNoCaixa('Vale', cfg)).toBe('nenhum')
    expect(validarNovaForma('Vale', cfg)).toBeNull()
    cfg = { formas_pagamento: adicionarForma(cfg, 'VALE', 'Dinheiro') }
    expect(formasCadastradas(cfg)).toEqual([
      { nome: 'Vale', conta_como: 'Dinheiro', ativo: true },
      { nome: 'Boleto', conta_como: 'Pix', ativo: true },
    ])
  })

  it('a lista gravada é JSON simples (cabe na coluna jsonb com a trava de array)', () => {
    const lista = adicionarForma(null, 'Vale', 'nenhum')
    expect(Array.isArray(JSON.parse(JSON.stringify(lista)))).toBe(true)
  })
})
