// Catálogo público novo — implementação de docs/CATALOGO_SPEC.md.
//
// Substitui CatalogoPublico.jsx, mas NÃO está plugado em nenhuma rota ainda:
// a troca em produção afeta o catálogo de todas as lojas Business ao mesmo
// tempo e é decisão do Thiago (ver relatório da Parte 3).
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
import { supabase } from '../../lib/supabase'
import { produtoVisivelNoCatalogo } from '../../utils/catalogo'
import { fmtR } from '../../utils/formatters'
import { t, TEXTOS } from '../../i18n/catalogo'
import {
  normalizarProduto, temCor, legendaCard, perguntaModal, rotuloCelula,
  linhasDoCarrinho, totais, qtdPorProduto, aplicarRascunho, definirQtd, lojaDaConfig,
  estadoMinimo, categoriasDe, filtrarProdutos, ordenarProdutos,
  mensagemWhatsApp, linkWhatsApp,
  carregarCarrinho, salvarCarrinho, TAMANHO_UNICO,
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

/** Trava o scroll do body enquanto modal ou drawer estiver aberto. */
function useTravaScroll(ativo) {
  useEffect(() => {
    if (!ativo) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = anterior }
  }, [ativo])
}

/**
 * Esc fecha, foco vai para o primeiro elemento ao abrir e fica preso dentro.
 * Sem isso o Tab do teclado escapa para a página atrás do modal.
 */
function useFocoPreso(ref, ativo, aoFechar) {
  useEffect(() => {
    if (!ativo || !ref.current) return
    const painel = ref.current
    const focaveis = () => [...painel.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )].filter(el => el.offsetParent !== null)

    focaveis()[0]?.focus()

    function aoTeclar(e) {
      if (e.key === 'Escape') { e.preventDefault(); aoFechar?.(); return }
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
  }, [ativo, ref, aoFechar])
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.1 Faixa de vídeo (opcional, acima do cabeçalho, não sticky)
// ─────────────────────────────────────────────────────────────────────────────
export function FaixaVideo({ video, nomeLoja }) {
  const menosMovimento = usaMenosMovimento()
  if (!video?.ativo) return null

  const titulo = video.titulo || nomeLoja
  const etiqueta = video.etiqueta || TEXTOS.etiquetaVideoPadrao
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
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
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

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '22px 20px', maxWidth: LARGURA, margin: '0 auto',
      }}>
        <p style={{
          margin: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: '.16em',
          textTransform: 'uppercase', color: 'rgba(251,249,245,.8)',
        }}>{etiqueta}</p>
        <h1 style={{
          margin: '4px 0 0', fontFamily: DISPLAY, fontWeight: 400,
          fontSize: 'clamp(28px, 4.4vw, 46px)', lineHeight: 1.05, color: C.fundo,
        }}>{titulo}</h1>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.2 Cabeçalho sticky. No celular os 3 itens quebram em 2 linhas sozinhos
// pelo flex-wrap — sem media query, como manda a seção 10.
// ─────────────────────────────────────────────────────────────────────────────
export function Cabecalho({ loja, busca, setBusca, totalPecas, aoAbrirPedido }) {
  const inicial = (loja.nome || '?').trim().charAt(0).toUpperCase()

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
          {loja.logoUrl ? (
            <img src={loja.logoUrl} alt={loja.nome}
              style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', flex: 'none' }} />
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: C.tinta, flex: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, fontWeight: 700, color: C.fundo,
            }}>{inicial}</div>
          )}
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
  // Produto sem escolha de cor ainda precisa de UMA caixa para os steppers.
  const cores = produto.cores.length ? produto.cores : [null]
  const tamanhos = produto.tamanhos.length ? produto.tamanhos : [TAMANHO_UNICO]

  const parDe = (cor, tam) => `${comCor && cor ? cor.nome : ''}|${tam}`
  const qtdDe = (cor, tam) => rascunho[parDe(cor, tam)] || 0

  function mudarQtd(cor, tam, delta) {
    const par = parDe(cor, tam)
    setRascunho(prev => {
      const nova = Math.max(0, (prev[par] || 0) + delta)
      const copia = { ...prev }
      if (nova > 0) copia[par] = nova
      else delete copia[par]
      return copia
    })
  }

  const totalRascunho = Object.values(rascunho).reduce((s, n) => s + n, 0)
  const subtotal = totalRascunho * produto.preco

  function totalDaCor(cor) {
    return tamanhos.reduce((s, tam) => s + qtdDe(cor, tam), 0)
  }

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
        <div style={{ position: 'relative', overflow: 'hidden', minHeight: 340, minWidth: 0 }}>
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

          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: C.tinta }}>
              {perguntaModal(produto)}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cores.map((cor, idx) => {
                const nDaCor = totalDaCor(cor)
                return (
                  <div key={cor?.nome || `sem-cor-${idx}`} style={{
                    border: `1px solid ${C.linhaCard}`, borderRadius: 16,
                    background: C.superficie, padding: 14,
                  }}>
                    {cor && comCor && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 99, background: cor.hex, flex: 'none',
                          border: '1px solid rgba(0,0,0,.14)', boxShadow: `inset 0 0 0 2px ${C.superficie}`,
                        }} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: C.tinta, flex: 1, minWidth: 0 }}>
                          {cor.nome}
                        </span>
                        <span style={{ fontSize: 13.5, color: C.texto4 }}>
                          {nDaCor > 0 ? t('resumoPecas', { n: nDaCor }) : ''}
                        </span>
                      </div>
                    )}

                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 10,
                    }}>
                      {tamanhos.map(tam => {
                        const qtd = qtdDe(cor, tam)
                        return (
                          <div key={tam} style={{
                            borderRadius: 12, padding: '9px 10px',
                            background: qtd > 0 ? C.superficie3 : 'transparent',
                            border: `1px solid ${qtd > 0 ? C.tinta : C.linhaInput}`,
                          }}>
                            <p style={{
                              margin: '0 0 7px', fontSize: 12.5, fontWeight: 600,
                              letterSpacing: '.06em', color: C.texto3,
                            }}>{rotuloCelula(produto, tam)}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                onClick={() => mudarQtd(cor, tam, -1)}
                                disabled={qtd === 0}
                                aria-label={TEXTOS.ariaDiminuir}
                                style={{
                                  width: 32, height: 32, borderRadius: 10, flex: 'none',
                                  border: `1px solid ${C.linhaInput}`, background: C.superficie,
                                  color: qtd === 0 ? C.texto5 : C.tinta, fontSize: 16,
                                  cursor: qtd === 0 ? 'not-allowed' : 'pointer',
                                  opacity: qtd === 0 ? 0.5 : 1,
                                }}
                              >−</button>
                              <span style={{
                                flex: 1, textAlign: 'center', fontSize: 15.5, fontWeight: 700, color: C.tinta,
                              }}>{qtd}</span>
                              <button
                                onClick={() => mudarQtd(cor, tam, 1)}
                                aria-label={TEXTOS.ariaAumentar}
                                style={{
                                  width: 32, height: 32, borderRadius: 10, flex: 'none', border: 'none',
                                  background: C.tinta, color: C.fundo, fontSize: 16, cursor: 'pointer',
                                }}
                              >+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.55, color: C.texto3 }}>
              {modoAtacado ? TEXTOS.notaAtacado : TEXTOS.notaVarejo}
            </p>
          </div>

          <div style={{
            borderTop: `1px solid ${C.linha}`, padding: '16px 24px 20px', background: C.superficie2,
            display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, color: C.texto4 }}>
                {totalRascunho > 0 ? t('pecasSelecionadas', { n: totalRascunho }) : TEXTOS.escolhaQuantidades}
              </p>
              <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 26, color: C.tinta }}>{fmtR(subtotal)}</p>
            </div>
            <button
              className="cat-btn-tinta"
              onClick={() => aoConfirmar(rascunho)}
              style={{
                flex: '1 1 200px', height: 54, borderRadius: 14, border: 'none',
                background: C.tinta, color: C.fundo, fontSize: 16, fontWeight: 600, cursor: 'pointer',
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
      <p style={{
        margin: '0 0 11px', padding: '11px 12px', borderRadius: 10,
        background: C.superficie3, border: `1px solid ${C.linha}`,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11.5, lineHeight: 1.5, color: C.tinta,
        wordBreak: 'break-all', maxHeight: 96, overflow: 'auto',
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
}) {
  const painelRef = useRef(null)
  // Feedback local do botão de copiar. Fica aqui, e não no componente pai,
  // porque é estado de UI de um botão só — não interessa a mais ninguém.
  const [pixCopiado, setPixCopiado] = useState(false)
  useTravaScroll(true)
  useFocoPreso(painelRef, true, aoFechar)

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
        }}
      >
        <div style={{
          padding: 20, borderBottom: `1px solid ${C.linha}`,
          display: 'flex', alignItems: 'flex-start', gap: 12,
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
          flex: 1, overflowY: 'auto', padding: '16px 20px',
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
        }}>
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

          {loja.whatsapp && (
            <button
              className="cat-btn-wa"
              onClick={aoEnviar}
              style={{
                width: '100%', height: 54, borderRadius: 14, border: 'none', background: C.whatsapp,
                color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: 10,
              }}
            >{TEXTOS.enviarWhatsapp}</button>
          )}

          {/* Pix copia-e-cola. Só aparece com o checkout ligado E chave
              cadastrada; sem chave o caminho antigo continua igual, e o botão
              do WhatsApp acima segue sendo como o pedido se fecha. Não tem QR
              Code nem gateway de propósito — a cliente copia e paga no banco
              dela. */}
          {/* Ordem de preferência no checkout:
                1. Mercado Pago ligado e sem falha  → QR dinâmico
                2. Chave Pix cadastrada             → copia-e-cola estático
                3. Só checkout ligado               → botão antigo
              O passo 2 é fallback do 1: se a Edge Function falhar, `pixMp.erro`
              liga e o bloco estático assume sem a cliente ficar sem caminho. */}
          {loja.checkoutOnline && loja.mercadopagoAtivo && !pixMp?.erro ? (
            <PixDinamico
              estado={pixMp}
              aoGerar={aoGerarPixMp}
              aoCopiar={aoCopiarTexto}
              primeiroPlano={!loja.chavePix}
            />
          ) : loja.checkoutOnline && loja.chavePix ? (
            <div style={{
              border: `1px solid ${C.linhaInput}`, borderRadius: 14,
              background: C.superficie, padding: '14px 15px',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: C.tinta }}>
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
                  width: '100%', height: 48, borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${C.tinta}`,
                  background: pixCopiado ? C.tinta : C.superficie,
                  color: pixCopiado ? C.fundo : C.tinta,
                  fontSize: 15, fontWeight: 600,
                }}
              >{pixCopiado ? TEXTOS.pixCopiado : TEXTOS.pixCopiar}</button>
            </div>
          ) : loja.checkoutOnline ? (
            <button
              onClick={aoPagar}
              style={{
                width: '100%', height: 54, borderRadius: 14, border: `1px solid ${C.tinta}`,
                background: C.superficie, color: C.tinta, fontSize: 16, fontWeight: 600, cursor: 'pointer',
              }}
            >{TEXTOS.pagarSite}</button>
          ) : null}
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
        cliente_nome: '',
        cliente_whatsapp: '',
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
      if (error || !data?.qr_code) throw new Error(data?.error || error?.message || 'sem QR')

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

  return (
    <div className="cat-raiz" style={{
      minHeight: '100dvh', background: C.fundo, fontFamily: UI, color: C.tinta,
      WebkitFontSmoothing: 'antialiased',
    }}>
      <EstiloGlobal />

      <FaixaVideo video={loja.videoTopo} nomeLoja={loja.nome} />

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
        />
      )}

      <Toast texto={toast} />
    </div>
  )
}
