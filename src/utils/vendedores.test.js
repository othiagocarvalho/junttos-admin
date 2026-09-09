import { describe, it, expect } from 'vitest'
import {
  SEM_VENDEDOR, normalizarNomeVendedor, chaveVendedor,
  validarNovoVendedor, opcoesVendedor, vendedorParaVenda,
} from './vendedores'
import { calcularComissoes } from './comissao'

describe('SEM_VENDEDOR', () => {
  it('tem valor VAZIO, não o texto "Sem vendedor"', () => {
    // Se gravasse a string, o relatório de comissão criaria uma segunda linha
    // separada da 'Sem vendedor(a)' que já existe hoje para venda sem nome.
    expect(SEM_VENDEDOR.valor).toBe('')
    expect(SEM_VENDEDOR.rotulo).toBe('Sem vendedor')
  })
})

describe('normalizarNomeVendedor', () => {
  it('apara as pontas e colapsa espaço interno', () => {
    expect(normalizarNomeVendedor('  Ana   Lívia  ')).toBe('Ana Lívia')
  })

  it('preserva acento e caixa — o nome aparece no recibo', () => {
    expect(normalizarNomeVendedor('Letícia')).toBe('Letícia')
    expect(normalizarNomeVendedor('BRENDA')).toBe('BRENDA')
  })

  it('vazio e nulo viram string vazia', () => {
    expect(normalizarNomeVendedor('')).toBe('')
    expect(normalizarNomeVendedor('   ')).toBe('')
    expect(normalizarNomeVendedor(null)).toBe('')
  })
})

describe('chaveVendedor', () => {
  it('as três formas que hoje partem a comissão dão a mesma chave', () => {
    const k = chaveVendedor('Ana Lívia')
    expect(chaveVendedor('ana lívia')).toBe(k)
    expect(chaveVendedor('Ana  Lívia')).toBe(k)
    expect(chaveVendedor('  Ana Lívia ')).toBe(k)
  })

  it('pessoas diferentes continuam diferentes', () => {
    expect(chaveVendedor('Ana')).not.toBe(chaveVendedor('Ana Lívia'))
  })
})

describe('validarNovoVendedor', () => {
  it('nome válido passa', () => {
    expect(validarNovoVendedor('Gabriele', ['Brenda'])).toBeNull()
  })

  it('recusa vazio e nome de uma letra', () => {
    expect(validarNovoVendedor('')).toBeTruthy()
    expect(validarNovoVendedor('  ')).toBeTruthy()
    expect(validarNovoVendedor('A')).toBeTruthy()
  })

  it('recusa duplicata mesmo com caixa e espaço diferentes', () => {
    // É o caso que gera duas linhas de comissão para a mesma pessoa.
    expect(validarNovoVendedor('ana lívia', ['Ana Lívia'])).toBeTruthy()
    expect(validarNovoVendedor('Ana  Lívia', ['Ana Lívia'])).toBeTruthy()
  })

  it('duplicata é checada contra INATIVOS também', () => {
    // Reativar é melhor do que criar homônimo — homônimo volta a partir a
    // comissão em duas linhas.
    expect(validarNovoVendedor('Brenda', ['Brenda'])).toBeTruthy()
  })

  it('recusa nome absurdamente longo', () => {
    expect(validarNovoVendedor('x'.repeat(61))).toBeTruthy()
  })
})

describe('opcoesVendedor', () => {
  const lista = [
    { nome: 'Letícia', ativo: true },
    { nome: 'Ana Lívia', ativo: true },
    { nome: 'Brenda', ativo: false },
  ]

  it('"Sem vendedor" é sempre a primeira opção', () => {
    expect(opcoesVendedor(lista)[0]).toEqual(SEM_VENDEDOR)
  })

  it('lista só os ativos, em ordem alfabética pt', () => {
    expect(opcoesVendedor(lista).map(o => o.rotulo))
      .toEqual(['Sem vendedor', 'Ana Lívia', 'Letícia'])
  })

  it('desativado some do select', () => {
    expect(opcoesVendedor(lista).some(o => o.valor === 'Brenda')).toBe(false)
  })

  it('mas se a venda em edição já tem o desativado, ele aparece marcado', () => {
    // Sem isto, abrir uma venda antiga trocaria o vendedor por "Sem vendedor"
    // em silêncio e a comissão dela mudaria sozinha.
    const ops = opcoesVendedor(lista, 'Brenda')
    const b = ops.find(o => o.valor === 'Brenda')
    expect(b).toBeTruthy()
    expect(b.rotulo).toBe('Brenda (inativo)')
    expect(b.inativo).toBe(true)
  })

  it('nome digitado à mão no passado também é preservado', () => {
    const ops = opcoesVendedor(lista, 'Fulana Antiga')
    expect(ops.some(o => o.valor === 'Fulana Antiga')).toBe(true)
  })

  it('atual que JÁ está ativo não vira opção duplicada', () => {
    const ops = opcoesVendedor(lista, 'Letícia')
    expect(ops.filter(o => o.valor === 'Letícia')).toHaveLength(1)
  })

  it('lista vazia ainda oferece "Sem vendedor"', () => {
    expect(opcoesVendedor([])).toEqual([SEM_VENDEDOR])
    expect(opcoesVendedor(null)).toEqual([SEM_VENDEDOR])
  })

  it('ignora registro sem nome utilizável', () => {
    expect(opcoesVendedor([{ nome: '  ', ativo: true }])).toEqual([SEM_VENDEDOR])
  })
})

describe('vendedorParaVenda', () => {
  it('"Sem vendedor" grava null, igual ao comportamento de hoje', () => {
    // NovaVenda já faz `form.vendedora || null`; e a comissão agrupa vendas
    // sem nome sob 'Sem vendedor(a)'.
    expect(vendedorParaVenda('')).toBeNull()
    expect(vendedorParaVenda('   ')).toBeNull()
  })

  it('grava o nome exatamente como o relatório vai somar', () => {
    expect(vendedorParaVenda('Ana Lívia')).toBe('Ana Lívia')
  })

  it('normaliza antes de gravar — evita o mismatch de espaço', () => {
    expect(vendedorParaVenda('  Ana   Lívia ')).toBe('Ana Lívia')
  })
})

// Fecha o ciclo com a regra real do relatório.
//
// Este bloco reproduzia a mão o agrupamento antigo (igualdade exata de string
// + linha "Sem vendedor(a)"). Essa regra deixou de existir: quem calcula agora
// é calcularComissoes(), e o teste passa a exercitar a função de verdade em vez
// de uma cópia dela — cópia em teste envelhece sem avisar, que foi exatamente
// o que aconteceu aqui.
describe('integração: o que vendedorParaVenda grava alimenta o cálculo real', () => {
  const cadastro = [{ nome: 'Ana Lívia', comissao_percentual: 5 }]

  it('variações de digitação da mesma pessoa caem na MESMA linha', () => {
    const vendas = [
      { vendedora: vendedorParaVenda('Ana Lívia'), valor: 100 },
      { vendedora: vendedorParaVenda('  Ana   Lívia '), valor: 50 },
    ]
    const linhas = calcularComissoes(vendas, cadastro)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ nome: 'Ana Lívia', total: 150, pct: 5, comissao: 7.5 })
  })

  it('"Sem vendedor" grava null e NÃO entra na comissão', () => {
    // Mudança deliberada: antes virava uma linha "Sem vendedor(a)" com
    // comissão calculada, inflando o total a pagar sem ter quem receber.
    const vendas = [
      { vendedora: vendedorParaVenda(SEM_VENDEDOR.valor), valor: 30 },
      { vendedora: null, valor: 20 },
      { vendedora: vendedorParaVenda('Ana Lívia'), valor: 100 },
    ]
    const linhas = calcularComissoes(vendas, cadastro)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].nome).toBe('Ana Lívia')
  })
})
