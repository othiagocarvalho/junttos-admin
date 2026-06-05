import { useState } from 'react'
import { Plus, Edit2, Trash2, Package } from 'lucide-react'
import Modal from '../../components/Modal'

const CATEGORIAS = ['Vestido', 'Cropped', 'Blusa', 'Saia', 'Short', 'Calça', 'Conjunto', 'Acessório', 'Outros']
const EMPTY_FORM  = { nome: '', categoria: 'Vestido', preco_custo: '', preco_venda: '', quantidade: '' }

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function QtyBadge({ qty }) {
  const n = Number(qty || 0)
  if (n <= 5)  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontWeight: 700, fontFamily: 'Manrope, sans-serif', whiteSpace: 'nowrap' }}>{n} un</span>
  if (n <= 10) return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: '#fefce8', border: '1px solid #fde047', color: '#854d0e', fontWeight: 700, fontFamily: 'Manrope, sans-serif', whiteSpace: 'nowrap' }}>{n} un</span>
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontWeight: 700, fontFamily: 'Manrope, sans-serif', whiteSpace: 'nowrap' }}>{n} un</span>
}

export default function EstoquePage({ estoque = [], addEstoqueItem, updateEstoqueItem, deleteEstoqueItem, theme }) {
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [search,     setSearch]     = useState('')

  const primary = theme?.primary || '#5E2BD0'

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      nome:        item.nome        || '',
      categoria:   item.categoria   || 'Vestido',
      preco_custo: item.preco_custo ?? '',
      preco_venda: item.preco_venda ?? '',
      quantidade:  item.quantidade  ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nome.trim()) return
    setSaving(true)
    const payload = {
      nome:        form.nome.trim(),
      categoria:   form.categoria || 'Outros',
      preco_custo: parseFloat(String(form.preco_custo).replace(',', '.')) || 0,
      preco_venda: parseFloat(String(form.preco_venda).replace(',', '.')) || 0,
      quantidade:  parseInt(form.quantidade)  || 0,
    }
    if (editItem) {
      await updateEstoqueItem(editItem.id, payload)
    } else {
      await addEstoqueItem(payload)
    }
    setSaving(false)
    setModalOpen(false)
  }

  async function handleDelete() {
    await deleteEstoqueItem(confirmDel.id)
    setConfirmDel(null)
  }

  const filtered = estoque.filter(item => {
    if (!search) return true
    const q = search.toLowerCase()
    return (item.nome      || '').toLowerCase().includes(q) ||
           (item.categoria || '').toLowerCase().includes(q)
  })

  const lowStock   = estoque.filter(i => Number(i.quantidade || 0) <= 5).length
  const totalValue = estoque.reduce((s, i) => s + Number(i.preco_venda || 0) * Number(i.quantidade || 0), 0)

  const inp = {
    width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 12,
    padding: '0 14px', fontFamily: 'Manrope, sans-serif', fontSize: 14,
    color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.10em', fontFamily: 'Manrope, sans-serif', marginBottom: 5,
  }

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
          background: primary, color: '#fff',
          fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700,
          boxShadow: `0 4px 14px ${primary}40`,
        }}>
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {[
          { label: 'Produtos',        value: estoque.length,                 alert: false },
          { label: 'Valor em estoque', value: fmtR(totalValue),             alert: false },
          { label: 'Estoque crítico',  value: `${lowStock} item${lowStock !== 1 ? 's' : ''}`, alert: lowStock > 0 },
        ].map(({ label, value, alert }) => (
          <div key={label} style={{ background: 'var(--surface)', border: `1px solid ${alert ? '#fca5a5' : 'var(--line)'}`, borderRadius: 14, padding: '14px 16px' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: alert ? '#dc2626' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{label}</p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: alert ? '#dc2626' : 'var(--ink)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar produto ou categoria..."
        style={{ ...inp, height: 46 }}
      />

      {/* Product table */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <Package size={36} color="var(--line)" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)' }}>
            {search ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado ainda.'}
          </p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: 580 }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 100px 88px 72px', padding: '11px 16px', background: primary }}>
                {['Produto', 'Qtd.', 'Categoria', 'Custo', 'Venda', ''].map(h => (
                  <span key={h} style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>{h}</span>
                ))}
              </div>
              {/* Rows */}
              {filtered.map((item, i) => (
                <div key={item.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 100px 100px 88px 72px',
                  padding: '12px 16px', alignItems: 'center',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none',
                  background: i % 2 === 0 ? '#fff' : 'var(--bg)',
                }}>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</span>
                  <div><QtyBadge qty={item.quantidade} /></div>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{item.categoria || '—'}</span>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{fmtR(item.preco_custo)}</span>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: primary }}>{fmtR(item.preco_venda)}</span>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => openEdit(item)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.color = primary}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setConfirmDel(item)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Produto' : 'Novo Produto'} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Nome do produto</label>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Vestido Floral" style={inp} autoFocus />
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
              <label style={lbl}>Preço de custo (R$)</label>
              <input value={form.preco_custo} onChange={e => setForm({ ...form, preco_custo: e.target.value })}
                placeholder="0,00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Preço de venda (R$)</label>
              <input value={form.preco_venda} onChange={e => setForm({ ...form, preco_venda: e.target.value })}
                placeholder="0,00" style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>Quantidade em estoque</label>
            <input type="number" min="0" value={form.quantidade}
              onChange={e => setForm({ ...form, quantidade: e.target.value })}
              placeholder="0" style={inp} />
          </div>
          <button onClick={handleSave} disabled={saving || !form.nome.trim()} style={{
            width: '100%', height: 48, borderRadius: 12, border: 'none', marginTop: 4,
            background: saving || !form.nome.trim() ? 'var(--line)' : primary,
            color: saving || !form.nome.trim() ? 'var(--muted)' : '#fff',
            cursor: saving || !form.nome.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700,
          }}>
            {saving ? 'Salvando...' : editItem ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Excluir produto" size="sm">
        <p style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 20, fontFamily: 'Manrope, sans-serif', lineHeight: 1.6 }}>
          Excluir <strong>{confirmDel?.nome}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setConfirmDel(null)}
            style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
            Cancelar
          </button>
          <button onClick={handleDelete}
            style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}>
            Excluir
          </button>
        </div>
      </Modal>
    </div>
  )
}
