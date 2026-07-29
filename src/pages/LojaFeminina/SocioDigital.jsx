import { useState, useEffect } from 'react'
import { Download, ArrowLeft, ChevronDown } from 'lucide-react'

// ── Keyframes ──────────────────────────────────────────────────────────────
const SD_CSS = `
  @keyframes sd-spin    { to { transform: rotate(360deg) } }
  @keyframes sd-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.05) } }
  @keyframes sd-ping    { 0% { transform: scale(1); opacity:.5 } 70%,100% { transform: scale(1.7); opacity:0 } }
  @keyframes sd-float   { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
  @keyframes sd-blink   { 0%,100% { opacity:1 } 50% { opacity:0 } }
  @keyframes sd-wave    { 0%,60%,100% { transform: scaleY(.35) } 30% { transform: scaleY(1) } }
  @keyframes sd-fadein  { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
`

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

// ── Static mock data ───────────────────────────────────────────────────────
const METRICS = [
  { label: 'FATURAMENTO', value: 'R$ 48.320', delta: '▲ +12%' },
  { label: 'TICKET MÉDIO', value: 'R$ 187',   delta: '▲ +4%'  },
  { label: 'VENDAS',       value: '258',       delta: '▲ +9%'  },
  { label: 'TROCAS',       value: '14',        delta: '▼ −18%' },
]

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

// ── Bubble ─────────────────────────────────────────────────────────────────
function Bubble({ children, style = {} }) {
  return (
    <div style={{ background: '#fff', borderRadius: '6px 18px 18px 18px', border: '1px solid #ECECF1', boxShadow: '0 8px 24px -18px rgba(52,23,128,.5)', ...style }}>
      {children}
    </div>
  )
}

// ── MsgRow ─────────────────────────────────────────────────────────────────
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
// endValue: numeric end for count-up; prefix/suffix: text around the number
function MetricCard({ label, endValue, prefix = '', suffix = '', delta, compact, startDelay = 0 }) {
  const count = useCountUp(endValue, 1200, startDelay)
  const formatted = endValue >= 1000
    ? count.toLocaleString('pt-BR')
    : String(count)
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: compact ? 13 : 16 }}>
      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.4px', color: '#8A8A93', textTransform: 'uppercase', marginBottom: 6, marginTop: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{label}</p>
      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: compact ? 18 : 22, fontWeight: 700, color: '#18181B', letterSpacing: '-.5px', margin: 0 }}>{prefix}{formatted}{suffix}</p>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#1E8A54', marginTop: 4, marginBottom: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{delta}</p>
    </div>
  )
}

// ── Desktop agent sidebar ──────────────────────────────────────────────────
function AgentSidebar({ onVoltar }) {
  return (
    <div style={{ width: 300, flexShrink: 0, background: 'linear-gradient(180deg,#341780,#5E2BD0 62%,#8B46E8)', color: '#fff', padding: '20px 26px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

      {/* ── BLOCO 1: voltar + orb + nome + status ── */}
      <div>
        {onVoltar && (
          <button
            onClick={onVoltar}
            style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', color: 'rgba(255,255,255,.85)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, marginBottom: 0 }}
          >
            <ArrowLeft size={13} /> Voltar ao painel
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
          <Orb size={104} logoSize={52} />
        </div>

        <p style={{ textAlign: 'center', fontSize: 19, fontWeight: 800, marginTop: 20, marginBottom: 0, letterSpacing: '-.3px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Sócio Digital
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'center', justifyContent: 'center', marginTop: 10, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, padding: '4px 11px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5CF2A0', boxShadow: '0 0 8px #5CF2A0', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>resumo pronto</span>
        </div>
      </div>

      {/* ── BLOCO 2: divisor + período ── */}
      <div>
        <div style={{ height: 1, background: 'rgba(255,255,255,.2)', marginBottom: 20 }} />
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>PERÍODO</p>
        <p style={{ fontSize: 16, fontWeight: 800, marginTop: 7, marginBottom: 0, letterSpacing: '-.3px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>01 a 15 de julho</p>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 4, marginBottom: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Fechamento automático · quinzenal</p>
      </div>

      {/* ── BLOCO 3: botões ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#fff', color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 800 }}>
          <Download size={16} /> Baixar PDF
        </button>
        <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#25D366', color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 800 }}>
          <WhatsAppSVG size={16} /> Enviar no WhatsApp
        </button>
      </div>

    </div>
  )
}

// ── Message stream (shared) ────────────────────────────────────────────────
function MessageStream({ mobile = false }) {
  const av = mobile ? 30 : 38
  const bPad = mobile ? '14px 16px' : '16px 20px'

  // Stagger delays: desktop 6 msgs, mobile 6 sections
  const D = mobile
    ? [0.1, 1.0, 2.0, 3.0, 3.6, 4.2]   // mobile: abertura, métricas, listas, sugestões, clientes, caixa
    : [0.1, 0.9, 1.7, 2.5, 3.3, 4.1]   // desktop: msgs 1–6

  const [sugOpen, setSugOpen] = useState(false)
  const [cliOpen, setCliOpen] = useState(false)

  // Bar animation for msg 6 caixa
  const [barsActive, setBarsActive] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setBarsActive(true), (D[5] + 0.3) * 1000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Count-up start delays: metrics appear at D[1], saldo at D[5]
  const metricDelay = D[1] * 1000
  const saldoDelay  = (D[5] + 0.3) * 1000

  // Animated saldo (+R$ 12.800 → 12800)
  const saldoCount = useCountUp(12800, 1200, saldoDelay)

  return (
    <div style={{ flex: 1, background: '#F6F6F9', overflowY: mobile ? undefined : 'auto', padding: mobile ? '18px 16px 88px' : '32px 40px 44px', display: 'flex', flexDirection: 'column' }}>

      {/* ── MSG 1: Abertura ── */}
      <MsgRow avatarSize={av} animDelay={D[0]}>
        <Bubble style={{ padding: bPad, maxWidth: mobile ? '100%' : 640 }}>
          <p style={{ fontSize: mobile ? 14 : 16, lineHeight: 1.55, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>
            {mobile
              ? <>Oi, sócio 👋 Boa quinzena! Foi <strong style={{ color: '#1E8A54' }}>crescimento</strong>. Te passo o essencial.</>
              : <>Oi, sócio 👋 Fechei a primeira quinzena de julho pra você. Foi um período de <strong style={{ color: '#1E8A54' }}>crescimento</strong> — puxei tudo e vou te passar o que importa, do jeito que a gente combinou: direto ao ponto.</>
            }
            <span style={{ display: 'inline-block', width: 9, height: 18, background: '#5E2BD0', borderRadius: 2, marginLeft: 4, verticalAlign: 'middle', animation: 'sd-blink 1s step-end infinite' }} />
          </p>
        </Bubble>
      </MsgRow>

      {/* ── MSG 2: Métricas ── */}
      <MsgRow avatarSize={av} animDelay={D[1]}>
        <div>
          {!mobile && (
            <p style={{ fontSize: 14, fontWeight: 700, color: '#52407F', marginTop: 0, marginBottom: 10, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Começando pelos números:
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12 }}>
            <MetricCard label="FATURAMENTO" endValue={48320} prefix="R$ " delta="▲ +12%" compact={mobile} startDelay={metricDelay} />
            <MetricCard label="TICKET MÉDIO" endValue={187} prefix="R$ " delta="▲ +4%" compact={mobile} startDelay={metricDelay} />
            <MetricCard label="VENDAS" endValue={258} delta="▲ +9%" compact={mobile} startDelay={metricDelay} />
            <MetricCard label="TROCAS" endValue={14} delta="▼ −18%" compact={mobile} startDelay={metricDelay} />
          </div>
        </div>
      </MsgRow>

      {/* ── MSG 3: Positivos / Atenção ── */}
      <MsgRow avatarSize={av} animDelay={D[2]}>
        <div>
          {!mobile && (
            <Bubble style={{ padding: bPad, marginBottom: 12, maxWidth: 640 }}>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>
                Duas listas rápidas pra você: o que <strong style={{ color: '#1E8A54' }}>brilhou</strong> e o que eu ficaria <strong style={{ color: '#E0563F' }}>de olho</strong>.
              </p>
            </Bubble>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Verde */}
            <div style={{ background: '#EBF7F0', border: '1px solid #C9EAD8', borderRadius: 16, padding: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#1E8A54', marginTop: 0, marginBottom: 10, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Foi bem 🎉</p>
              {mobile
                ? <p style={{ fontSize: 13, color: '#245C3F', lineHeight: 1.4, fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>Vestidos de festa (28% do fat.) · sábados = 40% · crediário em dia.</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {['Vestidos de festa puxaram 28% do faturamento', 'Sábados renderam 40% do total do período', 'Crediário 100% em dia — zero atraso novo'].map((t, i) => (
                      <p key={i} style={{ fontSize: 13, color: '#245C3F', lineHeight: 1.4, fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>• {t}</p>
                    ))}
                  </div>
              }
            </div>
            {/* Coral */}
            <div style={{ background: '#FDF0EC', border: '1px solid #F6D6CC', borderRadius: 16, padding: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#E0563F', marginTop: 0, marginBottom: 10, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>De olho 👀</p>
              {mobile
                ? <p style={{ fontSize: 13, color: '#7A3A2C', lineHeight: 1.4, fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>Trocas de calçado subindo · básicos em risco · 2 vendedoras abaixo da meta.</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {['Trocas de calçado por numeração subindo', 'Básicos caindo rápido — risco de ruptura', '2 vendedoras abaixo da meta da quinzena'].map((t, i) => (
                      <p key={i} style={{ fontSize: 13, color: '#7A3A2C', lineHeight: 1.4, fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>• {t}</p>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>
      </MsgRow>

      {/* ── MSG 4: Sugestões (mobile accordion) ── */}
      {mobile && (
        <MsgRow avatarSize={av} animDelay={D[3]}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', overflow: 'hidden' }}>
            <div
              onClick={() => setSugOpen(o => !o)}
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 12 }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 3px' }}>🛒 Sugestões de estoque</p>
                <p style={{ fontSize: 12, color: '#8A8A93', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>Recomprar já · Girar em promoção</p>
              </div>
              <ChevronDown size={18} color="#8A8A93" style={{ flexShrink: 0, transition: 'transform 0.3s ease', transform: sugOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            <div style={{ maxHeight: sugOpen ? '500px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
              <div style={{ background: '#F6F6F9', padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ECECF1', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 2 }}>🛒 Recomprar já</p>
                  <p style={{ fontSize: 11.5, color: '#8A8A93', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 12 }}>vendem muito, estoque no fim</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[['Vestido midi floral','4 restam'],['Calça wide alfaiataria','3 restam'],['Blusa cropped','5 restam']].map(([nome, chip]) => (
                      <div key={nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', flex: 1 }}>{nome}</span>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#C4443B', background: '#FDECEA', borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{chip}</span>
                      </div>
                    ))}
                  </div>
                  <button style={{ marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', padding: 0, display: 'block' }}>Ver 9 produtos →</button>
                </div>
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ECECF1', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#FF6F5E', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 2 }}>🏷️ Girar em promoção</p>
                  <p style={{ fontSize: 11.5, color: '#8A8A93', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 12 }}>parados faz tempo</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[['Jaqueta jeans oversized','68 dias'],['Conjunto alfaiataria','54 dias'],['Saia longa plissada','47 dias']].map(([nome, chip]) => (
                      <div key={nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', flex: 1 }}>{nome}</span>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#8A6D00', background: '#FBF2D6', borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{chip}</span>
                      </div>
                    ))}
                  </div>
                  <button style={{ marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', padding: 0, display: 'block' }}>Ver 14 produtos →</button>
                </div>
              </div>
            </div>
          </div>
        </MsgRow>
      )}

      {/* ── MSG 4: Sugestões (desktop only) ── */}
      {!mobile && (
        <MsgRow avatarSize={av} animDelay={D[3]}>
          <div>
            <Bubble style={{ padding: bPad, marginBottom: 12, maxWidth: 640 }}>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>
                Baseado no giro, duas jogadas que eu faria essa semana:
              </p>
            </Bubble>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Recomprar */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: 18 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 2 }}>🛒 Recomprar já</p>
                <p style={{ fontSize: 11.5, color: '#8A8A93', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 12 }}>vendem muito, estoque no fim</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['Vestido midi floral','4 restam'],['Calça wide alfaiataria','3 restam'],['Blusa cropped','5 restam']].map(([nome, chip]) => (
                    <div key={nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', flex: 1 }}>{nome}</span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#C4443B', background: '#FDECEA', borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{chip}</span>
                    </div>
                  ))}
                </div>
                <button style={{ marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', padding: 0, display: 'block' }}>Ver 9 produtos →</button>
              </div>
              {/* Girar promoção */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: 18 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#FF6F5E', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 2 }}>🏷️ Girar em promoção</p>
                <p style={{ fontSize: 11.5, color: '#8A8A93', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 12 }}>parados faz tempo</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['Jaqueta jeans oversized','68 dias'],['Conjunto alfaiataria','54 dias'],['Saia longa plissada','47 dias']].map(([nome, chip]) => (
                    <div key={nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', flex: 1 }}>{nome}</span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#8A6D00', background: '#FBF2D6', borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{chip}</span>
                    </div>
                  ))}
                </div>
                <button style={{ marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', padding: 0, display: 'block' }}>Ver 14 produtos →</button>
              </div>
            </div>
          </div>
        </MsgRow>
      )}

      {/* ── MSG 5: Clientes (mobile accordion) ── */}
      {mobile && (
        <MsgRow avatarSize={av} animDelay={D[4]}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', overflow: 'hidden' }}>
            <div
              onClick={() => setCliOpen(o => !o)}
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 12 }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 3px' }}>⭐ Clientes</p>
                <p style={{ fontSize: 12, color: '#8A8A93', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>Compraram mais · Sumiram 45+ dias</p>
              </div>
              <ChevronDown size={18} color="#8A8A93" style={{ flexShrink: 0, transition: 'transform 0.3s ease', transform: cliOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            <div style={{ maxHeight: cliOpen ? '500px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
              <div style={{ background: '#F6F6F9', padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ECECF1', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 12 }}>⭐ Compraram mais</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[{i:'MR',n:'Marina Ribeiro',v:'R$ 2.340'},{i:'JP',n:'Juliana Prado',v:'R$ 1.870'},{i:'CS',n:'Camila Souza',v:'R$ 1.520'}].map(({ i, n, v }) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1ECFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{i}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', flex: 1 }}>{n}</span>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#18181B' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ECECF1', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 12 }}>⏰ Sumiram (45+ dias)</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[{i:'PM',n:'Patrícia Mendes',d:'61 dias'},{i:'FL',n:'Fernanda Lima',d:'52 dias'},{i:'BT',n:'Bianca Teixeira',d:'48 dias'}].map(({ i, n, d }) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F4F4F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#8A8A93', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{i}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', flex: 1 }}>{n}</span>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#C4443B' }}>{d}</span>
                      </div>
                    ))}
                  </div>
                  <button style={{ marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', padding: 0, display: 'block' }}>Campanha de retorno →</button>
                </div>
              </div>
            </div>
          </div>
        </MsgRow>
      )}

      {/* ── MSG 5: Clientes (desktop only) ── */}
      {!mobile && (
        <MsgRow avatarSize={av} animDelay={D[4]}>
          <div>
            <Bubble style={{ padding: bPad, marginBottom: 12, maxWidth: 640 }}>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>
                Suas clientes fiéis continuam firmes. E tem gente que sumiu — vale um alô.
              </p>
            </Bubble>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Top clientes */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: 18 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 12 }}>⭐ Compraram mais</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[{i:'MR',n:'Marina Ribeiro',v:'R$ 2.340'},{i:'JP',n:'Juliana Prado',v:'R$ 1.870'},{i:'CS',n:'Camila Souza',v:'R$ 1.520'}].map(({ i, n, v }) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1ECFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{i}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', flex: 1 }}>{n}</span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#18181B' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Inativos */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: 18 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 12 }}>⏰ Sumiram (45+ dias)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[{i:'PM',n:'Patrícia Mendes',d:'61 dias'},{i:'FL',n:'Fernanda Lima',d:'52 dias'},{i:'BT',n:'Bianca Teixeira',d:'48 dias'}].map(({ i, n, d }) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F4F4F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#8A8A93', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{i}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: 'Plus Jakarta Sans, sans-serif', flex: 1 }}>{n}</span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#C4443B' }}>{d}</span>
                    </div>
                  ))}
                </div>
                <button style={{ marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: '#5E2BD0', fontFamily: 'Plus Jakarta Sans, sans-serif', padding: 0, display: 'block' }}>Campanha de retorno →</button>
              </div>
            </div>
          </div>
        </MsgRow>
      )}

      {/* ── MSG 6: Caixa projetado ── */}
      <MsgRow avatarSize={av} mb={12} animDelay={D[5]}>
        <div>
          <div style={{ background: 'linear-gradient(120deg,#341780,#5E2BD0 70%,#7B3FE0)', borderRadius: '6px 18px 18px 18px', boxShadow: '0 8px 24px -18px rgba(52,23,128,.5)', padding: mobile ? '18px 18px' : '22px 24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            {/* Decorative orb */}
            <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: '#FF6F5E', opacity: .22, bottom: -50, right: -30, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: mobile ? 'wrap' : 'nowrap' }}>
              {/* Left */}
              <div style={{ flex: 1, minWidth: mobile ? '100%' : 220 }}>
                <p style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 10 }}>
                  Pra fechar — seu caixa nos próximos 15 dias 💰
                </p>
                {mobile ? (
                  <>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: '#5CF2A0', letterSpacing: '-1px', marginTop: 0, marginBottom: 6 }}>
                      +R$ {saldoCount.toLocaleString('pt-BR')}
                    </p>
                    <p style={{ fontSize: 13, opacity: .9, fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.5, margin: 0 }}>R$ 31.200 entram − R$ 18.400 a pagar. Segura o boleto do dia 22.</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 14, lineHeight: 1.5, opacity: .94, fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 0, marginBottom: 16 }}>
                      Cruzei as entradas esperadas com suas contas a pagar. Sobra <strong style={{ color: '#5CF2A0' }}>folga confortável</strong>, mas segura o boleto do fornecedor que vence dia 22.
                    </p>
                    {/* Bar: Entradas */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11.5, opacity: .85, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Entradas esperadas</span>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11.5, fontWeight: 700 }}>R$ 31.200</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: barsActive ? '100%' : '0%', background: '#5CF2A0', borderRadius: 999, transition: 'width 1.4s ease' }} />
                      </div>
                    </div>
                    {/* Bar: Contas */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11.5, opacity: .85, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Contas a pagar</span>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11.5, fontWeight: 700 }}>R$ 18.400</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: barsActive ? '59%' : '0%', background: '#FF6F5E', borderRadius: 999, transition: 'width 1.4s ease 0.15s' }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Right: saldo (desktop only) */}
              {!mobile && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', opacity: .85, marginTop: 0, marginBottom: 8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>SALDO PROJETADO</p>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 30, fontWeight: 700, color: '#5CF2A0', letterSpacing: '-1px', margin: 0 }}>
                    +R$ {saldoCount.toLocaleString('pt-BR')}
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
        <span style={{ fontSize: 13, color: '#8A8A93', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Sócio Digital · próximo resumo em 31 de julho
        </span>
      </div>

    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────
export default function SocioDigital({ mobile = false, onVoltar }) {
  if (mobile) {
    return (
      <>
        <style>{SD_CSS}</style>
        <div style={{ display: 'flex', flexDirection: 'column', background: '#F6F6F9', minHeight: 'calc(100dvh - 56px)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {/* Mobile gradient header */}
          <div style={{ background: 'linear-gradient(160deg,#341780,#5E2BD0 62%,#8B46E8)', padding: '32px 20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Orb size={76} logoSize={38} />
            <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-.3px', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '4px 0 0' }}>Sócio Digital</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.8)', textTransform: 'uppercase', letterSpacing: '.4px', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0 }}>01 A 15 DE JULHO</p>
          </div>
          <MessageStream mobile />
        </div>
      </>
    )
  }

  return (
    <>
      <style>{SD_CSS}</style>
      <div style={{ display: 'flex', width: '100%', height: '100dvh', overflow: 'hidden', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <AgentSidebar onVoltar={onVoltar} />
        <MessageStream mobile={false} />
      </div>
    </>
  )
}
