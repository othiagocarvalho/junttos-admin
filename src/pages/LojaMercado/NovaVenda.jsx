import { useState } from 'react'
import { Camera, Check, Plus, Minus, Trash2, Search } from 'lucide-react'
import BarcodeScanner from '../../components/BarcodeScanner'
import ReciboVenda from '../../components/ReciboVenda'

const inp = {
  width: '100%', height: 48, border: '1.5px solid var(--line)', borderRadius: 12,
  padding: '0 14px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15,
  color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
}

const PGTOS = ['Dinheiro', 'Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Fiado']

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

export default function NovaVenda({ produtosData = [], addVenda, buscarPorEan, vendas = [], theme = {}, fetchAll }) {
  const [cart, setCart] = useState([]) // [{id, nome, preco_venda, quantidade}]
  const [pgto, setPgto] = useState('Pix')
  const [scanner, setScanner] = useState(false)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [savedVenda, setSavedVenda] = useState(null)
  const [reciboAberto, setReciboAberto] = useState(false)
  const [err, setErr] = useState('')

  const primary = theme.primary || '#5E2BD0'
  const total = cart.reduce((s, item) => s + item.preco_venda * item.quantidade, 0)

  // EAN scan → buscar produto
  async function handleEanDetected(ean) {
    setScanner(false)
    if (!ean?.trim()) return
    const prod = await buscarPorEan(ean.trim())
    if (prod) addToCart(prod)
    else setErr(`EAN ${ean} não encontrado. Cadastre o produto primeiro.`)
  }

  // Busca por nome (local) ou EAN (banco) quando dígitos ≥ 8
  async function handleBusca(val) {
    setBusca(val)
    if (!val.trim()) { setResultados([]); return }

    if (/^\d{8,}$/.test(val.trim())) {
      const prod = await buscarPorEan(val.trim())
      if (prod) { addToCart(prod); return }
    }

    const q = val.toLowerCase()
    setResultados(produtosData.filter(p => p.nome?.toLowerCase().includes(q)).slice(0, 8))
  }

  function addToCart(prod) {
    setErr('')
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === prod.id)
      if (idx >= 0) {
        return prev.map((i, n) => n === idx ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...prev, { id: prod.id, nome: prod.nome, preco_venda: Number(prod.preco_venda) || 0, quantidade: 1 }]
    })
    setBusca('')
    setResultados([])
  }

  function setQtd(id, delta) {
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, quantidade: Math.max(0, i.quantidade + delta) } : i)
      .filter(i => i.quantidade > 0)
    )
  }

  function removeItem(id) { setCart(prev => prev.filter(i => i.id !== id)) }

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
    if (saveErr?.code === 'BAL_TRAVA') {
      setErr('Caixa travado. Feche o caixa para registrar vendas.')
      return
    }
    if (saveErr) { setErr('Erro ao salvar: ' + (saveErr.message || JSON.stringify(saveErr))); return }
    setSavedVenda(novaVenda)
    setDone(true)
    fetchAll?.()
  }

  function reset() {
    setCart([]); setPgto('Pix'); setBusca(''); setResultados([])
    setDone(false); setSavedVenda(null); setReciboAberto(false); setErr('')
  }

  if (done) {
    return (
      <>
        <div style={{
          background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)',
          padding: '48px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={26} color="#fff" strokeWidth={2.5} />
          </div>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>Venda registrada!</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)' }}>{fmtR(total)} · {pgto}</p>
          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320, marginTop: 8 }}>
            <button
              onClick={() => setReciboAberto(true)}
              style={{ flex: 1, height: 44, borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}
            >
              Recibo
            </button>
            <button onClick={reset} style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: primary, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>
              Nova Venda
            </button>
          </div>
        </div>
        {reciboAberto && savedVenda && (
          <ReciboVenda venda={savedVenda} vendas={vendas} theme={theme} onFechar={() => setReciboAberto(false)} />
        )}
      </>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 18 }}>
          Nova Venda
        </p>

        {/* Busca por EAN ou nome */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              style={{ ...inp, paddingLeft: 38 }}
              placeholder="Buscar produto pelo nome..."
              value={busca}
              onChange={e => handleBusca(e.target.value)}
            />
          </div>
          <button
            onClick={() => setScanner(true)}
            title="Escanear EAN"
            style={{
              width: 48, height: 48, borderRadius: 12, border: '1.5px solid var(--line)',
              background: 'var(--surface)', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Camera size={18} color={primary} />
          </button>
        </div>

        {/* Resultados da busca */}
        {resultados.length > 0 && (
          <div style={{
            border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden',
            marginBottom: 12, background: 'var(--surface)',
          }}>
            {resultados.map((p, i) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '12px 14px', border: 'none', background: 'none',
                  borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)' }}>{p.nome}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: primary, fontWeight: 700, flexShrink: 0 }}>
                  {fmtR(p.preco_venda)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Carrinho */}
        {cart.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Carrinho
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cart.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--mist, #F8F7F5)', borderRadius: 12, padding: '10px 12px',
                }}>
                  <span style={{ flex: 1, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.nome}
                  </span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: primary, fontWeight: 700, flexShrink: 0 }}>
                    {fmtR(item.preco_venda * item.quantidade)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setQtd(item.id, -1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Minus size={12} color="var(--ink)" />
                    </button>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--ink)', minWidth: 18, textAlign: 'center' }}>{item.quantidade}</span>
                    <button onClick={() => setQtd(item.id, 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={12} color="var(--ink)" />
                    </button>
                    <button onClick={() => removeItem(item.id)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={13} color="#EF4444" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 4px 0' }}>
              <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Total</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(total)}</span>
            </div>
          </div>
        )}

        {/* Forma de pagamento */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Forma de pagamento
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PGTOS.map(p => (
              <button
                key={p}
                onClick={() => setPgto(p)}
                style={{
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
                  border: pgto === p ? 'none' : '1.5px solid var(--line)',
                  background: pgto === p ? primary : 'var(--surface)',
                  color: pgto === p ? '#fff' : 'var(--muted)',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          {pgto === 'Fiado' && (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: '#D97706', marginTop: 8 }}>
              Fiado: a venda será registrada sem baixa financeira.
            </p>
          )}
        </div>

        {err && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '10px 14px', marginBottom: 16,
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: '#DC2626',
          }}>
            {err}
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px 24px' }}>
        <button
          onClick={handleSave}
          disabled={saving || cart.length === 0}
          style={{
            width: '100%', height: 50, borderRadius: 14, border: 'none',
            background: saving || cart.length === 0 ? 'var(--line)' : primary,
            color: '#fff', cursor: saving || cart.length === 0 ? 'default' : 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700,
          }}
        >
          {saving ? 'Salvando...' : `Confirmar · ${fmtR(total)}`}
        </button>
      </div>

      {scanner && (
        <BarcodeScanner
          onDetected={handleEanDetected}
          onClose={() => setScanner(false)}
        />
      )}
    </div>
  )
}
