import { useState } from 'react'
import { Plus, X, Receipt } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

export default function Crediario({ crediario = [], addCrediario, pagarParcela, theme }) {
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pagandoId, setPagandoId] = useState(null)
  const [form, setForm] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    valor_total: '',
    parcelas: '1',
    data_compra: new Date().toISOString().slice(0, 10),
    observacoes: '',
  })

  const emAberto = crediario.filter(c => c.status === 'aberto')
  const quitados = crediario.filter(c => c.status === 'quitado')

  const now = new Date()
  const mesAtual = now.toISOString().slice(0, 7)
  const totalQuitadoMes = quitados
    .filter(c => (c.data_compra || '').slice(0, 7) === mesAtual)
    .reduce((s, c) => s + Number(c.valor_total), 0)

  const totalEmAberto = emAberto.reduce((s, c) => {
    const pago = Number(c.parcelas_pagas) * Number(c.valor_parcela)
    return s + (Number(c.valor_total) - pago)
  }, 0)

  const valorPreview = parseFloat((form.valor_total || '0').replace(',', '.')) || 0
  const parcelasNum = parseInt(form.parcelas || '1') || 1

  async function handleSubmit() {
    if (!form.cliente_nome.trim() || !form.valor_total || !form.parcelas) return
    setSaving(true)
    try {
      await addCrediario(form)
      setForm({ cliente_nome: '', cliente_telefone: '', valor_total: '', parcelas: '1', data_compra: new Date().toISOString().slice(0, 10), observacoes: '' })
      setShowModal(false)
    } catch (e) {
      alert('Erro ao salvar: ' + e.message)
    }
    setSaving(false)
  }

  async function handlePagar(id) {
    setPagandoId(id)
    try { await pagarParcela(id) } catch (e) { alert('Erro: ' + e.message) }
    setPagandoId(null)
  }

  const labelStyle = {
    display: 'block', fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700,
    color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5,
  }
  const inputStyle = {
    width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 12,
    padding: '0 14px', fontFamily: 'Manrope, sans-serif', fontSize: 14,
    color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
  }
  const canSubmit = !saving && form.cliente_nome.trim() && form.valor_total && form.parcelas

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Crediário</p>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            borderRadius: 12, border: 'none', background: theme.primary, cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff',
          }}
        >
          <Plus size={14} /> Nova venda fiada
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 14px' }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Em aberto</p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#ef4444', lineHeight: 1 }}>{fmtR(totalEmAberto)}</p>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{emAberto.length} cliente{emAberto.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 14px' }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Quitado (mês)</p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#16a34a', lineHeight: 1 }}>{fmtR(totalQuitadoMes)}</p>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{quitados.length} total</p>
        </div>
      </div>

      {/* Empty state */}
      {crediario.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Receipt size={32} color="var(--line)" />
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>Nenhuma venda fiada registrada</p>
        </div>
      )}

      {/* Em aberto */}
      {emAberto.length > 0 && (
        <div>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Em aberto</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {emAberto.map(c => (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{c.cliente_nome}</p>
                    {c.cliente_telefone && <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{c.cliente_telefone}</p>}
                  </div>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontFamily: 'Manrope, sans-serif', fontWeight: 700, flexShrink: 0 }}>Em aberto</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(c.valor_total)}</p>
                    <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{c.parcelas_pagas} de {c.parcelas} parcela{c.parcelas !== 1 ? 's' : ''} paga{c.parcelas_pagas !== 1 ? 's' : ''}</p>
                  </div>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
                    {new Date(c.data_compra + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={() => handlePagar(c.id)}
                  disabled={pagandoId === c.id}
                  style={{
                    width: '100%', height: 40, borderRadius: 10, border: 'none',
                    background: pagandoId === c.id ? 'var(--line)' : theme.primary,
                    color: '#fff', cursor: pagandoId === c.id ? 'not-allowed' : 'pointer',
                    fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700,
                  }}
                >
                  {pagandoId === c.id ? 'Registrando...' : 'Registrar pagamento de parcela'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quitados */}
      {quitados.length > 0 && (
        <div>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Quitados</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quitados.map(c => (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px', opacity: 0.75 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{c.cliente_nome}</p>
                    {c.cliente_telefone && <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{c.cliente_telefone}</p>}
                  </div>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: 'rgba(22,163,74,0.1)', color: '#16a34a', fontFamily: 'Manrope, sans-serif', fontWeight: 700, flexShrink: 0 }}>Quitado</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(c.valor_total)}</p>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
                    {c.parcelas} parcela{c.parcelas !== 1 ? 's' : ''} · {new Date(c.data_compra + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Nova Venda Fiada */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Nova venda fiada</p>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome do cliente *</label>
                <input value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} placeholder="Maria Silva" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input value={form.cliente_telefone} onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))} placeholder="(85) 99999-0000" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Valor total *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14, fontFamily: 'Manrope, sans-serif', pointerEvents: 'none' }}>R$</span>
                  <input value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, paddingLeft: 36 }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Número de parcelas *</label>
                <input type="number" min="1" value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))} style={inputStyle} />
              </div>
              {valorPreview > 0 && parcelasNum > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(107,79,187,0.06)', border: '1px solid rgba(107,79,187,0.15)', fontFamily: 'Manrope, sans-serif', fontSize: 13, color: '#6B4FBB', fontWeight: 600 }}>
                  {parcelasNum}× de {fmtR(valorPreview / parcelasNum)}
                </div>
              )}
              <div>
                <label style={labelStyle}>Data da compra</label>
                <input type="date" value={form.data_compra} onChange={e => setForm(f => ({ ...f, data_compra: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Anotações..." style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, height: 48, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  flex: 2, height: 48, borderRadius: 12, border: 'none',
                  background: canSubmit ? theme.primary : 'var(--line)',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14,
                }}
              >
                {saving ? 'Salvando...' : 'Registrar venda fiada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
