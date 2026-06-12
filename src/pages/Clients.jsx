import { useState } from 'react'
import { useData } from '../context/DataContext'
import Modal from '../components/Modal'
import { Plus, Trash2, Edit2, Users, DollarSign, Clock, UserCheck } from 'lucide-react'
import StatCard from '../components/junttos/StatCard'
import Toolbar from '../components/junttos/Toolbar'
import DataTable from '../components/junttos/DataTable'
import StatusPill from '../components/junttos/StatusPill'
import EmptyState from '../components/junttos/EmptyState'
import { T } from '../theme/tokens'

const POLOS    = ['Fortaleza', 'Belém']
const PRODUCTS = ['Sistema de Gestão', 'Catálogo de Vendas', 'Inventário']
const STATUSES = ['Ativo', 'Trial', 'Cancelado']

const productChipColor = {
  'Sistema de Gestão':  { bg: T.tintPurple, text: T.purpleText },
  'Catálogo de Vendas': { bg: T.tintLilac,  text: '#6849d6' },
  'Inventário':         { bg: T.tintCoral,  text: T.coralText },
}

const emptyForm = {
  name: '', company: '', polo: 'Fortaleza',
  product: 'Sistema de Gestão', value: '',
  closedDate: '', status: 'Ativo', consultantId: 1,
}

export default function Clients() {
  const { clients, addClient, updateClient, deleteClient, consultants } = useData()
  const [search, setSearch]             = useState('')
  const [filterPolo, setFilterPolo]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen]       = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [form, setForm]                 = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const filtered = clients.filter((c) => {
    const matchSearch  = c.name.toLowerCase().includes(search.toLowerCase()) || c.company.toLowerCase().includes(search.toLowerCase())
    const matchPolo    = !filterPolo   || c.polo   === filterPolo
    const matchStatus  = !filterStatus || c.status === filterStatus
    return matchSearch && matchPolo && matchStatus
  })

  function openAdd() { setEditingClient(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(client) {
    setEditingClient(client)
    setForm({ name: client.name, company: client.company, polo: client.polo, product: client.product, value: String(client.value), closedDate: client.closedDate, status: client.status, consultantId: client.consultantId })
    setModalOpen(true)
  }
  function handleSubmit(e) {
    e.preventDefault()
    const data = { ...form, value: Number(form.value), consultantId: Number(form.consultantId) }
    if (editingClient) updateClient(editingClient.id, data)
    else addClient(data)
    setModalOpen(false)
  }
  function handleDelete(id) { deleteClient(id); setConfirmDelete(null) }

  const totalMRR   = clients.filter((c) => c.status === 'Ativo').reduce((sum, c) => sum + c.value, 0)
  const activeCount = clients.filter((c) => c.status === 'Ativo').length
  const trialCount  = clients.filter((c) => c.status === 'Trial').length

  return (
    <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>
            Clientes
          </h1>
          <p style={{ fontSize: 13.5, color: T.muted }}>Gerencie todos os clientes da Junttos</p>
        </div>
        <button
          onClick={openAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            height: 44, padding: '0 20px', borderRadius: T.rPill,
            background: T.coral, color: T.white, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(255,111,94,0.28)',
            transition: 'background .18s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.coralText }}
          onMouseLeave={e => { e.currentTarget.style.background = T.coral }}
        >
          <Plus style={{ width: 15, height: 15, strokeWidth: 2 }} />
          Novo Cliente
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={Users}     color="purple" label="Total de Clientes" value={clients.length} />
        <StatCard icon={UserCheck} color="coral"  label="Ativos"            value={activeCount} />
        <StatCard icon={Clock}     color="lilac"  label="Em Trial"          value={trialCount} />
        <StatCard icon={DollarSign} color="deep"  label="MRR Ativo"         value={`R$ ${totalMRR.toLocaleString('pt-BR')}`} />
      </div>

      {/* Toolbar */}
      <div style={{ marginBottom: 20 }}>
        <Toolbar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar por nome ou empresa…"
          filters={[
            {
              label: 'Polo', value: filterPolo, onChange: setFilterPolo,
              options: [{ value: '', label: 'Todos' }, ...POLOS.map(p => ({ value: p, label: p }))],
            },
            {
              label: 'Status', value: filterStatus, onChange: setFilterStatus,
              options: [{ value: '', label: 'Todos' }, ...STATUSES.map(s => ({ value: s, label: s }))],
            },
          ]}
        />
      </div>

      {/* Table */}
      <div style={{ background: T.white, borderRadius: T.rCard, boxShadow: T.cardShadow, border: `1px solid ${T.line}`, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.line}` }}>
          <p style={{ fontSize: 13, color: T.muted }}>
            <strong style={{ color: T.ink }}>{filtered.length}</strong> clientes encontrados
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhum cliente encontrado"
            description="Tente ajustar os filtros ou adicione um novo cliente"
            action="Novo Cliente"
            onAction={openAdd}
          />
        ) : (
          <DataTable columns={['Cliente', 'Polo', 'Produto', 'Valor/mês', 'Fechamento', 'Consultor', 'Status', '']}>
            {filtered.map((client) => {
              const consultant = consultants.find((c) => c.id === client.consultantId)
              const pc = productChipColor[client.product] || { bg: T.tintPurple, text: T.purpleText }
              return (
                <tr key={client.id} className="jt-tr" style={{ cursor: 'default' }}>
                  <td style={{ padding: '13px 20px', borderBottom: `1px solid ${T.line}` }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, margin: 0 }}>{client.name}</p>
                    <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>{client.company}</p>
                  </td>
                  <td style={{ padding: '13px 20px', borderBottom: `1px solid ${T.line}`, fontSize: 13.5, color: T.ink }}>
                    {client.polo}
                  </td>
                  <td style={{ padding: '13px 20px', borderBottom: `1px solid ${T.line}` }}>
                    <span style={{ display: 'inline-block', background: pc.bg, color: pc.text, borderRadius: T.rChip, fontSize: 11.5, fontWeight: 600, padding: '3px 10px' }}>
                      {client.product}
                    </span>
                  </td>
                  <td style={{ padding: '13px 20px', borderBottom: `1px solid ${T.line}`, fontSize: 13.5, fontWeight: 700, color: T.ink, fontFamily: T.mono }}>
                    R$ {client.value.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '13px 20px', borderBottom: `1px solid ${T.line}`, fontSize: 13.5, color: T.muted }}>
                    {new Date(client.closedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '13px 20px', borderBottom: `1px solid ${T.line}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                        background: T.iconGrad,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: T.white,
                      }}>
                        {consultant?.avatar}
                      </div>
                      <span style={{ fontSize: 13.5, color: T.ink }}>{consultant?.name.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td style={{ padding: '13px 20px', borderBottom: `1px solid ${T.line}` }}>
                    <StatusPill status={client.status} />
                  </td>
                  <td style={{ padding: '13px 20px', borderBottom: `1px solid ${T.line}` }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(client)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, transition: 'color .15s, border-color .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = T.purpleText; e.currentTarget.style.borderColor = T.purple }}
                        onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.line }}>
                        <Edit2 style={{ width: 13, height: 13 }} />
                      </button>
                      <button onClick={() => setConfirmDelete(client)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, transition: 'color .15s, border-color .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = T.coralText; e.currentTarget.style.borderColor = T.coral }}
                        onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.line }}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </DataTable>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingClient ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nome do Contato">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: João Silva" className={inputClass} />
            </FormField>
            <FormField label="Empresa">
              <input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Ex: Construtora X" className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Polo">
              <select value={form.polo} onChange={(e) => setForm({ ...form, polo: e.target.value })} className={inputClass}>
                {POLOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Consultor">
              <select value={form.consultantId} onChange={(e) => setForm({ ...form, consultantId: e.target.value })} className={inputClass} disabled={consultants.length === 0}>
                {consultants.length === 0
                  ? <option value="">Nenhum consultor cadastrado</option>
                  : consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                }
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Produto Contratado">
              <select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} className={inputClass}>
                {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Valor Mensal (R$)">
              <input required type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Ex: 1200" className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Data de Fechamento">
              <input required type="date" value={form.closedDate} onChange={(e) => setForm({ ...form, closedDate: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className={cancelBtn}>Cancelar</button>
            <button type="submit" className={submitBtn}>{editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Excluir Cliente" size="sm">
        <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.6, marginBottom: 20 }}>
          Tem certeza que deseja excluir <strong>{confirmDelete?.name}</strong> da{' '}
          <strong>{confirmDelete?.company}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmDelete(null)} className={cancelBtn}>Cancelar</button>
          <button onClick={() => handleDelete(confirmDelete.id)}
            style={{ flex: 1, background: T.coral, color: T.white, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, padding: '10px', cursor: 'pointer', transition: 'background .18s' }}
            onMouseEnter={e => { e.currentTarget.style.background = T.coralText }}
            onMouseLeave={e => { e.currentTarget.style.background = T.coral }}
          >
            Excluir
          </button>
        </div>
      </Modal>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#16101F] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputClass = 'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] focus:ring-1 focus:ring-[#5E2BD0]/15 transition'
const cancelBtn  = 'flex-1 bg-[#ECE7F4] hover:bg-[#ECE7F4] text-[#16101F] text-sm font-semibold py-2.5 rounded-xl transition'
const submitBtn  = 'flex-1 bg-[#FF6F5E] hover:bg-[#DD4F3E] text-white text-sm font-semibold py-2.5 rounded-xl transition'
