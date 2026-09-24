import { useState, useEffect } from 'react'
import { Download, ArrowLeft, ChevronDown, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmtR } from '../../utils/formatters'
import {
  DIAS_INATIVO, rotuloPeriodo, textoProximoResumo, dataPorExtenso, proximaGeracao,
  montarLeituraSocio, fraseAbertura, variacaoPct, formatarDelta,
  formatarSocioTexto, montarHtmlSocio, fatiarSegmentos, tamanhoSegmentos,
} from '../../utils/socioDigital'

// Sócio Digital — resumo quinzenal da loja.
//
// Os números vêm PRONTOS de lf_socio_relatorios (gerados e congelados pelo
// banco nos dias 1 e 16 — ver supabase/fix_socio_digital.sql). Esta tela só
// lê o relatório mais recente e apresenta; nada aqui recalcula métrica.
// A leitura "Foi bem / De olho" e os textos de compartilhamento ficam em
// utils/socioDigital.js, testados.

// ── Keyframes ──────────────────────────────────────────────────────────────
const SD_CSS = `
  @keyframes sd-spin    { to { transform: rotate(360deg) } }
  @keyframes sd-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.05) } }
  @keyframes sd-ping    { 0% { transform: scale(1); opacity:.5 } 70%,100% { transform: scale(1.7); opacity:0 } }
  @keyframes sd-float   { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
  @keyframes sd-blink   { 0%,100% { opacity:1 } 50% { opacity:0 } }
  @keyframes sd-wave    { 0%,60%,100% { transform: scaleY(.35) } 30% { transform: scaleY(1) } }
  @keyframes sd-fadein  { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
  @keyframes sd-typing  { 0%,60%,100% { transform: translateY(0); opacity:.35 } 30% { transform: translateY(-4px); opacity:1 } }
`

const FONT = 'Plus Jakarta Sans, sans-serif'
const MONO = "'Space Mono', monospace"

// ── Count-up hook ──────────────────────────────────────────────────────────
function useCountUp(endValue, duration = 1200, startDelay = 0) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => {
      let startTime = null
      function step(ts) {
        if (!startTime) startTime = ts
        const progress = Math.min((ts - startTime) / duration, 1)
        setValue(Math.round(progress * endValue))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, startDelay)
    return () => clearTimeout(timer)
  }, [endValue, duration, startDelay])
  return value
}

// ── Compartilhamento ───────────────────────────────────────────────────────
// Mesmo mecanismo do Recibo (components/ReciboVenda.jsx): janela com HTML
// próprio + print(); o "PDF" é o "Salvar como PDF" da caixa de impressão.
function baixarPdf(relatorio, nomeLoja) {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) return
  w.document.write(montarHtmlSocio(relatorio, nomeLoja))
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 300)
}

// Sem número de destino: a lojista escolhe o contato no WhatsApp (mesmo
// fallback do Recibo quando a venda não tem telefone).
function enviarWhatsApp(relatorio, nomeLoja) {
  const texto = formatarSocioTexto(relatorio, nomeLoja)
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
}

function iniciais(nome) {
  return (nome || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// ── JunttosSVG ─────────────────────────────────────────────────────────────
function JunttosSVG({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="18 21 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="55" width="60" height="28" rx="14" fill="#5E2BD0" />
      <circle cx="40" cy="37" r="14" fill="#341780" />
      <circle cx="64" cy="39" r="14" fill="#FF6F5E" />
    </svg>
  )
}

// ── Orb ────────────────────────────────────────────────────────────────────
function Orb({ size = 104, logoSize = 52 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', position: 'relative', animation: 'sd-float 5s ease-in-out infinite', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: -8, right: -8, bottom: -8, left: -8, borderRadius: '50%', border: '2px solid rgba(255,255,255,.32)', animation: 'sd-ping 2.8s ease-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -8, right: -8, bottom: -8, left: -8, borderRadius: '50%', border: '2px solid rgba(255,111,94,.32)', animation: 'sd-ping 2.8s ease-out .7s infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: '50%', background: 'conic-gradient(from 0deg,#FF6F5E,#FFB27A,#5E2BD0,#341780,#FF6F5E)', animation: 'sd-spin 7s linear infinite', filter: 'blur(.5px)' }} />
      <div style={{ position: 'absolute', top: 7, right: 7, bottom: 7, left: 7, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sd-breathe 4s ease-in-out infinite' }}>
        <JunttosSVG size={logoSize} />
      </div>
    </div>
  )
}

// ── MsgAvatar ──────────────────────────────────────────────────────────────
function MsgAvatar({ size = 38 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: '#fff', border: '1px solid #ECECF1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <JunttosSVG size={Math.round(size * 0.58)} />
    </div>
  )
}

// ── WhatsApp SVG ───────────────────────────────────────────────────────────
function WhatsAppSVG({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// ── Bubble / MsgRow ────────────────────────────────────────────────────────
function Bubble({ children, style = {} }) {
  return (
    <div style={{ background: '#fff', borderRadius: '6px 18px 18px 18px', border: '1px solid #ECECF1', boxShadow: '0 8px 24px -18px rgba(52,23,128,.5)', ...style }}>
      {children}
    </div>
  )
}

function MsgRow({ children, avatarSize = 38, mb = 22, animDelay = 0 }) {
  return (
    <div style={{
      display: 'flex', gap: 14, marginBottom: mb, alignItems: 'flex-start',
      opacity: 0,
      animation: `sd-fadein 0.5s ease ${animDelay}s forwards`,
    }}>
      <MsgAvatar size={avatarSize} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

// ── Metric card ────────────────────────────────────────────────────────────
function MetricCard({ label, endValue, prefix = '', delta, compact, startDelay = 0 }) {
  const count = useCountUp(Math.round(Number(endValue) || 0), 1200, startDelay)
  const formatted = count >= 1000 ? count.toLocaleString('pt-BR') : String(count)
  const corDelta = delta?.startsWith('▲') ? '#1E8A54' : delta?.startsWith('▼') ? '#E0563F' : '#8A8A93'
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: compact ? 13 : 16 }}>
      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.4px', color: '#8A8A93', textTransform: 'uppercase', marginBottom: 6, marginTop: 0, fontFamily: FONT }}>{label}</p>
      <p style={{ fontFamily: MONO, fontSize: compact ? 18 : 22, fontWeight: 700, color: '#18181B', letterSpacing: '-.5px', margin: 0 }}>{prefix}{formatted}</p>
      <p style={{ fontSize: 12, fontWeight: 800, color: corDelta, marginTop: 4, marginBottom: 0, fontFamily: FONT }}>{delta}</p>
    </div>
  )
}

// ── Listas de produto / cliente ────────────────────────────────────────────
function LinhaChip({ nome, chip, corChip, bgChip }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: FONT, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: corChip, background: bgChip, borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{chip}</span>
    </div>
  )
}

function Vazio({ texto }) {
  return <p style={{ fontSize: 12.5, color: '#8A8A93', fontFamily: FONT, margin: 0 }}>{texto}</p>
}

const btnLink = { marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: '#5E2BD0', fontFamily: FONT, padding: 0, display: 'block' }

function CardRecomprar({ itens, onVer, pad = 18 }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: pad }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: '#5E2BD0', fontFamily: FONT, marginTop: 0, marginBottom: 2 }}>🛒 Recomprar já</p>
      <p style={{ fontSize: 11.5, color: '#8A8A93', fontFamily: FONT, marginTop: 0, marginBottom: 12 }}>vendem muito, estoque no fim</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itens.length === 0
          ? <Vazio texto="Nenhum produto com estoque no fim." />
          : itens.slice(0, 3).map(p => (
              <LinhaChip key={p.nome} nome={p.nome} chip={`${p.estoque} ${Number(p.estoque) === 1 ? 'resta' : 'restam'}`} corChip="#C4443B" bgChip="#FDECEA" />
            ))}
      </div>
      {itens.length > 0 && (
        <button type="button" onClick={onVer} style={btnLink}>
          Ver {itens.length} {itens.length === 1 ? 'produto' : 'produtos'} →
        </button>
      )}
    </div>
  )
}

function CardParados({ itens, onVer, pad = 18 }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: pad }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: '#FF6F5E', fontFamily: FONT, marginTop: 0, marginBottom: 2 }}>🏷️ Girar em promoção</p>
      <p style={{ fontSize: 11.5, color: '#8A8A93', fontFamily: FONT, marginTop: 0, marginBottom: 12 }}>parados faz tempo</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itens.length === 0
          ? <Vazio texto={`Nenhum produto parado há ${DIAS_INATIVO}+ dias.`} />
          : itens.slice(0, 3).map(p => (
              <LinhaChip key={p.nome} nome={p.nome} chip={`${p.dias} dias`} corChip="#8A6D00" bgChip="#FBF2D6" />
            ))}
      </div>
      {itens.length > 0 && (
        <button type="button" onClick={onVer} style={btnLink}>
          Ver {itens.length} {itens.length === 1 ? 'produto' : 'produtos'} →
        </button>
      )}
    </div>
  )
}

function LinhaCliente({ nome, valor, destaque }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: destaque ? '#F1ECFE' : '#F4F4F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: destaque ? '#5E2BD0' : '#8A8A93', fontFamily: FONT }}>{iniciais(nome)}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: FONT, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
      <span style={{ fontFamily: MONO, fontSize: destaque ? 12 : 11, fontWeight: 700, color: destaque ? '#18181B' : '#C4443B', flexShrink: 0 }}>{valor}</span>
    </div>
  )
}

function CardTopClientes({ itens, pad = 18 }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: pad }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: '#18181B', fontFamily: FONT, marginTop: 0, marginBottom: 12 }}>⭐ Compraram mais</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {itens.length === 0
          ? <Vazio texto="Nenhuma venda com cliente identificada." />
          : itens.slice(0, 3).map(c => <LinhaCliente key={c.nome} nome={c.nome} valor={fmtR(c.total)} destaque />)}
      </div>
    </div>
  )
}

function CardInativos({ inativos, onCampanha, pad = 18 }) {
  const lista = inativos?.lista || []
  const total = Number(inativos?.total) || 0
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: pad }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: '#18181B', fontFamily: FONT, marginTop: 0, marginBottom: 12 }}>⏰ Sumiram ({DIAS_INATIVO}+ dias)</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.length === 0
          ? <Vazio texto="Ninguém sumiu. Boa!" />
          : lista.slice(0, 3).map(c => <LinhaCliente key={c.nome} nome={c.nome} valor={`${c.dias} dias`} />)}
      </div>
      {lista.length > 0 && onCampanha && (
        <button type="button" onClick={() => onCampanha(lista.map(c => c.nome))} style={btnLink}>
          Campanha de retorno{total > 3 ? ` (${total})` : ''} →
        </button>
      )}
    </div>
  )
}

// ── Modal "Ver produtos" ───────────────────────────────────────────────────
// Lista inline, sem sair da tela — mesmo padrão de bottom-sheet do resto do
// app (EstoqueMobile, Crediário). Levar ao Estoque exigiria um filtro por
// lista de nomes que a tela de Estoque não tem.
function ModalProdutos({ modal, onFechar }) {
  useEffect(() => {
    function esc(e) { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar])

  const recomprar = modal.tipo === 'recomprar'
  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '22px 20px', paddingBottom: 'calc(28px + env(safe-area-inset-bottom))', width: '100%', maxWidth: 520, maxHeight: '80dvh', overflowY: 'auto', boxSizing: 'border-box', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: recomprar ? '#5E2BD0' : '#FF6F5E', margin: 0 }}>
              {recomprar ? '🛒 Recomprar já' : '🏷️ Girar em promoção'}
            </p>
            <p style={{ fontSize: 12.5, color: '#8A8A93', margin: '3px 0 0' }}>
              {recomprar
                ? 'Venderam 2+ peças no período e restam 3 ou menos'
                : `Com estoque e sem venda há ${DIAS_INATIVO}+ dias`}
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A93', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modal.itens.map(p => (
            <div key={p.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid #ECECF1' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: '#18181B' }}>{p.nome}</span>
              {recomprar ? (
                <span style={{ fontSize: 12, color: '#52525B', flexShrink: 0 }}>
                  vendeu <b>{p.vendidos}</b> · resta{Number(p.estoque) === 1 ? '' : 'm'} <b style={{ color: '#C4443B' }}>{p.estoque}</b>
                </span>
              ) : (
                <span style={{ fontSize: 12, color: '#52525B', flexShrink: 0 }}>
                  {p.estoque} em estoque · <b style={{ color: '#8A6D00' }}>{p.dias} dias</b>
                </span>
              )}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: '#A1A1AA', marginTop: 14, marginBottom: 0 }}>
          Estoque registrado no fechamento do período.
        </p>
      </div>
    </div>
  )
}

// ── Desktop agent sidebar ──────────────────────────────────────────────────
function AgentSidebar({ onVoltar, relatorio, nomeLoja }) {
  const periodo = relatorio ? { inicio: relatorio.periodo_inicio, fim: relatorio.periodo_fim } : null
  const btnBase = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, border: 'none', fontFamily: FONT, fontSize: 14, fontWeight: 800 }
  return (
    <div style={{ width: 300, flexShrink: 0, background: 'linear-gradient(180deg,#341780,#5E2BD0 62%,#8B46E8)', color: '#fff', padding: '20px 26px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

      {/* ── BLOCO 1: voltar + orb + nome + status ── */}
      <div>
        {onVoltar && (
          <button
            onClick={onVoltar}
            style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', color: 'rgba(255,255,255,.85)', fontFamily: FONT, fontSize: 12, fontWeight: 700, marginBottom: 0 }}
          >
            <ArrowLeft size={13} /> Voltar ao painel
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
          <Orb size={104} logoSize={52} />
        </div>

        <p style={{ textAlign: 'center', fontSize: 19, fontWeight: 800, marginTop: 20, marginBottom: 0, letterSpacing: '-.3px', fontFamily: FONT }}>
          Sócio Digital
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'center', justifyContent: 'center', marginTop: 10, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, padding: '4px 11px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: relatorio ? '#5CF2A0' : '#FFD27A', boxShadow: `0 0 8px ${relatorio ? '#5CF2A0' : '#FFD27A'}`, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT }}>{relatorio ? 'resumo pronto' : 'aguardando o primeiro resumo'}</span>
        </div>
      </div>

      {/* ── BLOCO 2: divisor + período ── */}
      <div>
        <div style={{ height: 1, background: 'rgba(255,255,255,.2)', marginBottom: 20 }} />
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', fontFamily: FONT, margin: 0 }}>PERÍODO</p>
        <p style={{ fontSize: 16, fontWeight: 800, marginTop: 7, marginBottom: 0, letterSpacing: '-.3px', fontFamily: FONT }}>{periodo ? rotuloPeriodo(periodo) : '—'}</p>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 4, marginBottom: 0, fontFamily: FONT }}>Fechamento automático · quinzenal</p>
      </div>

      {/* ── BLOCO 3: botões ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" disabled={!relatorio} onClick={() => baixarPdf(relatorio, nomeLoja)}
          style={{ ...btnBase, cursor: relatorio ? 'pointer' : 'not-allowed', opacity: relatorio ? 1 : 0.5, background: '#fff', color: '#5E2BD0' }}>
          <Download size={16} /> Baixar PDF
        </button>
        <button type="button" disabled={!relatorio} onClick={() => enviarWhatsApp(relatorio, nomeLoja)}
          style={{ ...btnBase, cursor: relatorio ? 'pointer' : 'not-allowed', opacity: relatorio ? 1 : 0.5, background: '#25D366', color: '#fff' }}>
          <WhatsAppSVG size={16} /> Enviar no WhatsApp
        </button>
      </div>

    </div>
  )
}

// ── Estados sem relatório ──────────────────────────────────────────────────
// Sem relatório ainda: o Sócio se apresenta em 3 falas + "Entendi". O clique
// não grava nada (o "visto" do banner é outra coisa — socio_visto_periodo).
//
// Cada fala passa por "digitando…" (3 pontinhos) e depois o texto é escrito
// letra a letra; a próxima só começa quando a anterior terminou. `etapa`
// avança de 0 a 2*N-1: par = fala i com pontinhos, ímpar = fala i escrevendo
// (`letras` = quantos caracteres já aparecem).
// Acessibilidade: a sequência visual é aria-hidden; o texto completo das 3
// falas fica sempre no DOM num bloco só para leitor de tela.
const DIGITANDO_MS = 1000
const LETRA_MS = 18
const PAUSA_MS = 500

function TextoSegmentos({ segmentos }) {
  return segmentos.map((s, i) => s.negrito ? <strong key={i}>{s.texto}</strong> : <span key={i}>{s.texto}</span>)
}

function Digitando() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 22 }}>
      {[0, 0.15, 0.3].map(delay => (
        <span key={delay} style={{ width: 7, height: 7, borderRadius: '50%', background: '#5E2BD0', animation: `sd-typing 1s ease-in-out ${delay}s infinite` }} />
      ))}
    </div>
  )
}

const srOnly = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }

function SemRelatorio({ mobile, carregando }) {
  const [entendi, setEntendi] = useState(false)
  const ultimaEtapa = 5   // 3 falas × (digitando, texto) − 1
  // Quem pede menos movimento no sistema vê as falas direto, sem digitação.
  const [reduzir] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const [etapa, setEtapa] = useState(reduzir ? ultimaEtapa : 0)
  const [letras, setLetras] = useState(reduzir ? Infinity : 0)

  const falas = [
    [{ texto: 'Oi! Sou seu Sócio Digital. A cada 15 dias eu olho tudo que aconteceu na sua loja e te conto o que importa.' }],
    [{ texto: 'Vou avisar quando um produto parar de vender, quando uma cliente sumir, e como seu caixa fica nos próximos 15 dias.' }],
    [
      { texto: 'Meu primeiro resumo pra você sai em ' },
      { texto: dataPorExtenso(proximaGeracao()), negrito: true },
      { texto: '. Até lá, só estou de olho.' },
    ],
  ]
  const falaAtual = Math.floor(etapa / 2)
  const escrevendo = etapa % 2 === 1
  const falaCompleta = escrevendo && letras >= tamanhoSegmentos(falas[falaAtual])

  useEffect(() => {
    if (carregando) return
    let t
    if (!escrevendo) {
      t = setTimeout(() => { setLetras(0); setEtapa(e => e + 1) }, DIGITANDO_MS)
    } else if (!falaCompleta) {
      t = setTimeout(() => setLetras(n => n + 1), LETRA_MS)
    } else if (etapa < ultimaEtapa) {
      t = setTimeout(() => setEtapa(e => e + 1), PAUSA_MS)
    }
    return () => clearTimeout(t)
  }, [carregando, etapa, letras, escrevendo, falaCompleta])

  const av = mobile ? 30 : 38
  const bPad = mobile ? '14px 16px' : '16px 20px'
  const txt = { fontSize: mobile ? 14 : 16, lineHeight: 1.55, color: '#18181B', fontFamily: FONT, margin: 0 }
  const wrap = { flex: 1, background: '#F6F6F9', padding: mobile ? '18px 16px 88px' : '32px 40px 44px' }

  if (carregando) {
    return (
      <div style={wrap}>
        <MsgRow avatarSize={av}>
          <Bubble style={{ padding: bPad, maxWidth: 640 }}>
            <p style={txt}>Buscando seu último resumo…</p>
          </Bubble>
        </MsgRow>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={srOnly}>
        {falas.map((fala, i) => <p key={i}><TextoSegmentos segmentos={fala} /></p>)}
      </div>
      <div aria-hidden="true">
        {falas.map((fala, i) => {
          if (etapa < i * 2) return null
          const digitando = etapa === i * 2
          // Falas anteriores ficam completas; só a atual é fatiada.
          const visivel = i === falaAtual ? fatiarSegmentos(fala, letras) : fala
          return (
            <MsgRow key={i} avatarSize={av} mb={14}>
              <Bubble style={{ padding: bPad, maxWidth: digitando ? 'fit-content' : 640 }}>
                {digitando
                  ? <Digitando />
                  : <p style={txt}><TextoSegmentos segmentos={visivel} /></p>}
              </Bubble>
            </MsgRow>
          )
        })}
      </div>
      {etapa >= ultimaEtapa && falaCompleta && (
        <div style={{ paddingLeft: av + 14, opacity: 0, animation: 'sd-fadein 0.5s ease 0.4s forwards' }}>
          <button type="button" disabled={entendi} onClick={() => setEntendi(true)}
            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, cursor: entendi ? 'default' : 'pointer', background: entendi ? '#ECECF1' : '#5E2BD0', color: entendi ? '#8A8A93' : '#fff' }}>
            {entendi ? 'Combinado 👍' : 'Entendi'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Message stream (shared) ────────────────────────────────────────────────
function MessageStream({ mobile = false, relatorio, onVerProdutos, onCampanha }) {
  const av = mobile ? 30 : 38
  const bPad = mobile ? '14px 16px' : '16px 20px'
  const dados = relatorio.dados || {}
  const met = dados.metricas || {}
  const ant = dados.anterior || {}
  const periodo = { inicio: relatorio.periodo_inicio, fim: relatorio.periodo_fim }
  const leitura = montarLeituraSocio(dados)
  const caixa = dados.caixa || {}
  const recomprar = dados.recomprar || []
  const parados = dados.parados || []

  // Stagger delays: desktop 6 msgs, mobile 6 sections
  const D = mobile
    ? [0.1, 1.0, 2.0, 3.0, 3.6, 4.2]   // mobile: abertura, métricas, listas, sugestões, clientes, caixa
    : [0.1, 0.9, 1.7, 2.5, 3.3, 4.1]   // desktop: msgs 1–6

  const [sugOpen, setSugOpen] = useState(false)
  const [cliOpen, setCliOpen] = useState(false)

  const [barsActive, setBarsActive] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setBarsActive(true), (D[5] + 0.3) * 1000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const metricDelay = D[1] * 1000
  const saldoDelay  = (D[5] + 0.3) * 1000

  const saldo = Number(caixa.saldo) || 0
  const saldoCount = useCountUp(Math.abs(Math.round(saldo)), 1200, saldoDelay)
  const saldoTxt = `${saldo < 0 ? '−' : '+'}R$ ${saldoCount.toLocaleString('pt-BR')}`
  const corSaldo = saldo < 0 ? '#FFB4A6' : '#5CF2A0'
  const entradas = Number(caixa.entradas) || 0
  const saidas = Number(caixa.saidas) || 0
  const base = Math.max(entradas, saidas, 1)
  const maior = caixa.maior_conta

  const textoCaixa = saldo < 0
    ? <>As contas a pagar passam das entradas previstas. {maior ? <>Atenção a <strong>{maior.descricao}</strong> ({fmtR(maior.valor)}).</> : null}</>
    : entradas === 0 && saidas === 0
      ? <>Nada previsto para entrar ou sair nesses dias pelo Financeiro e pelo Crediário.</>
      : <>Cruzei as entradas previstas com suas contas a pagar. Sobra <strong style={{ color: '#5CF2A0' }}>folga</strong>{maior ? <> — a maior conta é <strong>{maior.descricao}</strong> ({fmtR(maior.valor)})</> : null}.</>

  return (
    <div style={{ flex: 1, background: '#F6F6F9', overflowY: mobile ? undefined : 'auto', padding: mobile ? '18px 16px 88px' : '32px 40px 44px', display: 'flex', flexDirection: 'column' }}>

      {/* ── MSG 1: Abertura ── */}
      <MsgRow avatarSize={av} animDelay={D[0]}>
        <Bubble style={{ padding: bPad, maxWidth: mobile ? '100%' : 640 }}>
          <p style={{ fontSize: mobile ? 14 : 16, lineHeight: 1.55, color: '#18181B', fontFamily: FONT, margin: 0 }}>
            {fraseAbertura(leitura.tom, periodo)}
            <span style={{ display: 'inline-block', width: 9, height: 18, background: '#5E2BD0', borderRadius: 2, marginLeft: 4, verticalAlign: 'middle', animation: 'sd-blink 1s step-end infinite' }} />
          </p>
        </Bubble>
      </MsgRow>

      {/* ── MSG 2: Métricas ── */}
      <MsgRow avatarSize={av} animDelay={D[1]}>
        <div>
          {!mobile && (
            <p style={{ fontSize: 14, fontWeight: 700, color: '#52407F', marginTop: 0, marginBottom: 10, fontFamily: FONT }}>
              Começando pelos números (comparado com a quinzena anterior):
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12 }}>
            <MetricCard label="FATURAMENTO" endValue={met.faturamento} prefix="R$ " delta={formatarDelta(variacaoPct(met.faturamento, ant.faturamento))} compact={mobile} startDelay={metricDelay} />
            <MetricCard label="TICKET MÉDIO" endValue={met.ticket_medio} prefix="R$ " delta={formatarDelta(variacaoPct(met.ticket_medio, ant.ticket_medio))} compact={mobile} startDelay={metricDelay} />
            <MetricCard label="VENDAS" endValue={met.vendas} delta={formatarDelta(variacaoPct(met.vendas, ant.vendas))} compact={mobile} startDelay={metricDelay} />
            <MetricCard label="TROCAS" endValue={met.trocas} delta={`${Number(ant.trocas) || 0} na anterior`} compact={mobile} startDelay={metricDelay} />
          </div>
        </div>
      </MsgRow>

      {/* ── MSG 3: Positivos / Atenção ── */}
      <MsgRow avatarSize={av} animDelay={D[2]}>
        <div>
          {!mobile && (
            <Bubble style={{ padding: bPad, marginBottom: 12, maxWidth: 640 }}>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: '#18181B', fontFamily: FONT, margin: 0 }}>
                Duas listas rápidas pra você: o que <strong style={{ color: '#1E8A54' }}>brilhou</strong> e o que eu ficaria <strong style={{ color: '#E0563F' }}>de olho</strong>.
              </p>
            </Bubble>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#EBF7F0', border: '1px solid #C9EAD8', borderRadius: 16, padding: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#1E8A54', marginTop: 0, marginBottom: 10, fontFamily: FONT }}>Foi bem 🎉</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {leitura.foiBem.length === 0
                  ? <p style={{ fontSize: 13, color: '#245C3F', lineHeight: 1.4, fontFamily: FONT, margin: 0 }}>Sem destaques neste período.</p>
                  : leitura.foiBem.map((t, i) => (
                      <p key={i} style={{ fontSize: 13, color: '#245C3F', lineHeight: 1.4, fontFamily: FONT, margin: 0 }}>• {t}</p>
                    ))}
              </div>
            </div>
            <div style={{ background: '#FDF0EC', border: '1px solid #F6D6CC', borderRadius: 16, padding: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#E0563F', marginTop: 0, marginBottom: 10, fontFamily: FONT }}>De olho 👀</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {leitura.deOlho.length === 0
                  ? <p style={{ fontSize: 13, color: '#7A3A2C', lineHeight: 1.4, fontFamily: FONT, margin: 0 }}>Nada preocupante. Segue o jogo.</p>
                  : leitura.deOlho.map((t, i) => (
                      <p key={i} style={{ fontSize: 13, color: '#7A3A2C', lineHeight: 1.4, fontFamily: FONT, margin: 0 }}>• {t}</p>
                    ))}
              </div>
            </div>
          </div>
        </div>
      </MsgRow>

      {/* ── MSG 4: Sugestões de estoque ── */}
      {mobile ? (
        <MsgRow avatarSize={av} animDelay={D[3]}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', overflow: 'hidden' }}>
            <div
              onClick={() => setSugOpen(o => !o)}
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 12 }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#5E2BD0', fontFamily: FONT, margin: '0 0 3px' }}>🛒 Sugestões de estoque</p>
                <p style={{ fontSize: 12, color: '#8A8A93', fontFamily: FONT, margin: 0 }}>Recomprar já · Girar em promoção</p>
              </div>
              <ChevronDown size={18} color="#8A8A93" style={{ flexShrink: 0, transition: 'transform 0.3s ease', transform: sugOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            <div style={{ maxHeight: sugOpen ? '600px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
              <div style={{ background: '#F6F6F9', padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <CardRecomprar itens={recomprar} pad={16} onVer={() => onVerProdutos({ tipo: 'recomprar', itens: recomprar })} />
                <CardParados itens={parados} pad={16} onVer={() => onVerProdutos({ tipo: 'parados', itens: parados })} />
              </div>
            </div>
          </div>
        </MsgRow>
      ) : (
        <MsgRow avatarSize={av} animDelay={D[3]}>
          <div>
            <Bubble style={{ padding: bPad, marginBottom: 12, maxWidth: 640 }}>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: '#18181B', fontFamily: FONT, margin: 0 }}>
                Baseado no giro, duas jogadas que eu faria essa semana:
              </p>
            </Bubble>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CardRecomprar itens={recomprar} onVer={() => onVerProdutos({ tipo: 'recomprar', itens: recomprar })} />
              <CardParados itens={parados} onVer={() => onVerProdutos({ tipo: 'parados', itens: parados })} />
            </div>
          </div>
        </MsgRow>
      )}

      {/* ── MSG 5: Clientes ── */}
      {mobile ? (
        <MsgRow avatarSize={av} animDelay={D[4]}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', overflow: 'hidden' }}>
            <div
              onClick={() => setCliOpen(o => !o)}
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 12 }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#18181B', fontFamily: FONT, margin: '0 0 3px' }}>⭐ Clientes</p>
                <p style={{ fontSize: 12, color: '#8A8A93', fontFamily: FONT, margin: 0 }}>Compraram mais · Sumiram {DIAS_INATIVO}+ dias</p>
              </div>
              <ChevronDown size={18} color="#8A8A93" style={{ flexShrink: 0, transition: 'transform 0.3s ease', transform: cliOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            <div style={{ maxHeight: cliOpen ? '600px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
              <div style={{ background: '#F6F6F9', padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <CardTopClientes itens={dados.clientes_top || []} pad={16} />
                <CardInativos inativos={dados.clientes_inativos} pad={16} onCampanha={onCampanha} />
              </div>
            </div>
          </div>
        </MsgRow>
      ) : (
        <MsgRow avatarSize={av} animDelay={D[4]}>
          <div>
            <Bubble style={{ padding: bPad, marginBottom: 12, maxWidth: 640 }}>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: '#18181B', fontFamily: FONT, margin: 0 }}>
                Suas clientes fiéis e quem sumiu — vale um alô.
              </p>
            </Bubble>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CardTopClientes itens={dados.clientes_top || []} />
              <CardInativos inativos={dados.clientes_inativos} onCampanha={onCampanha} />
            </div>
          </div>
        </MsgRow>
      )}

      {/* ── MSG 6: Caixa projetado ── */}
      <MsgRow avatarSize={av} mb={12} animDelay={D[5]}>
        <div>
          <div style={{ background: 'linear-gradient(120deg,#341780,#5E2BD0 70%,#7B3FE0)', borderRadius: '6px 18px 18px 18px', boxShadow: '0 8px 24px -18px rgba(52,23,128,.5)', padding: mobile ? '18px 18px' : '22px 24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: '#FF6F5E', opacity: .22, bottom: -50, right: -30, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: mobile ? 'wrap' : 'nowrap' }}>
              <div style={{ flex: 1, minWidth: mobile ? '100%' : 220 }}>
                <p style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT, marginTop: 0, marginBottom: 10 }}>
                  Pra fechar — seu caixa nos 15 dias seguintes 💰
                </p>
                {mobile ? (
                  <>
                    <p style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: corSaldo, letterSpacing: '-1px', marginTop: 0, marginBottom: 6 }}>
                      {saldoTxt}
                    </p>
                    <p style={{ fontSize: 13, opacity: .9, fontFamily: FONT, lineHeight: 1.5, margin: 0 }}>
                      {fmtR(entradas)} entram − {fmtR(saidas)} a pagar. {textoCaixa}
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 14, lineHeight: 1.5, opacity: .94, fontFamily: FONT, marginTop: 0, marginBottom: 16 }}>
                      {textoCaixa}
                    </p>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11.5, opacity: .85, fontFamily: FONT }}>Entradas esperadas</span>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700 }}>{fmtR(entradas)}</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: barsActive ? `${(entradas / base) * 100}%` : '0%', background: '#5CF2A0', borderRadius: 999, transition: 'width 1.4s ease' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11.5, opacity: .85, fontFamily: FONT }}>Contas a pagar</span>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700 }}>{fmtR(saidas)}</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: barsActive ? `${(saidas / base) * 100}%` : '0%', background: '#FF6F5E', borderRadius: 999, transition: 'width 1.4s ease 0.15s' }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
              {!mobile && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', opacity: .85, marginTop: 0, marginBottom: 8, fontFamily: FONT }}>SALDO PROJETADO</p>
                  <p style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: corSaldo, letterSpacing: '-1px', margin: 0 }}>
                    {saldoTxt}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </MsgRow>

      {/* ── Assinatura / ondinha de voz ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: mobile ? 0 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {[0, 0.15, 0.3].map((delay, idx) => (
            <div key={idx} style={{ width: 3, height: 14, background: '#5E2BD0', borderRadius: 2, animation: `sd-wave 1s ease-in-out ${delay}s infinite`, transformOrigin: 'center' }} />
          ))}
        </div>
        <span style={{ fontSize: 13, color: '#8A8A93', fontFamily: FONT }}>
          Sócio Digital · {textoProximoResumo()}
        </span>
      </div>

    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────
//
// Props:
//   lojaId               loja logada (a RLS de lf_socio_relatorios só devolve a dela)
//   nomeLoja             cabeçalho do PDF e do WhatsApp
//   onVisto(periodo)     chamado ao abrir um relatório — o pai grava
//                        lf_config.socio_visto_periodo e o aviso do banner some
//   onCampanhaRetorno(nomes) leva ao CRM > Follow-ups filtrado por essas clientes
export default function SocioDigital({ mobile = false, onVoltar, lojaId, nomeLoja, onVisto, onCampanhaRetorno }) {
  const [estado, setEstado] = useState({ carregando: true, relatorio: null })
  const [modal, setModal] = useState(null)   // { tipo: 'recomprar'|'parados', itens }

  useEffect(() => {
    let vivo = true
    async function carregar() {
      if (!lojaId) { setEstado({ carregando: false, relatorio: null }); return }
      const { data, error } = await supabase
        .from('lf_socio_relatorios')
        .select('periodo_inicio, periodo_fim, dados, gerado_em')
        .eq('loja_id', lojaId)
        .order('periodo_inicio', { ascending: false })
        .limit(1)
      if (!vivo) return
      // Tabela ainda inexistente (SQL não rodado) cai aqui como erro — a tela
      // mostra o estado "primeiro resumo em…", não uma tela quebrada.
      if (error) console.warn('[SocioDigital] relatório indisponível:', error.message)
      setEstado({ carregando: false, relatorio: error ? null : (data?.[0] || null) })
    }
    carregar()
    return () => { vivo = false }
  }, [lojaId])

  const relatorio = estado.relatorio
  const periodoVisto = relatorio?.periodo_inicio

  // Abriu a tela com relatório → marca como visto (uma vez por período).
  useEffect(() => {
    if (periodoVisto) onVisto?.(periodoVisto)
  }, [periodoVisto]) // eslint-disable-line react-hooks/exhaustive-deps

  const stream = relatorio
    ? <MessageStream mobile={mobile} relatorio={relatorio} onVerProdutos={setModal} onCampanha={onCampanhaRetorno} />
    : <SemRelatorio mobile={mobile} carregando={estado.carregando} />

  const modalEl = modal && <ModalProdutos modal={modal} onFechar={() => setModal(null)} />

  if (mobile) {
    const periodo = relatorio ? { inicio: relatorio.periodo_inicio, fim: relatorio.periodo_fim } : null
    return (
      <>
        <style>{SD_CSS}</style>
        <div style={{ display: 'flex', flexDirection: 'column', background: '#F6F6F9', minHeight: 'calc(100dvh - 56px)', fontFamily: FONT }}>
          <div style={{ background: 'linear-gradient(160deg,#341780,#5E2BD0 62%,#8B46E8)', padding: '32px 20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Orb size={76} logoSize={38} />
            <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-.3px', fontFamily: FONT, margin: '4px 0 0' }}>Sócio Digital</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.8)', textTransform: 'uppercase', letterSpacing: '.4px', fontFamily: FONT, margin: 0 }}>
              {periodo ? rotuloPeriodo(periodo) : 'aguardando o primeiro resumo'}
            </p>
            {relatorio && (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="button" onClick={() => baixarPdf(relatorio, nomeLoja)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#fff', color: '#5E2BD0', fontFamily: FONT, fontSize: 12.5, fontWeight: 800 }}>
                  <Download size={14} /> PDF
                </button>
                <button type="button" onClick={() => enviarWhatsApp(relatorio, nomeLoja)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#25D366', color: '#fff', fontFamily: FONT, fontSize: 12.5, fontWeight: 800 }}>
                  <WhatsAppSVG size={14} /> WhatsApp
                </button>
              </div>
            )}
          </div>
          {stream}
        </div>
        {modalEl}
      </>
    )
  }

  return (
    <>
      <style>{SD_CSS}</style>
      <div style={{ display: 'flex', width: '100%', height: '100dvh', overflow: 'hidden', fontFamily: FONT }}>
        <AgentSidebar onVoltar={onVoltar} relatorio={relatorio} nomeLoja={nomeLoja} />
        {stream}
      </div>
      {modalEl}
    </>
  )
}
