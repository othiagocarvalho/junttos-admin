import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Plus, MapPin, CheckCircle2, Clock, XCircle } from 'lucide-react'
import StatCard from '../components/junttos/StatCard'
import Toolbar from '../components/junttos/Toolbar'
import EmptyState from '../components/junttos/EmptyState'
import { T } from '../theme/tokens'

const RESULT_OPTIONS = [
  { value: 'fechamento',    label: 'Fechamento' },
  { value: 'retornar',      label: 'Retornar' },
  { value: 'sem_interesse', label: 'Sem Interesse' },
  { value: 'pendente',      label: 'Pendente' },
]

const RESULT_CONFIG = {
  fechamento:    { bg: T.statusAtivoBg, text: T.statusAtivoTx, dot: T.statusAtivoTx, label: 'Fechamento'   },
  retornar:      { bg: T.statusTrialBg, text: T.statusTrialTx, dot: T.statusTrialTx, label: 'Retornar'     },
  sem_interesse: { bg: T.tintCoral,     text: T.coralText,     dot: T.coral,          label: 'Sem Interesse' },
  pendente:      { bg: T.tintPurple,    text: T.purpleText,    dot: T.purple,          label: 'Pendente'     },
}

const emptyForm = {
  consultor_id: '',
  empresa:      '',
  polo:         'Fortaleza',
  resultado:    'retornar',
  data_visita:  new Date().toISOString().split('T')[0],
  observacoes:  '',
}

export default function Visits() {
  const [visits,      setVisits]      = useState([])
  const [consultants, setConsultants] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [form,        setForm]        = useState(emptyForm)
  const [search,           setSearch]           = useState('')
  const [filterConsultant, setFilterConsultant] = useState('')
  const [filterPolo,       setFilterPolo]       = useState('')
  const [filterResult,     setFilterResult]     = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: vis }, { data: cons }] = await Promise.all([
      supabase
        .from('jt_visits')
        .select('*, jt_consultants(id, nome)')
        .order('data_visita', { ascending: false }),
      supabase
        .from('jt_consultants')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome'),
    ])
    setVisits(vis || [])
    setConsultants(cons || [])
    if (cons && cons.length > 0) {
      setForm(f => ({ ...f, consultor_id: cons[0].id }))
    }
    setLoading(false)
  }

  function openModal() {
    setForm({ ...emptyForm, consultor_id: consultants[0]?.id || '' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const { error } = await supabase.from('jt_visits').insert(form)
    if (error) { console.error('Erro ao registrar visita:', error); return }
    setModalOpen(false)
    fetchAll()
  }

  const filtered = visits.filter(v => {
    const empresa   = v.empresa || ''
    const consNome  = v.jt_consultants?.nome || ''
    const matchSearch     = empresa.toLowerCase().includes(search.toLowerCase()) || consNome.toLowerCase().includes(search.toLowerCase())
    const matchConsultant = !filterConsultant || v.consultor_id === filterConsultant
    const matchPolo       = !filterPolo   || v.polo     === filterPolo
    const matchResult     = !filterResult || v.resultado === filterResult
    return matchSearch && matchConsultant && matchPolo && matchResult
  })

  const stats = {
    total:        visits.length,
    fechamento:   visits.filter(v => v.resultado === 'fechamento').length,
    retornar:     visits.filter(v => v.resultado === 'retornar').length,
    semInteresse: visits.filter(v => v.resultado === 'sem_interesse').length,
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em' }}>Visitas e Rotas</h1>
          <p style={{ fontSize: 13.5, color: T.muted, marginTop: 4 }}>Acompanhe todas as visitas realizadas pela equipe</p>
        </div>
        <p style={{ color: T.muted, fontSize: 14 }}>Carregando...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Visitas e Rotas</h1>
          <p style={{ fontSize: 13.5, color: T.muted }}>Acompanhe todas as visitas realizadas pela equipe</p>
        </div>
        <button
          onClick={openModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', borderRadius: T.rPill, background: T.coral, color: T.white, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(255,111,94,0.28)', transition: 'background .18s' }}
          onMouseEnter={e => { e.currentTarget.style.background = T.coralText }}
          onMouseLeave={e => { e.currentTarget.style.background = T.coral }}
        >
          <Plus style={{ width: 15, height: 15, strokeWidth: 2 }} />
          Registrar Visita
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={MapPin}       color="purple" label="Total de Visitas" value={stats.total} />
        <StatCard icon={CheckCircle2} color="coral"  label="Fechamentos"     value={stats.fechamento} />
        <StatCard icon={Clock}        color="lilac"  label="Retornar"        value={stats.retornar} />
        <StatCard icon={XCircle}      color="deep"   label="Sem Interesse"   value={stats.semInteresse} />
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
              options: [{ value: '', label: 'Todos' }, ...consultants.map(c => ({ value: c.id, label: c.nome }))],
            },
            {
              label: 'Polo', value: filterPolo, onChange: setFilterPolo,
              options: [{ value: '', label: 'Todos' }, { value: 'Fortaleza', label: 'Fortaleza' }, { value: 'Belém', label: 'Belém' }],
            },
            {
              label: 'Resultado', value: filterResult, onChange: setFilterResult,
              options: [{ value: '', label: 'Todos' }, ...RESULT_OPTIONS.map(r => ({ value: r.value, label: r.label }))],
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
              onAction={openModal}
            />
          </div>
        ) : (
          filtered.map(visit => {
            const rc       = RESULT_CONFIG[visit.resultado] || RESULT_CONFIG.pendente
            const consNome = visit.jt_consultants?.nome || '—'
            return (
              <div key={visit.id}
                style={{ background: T.white, borderRadius: T.rCard, boxShadow: T.cardShadow, border: `1px solid ${T.line}`, padding: '18px 20px', transition: 'border-color .15s, box-shadow .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple + '44'; e.currentTarget.style.boxShadow = T.cardShadowHover }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.line;           e.currentTarget.style.boxShadow = T.cardShadow }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>
                  {/* Left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: T.iconGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: T.white }}>
                      {consNome.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: '0 0 3px' }}>{visit.empresa}</p>
                      <span style={{ fontSize: 12, color: T.muted }}>{consNome}</span>
                    </div>
                  </div>

                  {/* Middle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                    {visit.polo && (
                      <div>
                        <p style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Polo</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: 0 }}>{visit.polo}</p>
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Data</p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: 0 }}>
                        {new Date(visit.data_visita + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {/* Result pill */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: rc.bg, color: rc.text, borderRadius: T.rPill, fontSize: 12, fontWeight: 600, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: rc.dot, flexShrink: 0 }} />
                    {rc.label}
                  </span>
                </div>

                {visit.observacoes && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                    <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, margin: 0 }}>{visit.observacoes}</p>
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
              <select required value={form.consultor_id} onChange={e => setForm({ ...form, consultor_id: e.target.value })} className={inputClass}>
                <option value="">Selecione...</option>
                {consultants.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Polo</label>
              <select value={form.polo} onChange={e => setForm({ ...form, polo: e.target.value })} className={inputClass}>
                <option>Fortaleza</option>
                <option>Belém</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Empresa / Prospect</label>
            <input required value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} placeholder="Ex: Supermercado Estrela" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Data da Visita</label>
              <input required type="date" value={form.data_visita} onChange={e => setForm({ ...form, data_visita: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Resultado</label>
              <select value={form.resultado} onChange={e => setForm({ ...form, resultado: e.target.value })} className={inputClass}>
                {RESULT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Observações</label>
            <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Descreva o que aconteceu na visita..." rows={3} className={`${inputClass} resize-none`} />
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
