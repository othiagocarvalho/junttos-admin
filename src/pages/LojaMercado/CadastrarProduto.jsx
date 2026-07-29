import { useState } from 'react'
import { Camera, Check, X } from 'lucide-react'
import BarcodeScanner from '../../components/BarcodeScanner'

const inp = {
  width: '100%', height: 48, border: '1.5px solid var(--line)', borderRadius: 12,
  padding: '0 14px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15,
  color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
}

const EMPTY = { ean: '', nome: '', preco_venda: '', quantidade: '1' }

export default function CadastrarProduto({ addProduto, theme = {} }) {
  const [form, setForm] = useState(EMPTY)
  const [scanner, setScanner] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const primary = theme.primary || '#5E2BD0'

  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })) }

  async function handleSave() {
    if (!form.nome.trim()) { setErr('Informe o nome do produto.'); return }
    const preco = parseFloat(form.preco_venda.replace(',', '.')) || 0
    const qtd = parseInt(form.quantidade, 10) || 0
    if (preco <= 0) { setErr('Informe um preço de venda válido.'); return }
    if (qtd <= 0) { setErr('Informe a quantidade inicial.'); return }
    setErr('')
    setSaving(true)
    const { error } = await addProduto(form.nome.trim(), {
      ean: form.ean.trim() || null,
      preco_venda: preco,
      variacoes: [{ cor: 'Único', quantidade: qtd }],
    })
    setSaving(false)
    if (error) { setErr('Erro ao salvar: ' + (error.message || JSON.stringify(error))); return }
    setDone(true)
  }

  function reset() { setForm(EMPTY); setDone(false); setErr('') }

  if (done) {
    return (
      <div style={{
        background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)',
        padding: '48px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={26} color="#fff" strokeWidth={2.5} />
        </div>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Produto cadastrado!</p>
        <button onClick={reset} style={{
          height: 44, paddingInline: 32, borderRadius: 12, border: 'none',
          background: primary, color: '#fff', cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700,
        }}>Cadastrar outro</button>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>
          Novo Produto
        </p>

        {/* EAN */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Código de barras (EAN)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inp, flex: 1 }}
              placeholder="Ex: 7891000100103"
              value={form.ean}
              onChange={e => set('ean', e.target.value)}
            />
            <button
              onClick={() => setScanner(true)}
              title="Escanear"
              style={{
                width: 48, height: 48, borderRadius: 12, border: '1.5px solid var(--line)',
                background: 'var(--surface)', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Camera size={18} color={primary} />
            </button>
          </div>
        </div>

        {/* Nome */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Nome do produto *
          </label>
          <input
            style={inp}
            placeholder="Ex: Arroz 5kg"
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
          />
        </div>

        {/* Preço */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Preço de venda (R$) *
          </label>
          <input
            style={inp}
            placeholder="0,00"
            inputMode="decimal"
            value={form.preco_venda}
            onChange={e => set('preco_venda', e.target.value)}
          />
        </div>

        {/* Quantidade */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Quantidade em estoque *
          </label>
          <input
            style={inp}
            placeholder="1"
            inputMode="numeric"
            value={form.quantidade}
            onChange={e => set('quantidade', e.target.value)}
          />
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
          disabled={saving}
          style={{
            width: '100%', height: 50, borderRadius: 14, border: 'none',
            background: saving ? 'var(--line)' : primary,
            color: '#fff', cursor: saving ? 'default' : 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700,
          }}
        >
          {saving ? 'Salvando...' : 'Salvar produto'}
        </button>
      </div>

      {scanner && (
        <BarcodeScanner
          onDetected={ean => { set('ean', ean); setScanner(false) }}
          onClose={() => setScanner(false)}
        />
      )}
    </div>
  )
}
