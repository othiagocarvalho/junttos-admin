import { useState } from 'react'
import { Search, Plus, X, ChevronDown, ChevronRight, Package } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

const BADGE = {
  critico: { label: 'Crítico',  bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  atencao: { label: 'Atenção',  bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
}

const labelStyle = {
  display: 'block', fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700,
  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6,
}

const inputStyle = {
  width: '100%', height: 46, border: '1.5px solid var(--line)', borderRadius: 12,
  padding: '0 14px', fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 600,
  color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box',
}

function statusOf(qty) {
  const q = Number(qty || 0)
  if (q <= 2) return 'critico'
  if (q <= 5) return 'atencao'
  return null
}

function productStatus(items) {
  if (items.some(i => statusOf(i.quantidade) === 'critico')) return 'critico'
  if (items.some(i => statusOf(i.quantidade) === 'atencao')) return 'atencao'
  return null
}

export default function EstoqueMobile({ estoque = [], addEstoqueItem, updateEstoqueItem, deleteEstoqueItem, theme }) {
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState({})
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState({ cor: '', quantidade: '0', custo: '' })
  const [saving, setSaving]     = useState(false)

  const allNames = [...new Set(estoque.map(i => i.produto))].sort()
  const filteredNames = allNames.filter(n => n.toLowerCase().includes(search.toLowerCase()))
  const grouped = name => estoque.filter(i => i.produto === name)

  const totalCusto = estoque.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.custo || 0), 0)
  const totalPecas = estoque.reduce((s, i) => s + Number(i.quantidade || 0), 0)

  function toggleExpand(name) {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function openAdd(produto) {
    setForm({ cor: '', quantidade: '0', custo: '' })
    setModal({ mode: 'add', produto })
  }

  function openEdit(item) {
    setForm({ cor: item.cor, quantidade: String(item.quantidade), custo: item.custo ? String(item.custo) : '' })
    setModal({ mode: 'edit', produto: item.produto, item })
  }

  async function handleSave() {
    if (!form.cor.trim()) return
    setSaving(true)
    const payload = {
      produto: modal.produto,
      cor: form.cor.trim(),
      quantidade: parseInt(form.quantidade) || 0,
      custo: parseFloat((form.custo || '').replace(',', '.')) || 0,
    }
    if (modal.mode === 'add') {
      await addEstoqueItem(payload)
    } else {
      await updateEstoqueItem(modal.item.id, payload)
    }
    setSaving(false)
    setModal(null)
  }

  async function handleDelete() {
    setSaving(true)
    await deleteEstoqueItem(modal.item.id)
    setSaving(false)
    setModal(null)
  }

  const canSave = form.cor.trim() && !saving

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>

      {/* Custo total */}
      <div style={{
        background: theme.primary, borderRadius: 16, padding: '22px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
            Custo Total do Estoque
          </p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            {fmtR(totalCusto)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{totalPecas}</p>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>peças</p>
        </div>
      </div>

      {/* Busca */}
      <div style={{ position: 'relative' }}>
        <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar produto..."
          style={{
            width: '100%', height: 46, border: '1.5px solid var(--line)', borderRadius: 14,
            padding: '0 14px 0 40px', fontFamily: 'Manrope, sans-serif', fontSize: 14,
            color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Lista de produtos */}
      {filteredNames.length === 0 ? (
        <div style={{
          background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)',
          padding: '48px 24px', textAlign: 'center',
        }}>
          <Package size={32} color="var(--line)" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)' }}>
            {search ? 'Nenhum produto encontrado.' : 'Nenhum item no estoque ainda.'}
          </p>
        </div>
      ) : (
        filteredNames.map(name => {
          const items  = grouped(name)
          const isOpen = !!expanded[name]
          const total  = items.reduce((s, i) => s + Number(i.quantidade || 0), 0)
          const ps     = productStatus(items)

          return (
            <div key={name} style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden' }}>

              {/* Cabeçalho colapsável */}
              <button
                onClick={() => toggleExpand(name)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{name}</span>
                    {ps && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: BADGE[ps].bg, color: BADGE[ps].color, border: `1px solid ${BADGE[ps].border}`,
                        fontFamily: 'Manrope, sans-serif',
                      }}>{BADGE[ps].label}</span>
                    )}
                  </div>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                    {items.length} variação{items.length !== 1 ? 'ões' : ''} · {total} peça{total !== 1 ? 's' : ''}
                  </p>
                </div>
                {isOpen
                  ? <ChevronDown size={16} color="var(--muted)" />
                  : <ChevronRight size={16} color="var(--muted)" />
                }
              </button>

              {/* Variações expandidas */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--line)', padding: '12px 18px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map(item => {
                      const s = statusOf(item.quantidade)
                      return (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--line)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: item.custo > 0 ? 2 : 0 }}>
                              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.cor}</span>
                              {s && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                                  background: BADGE[s].bg, color: BADGE[s].color, border: `1px solid ${BADGE[s].border}`,
                                  fontFamily: 'Manrope, sans-serif',
                                }}>{BADGE[s].label}</span>
                              )}
                            </div>
                            {item.custo > 0 && (
                              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                                {fmtR(item.custo)} / peça
                              </p>
                            )}
                          </div>
                          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>
                            {item.quantidade}
                          </span>
                          <button
                            onClick={() => openEdit(item)}
                            style={{
                              background: 'none', border: '1px solid var(--line)', borderRadius: 8,
                              padding: '5px 11px', cursor: 'pointer',
                              fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--muted)',
                            }}
                          >
                            Editar
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => openAdd(name)}
                    style={{
                      marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 10,
                      border: '1px dashed var(--line)', background: 'none', cursor: 'pointer',
                      fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: theme.primary,
                    }}
                  >
                    <Plus size={13} /> Adicionar variação
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Modal adicionar/editar */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 20px 36px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                {modal.mode === 'add' ? `Nova variação — ${modal.produto}` : `Editar — ${modal.item.cor}`}
              </p>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Cor / Variação</label>
                <input
                  value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}
                  placeholder="ex: Preto, Rosa, M, GG..."
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Quantidade</label>
                  <input
                    type="number" min="0" value={form.quantidade}
                    onChange={e => setForm({ ...form, quantidade: e.target.value })}
                    placeholder="0" style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Custo (R$)</label>
                  <input
                    type="number" min="0" step="0.01" value={form.custo}
                    onChange={e => setForm({ ...form, custo: e.target.value })}
                    placeholder="0,00" style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {modal.mode === 'edit' && (
                <button
                  onClick={handleDelete} disabled={saving}
                  style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: '#fee2e2', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: '#dc2626', fontSize: 14 }}
                >
                  Excluir
                </button>
              )}
              <button onClick={() => setModal(null)}
                style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                Cancelar
              </button>
              <button
                onClick={handleSave} disabled={!canSave}
                style={{
                  flex: 2, height: 46, borderRadius: 12, border: 'none',
                  background: canSave ? theme.primary : 'var(--line)',
                  cursor: canSave ? 'pointer' : 'not-allowed',
                  fontFamily: 'Manrope, sans-serif', fontWeight: 700,
                  color: canSave ? '#fff' : 'var(--muted)', fontSize: 14,
                }}
              >
                {saving ? 'Salvando...' : modal.mode === 'add' ? 'Adicionar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
