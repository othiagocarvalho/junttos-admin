import { useState } from 'react'
import { useData } from '../context/DataContext'
import Modal from '../components/Modal'
import { Plus, MapPin, Search, ChevronDown, Filter, CheckCircle2, Clock, XCircle } from 'lucide-react'

const RESULTS = ['Fechou', 'Retornar', 'Sem Interesse']

const resultConfig = {
  Fechou: {
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  Retornar: {
    icon: Clock,
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dot: 'bg-amber-400',
  },
  'Sem Interesse': {
    icon: XCircle,
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-400',
  },
}

const emptyForm = {
  consultantId: '1',
  clientType: 'prospect',
  clientId: '',
  prospectName: '',
  date: new Date().toISOString().split('T')[0],
  polo: 'Fortaleza',
  result: 'Retornar',
  notes: '',
}

export default function Visits() {
  const { visits, addVisit, consultants, clients } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [filterConsultant, setFilterConsultant] = useState('Todos')
  const [filterPolo, setFilterPolo] = useState('Todos')
  const [filterResult, setFilterResult] = useState('Todos')
  const [search, setSearch] = useState('')

  const filtered = visits.filter((v) => {
    const consultant = consultants.find((c) => c.id === v.consultantId)
    const client = clients.find((c) => c.id === v.clientId)
    const targetName = v.clientType === 'cliente' ? (client?.company || '') : (v.prospectName || '')

    const matchSearch = targetName.toLowerCase().includes(search.toLowerCase()) ||
      consultant?.name.toLowerCase().includes(search.toLowerCase())
    const matchConsultant = filterConsultant === 'Todos' || v.consultantId === Number(filterConsultant)
    const matchPolo = filterPolo === 'Todos' || v.polo === filterPolo
    const matchResult = filterResult === 'Todos' || v.result === filterResult

    return matchSearch && matchConsultant && matchPolo && matchResult
  })

  const stats = {
    total: visits.length,
    fechou: visits.filter((v) => v.result === 'Fechou').length,
    retornar: visits.filter((v) => v.result === 'Retornar').length,
    semInteresse: visits.filter((v) => v.result === 'Sem Interesse').length,
  }

  function handleSubmit(e) {
    e.preventDefault()
    addVisit({
      ...form,
      consultantId: Number(form.consultantId),
      clientId: form.clientType === 'cliente' ? form.clientId : null,
      prospectName: form.clientType === 'prospect' ? form.prospectName : null,
    })
    setModalOpen(false)
    setForm(emptyForm)
  }

  const poloClients = clients.filter((c) => c.polo === (form.polo))

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#16101F]">Visitas e Rotas</h1>
          <p className="text-[#7B7390] text-sm mt-1">Acompanhe todas as visitas realizadas pela equipe</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setModalOpen(true) }}
          className="flex items-center gap-2 bg-[#FF6F5E] hover:bg-[#DD4F3E] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-[#FF6F5E]/20"
        >
          <Plus className="w-4 h-4" />
          Registrar Visita
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        {[
          { label: 'Total de Visitas', value: stats.total, color: 'text-white' },
          { label: 'Fechamentos', value: stats.fechou, color: 'text-emerald-400' },
          { label: 'Retornar', value: stats.retornar, color: 'text-amber-400' },
          { label: 'Sem Interesse', value: stats.semInteresse, color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#E6E0F0] rounded-xl px-5 py-4">
            <p className="text-[#7B7390] text-xs mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7B7390]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa ou consultor..."
            className="w-full bg-white border border-[#E6E0F0] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] transition"
          />
        </div>
        <SelectFilter value={filterConsultant} onChange={setFilterConsultant} label="Consultor"
          options={[{ value: 'Todos', label: 'Consultor: Todos' }, ...consultants.map((c) => ({ value: String(c.id), label: c.name }))]}
        />
        <SelectFilter value={filterPolo} onChange={setFilterPolo} label="Polo"
          options={[{ value: 'Todos', label: 'Polo: Todos' }, { value: 'Fortaleza', label: 'Fortaleza' }, { value: 'Belém', label: 'Belém' }]}
        />
        <SelectFilter value={filterResult} onChange={setFilterResult} label="Resultado"
          options={[{ value: 'Todos', label: 'Resultado: Todos' }, ...RESULTS.map((r) => ({ value: r, label: r }))]}
        />
      </div>

      {/* Visit list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#E6E0F0] rounded-2xl flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="w-10 h-10 text-[#7B7390] mb-3" />
            <p className="text-[#7B7390] font-medium">Nenhuma visita encontrada</p>
            <p className="text-[#7B7390] text-sm mt-1">Tente ajustar os filtros ou registre uma nova visita</p>
          </div>
        ) : (
          filtered.map((visit) => {
            const consultant = consultants.find((c) => c.id === visit.consultantId)
            const client = clients.find((c) => c.id === visit.clientId)
            const targetName = visit.clientType === 'cliente'
              ? client?.company || '—'
              : visit.prospectName || '—'
            const isProspect = visit.clientType === 'prospect'
            const result = resultConfig[visit.result]
            const ResultIcon = result.icon

            return (
              <div
                key={visit.id}
                className="bg-white border border-[#E6E0F0] rounded-2xl p-5 hover:border-[#5E2BD0]/30 transition-colors"
              >
                <div className="flex flex-wrap items-start gap-4">
                  {/* Left */}
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${consultant?.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {consultant?.avatar}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{targetName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[#7B7390] text-xs">{consultant?.name}</p>
                        <span className="text-[#7B7390]">·</span>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
                          isProspect
                            ? 'bg-blue-500/10 text-[#5E2BD0]'
                            : 'bg-violet-500/10 text-[#5E2BD0]'
                        }`}>
                          {isProspect ? 'Prospect' : 'Cliente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle */}
                  <div className="flex items-center gap-6 flex-wrap">
                    <div>
                      <p className="text-[#7B7390] text-[11px]">Polo</p>
                      <p className="text-[#16101F] text-sm font-medium">{visit.polo}</p>
                    </div>
                    <div>
                      <p className="text-[#7B7390] text-[11px]">Data</p>
                      <p className="text-[#16101F] text-sm font-medium">
                        {new Date(visit.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {/* Result */}
                  <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl ${result.className}`}>
                    <ResultIcon className="w-3.5 h-3.5" />
                    {visit.result}
                  </span>
                </div>

                {visit.notes && (
                  <div className="mt-3 pt-3 border-t border-[#E6E0F0]">
                    <p className="text-[#7B7390] text-sm">{visit.notes}</p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Registrar Visita" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Consultor</label>
              <select value={form.consultantId} onChange={(e) => setForm({ ...form, consultantId: e.target.value, clientId: '' })} className={inputClass}>
                {consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Polo</label>
              <select value={form.polo} onChange={(e) => setForm({ ...form, polo: e.target.value, clientId: '' })} className={inputClass}>
                <option>Fortaleza</option>
                <option>Belém</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Tipo de Visita</label>
            <div className="flex gap-3">
              {['prospect', 'cliente'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, clientType: type, clientId: '', prospectName: '' })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${
                    form.clientType === type
                      ? 'bg-[#5E2BD0]/10 border-[#5E2BD0]/40 text-[#5E2BD0]'
                      : 'bg-[#F6F3FA] border-[#E6E0F0] text-[#7B7390] hover:text-[#16101F]'
                  }`}
                >
                  {type === 'prospect' ? 'Prospect (novo)' : 'Cliente existente'}
                </button>
              ))}
            </div>
          </div>

          {form.clientType === 'prospect' ? (
            <div>
              <label className={labelClass}>Nome da Empresa / Prospect</label>
              <input
                required
                value={form.prospectName}
                onChange={(e) => setForm({ ...form, prospectName: e.target.value })}
                placeholder="Ex: Supermercado Estrela"
                className={inputClass}
              />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Cliente</label>
              <select
                required
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className={inputClass}
              >
                <option value="">Selecione o cliente...</option>
                {clients
                  .filter((c) => c.polo === form.polo)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.company} — {c.name}</option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Data da Visita</label>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Resultado</label>
              <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} className={inputClass}>
                {RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Observações</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Descreva o que aconteceu na visita..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className={cancelBtn}>Cancelar</button>
            <button type="submit" className={submitBtn}>Registrar Visita</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function SelectFilter({ value, onChange, options }) {
  return (
    <div className="relative">
      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7B7390] pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border border-[#E6E0F0] rounded-xl pl-8 pr-8 py-2.5 text-sm text-[#16101F] focus:outline-none focus:border-[#5E2BD0] appearance-none transition cursor-pointer"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7B7390] pointer-events-none" />
    </div>
  )
}

const labelClass = 'block text-sm font-medium text-[#16101F] mb-1.5'
const inputClass = 'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] focus:ring-1 focus:ring-[#5E2BD0]/15 transition'
const cancelBtn = 'flex-1 bg-[#E6E0F0] hover:bg-[#E6E0F0] text-[#16101F] text-sm font-semibold py-2.5 rounded-xl transition'
const submitBtn = 'flex-1 bg-[#FF6F5E] hover:bg-[#DD4F3E] text-white text-sm font-semibold py-2.5 rounded-xl transition'
