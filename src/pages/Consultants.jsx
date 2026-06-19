import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Edit2, MapPin, TrendingUp, Award } from 'lucide-react'
import EmptyState from '../components/junttos/EmptyState'
import Modal from '../components/Modal'
import { T } from '../theme/tokens'

const COLORS = [T.purple, T.lilac, T.coral, T.purpleDeep]
const emptyForm = { nome: '', email: '', telefone: '', ativo: true }

export default function Consultants() {
  const [consultants, setConsultants] = useState([])
  const [visits,      setVisits]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editing,     setEditing]     = useState(null)
  const [form,        setForm]        = useState(emptyForm)
  const [confirmDel,  setConfirmDel]  = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: cons }, { data: vis }] = await Promise.all([
      supabase.from('jt_consultants').select('*').order('created_at'),
      supabase.from('jt_visits').select('consultor_id, resultado'),
    ])
    setConsultants(cons || [])
    setVisits(vis || [])
    setLoading(false)
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(c) {
    setEditing(c)
    setForm({ nome: c.nome, email: c.email || '', telefone: c.telefone || '', ativo: c.ativo })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (editing) {
      const { data } = await supabase.from('jt_consultants').update(form).eq('id', editing.id).select().single()
      setConsultants(prev => prev.map(c => c.id === editing.id ? data : c))
    } else {
      const { data } = await supabase.from('jt_consultants').insert(form).select().single()
      setConsultants(prev => [...prev, data])
    }
    setModalOpen(false)
  }

  async function handleDelete(id) {
    await supabase.from('jt_consultants').delete().eq('id', id)
    setConsultants(prev => prev.filter(c => c.id !== id))
    setConfirmDel(null)
  }

  const stats = consultants.map((c, i) => {
    const myVisits    = visits.filter(v => v.consultor_id === c.id)
    const fechamentos = myVisits.filter(v => v.resultado === 'fechamento').length
    const rate        = myVisits.length > 0 ? Math.round((fechamentos / myVisits.length) * 100) : 0
    return { ...c, color: COLORS[i % COLORS.length], totalVisits: myVisits.length, fechamentos, rate }
  })

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em' }}>Consultores</h1>
          <p style={{ fontSize: 13.5, color: T.muted, marginTop: 4 }}>Equipe comercial e métricas de visitas</p>
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Consultores</h1>
          <p style={{ fontSize: 13.5, color: T.muted }}>Equipe comercial e métricas de visitas</p>
        </div>
        <button
          onClick={openAdd}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', borderRadius: T.rPill, background: T.coral, color: T.white, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(255,111,94,0.28)', transition: 'background .18s' }}
          onMouseEnter={e => { e.currentTarget.style.background = T.coralText }}
          onMouseLeave={e => { e.currentTarget.style.background = T.coral }}
        >
          <Plus style={{ width: 15, height: 15, strokeWidth: 2 }} />
          Novo Consultor
        </button>
      </div>

      {consultants.length === 0 ? (
        <div style={{ background: T.white, borderRadius: T.rCard, boxShadow: T.cardShadow, border: `1px solid ${T.line}` }}>
          <EmptyState
            title="Nenhum consultor cadastrado"
            description="Adicione consultores para ver métricas de desempenho."
            action="Novo Consultor"
            onAction={openAdd}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {stats.map((c, idx) => (
            <div key={c.id} style={{ background: T.white, borderRadius: T.rCard, boxShadow: T.cardShadow, border: `1px solid ${T.line}`, padding: 24 }}>
              {/* Profile row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: T.iconGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: T.white, boxShadow: '0 4px 12px rgba(94,43,208,0.25)', letterSpacing: '0.02em' }}>
                  {c.nome.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: T.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</h2>
                    {idx === 0 && consultants.length > 1 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: T.statusTrialBg, color: T.statusTrialTx, fontSize: 10, fontWeight: 700, borderRadius: T.rPill, padding: '2px 7px', flexShrink: 0 }}>
                        <Award style={{ width: 10, height: 10 }} /> Top
                      </span>
                    )}
                  </div>
                  {c.email    && <p style={{ fontSize: 12.5, color: T.muted, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</p>}
                  {c.telefone && <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>{c.telefone}</p>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => openEdit(c)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, transition: 'color .15s, border-color .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = T.purpleText; e.currentTarget.style.borderColor = T.purple }}
                    onMouseLeave={e => { e.currentTarget.style.color = T.muted;     e.currentTarget.style.borderColor = T.line }}>
                    <Edit2 style={{ width: 12, height: 12 }} />
                  </button>
                  <button onClick={() => setConfirmDel(c)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, transition: 'color .15s, border-color .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = T.coralText; e.currentTarget.style.borderColor = T.coral }}
                    onMouseLeave={e => { e.currentTarget.style.color = T.muted;     e.currentTarget.style.borderColor = T.line }}>
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { icon: MapPin,     label: 'Visitas',     value: c.totalVisits, color: T.lilac,         tint: T.tintLilac    },
                  { icon: Award,      label: 'Fechamentos', value: c.fechamentos, color: T.statusAtivoTx,  tint: T.statusAtivoBg },
                  { icon: TrendingUp, label: 'Conversão',   value: c.rate + '%',  color: T.statusTrialTx,  tint: T.statusTrialBg },
                ].map(({ icon: Icon, label, value, color, tint }) => (
                  <div key={label} style={{ background: T.mist, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                      <Icon style={{ width: 13, height: 13, color, strokeWidth: 1.9 }} />
                    </div>
                    <p style={{ fontSize: 11, color: T.muted, margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Consultor' : 'Novo Consultor'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nome completo</label>
            <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: João Silva" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>E-mail</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="joao@empresa.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(85) 9 9999-9999" className={inputClass} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className={cancelBtn}>Cancelar</button>
            <button type="submit" className={submitBtn}>{editing ? 'Salvar Alterações' : 'Cadastrar'}</button>
          </div>
        </form>
      </Modal>

      {/* Confirm delete */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Excluir Consultor" size="sm">
        <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.6, marginBottom: 20 }}>
          Tem certeza que deseja excluir <strong>{confirmDel?.nome}</strong>? As visitas associadas perderão o vínculo com o consultor.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmDel(null)} className={cancelBtn}>Cancelar</button>
          <button onClick={() => handleDelete(confirmDel.id)}
            style={{ flex: 1, background: T.coral, color: T.white, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, padding: '10px', cursor: 'pointer', transition: 'background .18s' }}
            onMouseEnter={e => { e.currentTarget.style.background = T.coralText }}
            onMouseLeave={e => { e.currentTarget.style.background = T.coral }}>
            Excluir
          </button>
        </div>
      </Modal>
    </div>
  )
}

const labelClass = 'block text-sm font-medium text-[#16101F] mb-1.5'
const inputClass = 'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] focus:ring-1 focus:ring-[#5E2BD0]/15 transition'
const cancelBtn  = 'flex-1 bg-[#ECE7F4] hover:bg-[#ECE7F4] text-[#16101F] text-sm font-semibold py-2.5 rounded-xl transition'
const submitBtn  = 'flex-1 bg-[#FF6F5E] hover:bg-[#DD4F3E] text-white text-sm font-semibold py-2.5 rounded-xl transition'
