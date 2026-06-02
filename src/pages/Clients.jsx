import { useState } from 'react'
import { useData } from '../context/DataContext'
import Modal from '../components/Modal'
import { Plus, Search, Filter, Users, ChevronDown, Trash2, Edit2 } from 'lucide-react'

const POLOS = ['Fortaleza', 'Belém']
const PRODUCTS = ['Sistema de Gestão', 'Catálogo de Vendas', 'Inventário']
const STATUSES = ['Ativo', 'Trial', 'Cancelado']

const statusConfig = {
  Ativo: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  Trial: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Cancelado: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

const productConfig = {
  'Sistema de Gestão': 'bg-blue-500/10 text-[#5E2BD0] border border-blue-500/20',
  'Catálogo de Vendas': 'bg-violet-500/10 text-[#5E2BD0] border border-violet-500/20',
  'Inventário': 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
}

const emptyForm = {
  name: '',
  company: '',
  polo: 'Fortaleza',
  product: 'Sistema de Gestão',
  value: '',
  closedDate: '',
  status: 'Ativo',
  consultantId: 1,
}

export default function Clients() {
  const { clients, addClient, updateClient, deleteClient, consultants } = useData()
  const [search, setSearch] = useState('')
  const [filterPolo, setFilterPolo] = useState('Todos')
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const filtered = clients.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase())
    const matchPolo = filterPolo === 'Todos' || c.polo === filterPolo
    const matchStatus = filterStatus === 'Todos' || c.status === filterStatus
    return matchSearch && matchPolo && matchStatus
  })

  function openAdd() {
    setEditingClient(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(client) {
    setEditingClient(client)
    setForm({
      name: client.name,
      company: client.company,
      polo: client.polo,
      product: client.product,
      value: String(client.value),
      closedDate: client.closedDate,
      status: client.status,
      consultantId: client.consultantId,
    })
    setModalOpen(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const data = { ...form, value: Number(form.value), consultantId: Number(form.consultantId) }
    if (editingClient) {
      updateClient(editingClient.id, data)
    } else {
      addClient(data)
    }
    setModalOpen(false)
  }

  function handleDelete(id) {
    deleteClient(id)
    setConfirmDelete(null)
  }

  const totalMRR = clients
    .filter((c) => c.status === 'Ativo')
    .reduce((sum, c) => sum + c.value, 0)

  const activeCount = clients.filter((c) => c.status === 'Ativo').length
  const trialCount = clients.filter((c) => c.status === 'Trial').length

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#16101F]">Clientes</h1>
          <p className="text-[#7B7390] text-sm mt-1">Gerencie todos os clientes da Junttos</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#FF6F5E] hover:bg-[#DD4F3E] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-[#FF6F5E]/20"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        {[
          { label: 'Total de Clientes', value: clients.length, color: 'text-white' },
          { label: 'Ativos', value: activeCount, color: 'text-emerald-400' },
          { label: 'Em Trial', value: trialCount, color: 'text-amber-400' },
          {
            label: 'MRR Ativo',
            value: `R$ ${totalMRR.toLocaleString('pt-BR')}`,
            color: 'text-[#5E2BD0]',
          },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#E6E0F0] rounded-xl px-5 py-4">
            <p className="text-[#7B7390] text-xs mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7B7390]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou empresa..."
            className="w-full bg-white border border-[#E6E0F0] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] transition"
          />
        </div>
        <SelectFilter
          value={filterPolo}
          onChange={setFilterPolo}
          options={['Todos', ...POLOS]}
          label="Polo"
        />
        <SelectFilter
          value={filterStatus}
          onChange={setFilterStatus}
          options={['Todos', ...STATUSES]}
          label="Status"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6E0F0] flex items-center justify-between">
          <p className="text-[#7B7390] text-sm">
            <span className="text-white font-medium">{filtered.length}</span> clientes encontrados
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-[#7B7390] mb-3" />
            <p className="text-[#7B7390] font-medium">Nenhum cliente encontrado</p>
            <p className="text-[#7B7390] text-sm mt-1">Tente ajustar os filtros ou adicione um novo cliente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E6E0F0]">
                  {['Cliente', 'Polo', 'Produto', 'Valor/mês', 'Fechamento', 'Consultor', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-medium text-[#7B7390] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E0F0]">
                {filtered.map((client) => {
                  const consultant = consultants.find((c) => c.id === client.consultantId)
                  return (
                    <tr key={client.id} className="hover:bg-[#F6F3FA] transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-white font-medium text-sm">{client.name}</p>
                        <p className="text-[#7B7390] text-xs">{client.company}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[#16101F] text-sm">{client.polo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${productConfig[client.product]}`}>
                          {client.product}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-semibold text-sm">
                          R$ {client.value.toLocaleString('pt-BR')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#7B7390] text-sm">
                        {new Date(client.closedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${consultant?.color} flex items-center justify-center text-white text-[10px] font-bold`}>
                            {consultant?.avatar}
                          </div>
                          <span className="text-[#16101F] text-sm">{consultant?.name.split(' ')[0]}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${statusConfig[client.status]}`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(client)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7B7390] hover:text-[#5E2BD0] hover:bg-blue-500/10 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(client)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7B7390] hover:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nome do Contato">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: João Silva"
                className={inputClass}
              />
            </FormField>
            <FormField label="Empresa">
              <input
                required
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Ex: Construtora X"
                className={inputClass}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Polo">
              <select
                value={form.polo}
                onChange={(e) => setForm({ ...form, polo: e.target.value })}
                className={inputClass}
              >
                {POLOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Consultor">
              <select
                value={form.consultantId}
                onChange={(e) => setForm({ ...form, consultantId: e.target.value })}
                className={inputClass}
              >
                {[{ id: 1, name: 'Carlos Mendes' }, { id: 2, name: 'Ana Lima' }].map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Produto Contratado">
              <select
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
                className={inputClass}
              >
                {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Valor Mensal (R$)">
              <input
                required
                type="number"
                min="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="Ex: 1200"
                className={inputClass}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Data de Fechamento">
              <input
                required
                type="date"
                value={form.closedDate}
                onChange={(e) => setForm({ ...form, closedDate: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputClass}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className={cancelBtn}>
              Cancelar
            </button>
            <button type="submit" className={submitBtn}>
              {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Excluir Cliente" size="sm">
        <p className="text-[#16101F] text-sm mb-5">
          Tem certeza que deseja excluir <span className="text-white font-semibold">{confirmDelete?.name}</span> da{' '}
          <span className="text-white font-semibold">{confirmDelete?.company}</span>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmDelete(null)} className={cancelBtn}>Cancelar</button>
          <button
            onClick={() => handleDelete(confirmDelete.id)}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2.5 rounded-xl transition"
          >
            Excluir
          </button>
        </div>
      </Modal>
    </div>
  )
}

function SelectFilter({ value, onChange, options, label }) {
  return (
    <div className="relative">
      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7B7390] pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border border-[#E6E0F0] rounded-xl pl-8 pr-8 py-2.5 text-sm text-[#16101F] focus:outline-none focus:border-[#5E2BD0] appearance-none transition cursor-pointer"
      >
        {options.map((o) => <option key={o} value={o}>{o === 'Todos' ? `${label}: Todos` : o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7B7390] pointer-events-none" />
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

const inputClass =
  'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] focus:ring-1 focus:ring-[#5E2BD0]/15 transition'

const cancelBtn =
  'flex-1 bg-[#E6E0F0] hover:bg-[#E6E0F0] text-[#16101F] text-sm font-semibold py-2.5 rounded-xl transition'

const submitBtn =
  'flex-1 bg-[#FF6F5E] hover:bg-[#DD4F3E] text-white text-sm font-semibold py-2.5 rounded-xl transition'
