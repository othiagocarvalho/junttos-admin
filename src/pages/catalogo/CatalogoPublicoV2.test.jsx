import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// O cliente real chama createClient() no import e depende das env vars do Vite.
// Aqui só interessa que o módulo do catálogo carregue inteiro.
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({}) } }))

const {
  default: CatalogoPublicoV2,
  Cabecalho, TresPassos, BlocoApresentacao, FaixaMinimo, Filtros,
  CardProduto, EstadoVazio, Rodape, ModalProduto, DrawerPedido, FaixaVideo,
  PixDinamico,
} = await import('./CatalogoPublicoV2')

const { normalizarProduto, lojaDaConfig, estadoMinimo, linhasDoCarrinho } =
  await import('../../utils/catalogoV2')

// vitest roda em environment 'node', sem jsdom: não dá para montar a página
// inteira nem medir layout. Dá para renderizar cada pedaço com react-dom/server
// e conferir o DOM que sai — é o que valida os critérios de estrutura da
// seção 13. Os critérios de PIXEL (quantas colunas cabem em 390px) estão
// verificados por aritmética de CSS no fim do arquivo, não por render.
const html = el => renderToStaticMarkup(el)

// ── Fixtures: os dados reais da tropicaleatacado ─────────────────────────────
const multicor = normalizarProduto({
  id: 'p1', nome: 'VESTIDO CURTO PATY DUDA', preco_venda: 33.33, ativo: true,
  fotos: ['foto1.jpg'],
  variacoes: [{ cor: 'ROSA BEBÊ' }, { cor: 'ROSA PINK' }, { cor: 'NUDE' }],
})
const umaCor = normalizarProduto({
  id: 'p2', nome: 'MACAQUINHO PATY MAVIE', preco_venda: 44.9, ativo: true,
  fotos: ['foto2.jpg'], variacoes: [{ cor: 'VINHO' }],
})
const comTamanho = normalizarProduto({
  id: 'p4', nome: 'CAMISA LISA', preco_venda: 20, ativo: true,
  fotos: ['f.jpg'], variacoes: [], tamanhos: ['P', 'M', 'G'],
})
const lojaAtacado = lojaDaConfig({
  nome: 'TropicaleAtacado', whatsapp_loja: '(85) 99999-0000',
  pedido_minimo_tipo: 'valor', pedido_minimo_valor: 300,
})

describe('módulo', () => {
  it('compila e exporta o componente como default', () => {
    expect(typeof CatalogoPublicoV2).toBe('function')
    expect(CatalogoPublicoV2.name).toBe('CatalogoPublicoV2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Critérios de aceite — seção 13
// ─────────────────────────────────────────────────────────────────────────────

describe('13.2 — cabeçalho sticky, sem forçar layout no celular', () => {
  const saida = html(
    <Cabecalho loja={lojaAtacado} busca="" setBusca={() => {}} totalPecas={3} aoAbrirPedido={() => {}} />,
  )

  it('é sticky no topo', () => {
    expect(saida).toContain('position:sticky')
    expect(saida).toContain('top:0')
  })

  it('deixa os 3 itens quebrarem sozinhos por flex-wrap, sem media query', () => {
    expect(saida).toContain('flex-wrap:wrap')
  })

  it('a busca usa 16px para o iOS não dar zoom no foco', () => {
    expect(saida).toMatch(/font-size:16px/)
  })

  it('mostra o contador de peças no botão Pedido', () => {
    expect(saida).toContain('Pedido')
    expect(saida).toContain('>3<')
  })
})

describe('13.3 — card sem texto de botão, card inteiro clicável, "+" na foto', () => {
  const saida = html(
    <CardProduto produto={multicor} modoAtacado noPedido={0} prioridade aoAbrir={() => {}} />,
  )

  it('não existe <button> nenhum dentro do card', () => {
    expect(saida).not.toContain('<button')
  })

  it('não escreve frase decorativa de ação', () => {
    for (const proibido of ['Escolher cor', 'Adicionar', 'Comprar', 'Ver produto']) {
      expect(saida).not.toContain(proibido)
    }
  })

  it('o card inteiro é o alvo: role=button e acessível por teclado', () => {
    expect(saida).toContain('role="button"')
    expect(saida).toContain('tabindex="0"')
    expect(saida).toContain('aria-label="Abrir VESTIDO CURTO PATY DUDA"')
  })

  it('tem o "+" no canto da foto', () => {
    expect(saida).toContain('>+<')
  })

  it('mostra o badge "N no pedido" só quando há itens', () => {
    expect(saida).not.toContain('no pedido')
    const comItens = html(
      <CardProduto produto={multicor} modoAtacado noPedido={4} aoAbrir={() => {}} />,
    )
    expect(comItens).toContain('4 no pedido')
  })

  it('a foto do card é 3/4 com object-fit cover', () => {
    expect(saida).toContain('aspect-ratio:3 / 4')
    expect(saida).toContain('object-fit:cover')
  })

  it('só os 4 primeiros cards carregam com prioridade', () => {
    expect(saida).toContain('loading="eager"')
    const tardio = html(<CardProduto produto={multicor} modoAtacado noPedido={0} aoAbrir={() => {}} />)
    expect(tardio).toContain('loading="lazy"')
  })
})

describe('13.4 — copy dinâmica no card e no modal', () => {
  it('produto só com cor: legenda e pergunta falam só de cor', () => {
    const card = html(<CardProduto produto={multicor} modoAtacado noPedido={0} aoAbrir={() => {}} />)
    expect(card).toContain('3 cores · Tamanho único')

    const modal = html(
      <ModalProduto produto={multicor} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />,
    )
    expect(modal).toContain('Quantas peças de cada cor?')
    expect(modal).not.toContain('cor e tamanho')
  })

  it('produto só com tamanho: legenda e pergunta falam só de tamanho', () => {
    const card = html(<CardProduto produto={comTamanho} modoAtacado noPedido={0} aoAbrir={() => {}} />)
    expect(card).toContain('P M G')

    const modal = html(
      <ModalProduto produto={comTamanho} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />,
    )
    expect(modal).toContain('Quantas peças de cada tamanho?')
    expect(modal).not.toContain('cor e tamanho')
  })

  it('produto sem escolha nenhuma: célula única rotulada "Quantidade"', () => {
    const modal = html(
      <ModalProduto produto={umaCor} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />,
    )
    expect(modal).toContain('Quantas peças você quer?')
    expect(modal).toContain('Quantidade')
    // Cor única não vira seletor de cor.
    expect(modal).not.toContain('Quantas peças de cada cor?')
  })

  it('sufixo "/ peça" só existe no atacado', () => {
    const atacado = html(<CardProduto produto={multicor} modoAtacado noPedido={0} aoAbrir={() => {}} />)
    const varejo = html(<CardProduto produto={multicor} modoAtacado={false} noPedido={0} aoAbrir={() => {}} />)
    expect(atacado).toContain('/ peça')
    expect(varejo).not.toContain('/ peça')
  })
})

describe('13.5 — faixa de pedido mínimo', () => {
  const faixa = carrinho => html(
    <FaixaMinimo minimo={estadoMinimo({ tipo: 'valor', valor: 300 }, carrinho)} />,
  )

  it('não aparece sem mínimo configurado', () => {
    expect(html(<FaixaMinimo minimo={null} />)).toBe('')
  })

  it('carrinho vazio: anuncia o mínimo, barra em 0%', () => {
    const s = faixa({ pecas: 0, valor: 0 })
    expect(s).toContain('Pedido mínimo de R$ 300,00.')
    expect(s).toContain('width:0%')
    expect(s).toContain('aria-valuenow="0"')
  })

  it('abaixo do mínimo: a barra reage ao carrinho', () => {
    const s = faixa({ pecas: 3, valor: 120 })
    expect(s).toContain('Faltam R$ 180,00 para atingir o pedido mínimo de R$ 300,00.')
    expect(s).toContain('width:40%')
  })

  it('atingido: libera e a barra trava em 100%', () => {
    const s = faixa({ pecas: 20, valor: 900 })
    expect(s).toContain('Pedido mínimo atingido. Você já pode finalizar.')
    expect(s).toContain('width:100%')
  })

  it('cabe em uma linha só — trunca em vez de quebrar', () => {
    expect(faixa({ pecas: 0, valor: 0 })).toContain('white-space:nowrap')
  })
})

describe('13.6 — chips e ordenação em uma linha só', () => {
  const saida = html(
    <Filtros
      categorias={['Tudo', 'Vestidos', 'Conjuntos', 'Longos', 'Saias', 'Macaquinhos']}
      categoria="Tudo" setCategoria={() => {}} ordem="destaque" setOrdem={() => {}}
    />,
  )

  it('a faixa de chips rola na horizontal em vez de quebrar linha', () => {
    expect(saida).toContain('overflow-x:auto')
    expect(saida).toContain('white-space:nowrap')
    expect(saida).not.toContain('flex-wrap:wrap')
  })

  it('o primeiro chip é sempre "Tudo" e ele começa ativo', () => {
    const primeiro = saida.indexOf('Tudo')
    const segundo = saida.indexOf('Vestidos')
    expect(primeiro).toBeGreaterThan(-1)
    expect(primeiro).toBeLessThan(segundo)
    expect(saida).toContain('aria-pressed="true"')
  })

  it('as 4 opções de ordenação estão lá', () => {
    for (const o of ['⇅ Ordenar', 'Menor preço', 'Maior preço', 'Nome A–Z']) {
      expect(saida).toContain(o)
    }
  })
})

describe('13.7 — modal: galeria, miniaturas e zoom', () => {
  const comVariasFotos = normalizarProduto({
    id: 'p9', nome: 'VESTIDO', preco_venda: 30, ativo: true,
    fotos: ['a.jpg', 'b.jpg', 'c.jpg'], variacoes: [{ cor: 'AZUL' }, { cor: 'VERDE' }],
  })

  it('é um dialog modal de verdade', () => {
    const s = html(<ModalProduto produto={multicor} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />)
    expect(s).toContain('role="dialog"')
    expect(s).toContain('aria-modal="true"')
  })

  it('convida ao zoom e começa sem ampliação', () => {
    const s = html(<ModalProduto produto={multicor} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />)
    expect(s).toContain('Toque para ampliar')
    expect(s).toContain('cursor:zoom-in')
    expect(s).toContain('transform:scale(1)')
  })

  it('miniaturas aparecem com 2+ fotos, cada uma com aria-label', () => {
    const s = html(<ModalProduto produto={comVariasFotos} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />)
    expect(s).toContain('aria-label="Ver foto 1"')
    expect(s).toContain('aria-label="Ver foto 3"')
  })

  it('miniaturas ficam DENTRO do modal, ancoradas na base da foto', () => {
    const s = html(<ModalProduto produto={comVariasFotos} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />)
    // left/bottom em vez de negativos: nunca sai da área visível do modal.
    expect(s).toContain('left:14px')
    expect(s).toContain('bottom:14px')
  })

  it('com uma foto só não há miniatura', () => {
    const s = html(<ModalProduto produto={multicor} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />)
    expect(s).not.toContain('Ver foto')
  })

  it('empilha no celular e vira 2 colunas no desktop sem media query', () => {
    const s = html(<ModalProduto produto={multicor} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />)
    expect(s).toContain('grid-template-columns:repeat(auto-fit, minmax(min(100%, 340px), 1fr))')
  })

  it('a nota final muda entre atacado e varejo', () => {
    const a = html(<ModalProduto produto={multicor} modoAtacado aoFechar={() => {}} aoConfirmar={() => {}} />)
    const v = html(<ModalProduto produto={multicor} modoAtacado={false} aoFechar={() => {}} aoConfirmar={() => {}} />)
    expect(a).toContain('Você pode misturar cores e tamanhos livremente. Não há grade fechada.')
    expect(v).toContain('Selecione a quantidade desejada de cada tamanho.')
  })
})

describe('13.8 — drawer soma, avisa e bloqueia abaixo do mínimo', () => {
  const mapa = { p1: multicor, p2: umaCor }
  const linhas = linhasDoCarrinho({ 'p1|ROSA PINK|Único': 3, 'p2|VINHO|Único': 5 }, mapa)

  it('mostra o total somado e o resumo de peças e variações', () => {
    const s = html(
      <DrawerPedido
        linhas={linhas} produtosPorId={mapa} minimo={estadoMinimo({ tipo: 'valor', valor: 300 }, { pecas: 8, valor: 324.49 })}
        loja={lojaAtacado} aoFechar={() => {}} aoMudarQtd={() => {}} aoEnviar={() => {}} aoPagar={() => {}}
      />,
    )
    expect(s).toContain('R$ 324,49')
    expect(s).toContain('8 peças · 2 variações')
  })

  it('abaixo do mínimo mostra o aviso âmbar', () => {
    const s = html(
      <DrawerPedido
        linhas={linhas} produtosPorId={mapa} minimo={estadoMinimo({ tipo: 'valor', valor: 500 }, { pecas: 8, valor: 324.49 })}
        loja={lojaAtacado} aoFechar={() => {}} aoMudarQtd={() => {}} aoEnviar={() => {}} aoPagar={() => {}}
      />,
    )
    expect(s).toContain('Faltam R$ 175,51 para o pedido mínimo. Adicione mais peças para finalizar.')
    expect(s).toContain('#FFF6E6')
  })

  it('mínimo atingido não mostra aviso', () => {
    const s = html(
      <DrawerPedido
        linhas={linhas} produtosPorId={mapa} minimo={estadoMinimo({ tipo: 'valor', valor: 300 }, { pecas: 8, valor: 324.49 })}
        loja={lojaAtacado} aoFechar={() => {}} aoMudarQtd={() => {}} aoEnviar={() => {}} aoPagar={() => {}}
      />,
    )
    expect(s).not.toContain('Adicione mais peças para finalizar')
  })

  it('a variação é "{Cor} · Tamanho {T}", omitindo o que não existe', () => {
    const s = html(
      <DrawerPedido
        linhas={linhas} produtosPorId={mapa} minimo={null} loja={lojaAtacado}
        aoFechar={() => {}} aoMudarQtd={() => {}} aoEnviar={() => {}} aoPagar={() => {}}
      />,
    )
    expect(s).toContain('ROSA PINK')
    // Produto de cor única não repete a cor; "Único" nunca vira texto de tela.
    expect(s).not.toContain('Tamanho Único')
  })

  it('pedido vazio explica o que fazer', () => {
    const s = html(
      <DrawerPedido
        linhas={[]} produtosPorId={mapa} minimo={null} loja={lojaAtacado}
        aoFechar={() => {}} aoMudarQtd={() => {}} aoEnviar={() => {}} aoPagar={() => {}}
      />,
    )
    expect(s).toContain('Seu pedido está vazio')
    expect(s).toContain('Toque em uma peça e escolha cor e tamanho.')
    expect(s).toContain('Nenhuma peça ainda')
  })

  it('"Pagar agora pelo site" só existe com checkoutOnline ligado', () => {
    const props = {
      linhas, produtosPorId: mapa, minimo: null,
      aoFechar: () => {}, aoMudarQtd: () => {}, aoEnviar: () => {}, aoPagar: () => {},
    }
    expect(html(<DrawerPedido {...props} loja={lojaAtacado} />)).not.toContain('Pagar agora pelo site')
    const comCheckout = lojaDaConfig({ whatsapp_loja: '85999990000', catalogo_checkout_online: true })
    expect(html(<DrawerPedido {...props} loja={comCheckout} />)).toContain('Pagar agora pelo site')
  })

  // ── Pix copia-e-cola ──────────────────────────────────────────────────────
  // Sem gateway e sem QR Code: a chave aparece em texto com um botão de copiar.
  const propsDrawer = () => ({
    linhas, produtosPorId: mapa, minimo: null,
    aoFechar: () => {}, aoMudarQtd: () => {}, aoEnviar: () => {}, aoPagar: () => {},
  })

  it('com checkout ligado E chave cadastrada, mostra o bloco de Pix', () => {
    const loja = lojaDaConfig({
      whatsapp_loja: '85999990000', catalogo_checkout_online: true,
      chave_pix: 'tropicale@exemplo.com',
    })
    const s = html(<DrawerPedido {...propsDrawer()} loja={loja} />)
    expect(s).toContain('Pague com Pix')
    expect(s).toContain('tropicale@exemplo.com')   // a chave em si, copiável
    expect(s).toContain('Copiar chave Pix')
    // O bloco SUBSTITUI o botão antigo, não convive com ele.
    expect(s).not.toContain('Pagar agora pelo site')
  })

  it('com checkout ligado e SEM chave, o comportamento antigo fica intacto', () => {
    const loja = lojaDaConfig({ whatsapp_loja: '85999990000', catalogo_checkout_online: true })
    const s = html(<DrawerPedido {...propsDrawer()} loja={loja} />)
    expect(s).toContain('Pagar agora pelo site')
    expect(s).not.toContain('Pague com Pix')
  })

  it('chave cadastrada mas checkout desligado não mostra Pix nenhum', () => {
    // Quem manda é o toggle: chave preenchida sozinha não publica nada.
    const loja = lojaDaConfig({ whatsapp_loja: '85999990000', chave_pix: 'x@y.com' })
    const s = html(<DrawerPedido {...propsDrawer()} loja={loja} />)
    expect(s).not.toContain('Pague com Pix')
    expect(s).not.toContain('x@y.com')
    expect(s).not.toContain('Pagar agora pelo site')
  })

  it('o WhatsApp continua disponível junto com o Pix', () => {
    // O Pix é um caminho a mais, não um substituto: quem paga ainda precisa
    // mandar o comprovante.
    const loja = lojaDaConfig({
      whatsapp_loja: '85999990000', catalogo_checkout_online: true, chave_pix: 'x@y.com',
    })
    const s = html(<DrawerPedido {...propsDrawer()} loja={loja} />)
    expect(s).toContain('Enviar pedido no WhatsApp')
    expect(s).toContain('Pague com Pix')
  })

  it('chave aleatória longa quebra linha em vez de estourar o drawer', () => {
    const chave = '7f3a1c2e-9b4d-4a6f-8e1b-2c5d7a9f0e3b'   // 36 caracteres, sem espaço
    const loja = lojaDaConfig({
      whatsapp_loja: '85999990000', catalogo_checkout_online: true, chave_pix: chave,
    })
    const s = html(<DrawerPedido {...propsDrawer()} loja={loja} />)
    expect(s).toContain(chave)
    expect(s).toContain('word-break:break-all')
  })

  // ── Mercado Pago: QR dinâmico com o copia-e-cola como rede de segurança ──
  const lojaMp = extra => lojaDaConfig({
    whatsapp_loja: '85999990000', catalogo_checkout_online: true,
    chave_pix: 'estatico@exemplo.com', mercadopago_ativo: true, ...extra,
  })

  it('com Mercado Pago ativo, o caminho principal é o QR dinâmico', () => {
    const s = html(<DrawerPedido {...propsDrawer()} loja={lojaMp()} pixMp={{}} />)
    expect(s).toContain('Gerar QR Code Pix')
    // O estático some enquanto o dinâmico está de pé.
    expect(s).not.toContain('estatico@exemplo.com')
  })

  it('QR gerado mostra imagem, copia-e-cola do MP e aviso de espera', () => {
    const pixMp = { qrCode: '00020126BR.GOV.BCB.PIX', qrBase64: 'iVBORw0KGgo=' }
    const s = html(<DrawerPedido {...propsDrawer()} loja={lojaMp()} pixMp={pixMp} />)
    expect(s).toContain('data:image/png;base64,iVBORw0KGgo=')
    expect(s).toContain('00020126BR.GOV.BCB.PIX')
    expect(s).toContain('Copiar código Pix')
    expect(s).toContain('Aguardando o pagamento...')
  })

  it('se o Mercado Pago falhar, cai no copia-e-cola estático', () => {
    // É a garantia de que ninguém fica sem forma de pagar quando a Edge
    // Function está fora do ar ou a credencial foi recusada.
    const s = html(<DrawerPedido {...propsDrawer()} loja={lojaMp()} pixMp={{ erro: true }} />)
    expect(s).toContain('Pague com Pix')
    expect(s).toContain('estatico@exemplo.com')
    expect(s).not.toContain('Gerar QR Code Pix')
  })

  it('MP falhando em loja SEM chave estática cai no botão antigo, nunca em nada', () => {
    const loja = lojaMp({ chave_pix: null })
    const s = html(<DrawerPedido {...propsDrawer()} loja={loja} pixMp={{ erro: true }} />)
    expect(s).toContain('Pagar agora pelo site')
  })

  it('sem mercadopago_ativo o comportamento anterior fica idêntico', () => {
    const loja = lojaDaConfig({
      whatsapp_loja: '85999990000', catalogo_checkout_online: true,
      chave_pix: 'estatico@exemplo.com',
    })
    const s = html(<DrawerPedido {...propsDrawer()} loja={loja} pixMp={{}} />)
    expect(s).toContain('estatico@exemplo.com')
    expect(s).not.toContain('Gerar QR Code Pix')
  })

  it('pagamento confirmado troca o QR pelo aviso de sucesso', () => {
    const s = html(<PixDinamico estado={{ pago: true, qrCode: 'x' }} />)
    expect(s).toContain('Pagamento confirmado!')
    expect(s).not.toContain('Copiar código Pix')
  })

  it('enquanto gera, o botão desabilita e avisa', () => {
    const s = html(<PixDinamico estado={{ carregando: true }} />)
    expect(s).toContain('Gerando QR Code...')
    expect(s).toContain('disabled')
  })

  it('o WhatsApp continua disponível junto com o QR dinâmico', () => {
    const s = html(<DrawerPedido {...propsDrawer()} loja={lojaMp()} pixMp={{ qrCode: 'abc' }} />)
    expect(s).toContain('Enviar pedido no WhatsApp')
  })

  it('sem WhatsApp cadastrado o botão verde não é desenhado', () => {
    const semWa = lojaDaConfig({ nome: 'X' })
    const s = html(
      <DrawerPedido
        linhas={linhas} produtosPorId={mapa} minimo={null} loja={semWa}
        aoFechar={() => {}} aoMudarQtd={() => {}} aoEnviar={() => {}} aoPagar={() => {}}
      />,
    )
    expect(s).not.toContain('Enviar pedido no WhatsApp')
  })
})

describe('13.10 — rodapé: Envio → Ajuda → botão, e nada além disso', () => {
  const saida = html(<Rodape loja={lojaAtacado} aoChamar={() => {}} />)

  it('a ordem dos três blocos é a da spec', () => {
    const iEnvio = saida.indexOf('Envio')
    const iAjuda = saida.indexOf('Precisa de ajuda?')
    const iBotao = saida.indexOf('Chamar no WhatsApp')
    expect(iEnvio).toBeGreaterThan(-1)
    expect(iEnvio).toBeLessThan(iAjuda)
    expect(iAjuda).toBeLessThan(iBotao)
  })

  it('não inclui "Como pagar" nem horário de atendimento', () => {
    for (const proibido of ['Como pagar', 'Horário', 'horário', 'Atendimento']) {
      expect(saida).not.toContain(proibido)
    }
  })

  it('usa o texto de envio da loja', () => {
    expect(saida).toContain('Enviamos para todo o Brasil.')
    const outro = lojaDaConfig({ catalogo_texto_envio: 'Só entregamos em Fortaleza.' })
    expect(html(<Rodape loja={outro} aoChamar={() => {}} />)).toContain('Só entregamos em Fortaleza.')
  })
})

describe('13.11 — vídeo do topo e apresentação ligam/desligam sem quebrar', () => {
  it('vídeo desligado não renderiza faixa nenhuma', () => {
    expect(html(<FaixaVideo video={lojaAtacado.videoTopo} nomeLoja="X" />)).toBe('')
  })

  it('vídeo ligado usa autoplay/muted/loop/playsinline', () => {
    const loja = lojaDaConfig({ nome: 'Tropicale', catalogo_video_topo: { ativo: true, videoUrl: 'v.mp4' } })
    const s = html(<FaixaVideo video={loja.videoTopo} nomeLoja={loja.nome} />)
    expect(s).toContain('<video')
    // React 19 preserva o camelCase no markup; o HTML parser do browser lê
    // nome de atributo sem diferenciar caixa, então isso é o autoplay de fato.
    expect(s).toContain('autoPlay=""')
    expect(s).toContain('muted=""')
    expect(s).toContain('loop=""')
    expect(s).toContain('playsInline=""')
  })

  it('sem vídeo mas com imagem usa kenburns', () => {
    const loja = lojaDaConfig({ catalogo_video_topo: { ativo: true, imagemUrl: 'capa.jpg' } })
    const s = html(<FaixaVideo video={loja.videoTopo} nomeLoja="Tropicale" />)
    expect(s).toContain('cat-kenburns 18s')
  })

  it('sem título usa o nome da loja', () => {
    const loja = lojaDaConfig({ catalogo_video_topo: { ativo: true, imagemUrl: 'c.jpg' } })
    expect(html(<FaixaVideo video={loja.videoTopo} nomeLoja="TropicaleAtacado" />))
      .toContain('TropicaleAtacado')
  })

  it('apresentação vazia (o estado padrão) mostra a linha fina dos 3 passos', () => {
    const s = html(<TresPassos />)
    expect(s).toContain('Escolha o produto')
    expect(s).toContain('Confira o pedido')
    expect(s).toContain('Pagamento')
    expect(s).toContain('→')
    expect(s).toContain('overflow-x:auto')
  })

  it('apresentação preenchida mostra o bloco grande com os passos em coluna', () => {
    const s = html(<BlocoApresentacao apresentacao={{
      etiqueta: 'NOVA COLEÇÃO', titulo: 'Verão 2026', descricao: 'Peças leves para revender.',
    }} />)
    expect(s).toContain('Verão 2026')
    expect(s).toContain('Peças leves para revender.')
    expect(s).toContain('Escolha o produto')
    // Em coluna não tem a seta da linha fina.
    expect(s).not.toContain('→')
  })
})

describe('13.12 — trocar o público não muda estilo nenhum', () => {
  it('o markup do card é byte a byte igual em feminino e masculino', () => {
    // `publico` não entra em nenhuma decisão de estilo — só existe como dado
    // de cadastro. A prova é o markup idêntico.
    const fem = lojaDaConfig({ nome: 'Loja', catalogo_publico: 'feminino' })
    const masc = lojaDaConfig({ nome: 'Loja', catalogo_publico: 'masculino' })
    expect(fem.publico).toBe('feminino')
    expect(masc.publico).toBe('masculino')

    const card = loja => html(
      <>
        <Cabecalho loja={loja} busca="" setBusca={() => {}} totalPecas={0} aoAbrirPedido={() => {}} />
        <CardProduto produto={multicor} modoAtacado noPedido={0} aoAbrir={() => {}} />
        <Rodape loja={loja} aoChamar={() => {}} />
      </>,
    )
    expect(card(fem)).toBe(card(masc))
  })
})

describe('estado vazio de busca', () => {
  it('explica o que fazer em vez de só dizer que não achou', () => {
    const s = html(<EstadoVazio />)
    expect(s).toContain('Nada encontrado')
    // As aspas do texto saem escapadas no markup.
    expect(s).toContain('Tente outra palavra ou toque em &quot;Tudo&quot;.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 13.1 e 13.6 — o que depende de LAYOUT, verificado por aritmética de CSS.
// jsdom não tem motor de layout e aqui nem jsdom existe; o que dá para provar
// é que a regra do grid produz o número de colunas certo em cada largura.
// ─────────────────────────────────────────────────────────────────────────────
describe('13.1 / A5 / A6 — grade: 2 colunas desde 320px, card travado em 258px', () => {
  /**
   * Reproduz a regra do grid:
   *   grid-template-columns: repeat(auto-fill, min(46%, 258px))
   *   gap: clamp(12px, 1.4vw, 22px)
   *   justify-content: center
   *
   * ─── O MODELO ANTERIOR ESTAVA ERRADO ──────────────────────────────────────
   * A versão de 20/08/2026 usava `minmax(min(46%, 258px), 258px)` e este teste
   * modelava o auto-fill contando pelo MÍNIMO da trilha. Com esse modelo a
   * conta dava 2 colunas e o teste passava — mas o navegador entregava UMA
   * coluna em todo celular, confirmado em device físico (Safari e webview do
   * WhatsApp) e depois no Chrome headless, onde getComputedStyle devolvia
   * `grid-template-columns: 258px` em 375, 390 e 430px.
   *
   * CSS Grid §7.2.3.1: para decidir quantas vezes repetir, o auto-fill usa a
   * função de tamanho MÁXIMA da trilha quando ela é definida — não a mínima.
   * Com máximo `258px` fixo a pergunta virava "quantas colunas de 258px cabem
   * em 350px de conteúdo?", e a resposta é uma.
   *
   * Com trilha única `min(46%, 258px)` não há mínimo e máximo divergentes: o
   * tamanho da trilha é um só, e é ele que conta. Os números abaixo foram
   * conferidos contra o Chrome (CDP, Emulation.setDeviceMetricsOverride) na
   * página real da tropicaleatacado — ver o relatório do fix.
   */
  function grade(larguraViewport) {
    const gap = Math.min(22, Math.max(12, larguraViewport * 0.014))
    const disponivel = Math.min(larguraViewport, 1280) - 40  // max-width 1280 + padding 20px
    const trilha = Math.min(disponivel * 0.46, 258)
    const n = Math.max(1, Math.floor((disponivel + gap) / (trilha + gap)))
    return { n, gap, largura: trilha, sobra: disponivel - (trilha * n + gap * (n - 1)) }
  }

  // ── A5: 2 colunas garantidas em toda a faixa de celular ──
  it('320px — a largura que estava dando 1 coluna no device real — dá 2 colunas', () => {
    expect(grade(320).n).toBe(2)
  })

  it('toda largura de celular dá 2 colunas, de 320 a 430', () => {
    for (const w of [320, 330, 360, 375, 390, 414, 430]) {
      expect(grade(w).n, `${w}px`).toBe(2)
    }
  })

  it('bate com o que o Chrome mediu na página real', () => {
    // Valores lidos de getComputedStyle().gridTemplateColumns com emulação
    // mobile. Se o modelo desta função divergir do navegador de novo, é aqui
    // que aparece.
    const medidoNoChrome = { 320: 128.8, 375: 154.1, 390: 161, 430: 179.4 }
    for (const [w, largura] of Object.entries(medidoNoChrome)) {
      const g = grade(Number(w))
      expect(g.n, `${w}px colunas`).toBe(2)
      expect(+g.largura.toFixed(1), `${w}px largura`).toBe(largura)
    }
  })

  it('3 colunas nunca cabem enquanto a porcentagem é quem manda', () => {
    // 3 × 46% = 138% > 100%, então no celular o teto é 2 — sem depender do gap.
    for (const w of [200, 320, 400, 500]) expect(grade(w).n).toBeLessThanOrEqual(2)
  })

  it('em celular a trilha é a porcentagem, não o cap de 258px', () => {
    // É o que diferencia o comportamento novo do antigo: em 390px a trilha
    // vale 46% (161px), e não 258px.
    expect(grade(390).largura).toBeCloseTo(161, 1)
    expect(grade(390).largura).toBeLessThan(258)
  })

  // ── A6: card travado em 258px (decisão preservada) ──
  it('o card nunca passa de 258px, por mais larga que seja a tela', () => {
    for (const w of [600, 768, 900, 1024, 1280, 1440, 1920, 2560]) {
      expect(grade(w).largura, `${w}px`).toBeLessThanOrEqual(258)
    }
  })

  it('no desktop o card fica exatamente em 258px', () => {
    for (const w of [768, 1024, 1280, 1440]) {
      expect(grade(w).largura, `${w}px`).toBe(258)
    }
  })

  it('a grade abre 2 → 3 → 4 colunas conforme a tela cresce', () => {
    // Conferido no Chrome: 600→2, 768→2, 1024→3, 1280→4, 1440→4.
    expect(grade(600).n).toBe(2)
    expect(grade(768).n).toBe(2)
    expect(grade(1024).n).toBe(3)
    expect(grade(1280).n).toBe(4)
    expect(grade(1440).n).toBe(4)
  })

  it('a sobra vira respiro centralizado, nunca negativa (sem overflow)', () => {
    for (const w of [320, 375, 390, 430, 600, 768, 1024, 1280, 1440]) {
      expect(grade(w).sobra, `${w}px`).toBeGreaterThanOrEqual(0)
    }
  })

  it('a regra do grid no componente é exatamente a calibrada aqui', async () => {
    const fs = await import('node:fs/promises')
    const fonte = await fs.readFile(new URL('./CatalogoPublicoV2.jsx', import.meta.url), 'utf8')
    expect(fonte).toContain("'repeat(auto-fill, min(46%, 258px))'")
    expect(fonte).toContain("'clamp(12px, 1.4vw, 22px)'")
    expect(fonte).toContain("justifyContent: 'center'")
    // Regressão: nenhuma das duas regras antigas pode voltar. A primeira
    // esticava o card no desktop; a segunda dava 1 coluna no celular.
    // A checagem é sobre a REGRA, não sobre o arquivo: o comentário que
    // explica o bug cita as duas de propósito.
    const regra = fonte.match(/gridTemplateColumns: '(repeat\(auto-fill[^']+)'/)?.[1]
    expect(regra).toBe('repeat(auto-fill, min(46%, 258px))')
  })

  it('a grade não usa minmax com máximo fixo — é o que quebrava o auto-fill', async () => {
    const fs = await import('node:fs/promises')
    const fonte = await fs.readFile(new URL('./CatalogoPublicoV2.jsx', import.meta.url), 'utf8')
    const regra = fonte.match(/gridTemplateColumns: '(repeat\(auto-fill[^']+)'/)?.[1]
    expect(regra).toBeTruthy()
    // minmax(..., <length>) faz o auto-fill contar pelo máximo. Só é seguro
    // com máximo flexível (1fr/auto) — ou sem minmax nenhum, como agora.
    const maximoFixo = /minmax\([^)]*,\s*[\d.]+px\s*\)/.test(regra)
    expect(maximoFixo, `regra atual: ${regra}`).toBe(false)
  })

  it('não existe nenhuma media query de layout — só a de acessibilidade', async () => {
    const fs = await import('node:fs/promises')
    const fonte = await fs.readFile(new URL('./CatalogoPublicoV2.jsx', import.meta.url), 'utf8')
    const queries = fonte.match(/@media[^{]+/g) || []
    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('prefers-reduced-motion')
  })
})
