import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, Check, Plus, Minus, Trash2, Smartphone, CreditCard, DollarSign, Receipt } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { precoEfetivo } from '../../utils/precosFaixas'

const GREEN = '#17864F'
const DARK  = '#0C3A24'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function TagAtacado() {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, color: GREEN, background: '#E8F5EE',
      borderRadius: 999, padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap',
    }}>atacado</span>
  )
}

function StepPills({ step }) {
  const labels = ['Produtos', 'Pagamento', 'Recibo']
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {labels.map((label, i) => (
        <div key={i} style={{
          flex: 1, padding: '8px 0', borderRadius: 999, textAlign: 'center',
          background: i === step ? '#FFFFFF' : 'rgba(255,255,255,.22)',
          fontSize: 13, fontWeight: 800,
          color: i === step ? GREEN : '#FFFFFF',
        }}>
          {i + 1} {label}
        </div>
      ))}
    </div>
  )
}

const PGTO_ICONS = { Dinheiro: DollarSign, Pix: Smartphone, Cartão: CreditCard, Fiado: Receipt }

export default function NovaVenda({ produtosData = [], addVenda, buscarPorEan, vendas = [], precosFaixas = [], fetchAll, config = {}, setTab }) {
  const [cart, setCart]           = useState([])
  const [step, setStep]           = useState(0)    // 0=bipar 1=pagamento 2=recibo
  const [pgto, setPgto]           = useState('Dinheiro')
  const [cedula, setCedula]       = useState(null)  // bill amount selected
  const [cedOutro, setCedOutro]   = useState('')
  const [cedOutroMode, setCedOutroMode] = useState(false)
  const [digitarMode, setDigitarMode]   = useState(false)
  const [busca, setBusca]         = useState('')
  const [resultados, setResultados] = useState([])
  const [permErr, setPermErr]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  const [eanNotFound, setEanNotFound] = useState('')

  const videoRef         = useRef(null)
  const controlsRef      = useRef(null)
  const lastDetectedRef  = useRef(0)
  const handleEanRef     = useRef()

  // Preço de cada item já considerando a faixa de atacado aplicável (se houver).
  const cartPrecificado = cart.map(i => ({ ...i, ...precoEfetivo(i, precosFaixas) }))
  const total  = cartPrecificado.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const bill1  = Math.max(Math.ceil(total / 10) * 10, 10)
  const BILLS  = [10, 20, 50, 100, 200]
  const bill2  = BILLS.find(c => c > bill1) || 200
  const troco  = cedula !== null && cedula >= total ? cedula - total : 0

  // ── Camera lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 0) {
      controlsRef.current?.stop()
      return
    }
    if (!videoRef.current) return

    const reader = new BrowserMultiFormatReader()
    reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      videoRef.current,
      (result) => {
        if (!result) return
        const now = Date.now()
        if (now - lastDetectedRef.current < 2000) return
        lastDetectedRef.current = now
        handleEanRef.current(result.getText())
      }
    ).then(c => { controlsRef.current = c })
     .catch(e => {
       if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') setPermErr(true)
     })

    return () => { controlsRef.current?.stop() }
  }, [step])

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleEanDetected(ean) {
    if (!ean?.trim()) return
    setEanNotFound('')
    const prod = await buscarPorEan(ean.trim())
    if (prod) addToCart(prod)
    else setEanNotFound(`EAN ${ean} não encontrado. Cadastre antes de vender.`)
  }
  handleEanRef.current = handleEanDetected

  function addToCart(prod) {
    setErr(''); setEanNotFound(''); setBusca(''); setResultados([])
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === prod.id)
      if (idx >= 0)
        return prev.map((i, n) => n === idx ? { ...i, quantidade: i.quantidade + 1, addedAt: Date.now() } : i)
      return [...prev, { id: prod.id, nome: prod.nome, preco_venda: Number(prod.preco_venda) || 0, quantidade: 1, addedAt: Date.now() }]
    })
  }

  function setQtd(id, delta) {
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, quantidade: Math.max(0, i.quantidade + delta) } : i)
      .filter(i => i.quantidade > 0)
    )
  }

  function removeItem(id) { setCart(prev => prev.filter(i => i.id !== id)) }

  async function handleBusca(val) {
    setBusca(val)
    if (!val.trim()) { setResultados([]); return }
    if (/^\d{8,}$/.test(val.trim())) {
      const prod = await buscarPorEan(val.trim())
      if (prod) { addToCart(prod); return }
    }
    const q = val.toLowerCase()
    setResultados(produtosData.filter(p => p.nome?.toLowerCase().includes(q)).slice(0, 6))
  }

  async function handleSave() {
    if (cart.length === 0) { setErr('Adicione ao menos um produto ao carrinho.'); return }
    setErr('')
    setSaving(true)
    const { error: saveErr, venda: novaVenda } = await addVenda({
      valor: total,
      ajuste_valor: 0,
      forma_pgto: JSON.stringify([{ forma: pgto, valor: total }]),
      produtos: cart.map(i => ({ nome: i.nome, quantidade: i.quantidade })),
      obs: pgto === 'Fiado' ? 'Fiado' : null,
      data: new Date().toISOString(),
    })
    setSaving(false)
    if (saveErr?.code === 'BAL_TRAVA') { setErr('Caixa travado. Feche o caixa para registrar vendas.'); return }
    if (saveErr) { setErr('Erro ao salvar: ' + (saveErr.message || JSON.stringify(saveErr))); return }
    fetchAll?.()
    setStep(2)
  }

  function reset() {
    setCart([]); setStep(0); setPgto('Dinheiro'); setCedula(null)
    setCedOutro(''); setCedOutroMode(false); setDigitarMode(false)
    setBusca(''); setResultados([]); setErr(''); setEanNotFound(''); setPermErr(false)
  }

  const recentItems = [...cartPrecificado].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 2)

  // ── T4 RECIBO ──────────────────────────────────────────────────────────────
  if (step === 2) {
    const nomeLoja = config?.nome || 'Mercado'
    const now = new Date()
    const dataStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    function handleWhatsApp() {
      const lines = [
        `*Recibo · ${nomeLoja}*`,
        `Data: ${dataStr}`,
        `_______________________`,
        ...cartPrecificado.map(i => i.comDesconto
          ? `${i.nome}   ${i.quantidade}×  ~${fmtR(i.preco_venda)}~ ${fmtR(i.preco)} (atacado)`
          : `${i.nome}   ${i.quantidade}×  ${fmtR(i.preco)}`),
        `_______________________`,
        `Total:  *${fmtR(total)}*`,
        troco > 0 ? `Troco: ${fmtR(troco)}` : '',
      ].filter(Boolean).join('\n')
      window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank')
    }

    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
        {/* Header */}
        <div style={{ background: GREEN, padding: '22px 22px 28px', flexShrink: 0 }}>
          <StepPills step={2} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 22 }}>
            <div style={{
              width: 62, height: 62, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}>
              <Check size={30} color="#FFF" strokeWidth={2.5} />
            </div>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#FFF', margin: 0 }}>Pronto! Venda feita</p>
            {troco > 0 && (
              <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.85)', margin: '6px 0 0' }}>
                Devolva {fmtR(troco)} de troco
              </p>
            )}
          </div>
        </div>

        {/* Receipt card */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 0' }}>
          <div style={{ border: '2px dashed #D4D4D8', borderRadius: 20, padding: '20px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', margin: '0 0 4px' }}>
              RECIBO · NÃO FISCAL
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#3F3F46', textAlign: 'center', margin: '0 0 16px' }}>
              {nomeLoja} · {dataStr}
            </p>
            <div style={{ height: 1, background: '#E4E4E7', marginBottom: 14 }} />
            {cartPrecificado.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#18181B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</p>
                    {item.comDesconto && <TagAtacado />}
                  </div>
                  {item.comDesconto ? (
                    <p style={{ fontSize: 13, color: '#71717A', margin: 0 }}>
                      {item.quantidade}× <span style={{ textDecoration: 'line-through' }}>{fmtR(item.preco_venda)}</span>{' '}
                      <span style={{ color: GREEN, fontWeight: 700 }}>{fmtR(item.preco)}</span>
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, color: '#71717A', margin: 0 }}>{item.quantidade}×  {fmtR(item.preco)}</p>
                  )}
                </div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: '#18181B', flexShrink: 0, marginLeft: 12, margin: 0 }}>
                  {fmtR(item.preco * item.quantidade)}
                </p>
              </div>
            ))}
            <div style={{ height: 1, background: '#E4E4E7', margin: '14px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#18181B', margin: 0 }}>Total</p>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: '#18181B', margin: 0 }}>{fmtR(total)}</p>
            </div>
            {troco > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#71717A', margin: 0 }}>Troco</p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 17, fontWeight: 700, color: '#71717A', margin: 0 }}>{fmtR(troco)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleWhatsApp}
            style={{
              width: '100%', height: 62, borderRadius: 18, border: 'none', minHeight: 56,
              background: '#25D366', color: '#FFF', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontSize: 18, fontWeight: 800,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 32 32" fill="#FFF" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 3C8.832 3 3 8.832 3 16c0 2.34.637 4.528 1.744 6.42L3 29l6.8-1.736A12.93 12.93 0 0016 29c7.168 0 13-5.832 13-13S23.168 3 16 3z"/>
              <path fill="#25D366" d="M21.7 19.3c-.3-.15-1.8-.89-2.08-.99-.28-.1-.48-.15-.69.15-.2.3-.79.99-.97 1.2-.18.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.69-1.66-.94-2.27-.25-.6-.5-.52-.69-.52-.18-.01-.38-.01-.58-.01-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/>
            </svg>
            Mandar no WhatsApp
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setTab('inicio')} style={{
              flex: 1, height: 56, borderRadius: 16, border: 'none', minHeight: 56,
              background: '#F4F4F7', color: '#3F3F46', cursor: 'pointer',
              fontSize: 16, fontWeight: 800,
            }}>Voltar ao menu</button>
            <button onClick={reset} style={{
              flex: 1, height: 56, borderRadius: 16, border: 'none', minHeight: 56,
              background: GREEN, color: '#FFF', cursor: 'pointer',
              fontSize: 16, fontWeight: 800,
            }}>Nova venda</button>
          </div>
        </div>
      </div>
    )
  }

  // ── T3 PAGAMENTO ───────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
        {/* Header */}
        <div style={{ background: GREEN, padding: '14px 22px 24px', flexShrink: 0 }}>
          <button onClick={() => setStep(0)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            marginBottom: 14, padding: 0,
          }}>
            <ChevronLeft size={24} color="#FFF" strokeWidth={2.5} />
            <span style={{ fontSize: 17, fontWeight: 800, color: '#FFF' }}>Voltar</span>
          </button>
          <StepPills step={1} />
          <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.85)', margin: '14px 0 4px' }}>
            Passo 2 · como o cliente vai pagar
          </p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 56, fontWeight: 700, color: '#FFF', margin: 0, lineHeight: 1 }}>
            {fmtR(total)}
          </p>
        </div>

        {/* Payment options */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {['Dinheiro', 'Pix', 'Cartão', 'Fiado'].map(p => {
            const IconComp = PGTO_ICONS[p] || DollarSign
            const selected = pgto === p
            return (
              <button
                key={p}
                onClick={() => { setPgto(p); setCedula(null); setCedOutro(''); setCedOutroMode(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 18,
                  width: '100%', padding: '0 22px', height: 78, border: 'none',
                  background: selected ? '#E8F5EE' : '#FFF',
                  borderBottom: '1px solid #F4F4F7', cursor: 'pointer',
                  boxShadow: selected ? `inset 0 0 0 3px ${GREEN}` : 'none',
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                  background: selected ? GREEN : '#F4F4F7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconComp size={22} color={selected ? '#FFF' : '#71717A'} strokeWidth={2} />
                </div>
                <span style={{ flex: 1, fontSize: 18, fontWeight: 800, color: '#18181B', textAlign: 'left' }}>
                  {p === 'Fiado' ? 'Fiado (anotar)' : p}
                </span>
                {selected && <Check size={26} color={GREEN} strokeWidth={2.5} />}
              </button>
            )
          })}

          {/* Troco block */}
          {pgto === 'Dinheiro' && (
            <div style={{ padding: '20px 22px', background: '#F9F9F9', borderBottom: '1px solid #F4F4F7' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#3F3F46', margin: '0 0 12px' }}>
                Quanto o cliente deu?
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[bill1, bill2].map(b => (
                  <button
                    key={b}
                    onClick={() => { setCedula(b); setCedOutroMode(false); setCedOutro('') }}
                    style={{
                      flex: 1, height: 56, borderRadius: 16, border: 'none', minHeight: 56,
                      background: cedula === b ? GREEN : '#F4F4F7',
                      color: cedula === b ? '#FFF' : '#3F3F46',
                      cursor: 'pointer', fontSize: 17, fontWeight: 800,
                    }}
                  >
                    {fmtR(b)}
                  </button>
                ))}
                <button
                  onClick={() => { setCedOutroMode(m => !m); setCedula(null) }}
                  style={{
                    flex: 1, height: 56, borderRadius: 16, border: 'none', minHeight: 56,
                    background: cedOutroMode ? '#3A3A44' : '#F4F4F7',
                    color: cedOutroMode ? '#FFF' : '#3F3F46',
                    cursor: 'pointer', fontSize: 17, fontWeight: 800,
                  }}
                >Outro</button>
              </div>
              {cedOutroMode && (
                <input
                  style={{
                    width: '100%', height: 56, borderRadius: 16, border: `2px solid ${GREEN}`,
                    padding: '0 16px', fontSize: 22, fontWeight: 700, color: '#18181B',
                    background: '#FFF', outline: 'none', boxSizing: 'border-box',
                    fontFamily: "'Space Mono', monospace", marginBottom: 10,
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                  autoFocus
                  value={cedOutro}
                  onChange={e => {
                    setCedOutro(e.target.value)
                    const v = parseFloat(e.target.value.replace(',', '.'))
                    setCedula(isNaN(v) ? null : v)
                  }}
                />
              )}
              {cedula !== null && cedula >= total && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 0' }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#3F3F46', margin: 0 }}>Troco</p>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: GREEN, margin: 0 }}>{fmtR(troco)}</p>
                </div>
              )}
              {cedula !== null && cedula < total && (
                <p style={{ fontSize: 14, color: '#EF4444', fontWeight: 600, margin: '8px 0 0' }}>
                  Valor insuficiente para cobrir o total.
                </p>
              )}
            </div>
          )}

          {pgto === 'Fiado' && (
            <div style={{ padding: '16px 22px', background: '#FFFBEB' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#D97706', margin: 0 }}>
                Fiado: a venda será registrada sem baixa financeira.
              </p>
            </div>
          )}

          {err && (
            <div style={{ padding: '16px 22px' }}>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#DC2626', fontWeight: 600 }}>
                {err}
              </div>
            </div>
          )}
        </div>

        {/* Confirm button */}
        <div style={{ padding: '14px 22px 28px', flexShrink: 0 }}>
          <button
            onClick={handleSave}
            disabled={saving || (pgto === 'Dinheiro' && cedula !== null && cedula < total)}
            style={{
              width: '100%', height: 72, borderRadius: 20, border: 'none', minHeight: 56,
              background: saving ? '#A9DCC2' : GREEN,
              color: '#FFF', cursor: saving ? 'default' : 'pointer',
              fontSize: 18, fontWeight: 800,
            }}
          >
            {saving ? 'Salvando...' : 'Confirmar venda'}
          </button>
        </div>
      </div>
    )
  }

  // ── T2 BIPAR ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: DARK }}>
      <style>{`
        @keyframes scanpulse {
          0%, 100% { top: 38%; opacity: .9; }
          50%       { top: 56%; opacity: .55; }
        }
      `}</style>

      {/* Module header */}
      <div style={{ background: GREEN, padding: '14px 22px 20px', flexShrink: 0 }}>
        <button onClick={() => setTab('inicio')} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          marginBottom: 14, padding: 0,
        }}>
          <ChevronLeft size={24} color="#FFF" strokeWidth={2.5} />
          <span style={{ fontSize: 17, fontWeight: 800, color: '#FFF' }}>Menu</span>
        </button>
        <StepPills step={0} />
      </div>

      {/* Camera area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 22px 16px', minHeight: 0 }}>
        {permErr ? (
          <div style={{ textAlign: 'center', padding: '0 20px' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#7BE8AE', marginBottom: 8 }}>Câmera bloqueada</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', marginBottom: 24 }}>
              Ative o acesso à câmera nas configurações do navegador.
            </p>
            <button onClick={() => setDigitarMode(true)} style={{
              padding: '14px 28px', borderRadius: 16, border: 'none',
              background: GREEN, color: '#FFF', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>Digitar EAN</button>
          </div>
        ) : (
          <>
            <p style={{ color: '#A9DCC2', fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
              Aponte para o código de barras
            </p>
            <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
              <video
                ref={videoRef}
                style={{ width: '100%', borderRadius: 18, display: 'block', background: DARK, aspectRatio: '4/3' }}
                muted playsInline
              />
              {/* Aim frame */}
              <div style={{
                position: 'absolute', top: '18%', left: '8%', right: '8%', bottom: '18%',
                border: '3px dashed rgba(255,255,255,.38)', borderRadius: 14,
                pointerEvents: 'none',
              }} />
              {/* Scan line */}
              <div style={{
                position: 'absolute', left: '10%', right: '10%', height: 4,
                background: '#7BE8AE', borderRadius: 2,
                boxShadow: '0 0 22px 5px rgba(123,232,174,.6)',
                animation: 'scanpulse 2.2s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            </div>
            {eanNotFound && (
              <p style={{ color: '#F87171', fontSize: 14, fontWeight: 700, marginTop: 14, textAlign: 'center' }}>
                {eanNotFound}
              </p>
            )}
          </>
        )}
      </div>

      {/* White drawer */}
      <div style={{ background: '#FFF', borderRadius: '28px 28px 0 0', padding: '20px 22px 28px', flexShrink: 0 }}>
        {/* Cart header */}
        <p style={{ fontSize: 18, fontWeight: 800, color: '#18181B', margin: '0 0 12px' }}>
          {cart.length} produto{cart.length !== 1 ? 's' : ''} na conta
        </p>

        {/* Recent items */}
        {recentItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {recentItems.map((item, i) => (
              <div key={item.id} style={{
                background: '#F4F4F7', borderRadius: 16, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: i === 0 ? GREEN : '#D4D4DA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={18} color="#FFF" strokeWidth={2.5} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#18181B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</p>
                    {item.comDesconto && <TagAtacado />}
                  </div>
                  {item.comDesconto ? (
                    <p style={{ fontSize: 13, color: '#71717A', margin: 0 }}>
                      {item.quantidade}× <span style={{ textDecoration: 'line-through' }}>{fmtR(item.preco_venda)}</span>{' '}
                      <span style={{ color: GREEN, fontWeight: 700 }}>{fmtR(item.preco)}</span>
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, color: '#71717A', margin: 0 }}>
                      {item.quantidade} unidade{item.quantidade !== 1 ? 's' : ''} · {i === 0 ? 'acabou de entrar' : 'na conta'}
                    </p>
                  )}
                </div>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: '#18181B', margin: 0, flexShrink: 0 }}>
                  {fmtR(item.preco * item.quantidade)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Digitar / busca */}
        {digitarMode && (
          <div style={{ marginBottom: 10 }}>
            <input
              style={{
                width: '100%', height: 52, borderRadius: 16, border: `2px solid ${GREEN}`,
                padding: '0 16px', fontSize: 16, fontWeight: 700,
                color: '#18181B', background: '#FFF', outline: 'none', boxSizing: 'border-box',
              }}
              placeholder="EAN ou nome do produto"
              value={busca}
              onChange={e => handleBusca(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Search dropdown */}
        {resultados.length > 0 && (
          <div style={{ border: '1px solid #E4E4E7', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
            {resultados.map((p, i) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '12px 14px', border: 'none', background: '#FFF',
                  borderTop: i > 0 ? '1px solid #F4F4F7' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>{p.nome}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: GREEN, fontWeight: 700, flexShrink: 0 }}>
                  {fmtR(p.preco_venda)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { setDigitarMode(d => !d); setBusca(''); setResultados([]) }}
            style={{
              width: 118, height: 72, borderRadius: 18, border: 'none', minHeight: 56,
              background: digitarMode ? '#18181B' : '#F4F4F7',
              color: digitarMode ? '#FFF' : '#3F3F46',
              cursor: 'pointer', fontSize: 14, fontWeight: 800, lineHeight: 1.3,
            }}
          >
            {digitarMode ? 'Usar câmera' : 'Digitar código'}
          </button>
          <button
            onClick={() => cart.length > 0 && setStep(1)}
            disabled={cart.length === 0}
            style={{
              flex: 1, height: 72, borderRadius: 18, border: 'none', minHeight: 56,
              background: cart.length === 0 ? '#A9DCC2' : GREEN,
              color: '#FFF', cursor: cart.length === 0 ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>Ir para o pagamento</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{fmtR(total)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
