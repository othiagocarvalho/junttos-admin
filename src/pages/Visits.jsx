import { useState } from 'react'
import { useData } from '../context/DataContext'
import Modal from '../components/Modal'
import { Plus, MapPin, CheckCircle2, Clock, XCircle } from 'lucide-react'
import StatCard from '../components/junttos/StatCard'
import Toolbar from '../components/junttos/Toolbar'
import EmptyState from '../components/junttos/EmptyState'
import StatusPill from '../components/junttos/StatusPill'
import { T } from '../theme/tokens'

const RESULTS = ['Fechou', 'Retornar', 'Sem Interesse']

const RESULT_CONFIG = {
  Fechou:        { bg: T.statusAtivoBg, text: T.statusAtivoTx, dot: T.statusAtivoTx },
  Retornar:      { bg: T.statusTrialBg, text: T.statusTrialTx, dot: T.statusTrialTx },
  'Sem Interesse': { bg: T.tintCoral,   text: T.coralText,     dot: T.coral },
}

const emptyForm = {
  consultantId: '1', clientType: 'prospect', clientId: '',
  prospectName: '', date: new Date().toISOString().split('T')[0],
  polo: 'Fortaleza', result: 'Retornar', notes: '',
}

export default function Visits() {
  const { visits, addVisit, consultants, clients } = useData()
  const [modalOpen, setModalOpen]         = useState(false)
  const [form, setForm]                   = useState(emptyForm)
  const [search, setSearch]               = useState('')
  const [filterConsultant, setFilterConsultant] = useState('')
  const [filterPolo, setFilterPolo]       = useState('')
  const [filterResult, setFilterResult]   = useState('')

  const filtered = visits.filter((v) => {
    const consultant = consultants.find((c) => c.id === v.consultantId)
    const client     = clients.find((c) => c.id === v.clientId)
    const targetName = v.clientType === 'cliente' ? (client?.company || '') : (v.prospectName || '')
    const matchSearch     = targetName.toLowerCase().includes(search.toLowerCase()) || consultant?.name.toLowerCase().includes(search.toLowerCase())
    const matchConsultant = !filterConsultant || v.consultantId === Number(filterConsultant)
    const matchPolo       = !filterPolo   || v.polo   === filterPolo
    const matchResult     = !filterResult || v.result === filterResult
    return matchSearch && matchConsultant && matchPolo && matchResult
  })

  const stats = {
    total:       visits.length,
    fechou:      visits.filter((v) => v.result === 'Fechou').length,
    retornar:    visits.filter((v) => v.result === 'Retornar').length,
    semInteresse: visits.filter((v) => v.result === 'Sem Interesse').length,
  }

  function handleSubmit(e) {
    e.preventDefault()
    addVisit({ ...form, consultantId: Number(form.consultantId), clientId: form.clientType === 'cliente' ? form.clientId : null, prospectName: form.clientType === 'prospect' ? form.prospectName : null })
    setModalOpen(false)
    setForm(emptyForm)
  }

  return (
    <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>
            Visitas e Rotas
          </h1>
          <p style={{ fontSize: 13.5, color: T.muted }}>Acompanhe todas as visitas realizadas pela equipe</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setModalOpen(true) }}
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
          Registrar Visita
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={MapPin}        color="purple" label="Total de Visitas" value={stats.total} />
        <StatCard icon={CheckCircle2}  color="coral"  label="Fechamentos"     value={stats.fechou} />
        <StatCard icon={Clock}         color="lilac"  label="Retornar"        value={stats.retornar} />
        <StatCard icon={XCircle}       color="deep"   label="Sem Interesse"   value={stats.semInteresse} />
      </div>

      {/* Toolbar */}
      <div style={{ marginBottom: 20 }}>
        <Toolbar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar empresa ou consultor…"
          filters={[
            {
              label: 'Consultor', value: filterConsultant, onChange: setFilterConsultant,
              options: [{ value: '', label: 'Todos' }, ...consultants.map((c) => ({ value: String(c.id), label: c.name }))],
            },
            {
              label: 'Polo', value: filterPolo, onChange: setFilterPolo,
              options: [{ value: '', label: 'Todos' }, { value: 'Fortaleza', label: 'Fortaleza' }, { value: 'Belém', label: 'Belém' }],
            },
            {
              label: 'Resultado', value: filterResult, onChange: setFilterResult,
              options: [{ value: '', label: 'Todos' }, ...RESULTS.map((r) => ({ value: r, label: r }))],
            },
          ]}
        />
      </div>

      {/* Visit list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ background: T.white, borderRadius: T.rCard, boxShadow: T.cardShadow, border: `1px solid ${T.line}` }}>
            <EmptyState
              title="Nenhuma visita encontrada"
              description="Tente ajustar os filtros ou registre uma nova visita"
              action="Registrar Visita"
              onAction={() => { setForm(emptyForm); setModalOpen(true) }}
            />
          </div>
        ) : (
          filtered.map((visit) => {
            const consultant = consultants.find((c) => c.id === visit.consultantId)
            const client     = clients.find((c) => c.id === visit.clientId)
            const targetName = visit.clientType === 'cliente' ? (client?.company || '—') : (visit.prospectName || '—')
            const isProspect = visit.clientType === 'prospect'
            const rc = RESULT_CONFIG[visit.result] || RESULT_CONFIG['Sem Interesse']
            return (
              <div key={visit.id} style={{
                background: T.white, borderRadius: T.rCard,
                boxShadow: T.cardShadow, border: `1px solid ${T.line}`,
                padding: '18px 20px', transition: 'border-color .15s, box-shadow .15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple + '44'; e.currentTarget.style.boxShadow = T.cardShadowHover }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.boxShadow = T.cardShadow }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>
                  {/* Left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: T.iconGrad,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: T.white,
                    }}>
                      {consultant?.avatar}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: '0 0 3px' }}>{targetName}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 12, color: T.muted }}>{consultant?.name}</span>
                        <span style={{ color: T.muted2 }}>·</span>
                        <span style={{ fontSize: 11, fontWeight: 600, background: isProspect ? T.tintPurple : T.tintLilac, color: isProspect ? T.purpleText : '#6849d6', borderRadius: T.rChip, padding: '2px 7px' }}>
                          {isProspect ? 'Prospect' : 'Cliente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Polo</p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: 0 }}>{visit.polo}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Data</p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: 0 }}>
                        {new Date(visit.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {/* Result */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: rc.bg, color: rc.text, borderRadius: T.rPill,
                    fontSize: 12, fontWeight: 600, padding: '5px 12px', whiteSpace: 'nowrap',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: rc.dot, flexShrink: 0 }} />
                    {visit.result}
                  </span>
                </div>

                {visit.notes && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                    <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, margin: 0 }}>{visit.notes}</p>
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
                <button key={type} type="button"
                  onClick={() => setForm({ ...form, clientType: type, clientId: '', prospectName: '' })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${
                    form.clientType === type
                      ? 'bg-[#5E2BD0]/10 border-[#5E2BD0]/40 text-[#5E2BD0]'
                      : 'bg-[#F6F3FA] border-[#E6E0F0] text-[#7B7390] hover:text-[#16101F]'
                  }`}>
                  {type === 'prospect' ? 'Prospect (novo)' : 'Cliente existente'}
                </button>
              ))}
            </div>
          </div>

          {form.clientType === 'prospect' ? (
            <div>
              <label className={labelClass}>Nome da Empresa / Prospect</label>
              <input required value={form.prospectName} onChange={(e) => setForm({ ...form, prospectName: e.target.value })} placeholder="Ex: Supermercado Estrela" className={inputClass} />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Cliente</label>
              <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={inputClass}>
                <option value="">Selecione o cliente…</option>
                {clients.filter((c) => c.polo === form.polo).map((c) => (
                  <option key={c.id} value={c.id}>{c.company} — {c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Data da Visita</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} />
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
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Descreva o que aconteceu na visita..." rows={3} className={`${inputClass} resize-none`} />
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

const labelClass = 'block text-sm font-medium text-[#16101F] mb-1.5'
const inputClass = 'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] focus:ring-1 focus:ring-[#5E2BD0]/15 transition'
const cancelBtn  = 'flex-1 bg-[#ECE7F4] hover:bg-[#ECE7F4] text-[#16101F] text-sm font-semibold py-2.5 rounded-xl transition'
const submitBtn  = 'flex-1 bg-[#FF6F5E] hover:bg-[#DD4F3E] text-white text-sm font-semibold py-2.5 rounded-xl transition'
