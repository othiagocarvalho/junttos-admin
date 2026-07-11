import { useState, useEffect } from 'react'
import { Plus, X, Receipt } from 'lucide-react'
import StatCard, { StatGrid } from '../../components/studio/StatCard'
import StatusPill from '../../components/studio/StatusPill'
import EmptyState from '../../components/studio/EmptyState'
import Button from '../../components/studio/Button'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

export default function Crediario({ crediario = [], addCrediario, pagarParcela, theme }) {
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!showModal) return
    function handleKey(e) { if (e.key === 'Escape') setShowModal(false) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showModal])
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
    display: 'block', fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700,
    color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5,
  }
  const inputStyle = {
    width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 'var(--r-input)',
    padding: '0 14px', fontFamily: 'var(--font-ui)', fontSize: 14,
    color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
  }
  const sectionLabelStyle = {
    fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
  }
  const canSubmit = !saving && form.cliente_nome.trim() && form.valor_total && form.parcelas

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>Crediário</p>
        <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)}>
          Nova venda fiada
        </Button>
      </div>

      {/* Summary cards */}
      <StatGrid>
        <StatCard
          label="Em aberto"
          value={fmtR(totalEmAberto)}
          sub={`${emAberto.length} cliente${emAberto.length !== 1 ? 's' : ''}`}
          style={{ borderLeft: '3px solid var(--negative)' }}
        />
        <StatCard
          label="Quitado (mês)"
          value={fmtR(totalQuitadoMes)}
          sub={`${quitados.length} total`}
          style={{ borderLeft: '3px solid var(--positive)' }}
        />
      </StatGrid>

      {/* Empty state */}
      {crediario.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)' }}>
          <EmptyState
            icon={Receipt}
            title="Nenhuma venda fiada"
            subtitle="Registre vendas a prazo e acompanhe as cobranças em um só lugar."
            actionLabel="Nova venda fiada"
            onAction={() => setShowModal(true)}
          />
        </div>
      )}

      {/* Em aberto */}
      {emAberto.length > 0 && (
        <div>
          <p style={sectionLabelStyle}>Em aberto</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {emAberto.map(c => (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow-card)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{c.cliente_nome}</p>
                    {c.cliente_telefone && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>{c.cliente_telefone}</p>}
                  </div>
                  <StatusPill tone="warn" label="Em aberto" style={{ flexShrink: 0 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(c.valor_total)}</p>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>{c.parcelas_pagas} de {c.parcelas} parcela{c.parcelas !== 1 ? 's' : ''} paga{c.parcelas_pagas !== 1 ? 's' : ''}</p>
                  </div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>
                    {new Date(c.data_compra + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button
                  fullWidth
                  onClick={() => handlePagar(c.id)}
                  disabled={pagandoId === c.id}
                >
                  {pagandoId === c.id ? 'Registrando...' : 'Registrar pagamento de parcela'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quitados */}
      {quitados.length > 0 && (
        <div>
          <p style={sectionLabelStyle}>Quitados</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quitados.map(c => (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: 16, opacity: 0.75 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{c.cliente_nome}</p>
                    {c.cliente_telefone && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>{c.cliente_telefone}</p>}
                  </div>
                  <StatusPill tone="ok" label="Quitado" style={{ flexShrink: 0 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(c.valor_total)}</p>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>
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
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Nova venda fiada</p>
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
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14, fontFamily: 'var(--font-ui)', pointerEvents: 'none' }}>R$</span>
                  <input value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, paddingLeft: 36 }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Número de parcelas *</label>
                <input type="number" min="1" value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))} style={inputStyle} />
              </div>
              {valorPreview > 0 && parcelasNum > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--r-input)', background: `color-mix(in srgb, ${theme.primary} 8%, white)`, border: `1px solid color-mix(in srgb, ${theme.primary} 20%, white)`, fontFamily: 'var(--font-ui)', fontSize: 13, color: theme.primary, fontWeight: 600 }}>
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
              <Button variant="secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                style={{ flex: 2 }}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {saving ? 'Salvando...' : 'Registrar venda fiada'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
