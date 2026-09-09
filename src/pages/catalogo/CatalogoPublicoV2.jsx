// Catálogo público novo — implementação de docs/CATALOGO_SPEC.md.
//
// Substituiu CatalogoPublico.jsx: é ESTE o componente servido em /catalogo
// desde 20/08/2026 (App.jsx). O antigo continua no repositório, sem rota, como
// caminho de volta.
//
// Este bloco dizia "NÃO está plugado em nenhuma rota ainda" muito depois de a
// rota existir. Um comentário desatualizado sobre o que está no ar é pior que
// nenhum: leva a tratar como rascunho o arquivo que atende todas as lojas
// Business.
//
// Toda a matemática, a copy dinâmica e a mensagem do WhatsApp moram em
// utils/catalogoV2.js, com teste. Aqui só tem desenho e estado de tela.
//
// ─── Divergências deliberadas em relação à spec ─────────────────────────────
// 1. Seção 2.2, "tamanhos herda a grade padrão da loja": NÃO implementado.
//    Nenhum produto do sistema tem dimensão de tamanho (variacoes[] só tem
//    cor + quantidade), então herdar P/M/G/GG inventaria tamanho que a loja
//    não vende. Todo produto é tratado como tamanhos ["Único"], sem seletor.
//    O componente continua sabendo desenhar tamanhos de verdade: no dia em
//    que existir cadastro, basta o dado chegar em `tamanhos[]`.
// 2. Preços em reais (numeric), não em centavos. O sistema inteiro
//    (preco_venda, pedido_minimo_valor, fmtR) trabalha em reais; converter só
//    o catálogo criaria dois padrões de moeda no mesmo banco.
// 3. Seção 12, `srcset` em 2 tamanhos: não implementado. O Storage guarda uma
//    única versão de cada foto; servir 400w/1200w exige gerar as variantes na
//    ingestão, que é trabalho do upload e não deste componente. `loading` e
//    `decoding` estão implementados.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
// Client SEM sessão, de propósito: esta é uma página pública, e falar como
// `authenticated` (quando a lojista está logada no mesmo navegador) fazia o
// INSERT em lf_pedidos voltar 403. Ver o cabeçalho de supabasePublico.js.
import { supabasePublico as supabase } from '../../lib/supabasePublico'
import { produtoVisivelNoCatalogo } from '../../utils/catalogo'
import { fmtR } from '../../utils/formatters'
import { revelarBloco } from '../../utils/revelarVariacoes'
import { t, TEXTOS } from '../../i18n/catalogo'
import {
  normalizarProduto, temCor, temTamanho, legendaCard, perguntaModal,
  linhasDoCarrinho, totais, qtdPorProduto, aplicarRascunho, definirQtd, lojaDaConfig,
  estadoMinimo, categoriasDe, filtrarProdutos, ordenarProdutos,
  mensagemWhatsApp, linkWhatsApp,
  carregarCarrinho, salvarCarrinho, TAMANHO_UNICO,
  validarDadosCliente, dadosClienteParaPedido,
} from '../../utils/catalogoV2'

// ─────────────────────────────────────────────────────────────────────────────
// Tokens de design — seção 3. Valores exatos, sem interpretação.
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  fundo: '#FBF9F5',
  superficie: '#FFFDF9',
  superficie2: '#F5F1E8',
  superficie3: '#F2EDE3',
  fotoPlaceholder: '#F4EFE6',
  tinta: '#191713',
  tintaHover: '#312C24',
  texto2: '#443F35',
  texto3: '#6E695C',
  texto4: '#8B8577',
  texto5: '#948D7C',
  linha: '#E8E2D6',
  linhaCard: '#EBE5D9',
  linhaInput: '#E1DACB',
  linhaHover: '#D6CCB6',
  whatsapp: '#0F7B45',
  whatsappHover: '#0B6739',
  alertaFundo: '#FFF6E6',
  alertaBorda: '#F0DEB8',
  alertaTexto: '#6B4E14',
  etiqueta: '#A0987F',
  seta: '#CFC6B4',
  iconeBusca: '#A39C8C',
}

const UI = "'Instrument Sans', system-ui, -apple-system, sans-serif"
const DISPLAY = "'Instrument Serif', Georgia, serif"
const LARGURA = 1280
// Vermelho de erro de formulário. Fora do objeto C de propósito: C é a paleta
// literal da spec (seção 3), e isto é um token novo, não algo que veio de lá.
const ERRO = '#B4381F'

const PASSOS = [TEXTOS.passo1, TEXTOS.passo2, TEXTOS.passo3]

// ─────────────────────────────────────────────────────────────────────────────
// CSS que estilo inline não expressa: keyframes, fontes, scrollbar, media
// query de acessibilidade. Nenhum breakpoint de layout aqui — a spec proíbe
// (seção 10), e nada abaixo mexe em largura.
// ─────────────────────────────────────────────────────────────────────────────
function EstiloGlobal() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif&display=swap');

      @keyframes cat-slideUp { from { transform: translateY(14px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      @keyframes cat-fadeIn  { from { opacity: 0 } to { opacity: 1 } }
      @keyframes cat-kenburns { 0% { transform: scale(1.05) } 100% { transform: scale(1.22) translate3d(-2%, -3%, 0) } }

      .cat-scroll-x::-webkit-scrollbar { display: none }
      .cat-raiz *, .cat-raiz *::before, .cat-raiz *::after { box-sizing: border-box }
      .cat-raiz h1, .cat-raiz h2, .cat-raiz h3, .cat-raiz p { text-wrap: pretty }
      .cat-raiz button { font-family: inherit }

      .cat-card:hover { border-color: ${C.linhaHover} !important }
      .cat-btn-tinta:hover { background: ${C.tintaHover} !important }
      .cat-btn-wa:hover { background: ${C.whatsappHover} !important }
      /* O verde preenchido escurece no hover; o de contorno não pode usar a
         mesma regra — ficaria fundo escuro com texto verde. */
      .cat-btn-wa-out:hover { background: rgba(15,123,69,.09) !important }
      .cat-input:focus { border-color: ${C.tinta} !important; outline: none }

      @media (prefers-reduced-motion: reduce) {
        .cat-raiz *, .cat-raiz *::before, .cat-raiz *::after {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  )
}

/** O usuário pediu menos movimento? Desliga kenburns, autoplay e entradas. */
function usaMenosMovimento() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

// Os componentes de apresentação abaixo são exportados para teste: vitest roda
// em environment 'node' e sem jsdom não dá para montar a página, mas dá para
// renderizar cada pedaço com react-dom/server e conferir o DOM que sai. É o que
// CatalogoPublicoV2.test.jsx faz com os critérios de aceite da seção 13.

// ─────────────────────────────────────────────────────────────────────────────
// Hooks de acessibilidade — seção 11
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trava o scroll do body enquanto modal ou drawer estiver aberto.
 *
 * `overflow: hidden` no body NÃO segura o iOS — nem no Safari, nem no WebView
 * do WhatsApp, que é por onde a cliente chega pelo link. O body para, o
 * documento continua rolando, e o dedo que deveria rolar o painel rola a
 * página atrás dele. Foi exatamente o relato: "quem rola é o fundo".
 *
 * `position: fixed` no body é o que segura nos dois mundos. Como fixar zera a
 * rolagem, a posição é guardada e devolvida ao fechar — sem isso o catálogo
 * voltaria para o topo toda vez que a cliente fechasse o carrinho.
 */
function useTravaScroll(ativo) {
  useEffect(() => {
    if (!ativo) return
    const y = window.scrollY || window.pageYOffset || 0
    const anterior = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${y}px`
    // Sem largura fixa o body encolhe para o conteúdo ao virar fixed, e a
    // página inteira "pula" de largura no instante em que o modal abre.
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = anterior.overflow
      document.body.style.position = anterior.position
      document.body.style.top = anterior.top
      document.body.style.width = anterior.width
      window.scrollTo(0, y)
    }
  }, [ativo])
}

/**
 * Esc fecha, foco vai para o primeiro elemento ao abrir e fica preso dentro.
 * Sem isso o Tab do teclado escapa para a página atrás do modal.
 */
function useFocoPreso(ref, ativo, aoFechar) {
  // aoFechar fica numa ref, e NÃO nas dependências do efeito abaixo.
  //
  // Os dois chamadores passam arrow inline (`aoFechar={() => setDrawerAberto(false)}`),
  // que ganha identidade nova a cada render do pai. Com aoFechar nas deps, o
  // efeito rodava de novo a cada tecla digitada nos campos de nome e WhatsApp
  // do drawer — e como a primeira coisa que ele faz é `focaveis()[0].focus()`,
  // o foco saltava do input para o botão ✕ a cada caractere. A cliente tinha
  // de clicar no campo de novo a cada letra.
  //
  // A ref mantém o handler de Escape sempre atualizado sem ressuscitar o
  // efeito. Vale igual para o ModalProduto, que usa o mesmo hook.
  const aoFecharRef = useRef(aoFechar)
  useEffect(() => { aoFecharRef.current = aoFechar })

  useEffect(() => {
    if (!ativo || !ref.current) return
    const painel = ref.current
    const focaveis = () => [...painel.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )].filter(el => el.offsetParent !== null)

    focaveis()[0]?.focus()

    function aoTeclar(e) {
      if (e.key === 'Escape') { e.preventDefault(); aoFecharRef.current?.(); return }
      if (e.key !== 'Tab') return
      const lista = focaveis()
      if (!lista.length) return
      const primeiro = lista[0]
      const ultimo = lista[lista.length - 1]
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
    }

    painel.addEventListener('keydown', aoTeclar)
    return () => painel.removeEventListener('keydown', aoTeclar)
    // aoFechar de fora de propósito — ver a nota no topo da função.
  }, [ativo, ref])
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.1 Faixa de vídeo (opcional, acima do cabeçalho, não sticky)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ─── OS DOIS BUGS QUE ISTO CORRIGE ──────────────────────────────────────────
 *
 * 1. CAMPO VAZIO AINDA ESCREVIA NA FAIXA. Era
 *
 *      const titulo = video.titulo || nomeLoja
 *      const etiqueta = video.etiqueta || TEXTOS.etiquetaVideoPadrao
 *
 *    com os dois elementos renderizados sempre. Apagar os campos na tela de
 *    configuração não apagava nada: a faixa passava a escrever o nome da loja
 *    e "Coleção nova". A Fanboy contornou digitando "." e "//" nos campos, e o
 *    catálogo dela ficou com esses fragmentos soltos sobre o vídeo.
 *
 *    Agora vazio é vazio: cada elemento só existe se tiver texto, e o bloco
 *    inteiro some quando os dois estão vazios. O fallback também saiu de
 *    lojaDaConfig — eram DOIS fallbacks empilhados, e tirar só um deixaria o
 *    outro escrevendo.
 *
 * 2. O VÍDEO APARECIA CORTADO. O elemento nunca transbordou o container
 *    (medido: 0px de transbordo nas quatro bordas) — quem cortava era o
 *    `object-fit: cover`, que preenche a caixa e joga fora o que sobra. Medido
 *    com o vídeo real da Fanboy (1920x824) contra a faixa:
 *
 *      320x568   -> 169px cortados na largura, 65% do quadro visível
 *      360x740   -> 129px cortados na largura, 74% visível
 *      375x812   -> 114px cortados na largura, 77% visível
 *      1280x900  -> 209px cortados na ALTURA,  62% visível
 *
 *    Quanto mais estreito o celular, pior. O vídeo de capa é peça fechada
 *    (logo, texto, composição), não textura de fundo: cortar um terço dele
 *    destrói o que a lojista mandou fazer. `contain` mostra o quadro inteiro
 *    em qualquer largura.
 *
 *    O preço é tarja da cor da faixa quando a proporção do vídeo não bate com
 *    a da caixa — é troca consciente: tarja não esconde conteúdo, corte
 *    esconde. A altura continua em `clamp(210px, 32vw, 340px)`: px e vw, sem
 *    dvh, então a lição de suporte de unidade de viewport não morde aqui.
 *
 *    A IMAGEM de capa segue em `cover` de propósito. Ela é o caminho sem
 *    vídeo, e o ken burns da spec (4.1) é um zoom lento que corta por
 *    definição — trocar para contain mataria o efeito, que ninguém pediu para
 *    remover.
 */
export function FaixaVideo({ video }) {
  const menosMovimento = usaMenosMovimento()
  if (!video?.ativo) return null

  const etiqueta = video.etiqueta || ''
  const titulo = video.titulo || ''
  const temTexto = !!(etiqueta || titulo)
  const temVideo = !!video.videoUrl && !menosMovimento

  return (
    <div style={{
      position: 'relative', height: 'clamp(210px, 32vw, 340px)',
      overflow: 'hidden', background: C.tinta,
    }}>
      {temVideo ? (
        <video
          src={video.videoUrl} poster={video.imagemUrl || undefined}
          autoPlay muted loop playsInline preload="metadata"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : video.imagemUrl ? (
        <img
          src={video.imagemUrl} alt="" aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            animation: menosMovimento ? 'none' : 'cat-kenburns 18s ease-in-out infinite alternate',
          }}
        />
      ) : null}

      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(25,23,19,.34) 0%, rgba(25,23,19,.1) 40%, rgba(25,23,19,.8) 100%)',
      }} />

      {temTexto && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '22px 20px', maxWidth: LARGURA, margin: '0 auto',
        }}>
          {etiqueta && (
            <p style={{
              margin: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: '.16em',
              textTransform: 'uppercase', color: 'rgba(251,249,245,.8)',
            }}>{etiqueta}</p>
          )}
          {titulo && (
            <h1 style={{
              // Sem etiqueta em cima, o título não precisa do respiro de 4px
              // que separava os dois — senão ele desce sozinho dentro da faixa.
              margin: etiqueta ? '4px 0 0' : 0, fontFamily: DISPLAY, fontWeight: 400,
              fontSize: 'clamp(28px, 4.4vw, 46px)', lineHeight: 1.05, color: C.fundo,
            }}>{titulo}</h1>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Logo da loja — ou a inicial dela, quando não há logo.
 *
 * ─── O BUG QUE ISTO CORRIGE ─────────────────────────────────────────────────
 * Os dois lugares que mostram a logo usavam caixa QUADRADA com
 * `object-fit: cover`. Cover preenche a caixa e corta o que sobra: numa logo
 * retangular larga, ele descarta as laterais e deixa só o miolo. A Tropicale
 * tem logo larga, e o que aparecia na tela era "ica...TACADO" no lugar de
 * "Tropicale Atacado".
 *
 * `contain` sozinho já resolveria o corte, mas com a caixa quadrada uma logo
 * 4:1 renderizaria em 76×19 — legível na marra, com muito espaço vazio dos
 * dois lados. Então a caixa também deixou de ser quadrada:
 *
 *   altura FIXA + largura AUTOMÁTICA + teto de largura
 *
 * Assim a logo manda na própria proporção. Quadrada continua quadrada (altura
 * = largura, exatamente como antes); larga ocupa a largura que precisa até o
 * teto. É o mesmo padrão que ClientHeader.jsx já usava — a única parte do
 * sistema que nunca teve esse problema.
 *
 * O teto existe porque sem ele uma logo muito larga empurraria a busca e o
 * botão de pedido para fora no celular.
 */
function LogoLoja({ loja, altura, maxLargura, raio, estilo }) {
  const inicial = (loja?.nome || '?').trim().charAt(0).toUpperCase()
  if (loja?.logoUrl) {
    return (
      <img
        src={loja.logoUrl}
        alt={loja.nome}
        style={{
          height: altura, width: 'auto', maxWidth: maxLargura,
          objectFit: 'contain', borderRadius: raio, flex: 'none', ...estilo,
        }}
      />
    )
  }
  // Sem logo: a caixa da inicial continua quadrada de propósito — ela é
  // desenhada por nós, e aí a proporção é escolha nossa, não da lojista.
  return (
    <div style={{
      width: altura, height: altura, borderRadius: raio, background: C.tinta,
      flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(altura * 0.43), fontWeight: 700, color: C.fundo, ...estilo,
    }}>{inicial}</div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.2 Cabeçalho sticky. No celular os 3 itens quebram em 2 linhas sozinhos
// pelo flex-wrap — sem media query, como manda a seção 10.
// ─────────────────────────────────────────────────────────────────────────────
export function Cabecalho({ loja, busca, setBusca, totalPecas, aoAbrirPedido }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(251,249,245,.92)', backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid ${C.linha}`,
    }}>
      <div style={{
        maxWidth: LARGURA, margin: '0 auto', padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
      }}>
        {/* Marca */}
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <LogoLoja loja={loja} altura={44} maxLargura={120} raio={12} />
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 17, fontWeight: 600, color: C.tinta,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220,
            }}>{loja.nome}</p>
            <p style={{ margin: 0, fontSize: 12.5, color: C.texto4 }}>{loja.subtitulo}</p>
          </div>
        </div>

        {/* Busca */}
        <div style={{ flex: '1 1 190px', minWidth: 140, position: 'relative' }}>
          <span aria-hidden="true" style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            fontSize: 17, color: C.iconeBusca, pointerEvents: 'none',
          }}>⌕</span>
          <input
            className="cat-input"
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder={TEXTOS.buscarPlaceholder}
            aria-label={TEXTOS.buscarPlaceholder}
            style={{
              width: '100%', height: 50, borderRadius: 14,
              border: `1px solid ${C.linhaInput}`, background: C.superficie,
              padding: '0 16px 0 42px',
              // 16px é obrigatório: menos que isso e o iOS dá zoom no foco.
              fontSize: 16, fontFamily: UI, color: C.tinta,
            }}
          />
        </div>

        {/* Pedido */}
        <button
          className="cat-btn-tinta"
          onClick={aoAbrirPedido}
          aria-label={TEXTOS.abrirPedido}
          style={{
            flex: 'none', height: 50, padding: '0 15px', borderRadius: 14,
            border: 'none', background: C.tinta, color: C.fundo, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 9,
            fontSize: 14.5, fontWeight: 600,
          }}
        >
          {TEXTOS.botaoPedido}
          <span style={{
            minWidth: 24, height: 24, borderRadius: 99, background: C.fundo, color: C.tinta,
            fontSize: 13, fontWeight: 700, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', padding: '0 6px',
          }}>{totalPecas}</span>
        </button>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.3 / 4.4 Os 3 passos — em linha fina quando não há apresentação, em coluna
// dentro do bloco grande quando há.
// ─────────────────────────────────────────────────────────────────────────────
export function TresPassos({ coluna }) {
  if (coluna) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {PASSOS.map((texto, i) => (
          <div key={texto} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 30, height: 30, borderRadius: 99, background: C.tinta, color: C.fundo,
              fontSize: 13, fontWeight: 700, flex: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</span>
            <span style={{ fontSize: 15, lineHeight: 1.45, color: C.texto2, fontWeight: 600 }}>{texto}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="cat-scroll-x" style={{
      padding: '14px 0 12px', display: 'flex', gap: 16, alignItems: 'center',
      overflowX: 'auto', scrollbarWidth: 'none', whiteSpace: 'nowrap',
    }}>
      {PASSOS.map((texto, i) => (
        <div key={texto} style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 19, height: 19, borderRadius: 99, background: C.tinta, color: C.fundo,
              fontSize: 11, fontWeight: 700, flex: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</span>
            <span style={{ fontSize: 13, color: C.texto3 }}>{texto}</span>
          </div>
          {i < PASSOS.length - 1 && (
            <span aria-hidden="true" style={{ fontSize: 12, color: C.seta }}>→</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function BlocoApresentacao({ apresentacao }) {
  return (
    <div style={{
      padding: '36px 0 26px', display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 26, alignItems: 'end',
    }}>
      <div>
        {apresentacao.etiqueta && (
          <p style={{
            margin: '0 0 10px', fontSize: 12, fontWeight: 600, letterSpacing: '.14em',
            textTransform: 'uppercase', color: C.etiqueta,
          }}>{apresentacao.etiqueta}</p>
        )}
        {apresentacao.titulo && (
          <h1 style={{
            margin: '0 0 14px', fontFamily: DISPLAY, fontWeight: 400,
            fontSize: 52, lineHeight: 1.02, color: C.tinta,
          }}>{apresentacao.titulo}</h1>
        )}
        {apresentacao.descricao && (
          <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.55, color: C.texto3, maxWidth: '44ch' }}>
            {apresentacao.descricao}
          </p>
        )}
      </div>
      <TresPassos coluna />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.5 Faixa preta de pedido mínimo — uma linha só, com barra de progresso
// ─────────────────────────────────────────────────────────────────────────────
export function FaixaMinimo({ minimo }) {
  if (!minimo) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, background: C.tinta,
      borderRadius: 13, padding: '11px 14px', marginBottom: 14,
    }}>
      <p style={{
        margin: 0, flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: C.fundo,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{minimo.texto}</p>
      <div
        role="progressbar"
        aria-valuenow={Math.round(minimo.progresso)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          flex: '0 0 84px', height: 6, borderRadius: 99,
          background: 'rgba(251,249,245,.24)', overflow: 'hidden',
        }}
      >
        <div style={{
          height: '100%', borderRadius: 99, background: C.fundo,
          width: `${minimo.progresso}%`, transition: 'width .3s ease',
        }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.6 Filtros — chips roláveis + select de ordenação, tudo em uma linha
// ─────────────────────────────────────────────────────────────────────────────
export function Filtros({ categorias, categoria, setCategoria, ordem, setOrdem }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 16 }}>
      <div className="cat-scroll-x" style={{
        flex: '1 1 auto', minWidth: 0, display: 'flex', gap: 7,
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {categorias.map(cat => {
          const ativo = cat === categoria
          return (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              aria-pressed={ativo}
              style={{
                height: 34, padding: '0 14px', borderRadius: 99, flex: 'none',
                fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer',
                background: ativo ? C.tinta : C.superficie,
                border: `1px solid ${ativo ? C.tinta : C.linhaInput}`,
                color: ativo ? C.fundo : C.texto2,
              }}
            >{cat}</button>
          )
        })}
      </div>

      <select
        value={ordem}
        onChange={e => setOrdem(e.target.value)}
        aria-label={TEXTOS.ordenar}
        style={{
          flex: 'none', height: 34, maxWidth: 126, borderRadius: 99,
          border: `1px solid ${C.linhaInput}`, background: C.superficie,
          fontSize: 13.5, fontFamily: UI, color: C.texto2, padding: '0 10px', cursor: 'pointer',
        }}
      >
        <option value="destaque">{TEXTOS.ordenar}</option>
        <option value="menor">{TEXTOS.ordemMenorPreco}</option>
        <option value="maior">{TEXTOS.ordemMaiorPreco}</option>
        <option value="nome">{TEXTOS.ordemNome}</option>
      </select>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.7 Card. O <article> inteiro é o alvo de clique — nenhum texto de botão.
// ─────────────────────────────────────────────────────────────────────────────
export function CardProduto({ produto, modoAtacado, noPedido, aoAbrir, prioridade }) {
  const foto = produto.fotos[0]

  function aoTeclar(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoAbrir() }
  }

  return (
    <article
      className="cat-card"
      role="button"
      tabIndex={0}
      aria-label={t('ariaAbrirProduto', { nome: produto.nome })}
      onClick={aoAbrir}
      onKeyDown={aoTeclar}
      style={{
        background: C.superficie, border: `1px solid ${C.linhaCard}`, borderRadius: 20,
        overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'relative', aspectRatio: '3 / 4',
        background: C.fotoPlaceholder, overflow: 'hidden',
      }}>
        {foto && (
          <img
            src={foto} alt={produto.nome}
            loading={prioridade ? 'eager' : 'lazy'} decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {produto.selo && (
          <span style={{
            position: 'absolute', top: 12, left: 12, background: C.tinta, color: C.fundo,
            fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
            padding: '6px 10px', borderRadius: 99,
          }}>{produto.selo}</span>
        )}

        {noPedido > 0 && (
          <span style={{
            position: 'absolute', top: 12, right: 12, background: C.fundo,
            border: `1px solid ${C.linhaInput}`, color: C.tinta,
            fontSize: 12.5, fontWeight: 700, padding: '5px 9px', borderRadius: 99,
          }}>{noPedido} no pedido</span>
        )}

        {/* Indicativo visual: quem clica é o card inteiro. */}
        <span aria-hidden="true" style={{
          position: 'absolute', right: 10, bottom: 10, width: 40, height: 40, borderRadius: 99,
          background: C.tinta, color: C.fundo, fontSize: 22, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(25,23,19,.28)',
        }}>+</span>
      </div>

      <div style={{
        padding: 'clamp(11px, 1.3vw, 16px)', display: 'flex', flexDirection: 'column',
        gap: 10, flex: 1,
      }}>
        <p style={{
          margin: 0, fontSize: 'clamp(13.5px, 1.5vw, 15.5px)', fontWeight: 600,
          lineHeight: 1.3, color: C.tinta,
        }}>{produto.nome}</p>

        <p style={{ margin: 0, fontSize: 12.5, color: C.texto5 }}>{legendaCard(produto)}</p>

        <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{
            fontFamily: DISPLAY, fontSize: 'clamp(21px, 2.3vw, 27px)', color: C.tinta,
          }}>{fmtR(produto.preco)}</span>
          {modoAtacado && <span style={{ fontSize: 13, color: C.texto5 }}>/ peça</span>}
        </p>

        {produto.cores.length > 0 && (
          <div style={{ marginTop: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {produto.cores.map(cor => (
              <span
                key={cor.nome}
                title={cor.nome}
                style={{
                  width: 20, height: 20, borderRadius: 99, background: cor.hex,
                  border: '1px solid rgba(0,0,0,.14)',
                  boxShadow: `inset 0 0 0 2px ${C.superficie}`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

/**
 * Catálogo despublicado.
 *
 * Substitui a página inteira — cabeçalho, grade e rodapé. Não é uma faixa em
 * cima do catálogo: o requisito é que nenhuma peça e nenhum preço fiquem
 * acessíveis por esta rota enquanto a loja estiver fora do ar.
 *
 * O que fica: a identidade da loja (para quem abriu o link saber que chegou no
 * lugar certo) e o caminho para falar com ela. Sem WhatsApp cadastrado o botão
 * não existe — botão verde que não abre conversa nenhuma é pior que nada, e é
 * a mesma regra que o Rodape já segue.
 */
export function CatalogoForaDoAr({ loja, aoChamar }) {
  const mostrarNome = !loja?.logoUrl
  return (
    <div style={{
      minHeight: '100dvh', background: C.fundo, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        {/* Aqui a logo é o elemento principal da tela, então o teto de
            largura é bem maior que no cabeçalho.

            A margem de baixo muda conforme o nome apareça ou não, para o
            espaço até o título ficar igual nos dois casos (a linha do nome
            somava 10px de margem própria). */}
        <LogoLoja
          loja={loja} altura={76} maxLargura={280} raio={20}
          estilo={{ margin: mostrarNome ? '0 auto 20px' : '0 auto 28px', display: 'block' }}
        />

        {/* O nome só entra quando NÃO há logo.
            Com logo ele era eco: a logo da loja quase sempre já traz o nome
            escrito, e a tela mostrava "Tropicale Atacado" duas vezes seguidas.
            Sem logo, o LogoLoja desenha só a inicial — e aí este texto é a
            única identificação da tela, então continua.

            No CABEÇALHO do catálogo o nome fica, de propósito: lá ele está ao
            LADO da logo e ancora o subtítulo ("Catálogo online"), formando um
            bloco de marca compacto. Aqui ele ficava embaixo, empilhado, que é
            o que fazia parecer repetição. */}
        {mostrarNome && (
          <p style={{
            margin: '0 0 10px', fontSize: 12, fontWeight: 600, letterSpacing: '.14em',
            textTransform: 'uppercase', color: C.etiqueta,
          }}>{loja?.nome}</p>
        )}

        <h1 style={{
          margin: '0 0 14px', fontFamily: DISPLAY, fontWeight: 400,
          fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 1.1, color: C.tinta,
        }}>{TEXTOS.foraDoArTitulo}</h1>

        <p style={{ margin: '0 0 26px', fontSize: 16, lineHeight: 1.6, color: C.texto3 }}>
          {loja?.whatsapp ? TEXTOS.foraDoArTexto : TEXTOS.foraDoArSemWhatsapp}
        </p>

        {loja?.whatsapp && (
          <button
            className="cat-btn-wa"
            onClick={aoChamar}
            style={{
              height: 54, padding: '0 26px', borderRadius: 14, border: 'none',
              background: C.whatsapp, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 9,
            }}
          >{TEXTOS.foraDoArWhatsapp}</button>
        )}
      </div>
    </div>
  )
}

export function EstadoVazio() {
  return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <p style={{ margin: '0 0 8px', fontSize: 19, color: C.texto2 }}>{TEXTOS.vazioTitulo}</p>
      <p style={{ margin: 0, fontSize: 15, color: C.texto4 }}>{TEXTOS.vazioTexto}</p>
    </div>
  )
}

/**
 * Loja sem NENHUMA peça publicada — não confundir com busca sem resultado.
 *
 * É o estado de 12 das 13 lojas hoje: elas alcançam /{slug}/catalogo porque a
 * rota é aberta a qualquer slug, mas não têm produto com
 * disponivel_catalogo_b2b. Mandar "tente outra palavra" para quem chegou num
 * catálogo que nunca teve peça é jogar a culpa na cliente.
 */
export function EstadoSemCatalogo({ loja, aoChamar }) {
  return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <p style={{ margin: '0 0 8px', fontSize: 19, color: C.texto2 }}>{TEXTOS.semCatalogoTitulo}</p>
      <p style={{ margin: '0 auto', fontSize: 15, color: C.texto4, maxWidth: '46ch', lineHeight: 1.55 }}>
        {TEXTOS.semCatalogoTexto}
      </p>
      {loja?.whatsapp && (
        <button
          className="cat-btn-wa"
          onClick={aoChamar}
          style={{
            marginTop: 22, height: 52, padding: '0 24px', borderRadius: 14, border: 'none',
            background: C.whatsapp, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }}
        >{TEXTOS.semCatalogoAjuda}</button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.8 Rodapé — Envio → Precisa de ajuda? → botão. Nessa ordem.
// ─────────────────────────────────────────────────────────────────────────────
export function Rodape({ loja, aoChamar }) {
  return (
    <footer style={{ borderTop: `1px solid ${C.linha}`, background: C.superficie2, marginTop: 20 }}>
      <div style={{
        maxWidth: LARGURA, margin: '0 auto', padding: '28px 20px',
        display: 'flex', gap: 18, alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 200px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 16.5, fontWeight: 600, color: C.tinta }}>{TEXTOS.envio}</p>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: C.texto3 }}>{loja.textoEnvio}</p>
        </div>

        <div>
          <p style={{ margin: '0 0 4px', fontSize: 16.5, fontWeight: 600, color: C.tinta }}>{TEXTOS.ajudaTitulo}</p>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: C.texto3 }}>{TEXTOS.ajudaTexto}</p>
        </div>

        {/* Sem WhatsApp cadastrado o botão não existe — botão verde que não
            abre conversa nenhuma é pior do que botão nenhum. */}
        {loja.whatsapp && (
          <button
            className="cat-btn-wa"
            onClick={aoChamar}
            style={{
              flex: 'none', height: 52, padding: '0 24px', borderRadius: 14, border: 'none',
              background: C.whatsapp, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}
          >{TEXTOS.chamarWhatsapp}</button>
        )}
      </div>
    </footer>
  )
}

/**
 * Cabeçalho de uma etapa de escolha: "Cor  ·  Verde" ou "Cor  ·  escolha uma".
 *
 * O valor escolhido fica na MESMA linha do título, e não numa linha própria:
 * é o que mantém a etapa com uma altura só, que é o ponto do redesenho.
 */
export function RotuloEscolha({ titulo, valor, vazio }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
      <span style={{
        fontSize: 12, fontWeight: 600, letterSpacing: '.1em',
        textTransform: 'uppercase', color: C.etiqueta,
      }}>{titulo}</span>
      <span style={{
        fontSize: 14, fontWeight: valor ? 600 : 400,
        color: valor ? C.tinta : C.texto4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{valor || vazio}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Modal do produto — rascunho local, só entra no pedido ao confirmar
// ─────────────────────────────────────────────────────────────────────────────
export function ModalProduto({ produto, modoAtacado, aoFechar, aoConfirmar }) {
  const [rascunho, setRascunho] = useState({})
  const [fotoIndice, setFotoIndice] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [zoomOrigem, setZoomOrigem] = useState('50% 50%')
  const painelRef = useRef(null)
  const fotoRef = useRef(null)

  useTravaScroll(true)
  useFocoPreso(painelRef, true, aoFechar)

  // Rascunho nasce vazio a cada abertura: a spec trata o modal como um
  // formulário novo, não como edição do que já está no carrinho. Quem garante
  // isso é o `key={produto.id}` lá no render — trocar de produto remonta o
  // modal inteiro, sem efeito de reset e sem render em cascata.
  const comCor = temCor(produto)
  const comTam = temTamanho(produto)
  // Produto sem escolha de cor ainda precisa de UM valor para a chave.
  const cores = produto.cores.length ? produto.cores : [null]
  const tamanhos = produto.tamanhos.length ? produto.tamanhos : [TAMANHO_UNICO]

  // ── Escolha corrente (chips) ────────────────────────────────────────────
  // Dimensão que NÃO é escolha já nasce resolvida: produto de cor única ou
  // sem tamanho não pode ganhar uma etapa vazia só para manter simetria.
  // temCor/temTamanho já tratam "1 opção" como ausência de escolha, então
  // quando os chips aparecem há sempre 2+ opções.
  const [corSel, setCorSel] = useState(comCor ? null : (cores[0] ?? null))
  const [tamSel, setTamSel] = useState(comTam ? null : tamanhos[0])
  const [qtd, setQtd] = useState(1)

  // A chave do rascunho é EXATAMENTE a de antes — `${cor}|${tamanho}`, com cor
  // vazia quando o produto não oferece escolha de cor. aplicarRascunho e
  // chaveItem continuam recebendo o mesmo formato, então carrinho, drawer,
  // mensagem do WhatsApp e lf_pedidos não enxergam diferença nenhuma.
  const parDe = (cor, tam) => `${comCor && cor ? cor.nome : ''}|${tam}`

  const podeAdicionar = (!comCor || corSel) && (!comTam || tamSel) && qtd > 0

  // ── Escolha obrigatória ──────────────────────────────────────────────────
  // O relato: o cliente toca no botão preto "Adicionar ao pedido" sem ter
  // escolhido cor, e nada explica que faltava escolher. Duas causas somadas:
  //
  //   • o botão preto NUNCA era desabilitado. Ele chamava aoConfirmar({}) com
  //     rascunho vazio; lá no pai isso vira um toast no rodapé da tela, longe
  //     do seletor de cor — que a essa altura já saiu de vista no celular;
  //   • o botão "Adicionar" de contorno era `disabled`, e botão desabilitado
  //     não recebe toque: tocar nele não fazia nem dizia nada.
  //
  // Agora o aviso aparece COLADO no seletor que falta, e a tela rola até ele.
  const faltaEscolha = (comCor && !corSel) || (comTam && !tamSel)
  const [erroEscolha, setErroEscolha] = useState('')
  const refCor = useRef(null)
  const refTam = useRef(null)

  /** Aponta o que falta e leva a pessoa até lá. */
  function sinalizarFaltaDeEscolha() {
    const semCor = comCor && !corSel
    const semTam = comTam && !tamSel
    if (!semCor && !semTam) return false
    setErroEscolha(
      semCor && semTam ? TEXTOS.faltaCorETamanho
        : semCor ? TEXTOS.faltaCor
          : TEXTOS.faltaTamanho,
    )
    // Mesmo utilitário da Nova Venda: rolagem mínima que traz o bloco inteiro
    // para dentro, respeitando o container que rola.
    revelarBloco(semCor ? refCor.current : refTam.current)
    return true
  }

  /**
   * O botão preto do rodapé.
   *
   * Lista vazia NÃO significa mais "não faz nada":
   *   • falta escolha  → avisa no seletor, não fecha o modal;
   *   • nada a escolher (cor única, sem tamanho) → confirma a escolha corrente
   *     com a quantidade da tela. Exigir que a cliente tocasse antes no
   *     "Adicionar" de contorno era um passo extra sem informação nenhuma,
   *     porque não havia o que escolher.
   */
  function confirmarTudo() {
    if (totalRascunho > 0) { aoConfirmar(rascunho); return }
    if (sinalizarFaltaDeEscolha()) return
    aoConfirmar({ [parDe(corSel, tamSel)]: qtd })
  }

  /**
   * Joga a escolha atual na lista compacta.
   *
   * SOMA ao que já existe em vez de sobrescrever: repetir a mesma combinação é
   * a forma natural de dizer "mais duas dessas", e o comportamento casa com o
   * aplicarRascunho lá no carrinho, que também soma.
   *
   * A cor e o tamanho ficam selecionados de propósito — quem acabou de somar
   * Verde/M costuma querer Verde/G em seguida, e limpar obrigaria a reescolher
   * a cor toda vez. A quantidade volta para 1, que é o palpite seguro.
   */
  function adicionarItem() {
    if (!podeAdicionar) return
    const par = parDe(corSel, tamSel)
    setRascunho(prev => ({ ...prev, [par]: (prev[par] || 0) + qtd }))
    setQtd(1)
  }

  /** Edita ou remove uma linha da lista compacta. 0 apaga. */
  function definirItem(par, n) {
    setRascunho(prev => {
      const copia = { ...prev }
      if (n > 0) copia[par] = n
      else delete copia[par]
      return copia
    })
  }

  // Lista compacta, derivada do rascunho — sem estado paralelo para
  // dessincronizar. A cor é reencontrada pelo nome para desenhar a bolinha.
  const itens = Object.entries(rascunho)
    .filter(([, n]) => n > 0)
    .map(([par, n]) => {
      const [nomeCor, tam] = String(par).split('|')
      return {
        par, n, tam,
        cor: cores.find(c => c?.nome === nomeCor) || null,
        rotulo: [nomeCor, comTam ? tam : ''].filter(Boolean).join(' · ') || TEXTOS.quantidade,
      }
    })

  const totalRascunho = itens.reduce((s, i) => s + i.n, 0)
  const subtotal = totalRascunho * produto.preco

  // Zoom: clique alterna, mouse move a origem, sair desliga.
  function alternarZoom() { setZoom(z => !z) }
  function moverZoom(e) {
    if (!zoom || !fotoRef.current) return
    const r = fotoRef.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    setZoomOrigem(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`)
  }

  const fotoAtual = produto.fotos[fotoIndice] || produto.fotos[0]

  return (
    <div
      onClick={aoFechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(25,23,19,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        animation: 'cat-fadeIn .18s ease',
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label={produto.nome}
        onClick={e => e.stopPropagation()}
        style={{
          background: C.fundo, borderRadius: 24, width: 'min(1020px, 100%)',
          maxHeight: '92vh', overflow: 'auto', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          animation: 'cat-slideUp .22s ease',
        }}
      >
        {/* ── Coluna da foto ── */}
        {/* No desktop esta coluna fica lado a lado e a altura quem manda é a
            coluna de escolha, então o minHeight quase nunca vale. Quem ele
            atende é o celular, onde o modal vira UMA coluna e a foto ficava
            com 340px fixos empurrando a etapa de tamanho para fora da tela.
            clamp com vh encolhe a foto em tela baixa e a mantém generosa em
            tela alta — e continua sem media query, como manda a seção 10. */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          minHeight: 'clamp(160px, 21vh, 340px)', minWidth: 0,
        }}>
          <div
            ref={fotoRef}
            onClick={alternarZoom}
            onMouseMove={moverZoom}
            onMouseLeave={() => setZoom(false)}
            style={{ position: 'absolute', inset: 0, cursor: zoom ? 'zoom-out' : 'zoom-in', background: C.fotoPlaceholder }}
          >
            {fotoAtual && (
              <img
                src={fotoAtual} alt={produto.nome} decoding="async"
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', transition: 'transform .18s ease',
                  transform: zoom ? 'scale(2.1)' : 'scale(1)',
                  transformOrigin: zoom ? zoomOrigem : '50% 50%',
                }}
              />
            )}
          </div>

          {produto.fotos.length >= 2 && (
            <div style={{ position: 'absolute', left: 14, bottom: 14, display: 'flex', gap: 8 }}>
              {produto.fotos.map((f, i) => (
                <button
                  key={f + i}
                  onClick={e => { e.stopPropagation(); setFotoIndice(i); setZoom(false) }}
                  aria-label={t('ariaVerFoto', { n: i + 1 })}
                  style={{
                    width: 52, height: 66, borderRadius: 9, padding: 0, cursor: 'pointer',
                    overflow: 'hidden', background: C.fotoPlaceholder,
                    border: `2px solid ${i === fotoIndice ? C.tinta : 'rgba(255,255,255,.7)'}`,
                  }}
                >
                  <img src={f} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}

          <span style={{
            position: 'absolute', right: 14, bottom: 14, background: 'rgba(251,249,245,.92)',
            color: C.texto2, fontSize: 12.5, padding: '6px 12px', borderRadius: 99,
            pointerEvents: 'none',
          }}>{TEXTOS.ampliar}</span>
        </div>

        {/* ── Coluna de escolha ── */}
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '92vh', minWidth: 0 }}>
          <div style={{ padding: '22px 24px 0', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: '0 0 6px', fontSize: 12, fontWeight: 600, letterSpacing: '.12em',
                textTransform: 'uppercase', color: C.etiqueta,
              }}>{produto.categoria}</p>
              <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, color: C.tinta }}>{produto.nome}</h2>
              <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 32, color: C.tinta }}>{fmtR(produto.preco)}</span>
                {modoAtacado && <span style={{ fontSize: 14, color: C.texto5 }}>/ peça no atacado</span>}
              </p>
            </div>
            <button
              onClick={aoFechar}
              aria-label={TEXTOS.ariaFechar}
              style={{
                flex: 'none', width: 42, height: 42, borderRadius: 12, cursor: 'pointer',
                border: `1px solid ${C.linhaInput}`, background: C.superficie,
                color: C.texto2, fontSize: 18,
              }}
            >✕</button>
          </div>

          {/* minHeight: 0 é obrigatório num filho de flex column: sem ele o
              min-height:auto impede encolher abaixo do conteúdo e o
              overflow-y nunca vira rolagem. overscroll-behavior impede o
              gesto de vazar para a página atrás no toque. */}
          <div style={{
            padding: '20px 24px', overflowY: 'auto', flex: 1, minHeight: 0,
            overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
          }}>
            <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: C.tinta }}>
              {perguntaModal(produto)}
            </p>

            {/* ── 1. Cor ─────────────────────────────────────────────────
                Bolinha com a cor real do produto. Só existe quando cor é
                ESCOLHA: com uma cor só, temCor é false e a etapa some — o
                produto vai direto para a quantidade. */}
            {comCor && (
              <div
                ref={refCor}
                style={{
                  marginBottom: 16,
                  // A moldura só aparece depois que a pessoa tentou avançar sem
                  // escolher — antes disso seria vermelho na cara de quem ainda
                  // nem começou.
                  ...(erroEscolha && !corSel ? {
                    border: `1.5px solid ${ERRO}`, borderRadius: 14,
                    padding: 12, margin: '0 -12px 16px',
                  } : null),
                }}
              >
                <RotuloEscolha titulo={TEXTOS.rotuloCor} valor={corSel?.nome} vazio={TEXTOS.escolhaUmaCor} />
                {erroEscolha && !corSel && (
                  <p role="alert" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: ERRO }}>
                    {TEXTOS.faltaCor}
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {cores.map(cor => {
                    const ativo = corSel?.nome === cor?.nome
                    return (
                      <button
                        key={cor?.nome}
                        onClick={() => { setCorSel(cor); setErroEscolha('') }}
                        aria-pressed={ativo}
                        aria-label={t('ariaEscolherCor', { nome: cor?.nome })}
                        title={cor?.nome}
                        style={{
                          width: 42, height: 42, borderRadius: 99, padding: 0, cursor: 'pointer',
                          background: cor?.hex, flex: 'none',
                          // O anel por fora (box-shadow) em vez de borda mais
                          // grossa: borda encolheria a área de cor e cores
                          // claras ficariam ainda mais difíceis de distinguir.
                          border: '1px solid rgba(0,0,0,.16)',
                          boxShadow: ativo
                            ? `0 0 0 2px ${C.fundo}, 0 0 0 4px ${C.tinta}`
                            : `inset 0 0 0 2px ${C.superficie}`,
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── 2. Tamanho ────────────────────────────────────────────────
                Pill retangular. Mesma regra: sem escolha de tamanho
                (o caso de hoje, em que tudo é "Único"), a etapa não existe. */}
            {comTam && (
              <div
                ref={refTam}
                style={{
                  marginBottom: 16,
                  ...(erroEscolha && !tamSel ? {
                    border: `1.5px solid ${ERRO}`, borderRadius: 14,
                    padding: 12, margin: '0 -12px 16px',
                  } : null),
                }}
              >
                <RotuloEscolha titulo={TEXTOS.rotuloTamanho} valor={tamSel} vazio={TEXTOS.escolhaUmTamanho} />
                {erroEscolha && !tamSel && (
                  <p role="alert" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: ERRO }}>
                    {TEXTOS.faltaTamanho}
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tamanhos.map(tam => {
                    const ativo = tamSel === tam
                    return (
                      <button
                        key={tam}
                        onClick={() => { setTamSel(tam); setErroEscolha('') }}
                        aria-pressed={ativo}
                        aria-label={t('ariaEscolherTamanho', { nome: tam })}
                        style={{
                          minWidth: 52, height: 42, padding: '0 15px', borderRadius: 99,
                          flex: 'none', cursor: 'pointer', fontSize: 14.5, fontWeight: 600,
                          background: ativo ? C.tinta : C.superficie,
                          border: `1px solid ${ativo ? C.tinta : C.linhaInput}`,
                          color: ativo ? C.fundo : C.texto2,
                        }}
                      >{tam}</button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── 3. Quantidade + Adicionar ─────────────────────────────────
                flex-wrap resolve os dois tamanhos de tela sem media query
                (seção 10): no desktop sobra largura e tudo cabe numa linha;
                no celular o botão desce sozinho para a linha de baixo. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: 12, borderRadius: 16,
              background: C.superficie, border: `1px solid ${C.linhaCard}`,
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.texto3, flex: 'none' }}>
                {TEXTOS.quantidade}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                <button
                  onClick={() => setQtd(n => Math.max(1, n - 1))}
                  disabled={qtd <= 1}
                  aria-label={TEXTOS.ariaDiminuir}
                  style={{
                    width: 40, height: 40, borderRadius: 12, flex: 'none',
                    border: `1px solid ${C.linhaInput}`, background: C.fundo,
                    color: qtd <= 1 ? C.texto5 : C.tinta, fontSize: 17,
                    cursor: qtd <= 1 ? 'not-allowed' : 'pointer', opacity: qtd <= 1 ? 0.5 : 1,
                  }}
                >−</button>
                <span style={{
                  minWidth: 30, textAlign: 'center', fontSize: 16.5, fontWeight: 700, color: C.tinta,
                }}>{qtd}</span>
                <button
                  onClick={() => setQtd(n => n + 1)}
                  aria-label={TEXTOS.ariaAumentar}
                  style={{
                    width: 40, height: 40, borderRadius: 12, flex: 'none', border: 'none',
                    background: C.tinta, color: C.fundo, fontSize: 17, cursor: 'pointer',
                  }}
                >+</button>
              </div>
              {/* Contorno, não preenchido: o botão cheio é o "Adicionar ao
                  pedido" do rodapé, que é a ação que fecha o modal. Dois
                  botões pretos iguais fariam a pessoa clicar no errado. */}
              {/* `aria-disabled` e NÃO `disabled`: botão desabilitado de
                  verdade não recebe toque nenhum, então tocar nele não fazia
                  nem dizia nada — que é metade da reclamação. Assim ele
                  continua anunciado como indisponível para o leitor de tela,
                  mas o toque chega e consegue EXPLICAR o que falta. */}
              <button
                onClick={() => { if (!sinalizarFaltaDeEscolha()) adicionarItem() }}
                aria-disabled={!podeAdicionar}
                style={{
                  flex: '1 1 130px', minWidth: 120, height: 44, borderRadius: 12,
                  border: `1.5px solid ${podeAdicionar ? C.tinta : C.linhaInput}`,
                  background: 'transparent',
                  color: podeAdicionar ? C.tinta : C.texto5,
                  fontSize: 15, fontWeight: 600,
                  cursor: podeAdicionar ? 'pointer' : 'not-allowed',
                }}
              >{TEXTOS.adicionarItem}</button>
            </div>

            {/* ── 4. Lista compacta do que já foi escolhido ─────────────────
                Fica DENTRO do modal, antes do rodapé: é a confirmação de que
                o clique em Adicionar fez alguma coisa. Cada linha edita a
                quantidade ou sai. */}
            {itens.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  gap: 10, marginBottom: 8,
                }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: C.tinta }}>
                    {TEXTOS.itensEscolhidos}
                  </p>
                  <p style={{ margin: 0, fontSize: 12.5, color: C.texto4 }}>
                    {t(itens.length === 1 ? 'itensResumoUm' : 'itensResumo',
                      { pecas: totalRascunho, itens: itens.length })}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {itens.map(item => (
                    <div key={item.par} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 12,
                      background: C.superficie3, border: `1px solid ${C.linha}`,
                    }}>
                      {item.cor && comCor && (
                        <span aria-hidden="true" style={{
                          width: 18, height: 18, borderRadius: 99, flex: 'none',
                          background: item.cor.hex, border: '1px solid rgba(0,0,0,.16)',
                        }} />
                      )}
                      <span style={{
                        flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.tinta,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{item.rotulo}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                        <button
                          onClick={() => definirItem(item.par, item.n - 1)}
                          aria-label={TEXTOS.ariaDiminuir}
                          style={{
                            width: 32, height: 32, borderRadius: 9, flex: 'none',
                            border: `1px solid ${C.linhaInput}`, background: C.fundo,
                            color: C.tinta, fontSize: 15, cursor: 'pointer',
                          }}
                        >−</button>
                        <span style={{
                          minWidth: 24, textAlign: 'center', fontSize: 14.5, fontWeight: 700, color: C.tinta,
                        }}>{item.n}</span>
                        <button
                          onClick={() => definirItem(item.par, item.n + 1)}
                          aria-label={TEXTOS.ariaAumentar}
                          style={{
                            width: 32, height: 32, borderRadius: 9, flex: 'none', border: 'none',
                            background: C.tinta, color: C.fundo, fontSize: 15, cursor: 'pointer',
                          }}
                        >+</button>
                        <button
                          onClick={() => definirItem(item.par, 0)}
                          aria-label={t('ariaRemoverItem', { item: item.rotulo })}
                          style={{
                            width: 32, height: 32, borderRadius: 9, flex: 'none',
                            border: `1px solid ${C.linhaInput}`, background: 'transparent',
                            color: C.texto4, fontSize: 14, cursor: 'pointer',
                          }}
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.55, color: C.texto3 }}>
              {modoAtacado ? TEXTOS.notaAtacado : TEXTOS.notaVarejo}
            </p>
          </div>

          {/* Rodapé grudado na base do que estiver rolando. No desktop a
              coluna de escolha já tem rolagem própria e ele nunca saía da
              tela; no celular o modal vira uma coluna só e QUEM rola é o
              painel inteiro — sem o sticky, "Adicionar ao pedido" ficava
              abaixo da dobra, que é a reclamação de origem. */}
          <div style={{
            borderTop: `1px solid ${C.linha}`, padding: '16px 24px 20px', background: C.superficie2,
            display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
            position: 'sticky', bottom: 0, zIndex: 1,
          }}>
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, color: C.texto4 }}>
                {totalRascunho > 0 ? t('pecasSelecionadas', { n: totalRascunho }) : TEXTOS.escolhaQuantidades}
              </p>
              <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 26, color: C.tinta }}>{fmtR(subtotal)}</p>
            </div>
            {/* Também `aria-disabled`, pelo mesmo motivo: é ESTE o botão que
                a cliente toca (preto, grande, com cara de ação principal), e
                era ele que confirmava um rascunho vazio sem explicar nada. */}
            <button
              className="cat-btn-tinta"
              onClick={confirmarTudo}
              aria-disabled={totalRascunho === 0 && faltaEscolha}
              style={{
                flex: '1 1 200px', height: 54, borderRadius: 14, border: 'none',
                background: C.tinta, color: C.fundo, fontSize: 16, fontWeight: 600, cursor: 'pointer',
                opacity: totalRascunho === 0 && faltaEscolha ? 0.55 : 1,
              }}
            >{TEXTOS.adicionar}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pix dinâmico (Mercado Pago) — QR Code + confirmação automática.
//
// Só entra quando a loja tem mercadopago_ativo. Se qualquer coisa falhar
// (função fora do ar, credencial recusada, loja sem token), `aoFalhar` avisa o
// drawer e ele volta para o Pix copia-e-cola — o caminho antigo continua sendo
// a rede de segurança, nunca é removido.
// ─────────────────────────────────────────────────────────────────────────────
export function PixDinamico({ estado, aoGerar, aoCopiar, primeiroPlano = false }) {
  const [copiado, setCopiado] = useState(false)

  if (estado?.pago) {
    return (
      <div style={{
        border: `1px solid ${C.whatsapp}`, borderRadius: 14,
        background: 'rgba(15,123,69,.06)', padding: '16px 15px', textAlign: 'center',
      }} role="status" aria-live="polite">
        <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: C.whatsapp }}>
          {TEXTOS.pixQrPago}
        </p>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: C.texto3 }}>
          {TEXTOS.pixQrPagoTexto}
        </p>
      </div>
    )
  }

  if (!estado?.qrCode) {
    return (
      <button
        onClick={aoGerar}
        disabled={estado?.carregando}
        style={{
          width: '100%', height: 54, borderRadius: 14,
          border: primeiroPlano ? 'none' : `1px solid ${C.tinta}`,
          background: primeiroPlano ? C.tinta : C.superficie,
          color: primeiroPlano ? C.fundo : C.tinta,
          fontSize: 16, fontWeight: 600,
          cursor: estado?.carregando ? 'progress' : 'pointer',
          opacity: estado?.carregando ? 0.7 : 1,
        }}
      >{estado?.carregando ? TEXTOS.pixQrGerando : TEXTOS.pixQrGerar}</button>
    )
  }

  return (
    <div style={{
      border: `1px solid ${C.linhaInput}`, borderRadius: 14,
      background: C.superficie, padding: '14px 15px',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: C.tinta }}>
        {TEXTOS.pixQrTitulo}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.45, color: C.texto3 }}>
        {TEXTOS.pixQrInstrucao}
      </p>

      {estado.qrBase64 && (
        <img
          src={`data:image/png;base64,${estado.qrBase64}`}
          alt={TEXTOS.pixQrAlt}
          style={{
            display: 'block', width: 200, height: 200, margin: '0 auto 12px',
            borderRadius: 10, background: '#fff', padding: 8,
            border: `1px solid ${C.linha}`,
          }}
        />
      )}

      {/* O copia-e-cola do próprio Mercado Pago: em banco que não lê QR na
          tela (ou quando a cliente está no celular olhando o próprio app), é
          por aqui que ela paga. */}
      {/* Sem maxHeight e sem overflow próprio, de propósito.
          Eram `maxHeight: 96, overflow: 'auto'` — uma caixa de rolagem de 96px
          dentro do painel, bem no ponto da tela onde a cliente arrasta o dedo
          para procurar este código. No toque isso é uma armadilha: o gesto era
          capturado por este parágrafo, e ao terminar os 96px ele passava para
          a página atrás em vez de rolar o painel.
          O código do Mercado Pago tem ~340 caracteres e ocupa umas 9 linhas
          aqui — agora aparece inteiro, que é o que a cliente precisa ver antes
          de copiar. Quem rola é o painel. */}
      <p style={{
        margin: '0 0 11px', padding: '11px 12px', borderRadius: 10,
        background: C.superficie3, border: `1px solid ${C.linha}`,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11.5, lineHeight: 1.5, color: C.tinta,
        wordBreak: 'break-all',
      }}>{estado.qrCode}</p>

      <button
        onClick={async () => {
          const ok = await aoCopiar?.(estado.qrCode)
          if (ok === false) return
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2200)
        }}
        style={{
          width: '100%', height: 48, borderRadius: 12, cursor: 'pointer',
          border: `1px solid ${C.tinta}`,
          background: copiado ? C.tinta : C.superficie,
          color: copiado ? C.fundo : C.tinta,
          fontSize: 15, fontWeight: 600,
        }}
      >{copiado ? TEXTOS.pixQrCopiado : TEXTOS.pixQrCopiar}</button>

      <p style={{
        margin: '10px 0 0', fontSize: 12.5, color: C.texto4, textAlign: 'center',
      }} role="status" aria-live="polite">{TEXTOS.pixQrAguardando}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Drawer "Meu pedido"
// ─────────────────────────────────────────────────────────────────────────────
export function DrawerPedido({
  linhas, produtosPorId, minimo, loja, aoFechar, aoMudarQtd, aoEnviar, aoPagar,
  aoCopiarPix, pixMp, aoGerarPixMp, aoCopiarTexto,
  cliente, aoMudarCliente, errosCliente = {},
}) {
  const painelRef = useRef(null)
  // Feedback local do botão de copiar. Fica aqui, e não no componente pai,
  // porque é estado de UI de um botão só — não interessa a mais ninguém.
  const [pixCopiado, setPixCopiado] = useState(false)
  useTravaScroll(true)
  useFocoPreso(painelRef, true, aoFechar)

  // Existe ALGUM caminho de pagamento no site? É a condição que já governava
  // os três ramos do checkout, agora com nome: ela decide se a caixa de
  // destaque aparece e se o WhatsApp desce para contorno.
  const temPagamento = !!loja.checkoutOnline

  const { pecas, valor } = totais(linhas)
  const resumo = linhas.length
    ? t('pedidoResumo', { pecas, variacoes: linhas.length })
    : TEXTOS.pedidoNenhumaPeca

  return (
    <>
      <div
        onClick={aoFechar}
        style={{
          position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(25,23,19,.42)',
          animation: 'cat-fadeIn .18s ease',
        }}
      />
      <aside
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label={TEXTOS.meuPedido}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(430px, 100vw)',
          background: C.fundo, zIndex: 61, display: 'flex', flexDirection: 'column',
          boxShadow: '-24px 0 60px rgba(25,23,19,.18)', animation: 'cat-slideUp .22s ease',
          // ── QUEM ROLA É O PAINEL INTEIRO ──────────────────────────────
          // Antes só a LISTA de itens rolava, e o bloco de checkout (dados,
          // total, QR do Pix, copia-e-cola) era um IRMÃO dela, sem rolagem
          // nenhuma. Medido em 375x812 com o QR aberto: a lista espremida em
          // 32px e o bloco de checkout com 892px transbordando 195px para
          // fora do aside — o botão "Copiar código Pix" caía em y=820 numa
          // tela de 812 e não havia como alcançá-lo.
          //
          // É a mesma decisão que o ModalProduto já tinha tomado ("no celular
          // o modal vira uma coluna só e QUEM rola é o painel inteiro"), com o
          // cabeçalho sticky no lugar do rodapé sticky de lá.
          overflowY: 'auto',
          // Impede o encadeamento: chegando ao fim do painel, o gesto PARA em
          // vez de passar para a página atrás. É a metade da correção que o
          // relato descreve como "quem rola é o fundo".
          overscrollBehavior: 'contain',
          // iOS antigo: rolagem com inércia dentro do elemento. Inofensivo
          // onde já é o padrão.
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{
          padding: 20, borderBottom: `1px solid ${C.linha}`,
          display: 'flex', alignItems: 'flex-start', gap: 12,
          // Com o painel inteiro rolando, o cabeçalho sairia da tela e levaria
          // o ✕ junto — fechar o carrinho viraria uma rolagem de volta ao topo.
          position: 'sticky', top: 0, zIndex: 2, background: C.fundo, flex: 'none',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 600, color: C.tinta }}>{TEXTOS.meuPedido}</p>
            <p style={{ margin: 0, fontSize: 13.5, color: C.texto4 }}>{resumo}</p>
          </div>
          <button
            onClick={aoFechar}
            aria-label={TEXTOS.ariaFechar}
            style={{
              flex: 'none', width: 42, height: 42, borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${C.linhaInput}`, background: C.superficie, color: C.texto2, fontSize: 18,
            }}
          >✕</button>
        </div>

        <div style={{
          // `1 0 auto`: cresce para ocupar a sobra (é o que mantém o estado
          // "carrinho vazio" centralizado pelo `margin: auto 0` abaixo) e NÃO
          // encolhe. A rolagem agora é do aside, não daqui — dois containers
          // de rolagem aninhados eram parte do problema no toque.
          flex: '1 0 auto', minHeight: 0, padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {linhas.length === 0 ? (
            <div style={{ margin: 'auto 0', textAlign: 'center', padding: '40px 10px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 17, color: C.texto2 }}>{TEXTOS.pedidoVazioTitulo}</p>
              <p style={{ margin: 0, fontSize: 14.5, color: C.texto4 }}>{TEXTOS.pedidoVazioTexto}</p>
            </div>
          ) : linhas.map(linha => {
            const produto = produtosPorId[linha.produtoId]
            const detalhes = []
            if (linha.cor && temCor(produto)) detalhes.push(linha.cor)
            if (linha.tamanho && linha.tamanho !== TAMANHO_UNICO) detalhes.push(`Tamanho ${linha.tamanho}`)

            return (
              <div key={linha.chave} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 66, height: 88, borderRadius: 10, flex: 'none',
                  background: C.fotoPlaceholder, overflow: 'hidden',
                }}>
                  {linha.foto && (
                    <img src={linha.foto} alt="" loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 3px', fontSize: 14.5, fontWeight: 600, color: C.tinta }}>{linha.nome}</p>
                  {detalhes.length > 0 && (
                    <p style={{ margin: '0 0 8px', fontSize: 13.5, color: C.texto4 }}>{detalhes.join(' · ')}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => aoMudarQtd(linha.chave, linha.qtd - 1)}
                      aria-label={TEXTOS.ariaDiminuir}
                      style={{
                        width: 36, height: 36, borderRadius: 10, flex: 'none',
                        border: `1px solid ${C.linhaInput}`, background: C.superficie,
                        color: C.tinta, fontSize: 16, cursor: 'pointer',
                      }}
                    >−</button>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.tinta, minWidth: 20, textAlign: 'center' }}>
                      {linha.qtd}
                    </span>
                    <button
                      onClick={() => aoMudarQtd(linha.chave, linha.qtd + 1)}
                      aria-label={TEXTOS.ariaAumentar}
                      style={{
                        width: 36, height: 36, borderRadius: 10, flex: 'none', border: 'none',
                        background: C.tinta, color: C.fundo, fontSize: 16, cursor: 'pointer',
                      }}
                    >+</button>
                    <span style={{ marginLeft: 'auto', fontSize: 14.5, fontWeight: 600, color: C.tinta }}>
                      {fmtR(linha.subtotal)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{
          borderTop: `1px solid ${C.linha}`, padding: '18px 20px 22px', background: C.superficie2,
          // `none`: com o QR aberto este bloco passa de 890px. Deixá-lo
          // encolhível fazia o conteúdo ser cortado; agora ele tem a altura
          // que precisa e quem rola é o aside.
          flex: 'none',
        }}>
          {/* Nome e WhatsApp são obrigatórios: sem eles o pedido chega no
              painel sem ninguém para contatar. Ficam escondidos com o carrinho
              vazio para não pedir dado antes de haver pedido. */}
          {linhas.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: C.tinta }}>
                {TEXTOS.seusDados}
              </p>
              <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.45, color: C.texto4 }}>
                {TEXTOS.seusDadosTexto}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <input
                    className="cat-input"
                    value={cliente?.nome ?? ''}
                    onChange={e => aoMudarCliente?.('nome', e.target.value)}
                    placeholder={TEXTOS.campoNomePlaceholder}
                    aria-label={TEXTOS.campoNome}
                    aria-invalid={errosCliente.nome ? 'true' : undefined}
                    autoComplete="name"
                    style={{
                      width: '100%', height: 50, borderRadius: 14, boxSizing: 'border-box',
                      border: `1px solid ${errosCliente.nome ? ERRO : C.linhaInput}`,
                      background: C.superficie, padding: '0 15px',
                      // 16px é obrigatório: menos que isso e o iOS dá zoom no foco.
                      fontSize: 16, fontFamily: UI, color: C.tinta,
                    }}
                  />
                  {errosCliente.nome && (
                    <p style={{ margin: '5px 0 0', fontSize: 12.5, color: ERRO }}>{errosCliente.nome}</p>
                  )}
                </div>
                <div>
                  <input
                    className="cat-input"
                    value={cliente?.whatsapp ?? ''}
                    onChange={e => aoMudarCliente?.('whatsapp', e.target.value)}
                    placeholder={TEXTOS.campoWhatsappPlaceholder}
                    aria-label={TEXTOS.campoWhatsapp}
                    aria-invalid={errosCliente.whatsapp ? 'true' : undefined}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    style={{
                      width: '100%', height: 50, borderRadius: 14, boxSizing: 'border-box',
                      border: `1px solid ${errosCliente.whatsapp ? ERRO : C.linhaInput}`,
                      background: C.superficie, padding: '0 15px',
                      fontSize: 16, fontFamily: UI, color: C.tinta,
                    }}
                  />
                  {errosCliente.whatsapp && (
                    <p style={{ margin: '5px 0 0', fontSize: 12.5, color: ERRO }}>{errosCliente.whatsapp}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {minimo && !minimo.atingido && (
            <div style={{
              background: C.alertaFundo, border: `1px solid ${C.alertaBorda}`, color: C.alertaTexto,
              fontSize: 14, borderRadius: 12, padding: '11px 13px', marginBottom: 14, lineHeight: 1.45,
            }}>{minimo.aviso}</div>
          )}

          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14,
          }}>
            <span style={{ fontSize: 15, color: C.texto3 }}>{TEXTOS.total}</span>
            <span style={{ fontFamily: DISPLAY, fontSize: 32, color: C.tinta }}>{fmtR(valor)}</span>
          </div>

          {/* ── Pagamento primeiro, com destaque ────────────────────────
              A ordem anterior era WhatsApp (verde, preenchido) e só depois o
              Pix. Quem chega no checkout já decidiu comprar; pagar na hora é o
              caminho que fecha a venda sozinho, e o WhatsApp é o plano B (e o
              caminho de quem quer combinar frete antes).

              A CASCATA DE FALLBACK NÃO MUDOU — é a mesma condição de antes,
              apenas movida para cima e embrulhada:
                1. Mercado Pago ligado e sem falha  → QR dinâmico
                2. Chave Pix cadastrada             → copia-e-cola estático
                3. Só checkout ligado               → botão antigo
              O passo 2 continua sendo o fallback do 1: se a Edge Function
              falhar, `pixMp.erro` liga e o bloco estático assume. */}
          {temPagamento && (
            <div style={{
              border: `2px solid ${C.tinta}`, borderRadius: 18,
              background: C.superficie3, padding: 12, marginBottom: 14,
            }}>
              {loja.checkoutOnline && loja.mercadopagoAtivo && !pixMp?.erro ? (
                <PixDinamico
                  estado={pixMp}
                  aoGerar={aoGerarPixMp}
                  aoCopiar={aoCopiarTexto}
                  // Sempre em primeiro plano agora: antes o botão só era
                  // preenchido quando não havia chave estática atrás dele.
                  // Como o Pix passou a ser a ação principal do checkout, um
                  // botão de contorno dentro da caixa de destaque brigaria
                  // com a própria caixa.
                  primeiroPlano
                />
              ) : loja.checkoutOnline && loja.chavePix ? (
                <div style={{
                  border: `1px solid ${C.linhaInput}`, borderRadius: 14,
                  background: C.superficie, padding: '14px 15px',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: C.tinta }}>
                    {TEXTOS.pixTitulo}
                  </p>
                  <p style={{ margin: '0 0 11px', fontSize: 13.5, lineHeight: 1.45, color: C.texto3 }}>
                    {TEXTOS.pixInstrucao}
                  </p>
                  <p style={{
                    margin: '0 0 11px', padding: '11px 12px', borderRadius: 10,
                    background: C.superficie3, border: `1px solid ${C.linha}`,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 13.5, color: C.tinta,
                    // Chave aleatória do Pix tem 36 caracteres e não tem espaço:
                    // sem isto ela estoura a largura do drawer no celular.
                    wordBreak: 'break-all',
                  }}>{loja.chavePix}</p>
                  <button
                    onClick={async () => {
                      const ok = await aoCopiarPix?.(loja.chavePix)
                      if (ok === false) return
                      setPixCopiado(true)
                      setTimeout(() => setPixCopiado(false), 2200)
                    }}
                    style={{
                      width: '100%', height: 52, borderRadius: 12, cursor: 'pointer',
                      border: 'none',
                      background: pixCopiado ? C.whatsapp : C.tinta,
                      color: C.fundo, fontSize: 16, fontWeight: 600,
                    }}
                  >{pixCopiado ? TEXTOS.pixCopiado : TEXTOS.pixCopiar}</button>
                </div>
              ) : (
                <button
                  onClick={aoPagar}
                  style={{
                    width: '100%', height: 54, borderRadius: 14, border: 'none',
                    background: C.tinta, color: C.fundo, fontSize: 16, fontWeight: 600, cursor: 'pointer',
                  }}
                >{TEXTOS.pagarSite}</button>
              )}
            </div>
          )}

          {/* ── WhatsApp depois, com menos ênfase ────────────────────────────
              Contorno em vez de preenchido QUANDO existe bloco de pagamento
              acima. Sem checkout ligado ele volta a ser o botão verde cheio de
              sempre: aí ele é a única forma de fechar o pedido, e rebaixá-lo
              deixaria o drawer sem ação principal nenhuma. */}
          {loja.whatsapp && (
            <button
              className={temPagamento ? 'cat-btn-wa-out' : 'cat-btn-wa'}
              onClick={aoEnviar}
              style={temPagamento ? {
                width: '100%', height: 50, borderRadius: 14,
                border: `1.5px solid ${C.whatsapp}`, background: 'transparent',
                color: C.whatsapp, fontSize: 15, fontWeight: 600, cursor: 'pointer',
              } : {
                width: '100%', height: 54, borderRadius: 14, border: 'none', background: C.whatsapp,
                color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
              }}
            >{TEXTOS.enviarWhatsapp}</button>
          )}
        </div>
      </aside>
    </>
  )
}

export function Toast({ texto }) {
  if (!texto) return null
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', zIndex: 80,
      background: C.tinta, color: C.fundo, padding: '14px 22px', borderRadius: 99,
      fontSize: 15, fontWeight: 500, boxShadow: '0 12px 34px rgba(25,23,19,.28)',
      animation: 'cat-slideUp .2s ease', maxWidth: 'calc(100vw - 40px)', textAlign: 'center',
    }}>{texto}</div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function CatalogoPublicoV2({ lojaId }) {
  const [config, setConfig] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState(TEXTOS.chipTudo)
  const [ordem, setOrdem] = useState('destaque')
  // Inicializador preguiçoso em vez de efeito: lojaId é fixo durante a vida do
  // app (App.jsx resolve a loja uma vez, antes de montar), então ler o carrinho
  // salvo na primeira render é correto e evita render em cascata.
  const [carrinho, setCarrinho] = useState(() => carregarCarrinho(window.localStorage, lojaId))
  const [drawerAberto, setDrawerAberto] = useState(false)
  // Identificação da cliente. Obrigatória nos TRÊS caminhos que criam pedido
  // (WhatsApp, Pix copia-e-cola e Pix do Mercado Pago) — antes disso o V2
  // gravava cliente_nome e cliente_whatsapp vazios em todos eles.
  const [cliente, setCliente] = useState({ nome: '', whatsapp: '' })
  const [errosCliente, setErrosCliente] = useState({})
  const [produtoAberto, setProdutoAberto] = useState(null)
  const [toast, setToast] = useState('')

  // Trava do registro do pedido no fluxo Pix: copiar a chave duas vezes não
  // pode virar dois pedidos em lf_pedidos.
  const pixRegistrado = useRef(false)
  // Pix dinâmico do Mercado Pago. `erro` ligado faz o drawer voltar para o
  // copia-e-cola estático — o caminho antigo é a rede de segurança.
  const [pixMp, setPixMp] = useState({
    carregando: false, qrCode: '', qrBase64: '', pago: false, erro: false, pedidoId: null,
  })
  const timerToast = useRef(null)
  const mostrarToast = useCallback(texto => {
    setToast(texto)
    clearTimeout(timerToast.current)
    timerToast.current = setTimeout(() => setToast(''), 2400)
  }, [])
  useEffect(() => () => clearTimeout(timerToast.current), [])

  // ── Carga ──
  useEffect(() => {
    let vivo = true
    async function carregar() {
      const [{ data: cfg }, { data: linhas }] = await Promise.all([
        supabase.from('lf_config').select('*').eq('loja_id', lojaId).maybeSingle(),
        supabase.from('lf_produtos').select('*')
          .eq('loja_id', lojaId).eq('ativo', true).eq('disponivel_catalogo_b2b', true)
          .order('created_at'),
      ])
      if (!vivo) return
      setConfig(cfg)
      // Fora do ar: nem entra na lista. A tela de aviso não usa produto
      // nenhum, e deixar a lista preenchida seria confiar só no render para
      // não vazar peça e preço.
      if (cfg?.catalogo_publicado === false) {
        setProdutos([])
        setCarregando(false)
        return
      }
      // produtoVisivelNoCatalogo hoje só exige foto: produto sem variação
      // entra normalmente e abre o modal com uma célula única "Quantidade".
      // O filtro segue aqui (e não no .eq() acima) porque fotos é JSONB e o
      // PostgREST não filtra tamanho de array sem coluna/índice novo.
      setProdutos((linhas || []).filter(produtoVisivelNoCatalogo).map(normalizarProduto))
      setCarregando(false)
    }
    carregar()
    return () => { vivo = false }
  }, [lojaId])

  // ── Carrinho persistido (seção 8.3) ──
  // Sincronizar storage é exatamente o que um efeito deve fazer: escreve para
  // fora, não chama setState.
  useEffect(() => {
    if (!lojaId) return
    salvarCarrinho(window.localStorage, lojaId, carrinho)
  }, [lojaId, carrinho])

  // Confirmação automática: enquanto o QR está na tela, consulta o pedido a
  // cada 5s até o webhook (mp-webhook) marcar 'pago'. É só leitura, e para
  // sozinho quando confirma, quando o drawer fecha ou ao desmontar.
  useEffect(() => {
    if (!pixMp.pedidoId || !pixMp.qrCode || pixMp.pago || !drawerAberto) return
    let vivo = true
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from('lf_pedidos').select('status').eq('id', pixMp.pedidoId).maybeSingle()
      if (!vivo) return
      if (data?.status === 'pago') {
        setPixMp(p => ({ ...p, pago: true }))
        setCarrinho({})
      }
    }, 5000)
    return () => { vivo = false; clearInterval(timer) }
  }, [pixMp.pedidoId, pixMp.qrCode, pixMp.pago, drawerAberto])

  // ── Derivados ──
  const loja = useMemo(() => lojaDaConfig(config), [config])
  const modoAtacado = loja.modoVenda === 'atacado'

  const produtosPorId = useMemo(
    () => Object.fromEntries(produtos.map(p => [p.id, p])),
    [produtos],
  )

  const visiveis = useMemo(
    () => ordenarProdutos(filtrarProdutos(produtos, busca, categoria), ordem),
    [produtos, busca, categoria, ordem],
  )

  const categorias = useMemo(() => categoriasDe(produtos), [produtos])
  const linhas = useMemo(() => linhasDoCarrinho(carrinho, produtosPorId), [carrinho, produtosPorId])
  const soma = useMemo(() => totais(linhas), [linhas])
  const porProduto = useMemo(() => qtdPorProduto(carrinho), [carrinho])

  // Faixa preta só em atacado com mínimo > 0 (seção 4.5).
  const minimo = useMemo(
    () => (modoAtacado ? estadoMinimo(loja.pedidoMinimo, soma) : null),
    [modoAtacado, loja.pedidoMinimo, soma],
  )

  const temApresentacao = !!(loja.apresentacao.etiqueta || loja.apresentacao.titulo || loja.apresentacao.descricao)

  // ── Ações ──

  /**
   * Porta única para os três caminhos que registram pedido.
   *
   * Fica antes de qualquer efeito colateral: nada de abrir o WhatsApp, copiar
   * chave ou criar cobrança no Mercado Pago com pedido que não dá para
   * contatar depois.
   */
  function clienteOk() {
    const { ok, erros } = validarDadosCliente(cliente)
    setErrosCliente(erros)
    if (!ok) {
      setDrawerAberto(true)   // traz os campos para a tela junto com o aviso
      mostrarToast(TEXTOS.erroDadosIncompletos)
    }
    return ok
  }

  function mudarCliente(campo, valor) {
    setCliente(c => ({ ...c, [campo]: valor }))
    // Limpa o erro do campo assim que ela começa a corrigir — deixar o texto
    // vermelho enquanto digita é ruído.
    setErrosCliente(e => (e[campo] ? { ...e, [campo]: undefined } : e))
  }

  function confirmarDoModal(rascunho) {
    const { carrinho: novo, adicionadas } = aplicarRascunho(carrinho, produtoAberto.id, rascunho)
    if (adicionadas === 0) { mostrarToast(TEXTOS.toastEscolhaUma); return }
    setCarrinho(novo)
    setProdutoAberto(null)
    setDrawerAberto(true)
    mostrarToast(t('toastAdicionado', { n: adicionadas }))
  }

  /**
   * Registra o pedido antes de abrir o WhatsApp (seção 8.1) para o lojista
   * ver a intenção no painel mesmo se o cliente não mandar a mensagem.
   *
   * Falha aqui NÃO bloqueia: o pedido do cliente vale mais do que o registro.
   * Perder o insert custa um pedido não rastreado; travar o botão custa a venda.
   */
  async function registrarPedido(status) {
    try {
      const { data, error } = await supabase.from('lf_pedidos').insert({
        loja_id: lojaId,
        ...dadosClienteParaPedido(cliente),
        produtos: linhas.map(l => ({
          nome: l.nome,
          variacao: [l.cor, l.tamanho !== TAMANHO_UNICO ? l.tamanho : ''].filter(Boolean).join(' / '),
          qtd: l.qtd,
          preco: l.preco,
        })),
        valor_total: soma.valor,
        status,
      })
        // O id volta porque o Pix dinâmico precisa dele para criar a cobrança.
        // Os outros chamadores ignoram o retorno, como antes.
        .select('id')
        .maybeSingle()
      if (error) throw error
      return data?.id ?? null
    } catch (e) {
      console.error('[catalogo] não foi possível registrar o pedido:', e)
      return null
    }
  }

  async function enviarNoWhatsApp() {
    if (!loja.whatsapp) { mostrarToast(TEXTOS.toastSemWhatsapp); return }
    if (!clienteOk()) return
    if (minimo && !minimo.atingido) { mostrarToast(TEXTOS.toastAbaixoMinimo); return }
    if (!linhas.length) return

    const mensagem = mensagemWhatsApp({
      nomeLoja: loja.nome,
      linhas,
      produtosPorId,
      url: window.location.href,
    })

    await registrarPedido('aguardando_contato')
    window.open(linkWhatsApp(loja.whatsapp, mensagem), '_blank', 'noopener,noreferrer')
  }

  /**
   * Copia a chave Pix e registra o pedido como aguardando pagamento.
   *
   * O registro é o mesmo que o antigo "Pagar agora pelo site" fazia — sem ele
   * a lojista perderia a intenção de compra no painel. Roda UMA vez por
   * pedido: copiar de novo (porque errou o Ctrl+V) não pode gerar um segundo
   * registro.
   *
   * Devolve false quando não deu para seguir, e aí o botão não pisca
   * "Chave copiada!" — confirmar uma cópia que não aconteceu é pior do que
   * não dar retorno nenhum.
   */
  async function copiarChavePix(chave) {
    if (minimo && !minimo.atingido) { mostrarToast(TEXTOS.toastAbaixoMinimo); return false }
    if (!linhas.length) return false
    if (!clienteOk()) return false

    try {
      await navigator.clipboard.writeText(chave)
    } catch {
      // Safari em contexto sem permissão de clipboard: a chave continua
      // visível na tela para copiar na mão, então não é um beco sem saída.
      return false
    }

    if (!pixRegistrado.current) {
      pixRegistrado.current = true
      await registrarPedido('aguardando_pagamento')
    }
    mostrarToast(TEXTOS.toastPixCopiado)
    return true
  }

  /**
   * Copia qualquer texto para a área de transferência.
   *
   * Usado pelo copia-e-cola do Mercado Pago, que já tem o pedido registrado
   * quando o QR foi gerado — por isso não repete o registrarPedido daqui.
   */
  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      return false
    }
    mostrarToast(TEXTOS.toastPixCopiado)
    return true
  }

  /**
   * Registra o pedido e pede um Pix dinâmico à Edge Function mp-criar-pix.
   *
   * Qualquer falha liga `erro`, e o drawer cai no Pix copia-e-cola estático.
   * Isso cobre de uma vez: loja com a flag ligada mas sem token gravado
   * (409 semCredencial), token recusado pelo Mercado Pago (409
   * credencialRuim), função fora do ar e rede caindo. Em nenhum desses casos
   * a cliente pode ficar sem um jeito de pagar.
   */
  async function gerarPixMercadoPago() {
    if (minimo && !minimo.atingido) { mostrarToast(TEXTOS.toastAbaixoMinimo); return }
    if (!linhas.length) return
    if (!clienteOk()) return

    setPixMp(p => ({ ...p, carregando: true }))

    try {
      // Precisa do pedido no banco antes: é o pedido_id que amarra a cobrança.
      let pedidoId = pixMp.pedidoId
      if (!pedidoId) {
        pedidoId = await registrarPedido('aguardando_pagamento')
        if (!pedidoId) throw new Error('pedido não registrado')
        pixRegistrado.current = true
      }

      const { data, error } = await supabase.functions.invoke('mp-criar-pix', {
        body: { pedido_id: pedidoId },
      })

      // Em resposta não-2xx o supabase-js devolve só "Edge Function returned a
      // non-2xx status code" e guarda o corpo em error.context — que é onde
      // mora o diagnóstico útil (status do Mercado Pago, prefixo do token).
      // Sem desembrulhar isso, quem investiga não tem nada para seguir.
      if (error || !data?.qr_code) {
        let detalhe = data?.error || error?.message || 'sem QR'
        try {
          const corpo = await error?.context?.json?.()
          if (corpo?.error) detalhe = corpo.error
          if (corpo?.diagnostico) {
            console.warn('[catalogo] diagnóstico do mp-criar-pix:', corpo.diagnostico)
          }
        } catch { /* corpo não era JSON — segue com a mensagem que já tem */ }
        throw new Error(detalhe)
      }

      setPixMp({
        carregando: false, erro: false, pago: false, pedidoId,
        qrCode: data.qr_code, qrBase64: data.qr_code_base64 || '',
      })
    } catch (e) {
      console.warn('[catalogo] Pix dinâmico indisponível, usando copia-e-cola:', e.message)
      setPixMp(p => ({ ...p, carregando: false, erro: true }))
      mostrarToast(TEXTOS.pixQrErro)
    }
  }

  async function pagarNoSite() {
    if (minimo && !minimo.atingido) { mostrarToast(TEXTOS.toastAbaixoMinimo); return }
    if (!linhas.length) return
    if (!clienteOk()) return
    await registrarPedido('aguardando_pagamento')
    // O provedor de pagamento ainda não está plugado — ver seção 8.2 da spec.
    mostrarToast('Pagamento online em breve')
  }

  function chamarNoWhatsApp() {
    if (!loja.whatsapp) { mostrarToast(TEXTOS.toastSemWhatsapp); return }
    window.open(linkWhatsApp(loja.whatsapp, ''), '_blank', 'noopener,noreferrer')
  }

  // ── Render ──
  if (carregando) {
    return (
      <div style={{
        minHeight: '100dvh', background: C.fundo,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <EstiloGlobal />
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          border: `2.5px solid ${C.tinta}`, borderTopColor: 'transparent',
          animation: 'cat-spin 1s linear infinite',
        }} />
        <style>{'@keyframes cat-spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  // Loja fora do ar: troca a página inteira. Fica ANTES de qualquer coisa que
  // desenhe produto — cabeçalho, grade, drawer e rodapé nem chegam a montar.
  if (!loja.publicado) {
    return (
      <div className="cat-raiz" style={{ fontFamily: UI, color: C.tinta, WebkitFontSmoothing: 'antialiased' }}>
        <EstiloGlobal />
        <CatalogoForaDoAr loja={loja} aoChamar={chamarNoWhatsApp} />
      </div>
    )
  }

  return (
    <div className="cat-raiz" style={{
      minHeight: '100dvh', background: C.fundo, fontFamily: UI, color: C.tinta,
      WebkitFontSmoothing: 'antialiased',
    }}>
      <EstiloGlobal />

      <FaixaVideo video={loja.videoTopo} />

      <Cabecalho
        loja={loja}
        busca={busca}
        setBusca={setBusca}
        totalPecas={soma.pecas}
        aoAbrirPedido={() => setDrawerAberto(true)}
      />

      <main style={{ maxWidth: LARGURA, margin: '0 auto', padding: '0 20px' }}>
        {temApresentacao
          ? <BlocoApresentacao apresentacao={loja.apresentacao} />
          : <TresPassos />}

        <FaixaMinimo minimo={minimo} />

        <Filtros
          categorias={categorias}
          categoria={categoria}
          setCategoria={setCategoria}
          ordem={ordem}
          setOrdem={setOrdem}
        />

        {produtos.length === 0 ? (
          <EstadoSemCatalogo loja={loja} aoChamar={chamarNoWhatsApp} />
        ) : visiveis.length === 0 ? <EstadoVazio /> : (
          <div style={{
            display: 'grid',
            // ── Seção 4.7, recalibrada em 20/08/2026, CORRIGIDA em 20/08/2026 ──
            //
            // Trilha única `min(46%, 258px)`, sem minmax. Parece detalhe, mas é
            // o ponto exato onde a versão anterior quebrava.
            //
            // A regra anterior era
            //   repeat(auto-fill, minmax(min(46%, 258px), 258px))
            // e rendia UMA coluna em todo celular — confirmado em device físico
            // (Safari e webview do WhatsApp) e reproduzido no Chrome headless:
            // getComputedStyle devolvia `grid-template-columns: 258px`, trilha
            // única, em 375, 390 e 430px.
            //
            // O motivo está no CSS Grid §7.2.3.1: para decidir QUANTAS vezes
            // repetir, o auto-fill usa a função de tamanho MÁXIMA da trilha
            // quando ela é definida — e não a mínima. Com máximo `258px` fixo,
            // o navegador pergunta "quantas colunas de 258px cabem?". Em 390px
            // de viewport sobram 350px de conteúdo: cabe uma só. O mínimo
            // `min(46%, 258px)` nunca chegava a ser consultado para a contagem;
            // ele só entraria se o máximo fosse flexível (1fr), que era
            // justamente o que a spec original usava.
            //
            // Ou seja: a troca `1fr → 258px`, feita para travar o card no
            // desktop, tirou a flexibilidade que fazia a conta do celular
            // funcionar. O teste da época não pegou porque modelava o auto-fill
            // contando pelo mínimo — o modelo errado.
            //
            // Com trilha única o dilema some, porque `min()` já é as duas
            // coisas ao mesmo tempo:
            //   • celular: 46% manda (em 320px → 128,8px), e duas colunas de
            //     46% + gap sempre cabem em 100%. Três nunca cabem (138% > 100%),
            //     então a faixa 320–430px dá exatamente 2 colunas.
            //   • desktop: 258px manda a partir de ~561px de conteúdo, e o card
            //     trava em 258px — idêntico ao comportamento aprovado antes,
            //     porque quando 46% ≥ 258px a regra velha também valia 258px.
            //
            // justifyContent centraliza a sobra nos dois lados; sem isso a
            // grade encostaria à esquerda e o canto direito não alinharia com
            // o rodapé. Continua sem media query e sem JS, como manda a seção 10.
            gridTemplateColumns: 'repeat(auto-fill, min(46%, 258px))',
            gap: 'clamp(12px, 1.4vw, 22px)',
            justifyContent: 'center',
            paddingBottom: 64,
          }}>
            {visiveis.map((p, i) => (
              <CardProduto
                key={p.id}
                produto={p}
                modoAtacado={modoAtacado}
                noPedido={porProduto[p.id] || 0}
                prioridade={i < 4}
                aoAbrir={() => setProdutoAberto(p)}
              />
            ))}
          </div>
        )}
      </main>

      <Rodape loja={loja} aoChamar={chamarNoWhatsApp} />

      {produtoAberto && (
        <ModalProduto
          key={produtoAberto.id}
          produto={produtoAberto}
          modoAtacado={modoAtacado}
          aoFechar={() => setProdutoAberto(null)}
          aoConfirmar={confirmarDoModal}
        />
      )}

      {drawerAberto && (
        <DrawerPedido
          linhas={linhas}
          produtosPorId={produtosPorId}
          minimo={minimo}
          loja={loja}
          aoFechar={() => setDrawerAberto(false)}
          aoMudarQtd={(chave, qtd) => setCarrinho(c => definirQtd(c, chave, qtd))}
          aoEnviar={enviarNoWhatsApp}
          aoPagar={pagarNoSite}
          aoCopiarPix={copiarChavePix}
          pixMp={pixMp}
          aoGerarPixMp={gerarPixMercadoPago}
          aoCopiarTexto={copiarTexto}
          cliente={cliente}
          aoMudarCliente={mudarCliente}
          errosCliente={errosCliente}
        />
      )}

      <Toast texto={toast} />
    </div>
  )
}
