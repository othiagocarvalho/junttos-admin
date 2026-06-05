import { useState } from 'react'
import { Plus, Edit2, Trash2, Package, ChevronDown, ChevronUp, Minus, X } from 'lucide-react'
import Modal from '../../components/Modal'

const CATEGORIAS = [
  'Vestido', 'Blusa', 'Cropped', 'Short', 'Conjunto',
  'Body', 'Macaquinho', 'Sobretudo', 'Bolsa', 'Óculos', 'Acessório', 'Outros',
]
const EMPTY_FORM = { nome: '', categoria: 'Vestido', preco_custo: '', preco_venda: '' }
const EMPTY_VAR  = { cor: '', quantidade: '1' }

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function totalQty(item) {
  const vars = item.variacoes || []
  if (vars.length > 0) return vars.reduce((s, v) => s + Number(v.quantidade || 0), 0)
  return Number(item.quantidade || 0)
}

function hasLow(item) {
  const vars = item.variacoes || []
  if (vars.length > 0) return vars.some(v => Number(v.quantidade || 0) <= 5)
  return Number(item.quantidade || 0) <= 5
}

function QtyBadge({ qty }) {
  const n = Number(qty ?? 0)
  const s = n <= 5
    ? { bg: '#fef2f2', br: '#fca5a5', c: '#dc2626' }
    : n <= 10
      ? { bg: '#fefce8', br: '#fde047', c: '#854d0e' }
      : { bg: '#f0fdf4', br: '#86efac', c: '#166534' }
  return (
    <span style={{
      fontSize: 11, padding: '2px 9px', borderRadius: 99,
      background: s.bg, border: `1px solid ${s.br}`, color: s.c,
      fontWeight: 700, fontFamily: 'Manrope, sans-serif', whiteSpace: 'nowrap',
    }}>{n} un</span>
  )
}

export default function EstoquePage({ estoque = [], addEstoqueItem, updateEstoqueItem, deleteEstoqueItem, theme }) {
  const primary = theme?.primary || '#5E2BD0'
  const isDark  = primary === '#D4A017'
  const btnColor = isDark ? '#0A0A0A' : '#fff'

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [confirmDel, setConfirmDel] = useState(null) // {type:'product'|'variation', item, varIdx?, varCor?}
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [formVars,   setFormVars]   = useState([])
  const [saving,     setSaving]     = useState(false)
  const [search,     setSearch]     = useState('')
  const [expanded,   setExpanded]   = useState({})
  const [addingVar,  setAddingVar]  = useState(null)
  const [newVar,     setNewVar]     = useState(EMPTY_VAR)

  const inp = {
    width: '100%', height: 42, border: '1.5px solid var(--line)', borderRadius: 10,
    padding: '0 12px', fontFamily: 'Manrope, sans-serif', fontSize: 14,
    color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.10em', fontFamily: 'Manrope, sans-serif', marginBottom: 5,
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setFormVars([])
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      nome:        item.nome        || '',
      categoria:   item.categoria   || 'Vestido',
      preco_custo: item.preco_custo ?? '',
      preco_venda: item.preco_venda ?? '',
    })
    setFormVars((item.variacoes || []).map(v => ({ ...v })))
    setModalOpen(true)
  }

  function addFormVar() {
    setFormVars(prev => [...prev, { cor: '', quantidade: 1 }])
  }
  function removeFormVar(idx) {
    setFormVars(prev => prev.filter((_, i) => i !== idx))
  }
  function updateFormVar(idx, field, val) {
    setFormVars(prev => prev.map((v, i) =>
      i === idx ? { ...v, [field]: field === 'quantidade' ? Number(val) || 0 : val } : v
    ))
  }

  async function handleSave() {
    if (!form.nome.trim()) return
    setSaving(true)
    const payload = {
      nome:        form.nome.trim(),
      categoria:   form.categoria || 'Outros',
      preco_custo: parseFloat(String(form.preco_custo).replace(',', '.')) || 0,
      preco_venda: parseFloat(String(form.preco_venda).replace(',', '.')) || 0,
      variacoes:   formVars.filter(v => v.cor.trim()),
    }
    if (editItem) {
      await updateEstoqueItem(editItem.id, payload)
    } else {
      await addEstoqueItem({ ...payload, quantidade: 0 })
    }
    setSaving(false)
    setModalOpen(false)
  }

  async function changeVarQty(item, varIdx, delta) {
    const variacoes = (item.variacoes || []).map((v, i) =>
      i === varIdx ? { ...v, quantidade: Math.max(0, Number(v.quantidade || 0) + delta) } : v
    )
    await updateEstoqueItem(item.id, { variacoes })
  }

  async function handleDeleteVar() {
    const { item, varIdx } = confirmDel
    const variacoes = (item.variacoes || []).filter((_, i) => i !== varIdx)
    await updateEstoqueItem(item.id, { variacoes })
    setConfirmDel(null)
  }

  async function handleDeleteProduct() {
    await deleteEstoqueItem(confirmDel.item.id)
    setConfirmDel(null)
  }

  async function handleAddVar(item) {
    if (!newVar.cor.trim()) return
    const variacoes = [...(item.variacoes || []), { cor: newVar.cor.trim(), quantidade: Number(newVar.quantidade) || 0 }]
    await updateEstoqueItem(item.id, { variacoes })
    setNewVar(EMPTY_VAR)
    setAddingVar(null)
  }

  const filtered = estoque.filter(item => {
    if (!search) return true
    const q = search.toLowerCase()
    return (item.nome || '').toLowerCase().includes(q) || (item.categoria || '').toLowerCase().includes(q)
  })

  const totalValue  = estoque.reduce((s, i) => s + (totalQty(i) * Number(i.preco_venda || 0)), 0)
  const criticalCnt = estoque.filter(hasLow).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Estoque</h2>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--muted)' }}>
            {estoque.length} produto{estoque.length !== 1 ? 's' : ''} cadastrado{estoque.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openAdd} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
          borderRadius: 12, border: 'none', cursor: 'pointer',
          background: primary, color: btnColor,
          fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700,
          boxShadow: `0 4px 14px ${primary}40`,
        }}>
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Produtos',         value: estoque.length,       alert: false },
          { label: 'Valor em estoque', value: fmtR(totalValue),     alert: false },
          { label: 'Estoque crítico',  value: `${criticalCnt} ${criticalCnt !== 1 ? 'itens' : 'item'}`, alert: criticalCnt > 0 },
        ].map(({ label, value, alert }) => (
          <div key={label} style={{ background: 'var(--surface)', border: `1px solid ${alert ? '#fca5a5' : 'var(--line)'}`, borderRadius: 14, padding: '14px 16px' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: alert ? '#dc2626' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{label}</p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: alert ? '#dc2626' : 'var(--ink)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar produto ou categoria..."
        style={{ ...inp, height: 46, borderRadius: 12 }} />

      {/* Product list */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <Package size={36} color="var(--line)" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)' }}>
            {search ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => {
            const isOpen = !!expanded[item.id]
            const vars   = item.variacoes || []
            const qty    = totalQty(item)
            const low    = hasLow(item)

            return (
              <div key={item.id} style={{
                background: 'var(--surface)',
                border: `1px solid ${low ? 'rgba(220,38,38,0.3)' : 'var(--line)'}`,
                borderRadius: 14, overflow: 'hidden',
              }}>
                {/* Product header */}
                <div
                  onClick={() => toggleExpand(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                        {item.nome}
                      </span>
                      {low && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontWeight: 700, fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>
                          crítico
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{item.categoria || '—'}</span>
                      <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: primary }}>{fmtR(item.preco_venda)}</span>
                    </div>
                  </div>
                  <QtyBadge qty={qty} />
                  <button onClick={e => { e.stopPropagation(); openEdit(item) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--muted)', display: 'flex', alignItems: 'center', borderRadius: 6, flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = primary}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
                    <Edit2 size={14} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setConfirmDel({ type: 'product', item }) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--muted)', display: 'flex', alignItems: 'center', borderRadius: 6, flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
                    <Trash2 size={14} />
                  </button>
                  <div style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Variations panel */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--line)' }}>
                    {vars.length === 0 ? (
                      <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--muted)', padding: '10px 16px' }}>
                        Nenhuma variação cadastrada.
                      </p>
                    ) : (
                      vars.map((v, vi) => (
                        <div key={vi} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                          borderBottom: vi < vars.length - 1 ? '1px solid var(--line)' : 'none',
                          background: vi % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                        }}>
                          <span style={{ flex: 1, fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--ink)' }}>{v.cor}</span>
                          <QtyBadge qty={v.quantidade} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button onClick={() => changeVarQty(item, vi, -1)}
                              style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                              <Minus size={11} />
                            </button>
                            <button onClick={() => changeVarQty(item, vi, +1)}
                              style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                              <Plus size={11} />
                            </button>
                          </div>
                          <button
                            onClick={() => setConfirmDel({ type: 'variation', item, varIdx: vi, varCor: v.cor })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', color: 'var(--muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}

                    {/* Add variation inline */}
                    <div style={{ padding: '8px 16px 12px' }}>
                      {addingVar === item.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input value={newVar.cor} onChange={e => setNewVar({ ...newVar, cor: e.target.value })}
                            placeholder="Cor / Modelo" autoFocus
                            style={{ ...inp, flex: 2, height: 36, fontSize: 13 }} />
                          <input value={newVar.quantidade} onChange={e => setNewVar({ ...newVar, quantidade: e.target.value })}
                            placeholder="Qtd" type="number" min="0"
                            style={{ ...inp, width: 70, flex: 'none', height: 36, fontSize: 13 }} />
                          <button onClick={() => handleAddVar(item)}
                            style={{ height: 36, padding: '0 14px', borderRadius: 8, background: primary, border: 'none', color: btnColor, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
                            OK
                          </button>
                          <button onClick={() => { setAddingVar(null); setNewVar(EMPTY_VAR) }}
                            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--line)', background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setAddingVar(item.id); setNewVar(EMPTY_VAR) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1.5px dashed ${primary}60`, background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 12, color: primary, fontWeight: 600 }}>
                          <Plus size={12} /> Adicionar variação
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit product modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Produto' : 'Novo Produto'} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Nome do produto</label>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Vestido Canelado" style={inp} autoFocus />
          </div>
          <div>
            <label style={lbl}>Categoria</label>
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
              style={{ ...inp, appearance: 'auto', cursor: 'pointer' }}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Preço custo (R$)</label>
              <input value={form.preco_custo} onChange={e => setForm({ ...form, preco_custo: e.target.value })}
                placeholder="0,00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Preço venda (R$)</label>
              <input value={form.preco_venda} onChange={e => setForm({ ...form, preco_venda: e.target.value })}
                placeholder="0,00" style={inp} />
            </div>
          </div>

          {/* Variations */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Variações (cor / modelo)</label>
              <button onClick={addFormVar} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: `1px solid ${primary}60`, background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 11, color: primary, fontWeight: 700 }}>
                <Plus size={11} /> Adicionar
              </button>
            </div>
            {formVars.length === 0 ? (
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>Clique em "Adicionar" para incluir cores ou modelos.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {formVars.map((v, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={v.cor} onChange={e => updateFormVar(i, 'cor', e.target.value)}
                      placeholder="Cor / Modelo" style={{ ...inp, flex: 2, height: 38 }} />
                    <input value={v.quantidade} onChange={e => updateFormVar(i, 'quantidade', e.target.value)}
                      placeholder="Qtd" type="number" min="0" style={{ ...inp, width: 70, flex: 'none', height: 38 }} />
                    <button onClick={() => removeFormVar(i)} style={{ width: 34, height: 38, borderRadius: 8, border: '1px solid var(--line)', background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving || !form.nome.trim()} style={{
            width: '100%', height: 48, borderRadius: 12, border: 'none', marginTop: 4,
            background: saving || !form.nome.trim() ? 'var(--line)' : primary,
            color: saving || !form.nome.trim() ? 'var(--muted)' : btnColor,
            cursor: saving || !form.nome.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700,
          }}>
            {saving ? 'Salvando...' : editItem ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={confirmDel?.type === 'variation' ? 'Excluir variação' : 'Excluir produto'}
        size="sm"
      >
        <p style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 20, fontFamily: 'Manrope, sans-serif', lineHeight: 1.6 }}>
          {confirmDel?.type === 'variation' ? (
            <>Excluir a variação <strong>{confirmDel.varCor}</strong> de <strong>{confirmDel.item.nome}</strong>? Esta ação não pode ser desfeita.</>
          ) : (
            <>Excluir <strong>{confirmDel?.item?.nome}</strong> e todas as variações? Esta ação não pode ser desfeita.</>
          )}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setConfirmDel(null)}
            style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
            Cancelar
          </button>
          <button
            onClick={() => confirmDel?.type === 'variation' ? handleDeleteVar() : handleDeleteProduct()}
            style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}>
            Excluir
          </button>
        </div>
      </Modal>
    </div>
  )
}
