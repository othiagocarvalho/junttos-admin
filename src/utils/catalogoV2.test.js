import { describe, it, expect } from 'vitest'
import {
  normalizarProduto, temCor, temTamanho, legendaCard, perguntaModal, rotuloCelula,
  chaveItem, partesDaChave, linhasDoCarrinho, totais, qtdPorProduto,
  aplicarRascunho, definirQtd, estadoMinimo,
  categoriasDe, filtrarProdutos, ordenarProdutos,
  linhaMensagem, mensagemWhatsApp, telefoneE164, linkWhatsApp,
  chaveCarrinho, carregarCarrinho, salvarCarrinho, TTL_CARRINHO_MS, TAMANHO_UNICO,
  lojaDaConfig,
  nomeValido, whatsappValido, validarDadosCliente, dadosClienteParaPedido,
} from './catalogoV2'

// ── Fixtures espelhando os dados reais da tropicaleatacado ───────────────────
// Todos com tamanhos ["Único"]: é o estado de 100% do catálogo hoje.

const linhaBanco = (over = {}) => ({
  id: 'p1',
  nome: 'VESTIDO CURTO PATY DUDA',
  preco_venda: 33.33,
  fotos: ['foto1.jpg'],
  ativo: true,
  categoria: null,
  variacoes: [
    { cor: 'ROSA BEBÊ', quantidade: 2 },
    { cor: 'ROSA PINK', quantidade: 1 },
    { cor: 'NUDE', quantidade: 0 },
  ],
  ...over,
})

const prodMulticor = normalizarProduto(linhaBanco())
const prodUmaCor = normalizarProduto(linhaBanco({
  id: 'p2', nome: 'MACAQUINHO PATY MAVIE', preco_venda: 44.9,
  variacoes: [{ cor: 'VINHO', quantidade: 5 }],
}))
const prodSemCor = normalizarProduto(linhaBanco({
  id: 'p3', nome: 'LONGO TROPICALE REF 90', preco_venda: 49.99, variacoes: [],
}))
const prodComTamanho = normalizarProduto(linhaBanco({
  id: 'p4', nome: 'CAMISA LISA', preco_venda: 20,
  variacoes: [], tamanhos: ['P', 'M', 'G'],
}))

const mapaProdutos = Object.fromEntries(
  [prodMulticor, prodUmaCor, prodSemCor, prodComTamanho].map(p => [p.id, p]),
)

// ─────────────────────────────────────────────────────────────────────────────
describe('normalizarProduto', () => {
  it('deriva cores de variacoes quando a coluna cores ainda está vazia', () => {
    expect(prodMulticor.cores).toEqual([
      { nome: 'ROSA BEBÊ', hex: '#F7C8DA' },
      { nome: 'ROSA PINK', hex: '#E8317B' },
      { nome: 'NUDE', hex: '#DFC3AC' },
    ])
  })

  it('prefere a coluna cores quando ela já está populada', () => {
    const p = normalizarProduto(linhaBanco({
      cores: [{ nome: 'Turquesa', hex: '#123456' }],
    }))
    expect(p.cores).toEqual([{ nome: 'Turquesa', hex: '#123456' }])
  })

  it('deriva a categoria do nome quando a coluna está NULL', () => {
    expect(prodMulticor.categoria).toBe('Vestidos')
    expect(prodSemCor.categoria).toBe('Longos')
    expect(normalizarProduto(linhaBanco({ nome: 'CJ. DE SAIA LONGA GRINGA VANESSA' })).categoria)
      .toBe('Saias')
  })

  it('respeita a categoria já cadastrada no banco', () => {
    expect(normalizarProduto(linhaBanco({ categoria: 'Festa' })).categoria).toBe('Festa')
  })

  it('usa ["Único"] quando o banco não traz tamanhos', () => {
    expect(prodMulticor.tamanhos).toEqual([TAMANHO_UNICO])
    expect(prodSemCor.tamanhos).toEqual([TAMANHO_UNICO])
  })

  it('nunca herda grade padrão da loja — produto sem tamanho continua sem tamanho', () => {
    for (const p of [prodMulticor, prodUmaCor, prodSemCor]) {
      expect(p.tamanhos).toEqual([TAMANHO_UNICO])
      expect(temTamanho(p)).toBe(false)
    }
  })

  it('preço vem de preco_venda e vira número', () => {
    expect(prodMulticor.preco).toBe(33.33)
    expect(normalizarProduto(linhaBanco({ preco_venda: null })).preco).toBe(0)
  })

  it('descarta foto vazia', () => {
    expect(normalizarProduto(linhaBanco({ fotos: ['a.jpg', null, ''] })).fotos).toEqual(['a.jpg'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('copy dinâmica — seção 6', () => {
  it('temCor só com mais de uma cor', () => {
    expect(temCor(prodMulticor)).toBe(true)
    expect(temCor(prodUmaCor)).toBe(false)
    expect(temCor(prodSemCor)).toBe(false)
  })

  it('temTamanho é falso para ["Único"]', () => {
    expect(temTamanho(prodMulticor)).toBe(false)
    expect(temTamanho(prodComTamanho)).toBe(true)
  })

  it('legenda do card: várias cores + tamanho único', () => {
    expect(legendaCard(prodMulticor)).toBe('3 cores · Tamanho único')
  })

  it('legenda do card: cor única nomeada', () => {
    expect(legendaCard(prodUmaCor)).toBe('VINHO · Tamanho único')
  })

  it('legenda do card: sem cor nenhuma não deixa separador solto', () => {
    expect(legendaCard(prodSemCor)).toBe('Tamanho único')
  })

  it('legenda do card: tamanhos listados separados por espaço', () => {
    expect(legendaCard(prodComTamanho)).toBe('P M G')
  })

  it('pergunta do modal cobre as 4 combinações da tabela', () => {
    const comAmbos = normalizarProduto(linhaBanco({ tamanhos: ['P', 'M'] }))
    expect(perguntaModal(comAmbos)).toBe('Quantas peças de cada cor e tamanho?')
    expect(perguntaModal(prodMulticor)).toBe('Quantas peças de cada cor?')
    expect(perguntaModal(prodComTamanho)).toBe('Quantas peças de cada tamanho?')
    expect(perguntaModal(prodUmaCor)).toBe('Quantas peças você quer?')
    expect(perguntaModal(prodSemCor)).toBe('Quantas peças você quer?')
  })

  it('nunca escreve "cor e tamanho" quando o produto só tem um dos dois', () => {
    for (const p of [prodMulticor, prodComTamanho, prodUmaCor, prodSemCor]) {
      if (temCor(p) && temTamanho(p)) continue
      expect(perguntaModal(p)).not.toContain('cor e tamanho')
    }
  })

  it('rótulo da célula vira "Quantidade" sem tamanho', () => {
    expect(rotuloCelula(prodMulticor, TAMANHO_UNICO)).toBe('Quantidade')
    expect(rotuloCelula(prodComTamanho, 'M')).toBe('M')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('carrinho — subtotal e total', () => {
  it('chave é produtoId|cor|tamanho e volta desmontada', () => {
    expect(chaveItem('p1', 'ROSA PINK', 'M')).toBe('p1|ROSA PINK|M')
    expect(chaveItem('p1', '', '')).toBe('p1||')
    expect(partesDaChave('p1|ROSA PINK|M')).toEqual({ produtoId: 'p1', cor: 'ROSA PINK', tamanho: 'M' })
    expect(partesDaChave('p1||')).toEqual({ produtoId: 'p1', cor: '', tamanho: '' })
  })

  it('subtotal por linha = preço × quantidade', () => {
    const linhas = linhasDoCarrinho({ 'p1|ROSA PINK|Único': 3 }, mapaProdutos)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].subtotal).toBeCloseTo(99.99, 2)
    expect(linhas[0].foto).toBe('foto1.jpg')
  })

  it('total soma peças e valor de todas as linhas', () => {
    const carrinho = {
      'p1|ROSA PINK|Único': 3,   // 3 × 33.33 = 99.99
      'p1|ROSA BEBÊ|Único': 2,   // 2 × 33.33 = 66.66
      'p2|VINHO|Único': 5,       // 5 × 44.90 = 224.50
    }
    const { pecas, valor } = totais(linhasDoCarrinho(carrinho, mapaProdutos))
    expect(pecas).toBe(10)
    expect(valor).toBeCloseTo(391.15, 2)
  })

  it('ignora quantidade zero ou negativa', () => {
    const linhas = linhasDoCarrinho({ 'p1|A|Único': 0, 'p1|B|Único': -2 }, mapaProdutos)
    expect(linhas).toEqual([])
    expect(totais(linhas)).toEqual({ pecas: 0, valor: 0 })
  })

  it('descarta item cujo produto sumiu do catálogo', () => {
    const linhas = linhasDoCarrinho({ 'sumiu|X|Único': 4 }, mapaProdutos)
    expect(linhas).toEqual([])
  })

  it('carrinho vazio soma zero', () => {
    expect(totais(linhasDoCarrinho({}, mapaProdutos))).toEqual({ pecas: 0, valor: 0 })
  })

  it('qtdPorProduto agrupa as variações do mesmo produto', () => {
    expect(qtdPorProduto({
      'p1|ROSA PINK|Único': 3, 'p1|NUDE|Único': 1, 'p2|VINHO|Único': 5,
    })).toEqual({ p1: 4, p2: 5 })
  })

  it('aplicarRascunho soma ao que já está no carrinho', () => {
    const { carrinho, adicionadas } = aplicarRascunho(
      { 'p1|ROSA PINK|Único': 2 }, 'p1',
      { 'ROSA PINK|Único': 3, 'NUDE|Único': 1, 'BRANCO|Único': 0 },
    )
    expect(carrinho).toEqual({ 'p1|ROSA PINK|Único': 5, 'p1|NUDE|Único': 1 })
    expect(adicionadas).toBe(4)
  })

  it('aplicarRascunho vazio não altera nem conta nada', () => {
    const { carrinho, adicionadas } = aplicarRascunho({ 'p1|A|Único': 2 }, 'p1', {})
    expect(carrinho).toEqual({ 'p1|A|Único': 2 })
    expect(adicionadas).toBe(0)
  })

  it('definirQtd em zero remove a linha', () => {
    expect(definirQtd({ 'p1|A|Único': 3 }, 'p1|A|Único', 0)).toEqual({})
    expect(definirQtd({ 'p1|A|Único': 3 }, 'p1|A|Único', 7)).toEqual({ 'p1|A|Único': 7 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('pedido mínimo', () => {
  const min = { tipo: 'valor', valor: 300, qtd: 0 }

  it('sem mínimo configurado não há faixa', () => {
    expect(estadoMinimo(null, { pecas: 0, valor: 0 })).toBeNull()
    expect(estadoMinimo({ tipo: 'nenhum' }, { pecas: 0, valor: 0 })).toBeNull()
    expect(estadoMinimo({ tipo: 'valor', valor: 0 }, { pecas: 0, valor: 0 })).toBeNull()
  })

  it('carrinho vazio anuncia o mínimo', () => {
    const e = estadoMinimo(min, { pecas: 0, valor: 0 })
    expect(e.texto).toBe('Pedido mínimo de R$ 300,00.')
    expect(e.progresso).toBe(0)
    expect(e.atingido).toBe(false)
  })

  it('abaixo do mínimo diz quanto falta', () => {
    const e = estadoMinimo(min, { pecas: 2, valor: 120 })
    expect(e.texto).toBe('Faltam R$ 180,00 para atingir o pedido mínimo de R$ 300,00.')
    expect(e.progresso).toBeCloseTo(40, 5)
    expect(e.aviso).toBe('Faltam R$ 180,00 para o pedido mínimo. Adicione mais peças para finalizar.')
  })

  it('atingido libera e a barra não passa de 100%', () => {
    const e = estadoMinimo(min, { pecas: 20, valor: 900 })
    expect(e.texto).toBe('Pedido mínimo atingido. Você já pode finalizar.')
    expect(e.progresso).toBe(100)
    expect(e.atingido).toBe(true)
    expect(e.aviso).toBe('')
  })

  it('mínimo por quantidade continua funcionando', () => {
    const e = estadoMinimo({ tipo: 'quantidade', qtd: 10 }, { pecas: 4, valor: 999 })
    expect(e.atingido).toBe(false)
    expect(e.falta).toBe(6)
    expect(e.texto).toContain('6 peças')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('busca, filtro e ordenação', () => {
  const lista = [prodMulticor, prodUmaCor, prodSemCor]

  it('primeiro chip é Tudo e os demais são as categorias na ordem de cadastro', () => {
    expect(categoriasDe(lista)).toEqual(['Tudo', 'Vestidos', 'Macaquinhos', 'Longos'])
  })

  it('Tudo não filtra', () => {
    expect(filtrarProdutos(lista, '', 'Tudo')).toHaveLength(3)
  })

  it('filtra por categoria', () => {
    expect(filtrarProdutos(lista, '', 'Longos').map(p => p.id)).toEqual(['p3'])
  })

  it('busca por nome ignora acento e caixa', () => {
    expect(filtrarProdutos(lista, 'macaquinho', 'Tudo').map(p => p.id)).toEqual(['p2'])
    expect(filtrarProdutos(lista, 'TROPICALE', 'Tudo').map(p => p.id)).toEqual(['p3'])
  })

  it('busca também casa a categoria', () => {
    expect(filtrarProdutos(lista, 'vestidos', 'Tudo').map(p => p.id)).toEqual(['p1'])
  })

  it('busca sem resultado devolve lista vazia', () => {
    expect(filtrarProdutos(lista, 'jaqueta de couro', 'Tudo')).toEqual([])
  })

  it('ordena por preço e por nome sem mutar a lista original', () => {
    const antes = lista.map(p => p.id)
    expect(ordenarProdutos(lista, 'menor').map(p => p.preco)).toEqual([33.33, 44.9, 49.99])
    expect(ordenarProdutos(lista, 'maior').map(p => p.preco)).toEqual([49.99, 44.9, 33.33])
    expect(ordenarProdutos(lista, 'nome').map(p => p.nome[0])).toEqual(['L', 'M', 'V'])
    expect(ordenarProdutos(lista, 'destaque').map(p => p.id)).toEqual(antes)
    expect(lista.map(p => p.id)).toEqual(antes)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('mensagem do WhatsApp — seção 8.1', () => {
  it('linha com cor, sem tamanho (o caso de 100% do catálogo hoje)', () => {
    const [linha] = linhasDoCarrinho({ 'p1|ROSA PINK|Único': 3 }, mapaProdutos)
    expect(linhaMensagem(linha, prodMulticor))
      .toBe('VESTIDO CURTO PATY DUDA — ROSA PINK — 3x R$ 33,33 = R$ 99,99')
  })

  it('omite a cor quando o produto só tem uma', () => {
    const [linha] = linhasDoCarrinho({ 'p2|VINHO|Único': 5 }, mapaProdutos)
    expect(linhaMensagem(linha, prodUmaCor))
      .toBe('MACAQUINHO PATY MAVIE — 5x R$ 44,90 = R$ 224,50')
  })

  it('inclui cor / tamanho quando existem os dois', () => {
    const comAmbos = normalizarProduto(linhaBanco({ id: 'p5', tamanhos: ['P', 'M'] }))
    const [linha] = linhasDoCarrinho({ 'p5|ROSA PINK|M': 2 }, { p5: comAmbos })
    expect(linhaMensagem(linha, comAmbos))
      .toBe('VESTIDO CURTO PATY DUDA — ROSA PINK / M — 2x R$ 33,33 = R$ 66,66')
  })

  it('monta a mensagem completa no formato da spec', () => {
    const carrinho = { 'p1|ROSA PINK|Único': 3, 'p2|VINHO|Único': 5 }
    const linhas = linhasDoCarrinho(carrinho, mapaProdutos)
    const msg = mensagemWhatsApp({
      nomeLoja: 'TropicaleAtacado',
      linhas,
      produtosPorId: mapaProdutos,
      url: 'https://junttos.app/tropicaleatacado/catalogo',
    })
    expect(msg).toBe([
      'Olá! Quero fazer um pedido no catálogo da TropicaleAtacado.',
      '',
      'VESTIDO CURTO PATY DUDA — ROSA PINK — 3x R$ 33,33 = R$ 99,99',
      'MACAQUINHO PATY MAVIE — 5x R$ 44,90 = R$ 224,50',
      '',
      'Total: 8 peças — R$ 324,49',
      'Pedido feito em: https://junttos.app/tropicaleatacado/catalogo',
    ].join('\n'))
  })

  it('formata moeda em pt-BR com separador de milhar', () => {
    const caro = normalizarProduto(linhaBanco({ id: 'p9', nome: 'PEÇA CARA', preco_venda: 1234.56, variacoes: [] }))
    const linhas = linhasDoCarrinho({ 'p9||': 1 }, { p9: caro })
    expect(linhaMensagem(linhas[0], caro)).toContain('R$ 1.234,56')
  })
})

describe('telefone e link do WhatsApp', () => {
  it('adiciona o DDI 55 em número brasileiro', () => {
    expect(telefoneE164('(85) 99999-0000')).toBe('5585999990000')
    expect(telefoneE164('8533334444')).toBe('558533334444')
  })

  it('não duplica o DDI de número já completo', () => {
    expect(telefoneE164('5585999990000')).toBe('5585999990000')
  })

  it('devolve vazio quando não há número', () => {
    expect(telefoneE164('')).toBe('')
    expect(telefoneE164(null)).toBe('')
    expect(telefoneE164('sem número')).toBe('')
  })

  it('monta o wa.me com a mensagem codificada', () => {
    const link = linkWhatsApp('(85) 99999-0000', 'Olá! Pedido')
    expect(link).toBe('https://wa.me/5585999990000?text=Ol%C3%A1!%20Pedido')
  })

  it('sem telefone não gera link — o botão verde não pode existir', () => {
    expect(linkWhatsApp('', 'Olá')).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('persistência do carrinho — seção 8.3', () => {
  const fakeStorage = (inicial = {}) => {
    const dados = { ...inicial }
    return {
      dados,
      getItem: k => (k in dados ? dados[k] : null),
      setItem: (k, v) => { dados[k] = v },
      removeItem: k => { delete dados[k] },
    }
  }

  it('a chave é isolada por loja', () => {
    expect(chaveCarrinho('tropicaleatacado')).toBe('catalogo:tropicaleatacado:carrinho')
  })

  it('salva e restaura o carrinho', () => {
    const s = fakeStorage()
    salvarCarrinho(s, 'lojaA', { 'p1|ROSA|Único': 3 }, 1000)
    expect(carregarCarrinho(s, 'lojaA', 2000)).toEqual({ 'p1|ROSA|Único': 3 })
  })

  it('nunca lê nem apaga a chave de outra loja', () => {
    const s = fakeStorage()
    salvarCarrinho(s, 'lojaA', { 'p1|ROSA|Único': 3 }, 1000)
    salvarCarrinho(s, 'lojaB', { 'p9|AZUL|Único': 1 }, 1000)
    salvarCarrinho(s, 'lojaB', {}, 1000)  // esvaziar B não pode tocar em A
    expect(carregarCarrinho(s, 'lojaA', 1000)).toEqual({ 'p1|ROSA|Único': 3 })
    expect(carregarCarrinho(s, 'lojaB', 1000)).toEqual({})
  })

  it('descarta carrinho com mais de 7 dias', () => {
    const s = fakeStorage()
    salvarCarrinho(s, 'lojaA', { 'p1|ROSA|Único': 3 }, 0)
    expect(carregarCarrinho(s, 'lojaA', TTL_CARRINHO_MS - 1)).toEqual({ 'p1|ROSA|Único': 3 })
    expect(carregarCarrinho(s, 'lojaA', TTL_CARRINHO_MS + 1)).toEqual({})
  })

  it('carrinho vazio remove a chave em vez de gravar lixo', () => {
    const s = fakeStorage()
    salvarCarrinho(s, 'lojaA', { 'p1|ROSA|Único': 3 }, 1000)
    salvarCarrinho(s, 'lojaA', {}, 1000)
    expect(s.getItem(chaveCarrinho('lojaA'))).toBeNull()
  })

  it('JSON quebrado ou formato estranho devolve carrinho vazio', () => {
    expect(carregarCarrinho(fakeStorage({ 'catalogo:x:carrinho': '{quebrado' }), 'x')).toEqual({})
    expect(carregarCarrinho(fakeStorage({ 'catalogo:x:carrinho': '"texto"' }), 'x')).toEqual({})
    expect(carregarCarrinho(fakeStorage({ 'catalogo:x:carrinho': '{"itens":{"a":1}}' }), 'x')).toEqual({})
  })

  it('storage indisponível não derruba o catálogo', () => {
    const quebrado = {
      getItem: () => { throw new Error('bloqueado') },
      setItem: () => { throw new Error('bloqueado') },
      removeItem: () => { throw new Error('bloqueado') },
    }
    expect(carregarCarrinho(quebrado, 'x')).toEqual({})
    expect(() => salvarCarrinho(quebrado, 'x', { a: 1 })).not.toThrow()
    expect(carregarCarrinho(null, 'x')).toEqual({})
  })

  it('quantidade inválida não sobrevive à leitura', () => {
    const s = fakeStorage()
    s.setItem(chaveCarrinho('x'), JSON.stringify({ salvoEm: 1000, itens: { a: 0, b: -3, c: 'oi', d: 2.7, e: 4 } }))
    expect(carregarCarrinho(s, 'x', 1000)).toEqual({ d: 2, e: 4 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('catálogo inteiro com tamanhos ["Único"] — estado real de produção', () => {
  // Os 4 casos de forma que aparecem nos 37 produtos da tropicaleatacado.
  const catalogo = [
    normalizarProduto(linhaBanco({ id: 'a', nome: 'VESTIDO CURTO PATY MEL', preco_venda: 33.33,
      variacoes: [{ cor: 'AZUL' }, { cor: 'VERDE' }, { cor: 'TERRACOTA' }] })),
    normalizarProduto(linhaBanco({ id: 'b', nome: 'VESTIDO CURTO PATY LAÍS', preco_venda: 33.33,
      variacoes: [{ cor: 'NUDE' }, { cor: 'PRETO' }] })),
    normalizarProduto(linhaBanco({ id: 'c', nome: 'MACAQUINHO PATY MAVIE', preco_venda: 44.99,
      variacoes: [{ cor: 'VINHO' }] })),
    normalizarProduto(linhaBanco({ id: 'd', nome: 'LONGO TROPICALE REF 90', preco_venda: 49.99,
      variacoes: [] })),
  ]

  it('nenhum produto oferece escolha de tamanho', () => {
    expect(catalogo.every(p => p.tamanhos.length === 1 && p.tamanhos[0] === TAMANHO_UNICO)).toBe(true)
    expect(catalogo.some(temTamanho)).toBe(false)
  })

  it('nenhuma pergunta do modal menciona tamanho', () => {
    for (const p of catalogo) expect(perguntaModal(p)).not.toContain('tamanho')
  })

  it('toda legenda termina em "Tamanho único"', () => {
    for (const p of catalogo) expect(legendaCard(p).endsWith('Tamanho único')).toBe(true)
  })

  it('a chave do carrinho carrega o tamanho Único e a mensagem não o mostra', () => {
    const mapa = Object.fromEntries(catalogo.map(p => [p.id, p]))
    const carrinho = aplicarRascunho({}, 'a', { 'AZUL|Único': 2, 'VERDE|Único': 1 }).carrinho
    expect(Object.keys(carrinho).sort()).toEqual(['a|AZUL|Único', 'a|VERDE|Único'])

    const linhas = linhasDoCarrinho(carrinho, mapa)
    const msg = mensagemWhatsApp({ nomeLoja: 'Sua Loja', linhas, produtosPorId: mapa, url: 'u' })
    expect(msg).not.toContain('Único')
    expect(msg).toContain('VESTIDO CURTO PATY MEL — AZUL — 2x R$ 33,33 = R$ 66,66')
    expect(msg).toContain('Total: 3 peças — R$ 99,99')
  })

  it('produto sem cor e sem tamanho gera chave com as duas partes vazias', () => {
    const { carrinho } = aplicarRascunho({}, 'd', { '|Único': 4 })
    expect(carrinho).toEqual({ 'd||Único': 4 })
    const linhas = linhasDoCarrinho(carrinho, { d: catalogo[3] })
    expect(linhas[0].subtotal).toBeCloseTo(199.96, 2)
    expect(linhaMensagem(linhas[0], catalogo[3])).toBe('LONGO TROPICALE REF 90 — 4x R$ 49,99 = R$ 199,96')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('lojaDaConfig — seção 2.1', () => {
  it('config vazia cai nos defaults da spec', () => {
    const loja = lojaDaConfig(null)
    expect(loja.subtitulo).toBe('Catálogo online')
    expect(loja.modoVenda).toBe('atacado')
    expect(loja.publico).toBe('feminino')
    expect(loja.checkoutOnline).toBe(false)
    expect(loja.textoEnvio).toBe('Enviamos para todo o Brasil.')
    expect(loja.pedidoMinimo).toBeNull()
    expect(loja.whatsapp).toBe('')
    expect(loja.videoTopo.ativo).toBe(false)
    expect(loja.apresentacao).toEqual({ etiqueta: '', titulo: '', descricao: '' })
  })

  it('lê a config real da tropicaleatacado sem a migração ter rodado', () => {
    // Exatamente as colunas que existem hoje no banco.
    const loja = lojaDaConfig({
      loja_id: 'tropicaleatacado', nome: 'TropicaleAtacado', slug: 'tropicaleatacado',
      plano: 'business', status: 'Ativo', segmento: 'moda', logo_url: null,
      pedido_minimo_tipo: null, pedido_minimo_valor: null, pedido_minimo_qtd: null,
    })
    expect(loja.nome).toBe('TropicaleAtacado')
    expect(loja.subtitulo).toBe('Catálogo online')
    expect(loja.modoVenda).toBe('atacado')
    expect(loja.pedidoMinimo).toBeNull()
    expect(loja.videoTopo.ativo).toBe(false)
  })

  it('lê o pedido mínimo já configurado (sualoja, catalogob2bdemo)', () => {
    const loja = lojaDaConfig({ pedido_minimo_tipo: 'valor', pedido_minimo_valor: 300, pedido_minimo_qtd: 0 })
    expect(loja.pedidoMinimo).toEqual({ tipo: 'valor', valor: 300, qtd: 0 })
  })

  it('tipo "nenhum" não vira faixa de mínimo', () => {
    expect(lojaDaConfig({ pedido_minimo_tipo: 'nenhum' }).pedidoMinimo).toBeNull()
  })

  it('normaliza o whatsapp para E.164', () => {
    expect(lojaDaConfig({ whatsapp_loja: '(85) 99999-0000' }).whatsapp).toBe('5585999990000')
  })

  it('bloco de apresentação só existe se algum campo estiver preenchido', () => {
    const vazio = lojaDaConfig({ catalogo_apresentacao: { etiqueta: '', titulo: '', descricao: '' } })
    const temAlgo = a => !!(a.etiqueta || a.titulo || a.descricao)
    expect(temAlgo(vazio.apresentacao)).toBe(false)

    const cheio = lojaDaConfig({ catalogo_apresentacao: { etiqueta: '', titulo: 'Coleção Verão', descricao: '' } })
    expect(temAlgo(cheio.apresentacao)).toBe(true)
  })

  it('vídeo do topo usa o nome da loja quando não há título', () => {
    const loja = lojaDaConfig({ nome: 'Tropicale', catalogo_video_topo: { ativo: true, videoUrl: 'v.mp4' } })
    expect(loja.videoTopo.ativo).toBe(true)
    expect(loja.videoTopo.etiqueta).toBe('Coleção nova')
    expect(loja.videoTopo.titulo).toBe('')  // o componente cai no nome da loja
  })

  it('modo varejo desliga o sufixo "/ peça" e a faixa de mínimo', () => {
    const loja = lojaDaConfig({ catalogo_modo_venda: 'varejo', pedido_minimo_tipo: 'valor', pedido_minimo_valor: 300 })
    expect(loja.modoVenda).toBe('varejo')
    // A faixa preta é condicionada a modoAtacado no componente; aqui o dado
    // continua disponível, quem decide não mostrar é a tela.
    expect(loja.pedidoMinimo).not.toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('A3 — produto sem variação entra no catálogo', () => {
  // Os 13 produtos da tropicaleatacado que ficavam invisíveis: têm foto e
  // preço, não têm variacoes. Conferido contra o banco em 20/08/2026.
  const semVariacao = normalizarProduto({
    id: 'sv', nome: 'LONGO TROPICALE REF 90', preco_venda: 49.99,
    ativo: true, fotos: ['foto.jpg'], variacoes: [],
  })

  it('normaliza sem cor nenhuma e com tamanho único', () => {
    expect(semVariacao.cores).toEqual([])
    expect(semVariacao.tamanhos).toEqual([TAMANHO_UNICO])
    expect(temCor(semVariacao)).toBe(false)
    expect(temTamanho(semVariacao)).toBe(false)
  })

  it('o modal pergunta só a quantidade e rotula a célula "Quantidade"', () => {
    expect(perguntaModal(semVariacao)).toBe('Quantas peças você quer?')
    expect(rotuloCelula(semVariacao, TAMANHO_UNICO)).toBe('Quantidade')
  })

  it('a legenda do card não deixa separador solto', () => {
    expect(legendaCard(semVariacao)).toBe('Tamanho único')
  })

  it('entra no carrinho com cor e tamanho vazios e soma certo', () => {
    const { carrinho, adicionadas } = aplicarRascunho({}, 'sv', { '|Único': 3 })
    expect(carrinho).toEqual({ 'sv||Único': 3 })
    expect(adicionadas).toBe(3)

    const linhas = linhasDoCarrinho(carrinho, { sv: semVariacao })
    expect(totais(linhas)).toEqual({ pecas: 3, valor: 149.97 })
  })

  it('sai na mensagem do WhatsApp sem cor e sem tamanho', () => {
    const linhas = linhasDoCarrinho({ 'sv||Único': 3 }, { sv: semVariacao })
    expect(linhaMensagem(linhas[0], semVariacao))
      .toBe('LONGO TROPICALE REF 90 — 3x R$ 49,99 = R$ 149,97')
  })
})

describe('o catálogo funciona ANTES da migration rodar', () => {
  // Linha exatamente como o banco devolve hoje: sem cores, sem tamanhos, sem
  // selo, categoria NULL. Conferido contra o banco real em 20/08/2026 — os 37
  // produtos da tropicaleatacado normalizam e renderizam sem a migration.
  const linhaPreMigration = {
    id: 'p1', loja_id: 'tropicaleatacado', nome: 'VESTIDO CURTO PATY DUDA',
    ativo: true, created_at: '2026-07-01T00:00:00Z', categoria: null,
    preco_custo: 12, preco_venda: 33.33, quantidade: 0,
    variacoes: [{ cor: 'ROSA BEBÊ', quantidade: 2 }, { cor: 'NUDE', quantidade: 1 }],
    fornecedor: null, referencia: null, valor_lote: null, data_vencimento: null,
    status_pgto: 'a_pagar', video_url: null, fornecedor_id: null,
    disponivel_catalogo_b2b: true, fotos: ['foto.jpg'], ean: null, ncm: null, cfop: null,
  }

  it('deriva cores, categoria e tamanhos sem as colunas novas', () => {
    const p = normalizarProduto(linhaPreMigration)
    expect(p.cores).toEqual([
      { nome: 'ROSA BEBÊ', hex: '#F7C8DA' },
      { nome: 'NUDE', hex: '#DFC3AC' },
    ])
    expect(p.categoria).toBe('Vestidos')
    expect(p.tamanhos).toEqual([TAMANHO_UNICO])
    expect(p.selo).toBe('')
    expect(p.preco).toBe(33.33)
  })

  it('a loja cai nos mesmos defaults que o ALTER TABLE usaria', () => {
    const loja = lojaDaConfig({
      loja_id: 'tropicaleatacado', nome: 'TropicaleAtacado',
      whatsapp_loja: '5591980669061', pedido_minimo_tipo: 'nenhum',
    })
    expect(loja.subtitulo).toBe('Catálogo online')
    expect(loja.modoVenda).toBe('atacado')
    expect(loja.textoEnvio).toBe('Enviamos para todo o Brasil.')
    expect(loja.checkoutOnline).toBe(false)
    expect(loja.videoTopo.ativo).toBe(false)
    expect(loja.pedidoMinimo).toBeNull()
    expect(loja.whatsapp).toBe('5591980669061')
  })

  it('whatsapp com DDI já embutido não ganha um 55 a mais', () => {
    expect(telefoneE164('5591980669061')).toBe('5591980669061')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Pix copia-e-cola no checkout do catálogo (sem gateway, sem QR Code).
// A chave morava só no CatalogoPublico V1, que ficou sem rota; o V2 não lia
// chave_pix nenhuma. Estes casos travam o contrato que o drawer usa.
// ─────────────────────────────────────────────────────────────────────────────
describe('lojaDaConfig — chave Pix', () => {
  it('expõe a chave cadastrada', () => {
    expect(lojaDaConfig({ chave_pix: 'loja@exemplo.com' }).chavePix).toBe('loja@exemplo.com')
  })

  it('sem chave devolve string vazia, nunca null', () => {
    // O drawer decide por `loja.chavePix` puro; null quebraria a comparação
    // com '' em qualquer teste e deixaria o bloco de Pix num estado ambíguo.
    expect(lojaDaConfig(null).chavePix).toBe('')
    expect(lojaDaConfig({}).chavePix).toBe('')
    expect(lojaDaConfig({ chave_pix: null }).chavePix).toBe('')
  })

  it('apara espaço em volta — chave copiada de app de banco costuma vir com sobra', () => {
    expect(lojaDaConfig({ chave_pix: '  85999990000  ' }).chavePix).toBe('85999990000')
    // Só espaço é o mesmo que não ter chave.
    expect(lojaDaConfig({ chave_pix: '   ' }).chavePix).toBe('')
  })

  it('chave e checkout são independentes — quem combina os dois é o drawer', () => {
    const so_chave = lojaDaConfig({ chave_pix: 'x@y.com' })
    expect(so_chave.chavePix).toBe('x@y.com')
    expect(so_chave.checkoutOnline).toBe(false)

    const ambos = lojaDaConfig({ chave_pix: 'x@y.com', catalogo_checkout_online: true })
    expect(ambos.checkoutOnline).toBe(true)
    expect(ambos.chavePix).toBe('x@y.com')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Identificação da cliente no checkout.
//
// Bug real: um pedido da Tropicale chegou com cliente_nome e cliente_whatsapp
// vazios. O V2 gravava string vazia fixa — não era validação frouxa, era
// ausência total dos campos, que o V1 tinha e a migração para o V2 perdeu.
// ─────────────────────────────────────────────────────────────────────────────
describe('nomeValido', () => {
  it('aceita nome de verdade', () => {
    expect(nomeValido('Ana')).toBe(true)
    expect(nomeValido('Bia')).toBe(true)
  })

  it('recusa vazio, espaço e uma letra só', () => {
    expect(nomeValido('')).toBe(false)
    expect(nomeValido('   ')).toBe(false)
    expect(nomeValido('A')).toBe(false)
    expect(nomeValido(null)).toBe(false)
    expect(nomeValido(undefined)).toBe(false)
  })

  it('nome com espaço em volta conta pelo conteúdo', () => {
    expect(nomeValido('  Jo  ')).toBe(true)
  })
})

describe('whatsappValido', () => {
  it('aceita celular com DDD, com e sem máscara', () => {
    expect(whatsappValido('(85) 99999-0000')).toBe(true)
    expect(whatsappValido('85999990000')).toBe(true)
  })

  it('aceita fixo com DDD (10 dígitos)', () => {
    expect(whatsappValido('8533334444')).toBe(true)
  })

  it('recusa curto demais, longo demais e vazio', () => {
    expect(whatsappValido('999990000')).toBe(false)   // 9, sem DDD
    expect(whatsappValido('859999900001')).toBe(false) // 12
    expect(whatsappValido('')).toBe(false)
    expect(whatsappValido(null)).toBe(false)
  })

  it('texto sem dígito nenhum é recusado', () => {
    expect(whatsappValido('meu zap')).toBe(false)
  })
})

describe('validarDadosCliente', () => {
  it('dados completos passam sem erro', () => {
    const r = validarDadosCliente({ nome: 'Ana', whatsapp: '(85) 99999-0000' })
    expect(r.ok).toBe(true)
    expect(r.erros).toEqual({})
  })

  it('aponta o campo exato que falta, não um erro genérico', () => {
    const semNome = validarDadosCliente({ nome: '', whatsapp: '85999990000' })
    expect(semNome.ok).toBe(false)
    expect(semNome.erros.nome).toBeTruthy()
    expect(semNome.erros.whatsapp).toBeUndefined()

    const semZap = validarDadosCliente({ nome: 'Ana', whatsapp: '' })
    expect(semZap.ok).toBe(false)
    expect(semZap.erros.whatsapp).toBeTruthy()
    expect(semZap.erros.nome).toBeUndefined()
  })

  it('os dois vazios acusam os dois', () => {
    const r = validarDadosCliente({ nome: '', whatsapp: '' })
    expect(Object.keys(r.erros).sort()).toEqual(['nome', 'whatsapp'])
  })

  it('sem argumento nenhum não estoura', () => {
    expect(validarDadosCliente().ok).toBe(false)
    expect(validarDadosCliente({}).ok).toBe(false)
  })
})

describe('dadosClienteParaPedido', () => {
  it('apara o nome e tira a máscara do telefone', () => {
    expect(dadosClienteParaPedido({ nome: '  Ana Paula ', whatsapp: '(85) 99999-0000' }))
      .toEqual({ cliente_nome: 'Ana Paula', cliente_whatsapp: '85999990000' })
  })

  it('nunca devolve undefined — as colunas do banco são NOT NULL na prática', () => {
    expect(dadosClienteParaPedido()).toEqual({ cliente_nome: '', cliente_whatsapp: '' })
  })

  it('o que sai daqui passa na validação de novo', () => {
    // Fecha o ciclo: normalizar não pode invalidar o que já era válido.
    const bruto = { nome: ' Ana ', whatsapp: '(85) 99999-0000' }
    const gravado = dadosClienteParaPedido(bruto)
    expect(validarDadosCliente({
      nome: gravado.cliente_nome, whatsapp: gravado.cliente_whatsapp,
    }).ok).toBe(true)
  })
})
