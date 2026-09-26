import { describe, it, expect } from 'vitest'
import {
  adicionarAoCarrinho,
  rotuloVariacao, codigoDaVariacao, normalizarCodigo, CODIGO_DIGITOS,
  etiquetasDoProduto, etiquetasDeProdutos, buscarPorCodigo, pareceLeitura,
  codigoEfetivo,
} from './codigoBarras'

// Formatos reais medidos em produção (426 variações da base):
//   {cor, quantidade}            264
//   {cor, custo, quantidade}      93
//   {quantidade, tamanho}         69
const prodCor = {
  id: '16c37d44-7df1-445d-9330-923fde6cf83a', nome: 'VESTIDO PATY', preco_venda: 44.9,
  variacoes: [{ cor: 'ROSA', quantidade: 3 }, { cor: 'NUDE', custo: 20, quantidade: 5 }],
}
const prodTam = {
  id: 'a1b2c3d4-0000-0000-0000-000000000000', nome: 'CAMISA LISA', preco_venda: 20,
  variacoes: [{ quantidade: 2, tamanho: 'M' }],
}

describe('rotuloVariacao', () => {
  it('acha a cor e o tamanho, ignorando quantidade e custo', () => {
    expect(rotuloVariacao({ cor: 'ROSA', quantidade: 3 })).toBe('ROSA')
    expect(rotuloVariacao({ cor: 'NUDE', custo: 20, quantidade: 5 })).toBe('NUDE')
    expect(rotuloVariacao({ quantidade: 2, tamanho: 'M' })).toBe('M')
  })

  it('variação só com controle não tem rótulo', () => {
    expect(rotuloVariacao({ quantidade: 3 })).toBeNull()
    expect(rotuloVariacao({ quantidade: 3, custo: 1 })).toBeNull()
    expect(rotuloVariacao(null)).toBeNull()
  })

  it('rótulo em branco conta como ausente', () => {
    expect(rotuloVariacao({ cor: '   ', quantidade: 1 })).toBeNull()
  })
})

describe('codigoDaVariacao', () => {
  it('é determinístico — a etiqueta impressa hoje bipa amanhã', () => {
    const a = codigoDaVariacao('tropicaleatacado', prodCor.id, 'ROSA')
    const b = codigoDaVariacao('tropicaleatacado', prodCor.id, 'ROSA')
    expect(a).toBe(b)
    expect(a).toBeTruthy()
  })

  it('é só de dígitos — é isso que ativa o Code C do Code128', () => {
    // Medido com o JsBarcode: 12 dígitos custam 101 módulos (Code C, dois
    // dígitos por símbolo) contra 167 de 12 alfanuméricos. Em 31mm úteis, a
    // diferença é 0,256mm por barra contra 0,166mm — o piso seguro para leitor
    // de mão é ~0,19mm. Qualquer letra no código derruba para o modo B e a
    // etiqueta térmica volta a ficar ilegível.
    const c = codigoDaVariacao('tropicaleatacado', prodCor.id, 'ROSA')
    expect(c).toMatch(/^[0-9]+$/)
  })

  it('tem sempre CODIGO_DIGITOS dígitos, com zero à esquerda quando precisa', () => {
    // Comprimento fixo importa: o Code C exige quantidade par de dígitos para
    // não gastar um símbolo extra trocando de modo no fim.
    expect(CODIGO_DIGITOS % 2).toBe(0)
    for (const rot of ['ROSA', 'NUDE', 'M', 'Único', 'A']) {
      expect(codigoDaVariacao('l', prodCor.id, rot)).toHaveLength(CODIGO_DIGITOS)
    }
  })

  it('variações diferentes do mesmo produto têm códigos diferentes', () => {
    // É o ponto central da decisão: o estoque é por variação.
    const rosa = codigoDaVariacao('l', prodCor.id, 'ROSA')
    const nude = codigoDaVariacao('l', prodCor.id, 'NUDE')
    expect(rosa).not.toBe(nude)
  })

  it('mesma variação em lojas diferentes não colide', () => {
    // Produto importado para duas lojas mantém o mesmo id — sem o loja_id no
    // hash, uma etiqueta bipada baixaria estoque da loja errada.
    expect(codigoDaVariacao('lojaA', prodCor.id, 'ROSA'))
      .not.toBe(codigoDaVariacao('lojaB', prodCor.id, 'ROSA'))
  })

  it('sem produto ou sem rótulo devolve vazio, não um código quebrado', () => {
    expect(codigoDaVariacao('l', '', 'ROSA')).toBe('')
    expect(codigoDaVariacao('l', prodCor.id, '')).toBe('')
  })
})

describe('codigoEfetivo', () => {
  it('usa o código manual quando a variação tem `codigo` preenchido', () => {
    const v = { cor: 'ROSA', quantidade: 3, codigo: '7891234560012' }
    expect(codigoEfetivo('tropicaleatacado', prodCor.id, v)).toBe('7891234560012')
  })

  it('normaliza o manual (espaço, caixa) do mesmo jeito que a leitura no PDV', () => {
    const v = { cor: 'ROSA', quantidade: 3, codigo: ' 789 123 4560012 ' }
    expect(codigoEfetivo('tropicaleatacado', prodCor.id, v)).toBe('7891234560012')
  })

  it('cai no hash automático quando `codigo` está ausente', () => {
    const v = { cor: 'ROSA', quantidade: 3 }
    expect(codigoEfetivo('tropicaleatacado', prodCor.id, v))
      .toBe(codigoDaVariacao('tropicaleatacado', prodCor.id, 'ROSA'))
  })

  it('string vazia ou só espaço em `codigo` NÃO conta como manual — continua automático', () => {
    const automatico = codigoDaVariacao('tropicaleatacado', prodCor.id, 'ROSA')
    expect(codigoEfetivo('tropicaleatacado', prodCor.id, { cor: 'ROSA', quantidade: 3, codigo: '' }))
      .toBe(automatico)
    expect(codigoEfetivo('tropicaleatacado', prodCor.id, { cor: 'ROSA', quantidade: 3, codigo: '   ' }))
      .toBe(automatico)
  })

  it('É O PONTO CENTRAL DO PEDIDO: o mesmo código manual funciona em lojas diferentes, de propósito', () => {
    // Ao contrário do automático (que muda por loja_id para NUNCA colidir),
    // o manual existe exatamente para IGNORAR essa separação quando é o
    // mesmo produto físico, do mesmo dono, em duas lojas.
    const v = { cor: 'ROSA', quantidade: 3, codigo: '7891234560012' }
    expect(codigoEfetivo('atacadaodosvestidos', prodCor.id, v)).toBe('7891234560012')
    expect(codigoEfetivo('tropicaleatacado', prodCor.id, v)).toBe('7891234560012')
  })
})

describe('etiquetasDoProduto — código manual', () => {
  it('usa o manual só na variação que o tem; a outra continua com o automático de sempre', () => {
    const produto = {
      id: prodCor.id, nome: 'VESTIDO PATY', preco_venda: 44.9,
      variacoes: [
        { cor: 'ROSA', quantidade: 3, codigo: '7891234560012' },
        { cor: 'NUDE', custo: 20, quantidade: 5 },
      ],
    }
    const ets = etiquetasDoProduto(produto, 'tropicaleatacado')
    expect(ets[0].codigo).toBe('7891234560012')
    expect(ets[1].codigo).toBe(codigoDaVariacao('tropicaleatacado', prodCor.id, 'NUDE'))
  })

  it('sem nenhum `codigo` em nenhuma variação, o comportamento é IDÊNTICO ao de antes desta mudança', () => {
    // Regressão: comportamento automático não pode mudar para quem não usa
    // código manual.
    const ets = etiquetasDoProduto(prodCor, 'tropicaleatacado')
    expect(ets[0].codigo).toBe(codigoDaVariacao('tropicaleatacado', prodCor.id, 'ROSA'))
    expect(ets[1].codigo).toBe(codigoDaVariacao('tropicaleatacado', prodCor.id, 'NUDE'))
  })
})

describe('buscarPorCodigo — código manual', () => {
  it('acha a variação pelo código manual', () => {
    const produto = { id: prodCor.id, nome: 'VESTIDO PATY', preco_venda: 44.9,
      variacoes: [{ cor: 'ROSA', quantidade: 3, codigo: '7891234560012' }] }
    const achado = buscarPorCodigo([produto], 'tropicaleatacado', '7891234560012')
    expect(achado.produto.id).toBe(prodCor.id)
    expect(achado.rotulo).toBe('ROSA')
  })

  it('duas lojas com o MESMO código manual não conflitam — cada uma só enxerga os próprios produtos', () => {
    // Simula duas lojas: cada `buscarPorCodigo` recebe só a lista de produtos
    // daquela loja (é assim que a tela já funciona — produtosData vem
    // filtrado por loja do useLojaData). O código manual é igual de propósito.
    const codigoCompartilhado = '7891234560012'
    const produtoAtacadao = {
      id: 'prod-atacadao-uuid', nome: 'Vestido Floral', preco_venda: 89.9,
      variacoes: [{ cor: 'ROSA', quantidade: 3, codigo: codigoCompartilhado }],
    }
    const produtoTropicale = {
      id: 'prod-tropicale-uuid', nome: 'Vestido Floral', preco_venda: 89.9,
      variacoes: [{ cor: 'ROSA', quantidade: 8, codigo: codigoCompartilhado }],
    }

    const achadoAtacadao = buscarPorCodigo([produtoAtacadao], 'atacadaodosvestidos', codigoCompartilhado)
    expect(achadoAtacadao.produto.id).toBe('prod-atacadao-uuid')
    expect(achadoAtacadao.quantidade).toBe(3)

    const achadoTropicale = buscarPorCodigo([produtoTropicale], 'tropicaleatacado', codigoCompartilhado)
    expect(achadoTropicale.produto.id).toBe('prod-tropicale-uuid')
    expect(achadoTropicale.quantidade).toBe(8)
  })
})

describe('normalizarCodigo', () => {
  it('tira espaço e sobe a caixa — leitor às vezes manda com sujeira', () => {
    expect(normalizarCodigo('  482913605744  ')).toBe('482913605744')
    expect(normalizarCodigo('4829 1360 5744')).toBe('482913605744')
    // Segue subindo a caixa: leitor mal configurado ainda pode mandar letra,
    // e normalizar antes de comparar não custa nada.
    expect(normalizarCodigo(' ab12 ')).toBe('AB12')
  })

  it('vazio continua vazio', () => {
    expect(normalizarCodigo('')).toBe('')
    expect(normalizarCodigo(null)).toBe('')
  })
})

describe('etiquetasDoProduto', () => {
  it('uma etiqueta por variação, com nome, rótulo e quantidade', () => {
    const ets = etiquetasDoProduto(prodCor, 'tropicaleatacado')
    expect(ets).toHaveLength(2)
    expect(ets[0]).toMatchObject({ nome: 'VESTIDO PATY', rotulo: 'ROSA', quantidade: 3, preco: 44.9 })
    expect(ets[1].rotulo).toBe('NUDE')
  })

  it('produto sem variação não gera etiqueta', () => {
    // Não existe peça física para etiquetar, e etiqueta genérica não baixaria
    // estoque de variação nenhuma.
    expect(etiquetasDoProduto({ id: 'x', nome: 'Y', variacoes: [] }, 'l')).toEqual([])
    expect(etiquetasDoProduto({ id: 'x', nome: 'Y' }, 'l')).toEqual([])
  })

  it('pula variação sem rótulo em vez de gerar etiqueta inútil', () => {
    const p = { id: 'x', nome: 'Y', variacoes: [{ quantidade: 1 }, { cor: 'AZUL', quantidade: 2 }] }
    const ets = etiquetasDoProduto(p, 'l')
    expect(ets).toHaveLength(1)
    expect(ets[0].rotulo).toBe('AZUL')
  })
})

describe('etiquetasDeProdutos (lote)', () => {
  it('junta as etiquetas de vários produtos na ordem recebida', () => {
    const ets = etiquetasDeProdutos([prodCor, prodTam], 'l')
    expect(ets).toHaveLength(3)
    expect(ets.map(e => e.rotulo)).toEqual(['ROSA', 'NUDE', 'M'])
  })

  it('lista vazia não quebra', () => {
    expect(etiquetasDeProdutos([], 'l')).toEqual([])
    expect(etiquetasDeProdutos(null, 'l')).toEqual([])
  })
})

describe('buscarPorCodigo', () => {
  const produtos = [prodCor, prodTam]
  const lojaId = 'tropicaleatacado'

  it('acha a variação exata que foi bipada', () => {
    const cod = codigoDaVariacao(lojaId, prodCor.id, 'NUDE')
    const achado = buscarPorCodigo(produtos, lojaId, cod)
    expect(achado.produto.id).toBe(prodCor.id)
    expect(achado.rotulo).toBe('NUDE')
    expect(achado.quantidade).toBe(5)
  })

  it('aceita o código com sujeira do leitor', () => {
    const cod = codigoDaVariacao(lojaId, prodTam.id, 'M')
    expect(buscarPorCodigo(produtos, lojaId, `  ${cod.toLowerCase()} `).rotulo).toBe('M')
  })

  it('código desconhecido devolve null — quem chama decide o que fazer', () => {
    expect(buscarPorCodigo(produtos, lojaId, '000000000000')).toBeNull()
    expect(buscarPorCodigo(produtos, lojaId, '')).toBeNull()
  })

  it('código de outra loja não resolve nesta', () => {
    const cod = codigoDaVariacao('outraloja', prodCor.id, 'ROSA')
    expect(buscarPorCodigo(produtos, lojaId, cod)).toBeNull()
  })
})

describe('pareceLeitura', () => {
  it('rajada de leitor é reconhecida', () => {
    expect(pareceLeitura([8, 12, 9, 11])).toBe(true)
  })

  it('digitação humana não é', () => {
    expect(pareceLeitura([120, 200, 90])).toBe(false)
  })

  it('uma tecla lenta no meio já descarta', () => {
    expect(pareceLeitura([8, 300, 9])).toBe(false)
  })

  it('sem amostra não arrisca', () => {
    expect(pareceLeitura([])).toBe(false)
    expect(pareceLeitura(null)).toBe(false)
  })
})

// ── Etapa 2: adicionarAoCarrinho compara por produto_id ────────────────────
describe('adicionarAoCarrinho com produto_id', () => {
  it('grava produto_id no item novo', () => {
    expect(adicionarAoCarrinho([], { produto_id: 'a', nome: 'X', variacao: 'M' }))
      .toEqual([{ produto_id: 'a', nome: 'X', variacao: 'M', obs: '', quantidade: 1 }])
  })
  it('mesmo id + variação soma quantidade', () => {
    const l = adicionarAoCarrinho(adicionarAoCarrinho([], { produto_id: 'a', nome: 'X', variacao: 'M' }), { produto_id: 'a', nome: 'X', variacao: 'M' })
    expect(l).toHaveLength(1)
    expect(l[0].quantidade).toBe(2)
  })
  it('MESMO NOME, ids diferentes → linhas separadas (não mistura as duplicatas)', () => {
    const l = adicionarAoCarrinho(adicionarAoCarrinho([], { produto_id: 'a', nome: 'SHORT', variacao: 'M' }), { produto_id: 'b', nome: 'SHORT', variacao: 'M' })
    expect(l.map(i => i.produto_id)).toEqual(['a', 'b'])
  })
  it('item antigo sem id (rascunho) + bipe do mesmo produto → soma e ganha o id', () => {
    const l = adicionarAoCarrinho([{ nome: 'X', variacao: 'M', obs: '', quantidade: 1 }], { produto_id: 'a', nome: 'X', variacao: 'M' })
    expect(l).toEqual([{ nome: 'X', variacao: 'M', obs: '', quantidade: 2, produto_id: 'a' }])
  })
  it('sem id continua como sempre (nome + variação)', () => {
    expect(adicionarAoCarrinho([], { nome: 'X', variacao: 'M' })).toEqual([{ nome: 'X', variacao: 'M', obs: '', quantidade: 1 }])
  })
})
