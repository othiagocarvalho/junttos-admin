import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Check, AlertCircle, Loader2, Eraser } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { T } from '../../theme/tokens'
import { PLANOS, fmtValorPlano, nomeModulo } from '../../utils/planos'

// Página pública: qualquer um com o link entra, sem login. Ela nunca recebe
// loja_id, pdf_path nem o id do contrato — a Edge Function devolve só o que
// aparece na tela. Erro de token é sempre a mesma mensagem, venha de token
// inexistente, expirado ou já usado.

function fmtData(v) {
  if (!v) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'
}
function fmtDataHora(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Canvas de assinatura. Desenha para o usuário ver, mas o que sai daqui é um
 * path SVG montado a partir dos próprios pontos — bem menor que um PNG base64
 * e escalável para qualquer tamanho na hora de exibir de volta.
 */
function CanvasAssinatura({ onChange, disabled }) {
  const canvasRef = useRef(null)
  const tracos    = useRef([])      // [[{x,y}, ...], ...]
  const atual     = useRef(null)
  const desenhando = useRef(false)

  const redesenhar = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.strokeStyle = T.ink
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    tracos.current.forEach(t => {
      if (t.length === 0) return
      ctx.beginPath()
      ctx.moveTo(t[0].x, t[0].y)
      t.forEach(p => ctx.lineTo(p.x, p.y))
      ctx.stroke()
    })
  }, [])

  // O canvas precisa de tamanho em pixels reais; em tela retina o bitmap é
  // maior que o CSS, senão o traço sai borrado.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    function ajustar() {
      const r = cv.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      cv.width  = Math.round(r.width * dpr)
      cv.height = Math.round(r.height * dpr)
      const ctx = cv.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      redesenhar()
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [redesenhar])

  function ponto(e) {
    const r = canvasRef.current.getBoundingClientRect()
    const src = e.touches?.[0] ?? e
    return {
      x: Math.round((src.clientX - r.left) * 10) / 10,
      y: Math.round((src.clientY - r.top) * 10) / 10,
    }
  }

  function emitir() {
    // 'M x y L x y ...' por traço, concatenados num path só.
    const d = tracos.current
      .filter(t => t.length > 0)
      .map(t => `M${t[0].x} ${t[0].y}` + t.slice(1).map(p => `L${p.x} ${p.y}`).join(''))
      .join(' ')
    if (!d) { onChange(''); return }
    const r = canvasRef.current.getBoundingClientRect()
    onChange(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(r.width)} ${Math.round(r.height)}">` +
      `<path d="${d}" fill="none" stroke="#16101F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    )
  }

  function inicio(e) {
    if (disabled) return
    e.preventDefault()
    desenhando.current = true
    atual.current = [ponto(e)]
    tracos.current.push(atual.current)
  }
  function mover(e) {
    if (!desenhando.current || disabled) return
    e.preventDefault()
    atual.current.push(ponto(e))
    redesenhar()
  }
  function fim() {
    if (!desenhando.current) return
    desenhando.current = false
    emitir()
  }

  function limpar() {
    tracos.current = []
    atual.current = null
    redesenhar()
    onChange('')
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={inicio} onMouseMove={mover} onMouseUp={fim} onMouseLeave={fim}
        onTouchStart={inicio} onTouchMove={mover} onTouchEnd={fim}
        style={{
          width: '100%', height: 180, display: 'block',
          background: T.white, border: `1.5px dashed ${T.line}`,
          borderRadius: T.rInput, cursor: disabled ? 'not-allowed' : 'crosshair',
          touchAction: 'none',   // sem isso o dedo rola a página em vez de desenhar
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
        <span style={{ fontSize: 11.5, color: T.muted }}>Assine acima com o dedo ou o mouse</span>
        <button
          type="button" onClick={limpar} disabled={disabled}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: T.ui, fontSize: 12.5, fontWeight: 600, color: T.muted, padding: 4,
          }}
        >
          <Eraser size={13} /> Limpar
        </button>
      </div>
    </div>
  )
}

function Moldura({ children }) {
  return (
    <div style={{
      minHeight: '100dvh', background: T.bg, fontFamily: T.ui,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 20 }}>
          <svg width="26" height="26" viewBox="18 21 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="55" width="60" height="28" rx="14" fill="#5E2BD0" />
            <circle cx="40" cy="37" r="14" fill="#341780" />
            <circle cx="64" cy="39" r="14" fill="#FF6F5E" />
          </svg>
          <span style={{ fontFamily: T.brand, fontSize: 19, fontWeight: 700, color: T.ink }}>junttos</span>
        </div>
        {children}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Cartao({ children, style }) {
  return (
    <div style={{
      background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard,
      boxShadow: T.cardShadow, padding: '24px 22px', ...style,
    }}>{children}</div>
  )
}

export default function AssinaturaContrato() {
  const { token } = useParams()
  const [estado, setEstado]     = useState('carregando') // carregando | pendente | assinado | invalido
  const [contrato, setContrato] = useState(null)
  const [svg, setSvg]           = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro]         = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.functions
      .invoke('gerar-contrato', { body: { action: 'publico-obter', token } })
    // Erro de rede e token recusado caem no mesmo lugar: a tela não distingue
    // motivo, e a function também não.
    if (error || data?.error || !data?.estado) { setEstado('invalido'); return }
    setContrato(data.contrato || null)
    setEstado(data.estado)
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  async function handleAssinar() {
    if (!svg || enviando) return
    setEnviando(true); setErro('')
    const { data, error } = await supabase.functions
      .invoke('gerar-contrato', { body: { action: 'publico-assinar', token, assinatura_svg: svg } })
    const msg = error?.message || data?.error
    if (msg) { setErro(msg); setEnviando(false); return }
    await carregar()
    setEnviando(false)
  }

  if (estado === 'carregando') {
    return (
      <Moldura>
        <Cartao>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 14 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Carregando contrato...
          </div>
        </Cartao>
      </Moldura>
    )
  }

  if (estado === 'invalido') {
    return (
      <Moldura>
        <Cartao>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <AlertCircle size={18} color={T.coralText} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 6 }}>
                Link inválido ou expirado
              </p>
              <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>
                Este link de assinatura não está mais disponível. Fale com a Junttos para receber um novo.
              </p>
            </div>
          </div>
        </Cartao>
      </Moldura>
    )
  }

  if (estado === 'assinado') {
    return (
      <Moldura>
        <Cartao>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: T.statusAtivoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Check size={18} color={T.statusAtivoTx} strokeWidth={2.5} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 6 }}>
                Contrato assinado
              </p>
              <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>
                {contrato?.razao_social ? <>Assinado por <strong style={{ color: T.ink }}>{contrato.razao_social}</strong>{' '}</> : null}
                em {fmtDataHora(contrato?.assinado_em)}. Guarde este comprovante — a Junttos também tem uma cópia.
              </p>
            </div>
          </div>
        </Cartao>
      </Moldura>
    )
  }

  // ── pendente ──
  const planoLabel = PLANOS[contrato?.plano]?.label || contrato?.plano || '—'

  return (
    <Moldura>
      <Cartao style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
          Contrato de prestação de serviços
        </p>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.3 }}>
          {contrato?.razao_social || 'Contratante'}
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 18 }}>
          {[
            ['CPF / CNPJ', contrato?.cpf_cnpj, true],
            ['Responsável', contrato?.responsavel_nome, false],
            ['Sistema', nomeModulo(contrato?.segmento), false],
            ['Plano', planoLabel, false],
            ['Mensalidade', contrato?.valor_mensal != null ? `R$ ${fmtValorPlano(contrato.valor_mensal)}` : '—', false],
            ['Início', fmtData(contrato?.contrato_inicio), false],
            ['Vencimento', contrato?.vencimento_dia ? `Todo dia ${contrato.vencimento_dia}` : '—', false],
          ].map(([label, valor, mono]) => (
            <div key={label} style={{ minWidth: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</p>
              <p style={{ fontSize: 13.5, color: T.ink, fontFamily: mono ? T.mono : T.ui, wordBreak: 'break-word' }}>{valor || '—'}</p>
            </div>
          ))}
        </div>

        {contrato?.pdf_url && (
          <a
            href={contrato.pdf_url} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 44, padding: '0 18px', borderRadius: T.rInput,
              border: `1.5px solid ${T.purple}`, background: T.tintPurple,
              color: T.purpleText, textDecoration: 'none', fontSize: 14, fontWeight: 700,
            }}
          >
            <FileText size={15} /> Ler o contrato completo
          </a>
        )}
      </Cartao>

      <Cartao>
        <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Assinatura</p>
        <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, marginBottom: 14 }}>
          Ao assinar, você declara que leu e concorda com os termos do contrato acima.
        </p>

        <CanvasAssinatura onChange={setSvg} disabled={enviando} />

        {erro && (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '11px 13px', marginTop: 14 }}>
            <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: T.coralText, lineHeight: 1.5 }}>{erro}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleAssinar}
          disabled={!svg || enviando}
          style={{
            width: '100%', height: 50, marginTop: 16, borderRadius: T.rCard, border: 'none',
            background: !svg || enviando ? T.mist : T.coral,
            color: !svg || enviando ? T.muted : T.white,
            cursor: !svg || enviando ? 'not-allowed' : 'pointer',
            fontFamily: T.ui, fontSize: 15, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: !svg || enviando ? 'none' : '0 4px 16px rgba(255,111,94,0.32)',
          }}
        >
          {enviando
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Registrando...</>
            : <><Check size={16} /> Assinar contrato</>}
        </button>

        <p style={{ fontSize: 11, color: T.muted2, lineHeight: 1.6, marginTop: 12, textAlign: 'center' }}>
          Assinatura eletrônica simples, nos termos da MP 2.200-2/2001. Data, hora e
          endereço de IP são registrados junto com o aceite.
        </p>
      </Cartao>
    </Moldura>
  )
}
