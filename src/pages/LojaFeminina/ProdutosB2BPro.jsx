import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Search, ChevronDown, ChevronRight, Package, Video } from 'lucide-react'

const UI   = "'Plus Jakarta Sans', sans-serif"
const MONO = "'Space Mono', monospace"

const P      = '#5E2BD0'
const ACCENT = '#F2643C'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function getLabel(v) {
  const key = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
  return key ? String(v[key]) : null
}

function statusOf(qty) {
  const q = Number(qty || 0)
  if (q <= 2) return 'critico'
  if (q <= 5) return 'atencao'
  return null
}

const BADGE = {
  critico: { label: 'Crítico',  bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  atencao: { label: 'Atenção',  bg: '#FBEFD6', color: '#b45309', border: '#fde68a' },
}

const TAMANHOS_DEFAULT = ['PP', 'P', 'M', 'G', 'GG', 'XG']
const EMPTY_GRADE = () => TAMANHOS_DEFAULT.map(t => ({ tamanho: t, quantidade: '' }))

const lbl = {
  display: 'block', fontSize: 10, fontWeight: 700, color: '#8A8A93',
  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
  fontFamily: UI,
}
const inp = {
  width: '100%', height: 44, border: '1px solid #ECECF1', borderRadius: 12,
  padding: '0 14px', fontFamily: UI, fontSize: 14,
  color: '#18181B', background: '#F6F6F9', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color .15s',
}

function GradeForm({ grade, setGrade, theme }) {
  function addTamanho() {
    setGrade(prev => [...prev, { tamanho: '', quantidade: '' }])
  }
  function removeTamanho(idx) {
    setGrade(prev => prev.filter((_, i) => i !== idx))
  }
  function setField(idx, field, val) {
    setGrade(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t))
  }

  const rowInp = {
    height: 42, border: '1px solid #ECECF1', borderRadius: 10,
    padding: '0 12px', fontFamily: UI, fontSize: 14,
    color: '#18181B', background: '#F6F6F9', outline: 'none', boxSizing: 'border-box', width: '100%',
  }

  return (
    <div>
      <label style={lbl}>Grade de Tamanho</label>
      {grade.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {grade.map((t, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={t.tamanho}
                onChange={e => setField(idx, 'tamanho', e.target.value)}
                placeholder="Ex: P, M, G, 36, 38..."
                style={{ ...rowInp, flex: 2 }}
              />
              <input
                type="number" min="0"
                value={t.quantidade}
                onChange={e => setField(idx, 'quantidade', e.target.value)}
                placeholder="Qtd"
                style={{ ...rowInp, flex: 1, textAlign: 'center', fontFamily: MONO }}
              />
              <button
                onClick={() => removeTamanho(idx)}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: 'none',
                  background: '#F6F6F9', cursor: 'pointer', color: '#8A8A93',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={addTamanho}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 10,
          border: `1px dashed ${P}80`, background: `${P}08`,
          cursor: 'pointer', fontFamily: UI, fontSize: 12, fontWeight: 600, color: P,
        }}
      >
        <Plus size={13} /> Adicionar tamanho
      </button>
    </div>
  )
}

function buildVariacoes(grade) {
  return grade
    .filter(t => t.tamanho.trim() && (parseInt(t.quantidade) || 0) >= 0)
    .map(t => ({ tamanho: t.tamanho.trim(), quantidade: parseInt(t.quantidade) || 0 }))
}

function variacaoesToGrade(variacoes) {
  if (!variacoes?.length) return EMPTY_GRADE()
  return variacoes.map(v => {
    const key = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
    return { tamanho: key ? String(v[key]) : '', quantidade: String(v.quantidade || 0) }
  })
}

function VideoSection({ previewUrl, existingUrl, onSelect, onRemovePreview, onRemoveExisting, error, theme }) {
  const MAX = 50 * 1024 * 1024
  function pick(file) {
    if (!file) return
    if (file.size > MAX) { onSelect(null, 'Vídeo muito grande. Limite: 50MB.'); return }
    const url = URL.createObjectURL(file)
    onSelect(file, url)
  }

  if (previewUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <video src={previewUrl} controls muted style={{ width: '100%', borderRadius: 10, maxHeight: 200, background: '#000' }} />
        <button
          onClick={onRemovePreview}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontFamily: UI, fontSize: 12, fontWeight: 600 }}
        >
          <X size={12} /> Remover seleção
        </button>
        {error && <p style={{ fontFamily: UI, fontSize: 12, color: '#dc2626' }}>{error}</p>}
      </div>
    )
  }

  if (existingUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <video src={existingUrl} controls muted style={{ width: '100%', borderRadius: 10, maxHeight: 200, background: '#000' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1, cursor: 'pointer' }}>
            <input type="file" accept="video/mp4,video/quicktime,video/webm,video/mov" style={{ display: 'none' }} onChange={e => pick(e.target.files[0])} />
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 34, borderRadius: 8, border: `1px solid ${P}`, color: P, fontFamily: UI, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Video size={12} /> Substituir
            </span>
          </label>
          <button
            onClick={onRemoveExisting}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: 34, borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontFamily: UI, fontSize: 12, fontWeight: 600 }}
          >
            <X size={12} /> Remover
          </button>
        </div>
        {error && <p style={{ fontFamily: UI, fontSize: 12, color: '#dc2626' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input type="file" accept="video/mp4,video/quicktime,video/webm,video/mov" style={{ display: 'none' }} onChange={e => pick(e.target.files[0])} />
        <div style={{ border: '1.5px dashed #ECECF1', borderRadius: 12, padding: '20px 16px', textAlign: 'center', background: '#F6F6F9', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Video size={22} color="#A1A1AA" />
          <p style={{ fontFamily: UI, fontSize: 13, fontWeight: 600, color: '#18181B' }}>Selecionar vídeo</p>
          <p style={{ fontFamily: UI, fontSize: 11, color: '#8A8A93' }}>MP4, MOV ou WebM · Máx. 50MB</p>
        </div>
      </label>
      {error && <p style={{ fontFamily: UI, fontSize: 12, color: '#dc2626', marginTop: 6 }}>{error}</p>}
    </div>
  )
}

export default function ProdutosB2BPro({
  produtosData = [],
  updateVariacoes,
  addProduto,
  updateProduto,
  fetchAll,
  theme,
  LOJA_ID,
}) {
  const [search, setSearch]               = useState('')
  const [expanded, setExpanded]           = useState({})
  const [newProdOpen, setNewProdOpen]     = useState(false)
  const [newProd, setNewProd]             = useState({ nome: '', precoCusto: '', precoVenda: '', grade: EMPTY_GRADE() })
  const [newSaving, setNewSaving]         = useState(false)
  const [editModal, setEditModal]         = useState(null)
  const [editGrade, setEditGrade]         = useState([])
  const [editSaving, setEditSaving]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting]           = useState(false)
  const [toast, setToast]                 = useState('')

  const [newVideoFile, setNewVideoFile]         = useState(null)
  const [newVideoPreview, setNewVideoPreview]   = useState(null)
  const [newVideoError, setNewVideoError]       = useState('')
  const [editVideoFile, setEditVideoFile]       = useState(null)
  const [editVideoPreview, setEditVideoPreview] = useState(null)
  const [editVideoUrl, setEditVideoUrl]         = useState('')
  const [editVideoError, setEditVideoError]     = useState('')
  const [uploadingVideo, setUploadingVideo]     = useState(false)

  const filtered = produtosData.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  )

  const totalPecas = produtosData.reduce((s, p) =>
    s + (p.variacoes || []).reduce((acc, v) => acc + Number(v.quantidade || 0), 0), 0)
  const totalVenda = produtosData.reduce((s, p) => {
    const qtd = (p.variacoes || []).reduce((acc, v) => acc + Number(v.quantidade || 0), 0)
    return s + qtd * Number(p.preco_venda || 0)
  }, 0)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function uploadVideo(file, prefix) {
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${LOJA_ID}/${prefix}_${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('produtos-videos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw new Error(error.message)
    const { data: { publicUrl } } = supabase.storage.from('produtos-videos').getPublicUrl(path)
    return publicUrl
  }

  function openEdit(produto) {
    setEditGrade(variacaoesToGrade(produto.variacoes))
    setEditVideoUrl(produto.video_url || '')
    setEditVideoFile(null)
    setEditVideoPreview(null)
    setEditVideoError('')
    setEditModal({ produto })
  }

  async function handleAddProduto() {
    if (!newProd.nome.trim() || newSaving) return
    const variacoes = buildVariacoes(newProd.grade)
    if (variacoes.length === 0) return
    setNewSaving(true)

    let videoUrl = null
    if (newVideoFile) {
      setUploadingVideo(true)
      try { videoUrl = await uploadVideo(newVideoFile, `prod_${Date.now()}`) }
      catch (e) { setNewVideoError('Erro no upload: ' + e.message); setNewSaving(false); setUploadingVideo(false); return }
      setUploadingVideo(false)
    }

    const err = await addProduto(newProd.nome.trim(), {
      precoCusto: parseFloat((newProd.precoCusto || '').replace(',', '.')) || 0,
      precoVenda: parseFloat((newProd.precoVenda || '').replace(',', '.')) || 0,
      variacoes,
      video_url: videoUrl,
    })
    setNewSaving(false)
    if (!err) {
      setNewProdOpen(false)
      setNewProd({ nome: '', precoCusto: '', precoVenda: '', grade: EMPTY_GRADE() })
      setNewVideoFile(null); setNewVideoPreview(null); setNewVideoError('')
    }
  }

  async function handleSaveEdit() {
    if (!editModal || editSaving) return
    const variacoes = buildVariacoes(editGrade)
    setEditSaving(true)

    let finalVideoUrl = editVideoUrl
    if (editVideoFile) {
      setUploadingVideo(true)
      try { finalVideoUrl = await uploadVideo(editVideoFile, editModal.produto.id) }
      catch (e) { setEditVideoError('Erro no upload: ' + e.message); setEditSaving(false); setUploadingVideo(false); return }
      setUploadingVideo(false)
    }

    await updateProduto(editModal.produto.id, { variacoes, video_url: finalVideoUrl || null })
    setEditSaving(false)
    setEditModal(null)
  }

  async function handleDeleteProduto() {
    if (!deleteConfirm) return
    setDeleting(true)
    const error = await updateProduto(deleteConfirm.produto.id, { ativo: false })
    if (!error) { setDeleteConfirm(null); setDeleting(false); showToast('Produto excluído.') }
    else { setDeleting(false) }
  }

  const newCanSave = newProd.nome.trim() && !newSaving && buildVariacoes(newProd.grade).length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#18181B', color: '#fff', padding: '10px 22px', borderRadius: 12,
          fontFamily: UI, fontSize: 13, fontWeight: 600, zIndex: 400,
          whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}

      {/* Destaque cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Valor em estoque — roxo cheio */}
        <div style={{
          background: P, borderRadius: 16, padding: '18px 18px',
          boxShadow: '0 10px 22px -10px rgba(94,43,208,.55)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -20, bottom: -20, width: 80, height: 80, borderRadius: '50%', background: ACCENT, opacity: 0.35 }} />
          <p style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
            Valor em Estoque
          </p>
          <p style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 4 }}>
            {fmtR(totalVenda)}
          </p>
          <p style={{ fontFamily: UI, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            <span style={{ fontFamily: MONO }}>{totalPecas}</span> peças em estoque
          </p>
        </div>
        {/* PRO card */}
        <div style={{
          background: '#ECE6FB', borderRadius: 16, padding: '18px 18px',
          border: `1px solid ${P}22`,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
            background: P, color: '#fff', fontFamily: UI, letterSpacing: '0.08em',
            textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 8,
          }}>
            Pro
          </span>
          <p style={{ fontFamily: UI, fontSize: 13, fontWeight: 600, color: P, lineHeight: 1.3 }}>
            Grade de tamanho ativa
          </p>
        </div>
      </div>

      {/* Busca + Novo */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color="#A1A1AA" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            style={{ width: '100%', height: 44, border: '1px solid #ECECF1', borderRadius: 12, padding: '0 14px 0 40px', fontFamily: UI, fontSize: 13, color: '#18181B', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <button
          onClick={() => { setNewProd({ nome: '', precoCusto: '', precoVenda: '', grade: EMPTY_GRADE() }); setNewVideoFile(null); setNewVideoPreview(null); setNewVideoError(''); setNewProdOpen(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 18px', height: 44, borderRadius: 12, flexShrink: 0,
            background: P, color: '#fff', fontFamily: UI, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            boxShadow: '0 10px 22px -10px rgba(94,43,208,.6)',
          }}
        >
          <Plus size={14} color="#fff" /> Novo
        </button>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: '56px 24px', textAlign: 'center' }}>
          <Package size={32} color="#ECECF1" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: UI, fontSize: 14, color: '#8A8A93' }}>
            {search ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.'}
          </p>
        </div>
      ) : filtered.map(produto => {
        const variacoes = produto.variacoes || []
        const isOpen = !!expanded[produto.id]
        const total = variacoes.reduce((s, v) => s + Number(v.quantidade || 0), 0)
        const ps = variacoes.some(v => statusOf(v.quantidade) === 'critico') ? 'critico'
          : variacoes.some(v => statusOf(v.quantidade) === 'atencao') ? 'atencao' : null

        return (
          <div key={produto.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', overflow: 'hidden' }}>
            <button
              onClick={() => setExpanded(p => ({ ...p, [produto.id]: !p[produto.id] }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontFamily: UI, fontSize: 14, fontWeight: 700, color: '#18181B' }}>{produto.nome}</span>
                  {ps && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: BADGE[ps].bg, color: BADGE[ps].color, border: `1px solid ${BADGE[ps].border}`, fontFamily: UI }}>
                      {BADGE[ps].label}
                    </span>
                  )}
                  {produto.video_url && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#ECE6FB', color: '#7c3aed', border: '1px solid #c4b5fd', fontFamily: UI, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Video size={9} /> vídeo
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {variacoes.map((v, idx) => {
                    const label = getLabel(v)
                    const s = statusOf(v.quantidade)
                    return (
                      <span key={idx} style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                        background: s ? BADGE[s].bg : '#ECE6FB',
                        color: s ? BADGE[s].color : P,
                        border: `1px solid ${s ? BADGE[s].border : P + '28'}`,
                        fontFamily: UI,
                      }}>
                        {label}: <span style={{ fontFamily: MONO }}>{v.quantidade}</span>
                      </span>
                    )
                  })}
                  {variacoes.length === 0 && (
                    <span style={{ fontFamily: UI, fontSize: 11, color: '#A1A1AA' }}>Sem tamanhos cadastrados</span>
                  )}
                </div>
              </div>
              {isOpen
                ? <ChevronDown size={16} color="#A1A1AA" />
                : <ChevronRight size={16} color="#A1A1AA" />}
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid #ECECF1', padding: '12px 18px 16px', background: '#F6F6F9' }}>
                <p style={{ fontFamily: UI, fontSize: 12, color: '#8A8A93', marginBottom: 12 }}>
                  <span style={{ fontFamily: MONO }}>{total}</span> peça{total !== 1 ? 's' : ''} · {fmtR(produto.preco_venda)}/peça
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => openEdit(produto)}
                    style={{
                      flex: 1, height: 38, borderRadius: 10, border: `1px solid ${P}`,
                      background: '#fff', color: P, fontFamily: UI,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Editar grade
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ produto })}
                    style={{
                      height: 38, padding: '0 14px', borderRadius: 10,
                      border: '1px solid #fca5a5', background: '#fee2e2',
                      color: '#dc2626', fontFamily: UI, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Modal — Novo Produto */}
      {newProdOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setNewProdOpen(false)}
        >
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <p style={{ fontFamily: UI, fontWeight: 800, fontSize: 16, color: '#18181B' }}>Novo Produto com Grade</p>
              <button onClick={() => setNewProdOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A93', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Nome do Produto *</label>
                <input value={newProd.nome} onChange={e => setNewProd(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Vestido Floral, Blusa Básica..." style={inp} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Preço de Custo</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8A8A93', fontFamily: UI, pointerEvents: 'none' }}>R$</span>
                    <input type="number" min="0" step="0.01" value={newProd.precoCusto} onChange={e => setNewProd(p => ({ ...p, precoCusto: e.target.value }))} placeholder="0,00" style={{ ...inp, paddingLeft: 36 }} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Preço de Venda *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8A8A93', fontFamily: UI, pointerEvents: 'none' }}>R$</span>
                    <input type="number" min="0" step="0.01" value={newProd.precoVenda} onChange={e => setNewProd(p => ({ ...p, precoVenda: e.target.value }))} placeholder="0,00" style={{ ...inp, paddingLeft: 36 }} />
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #ECECF1', paddingTop: 16 }}>
                <GradeForm grade={newProd.grade} setGrade={g => setNewProd(p => ({ ...p, grade: g }))} theme={theme} />
              </div>
              <div style={{ borderTop: '1px solid #ECECF1', paddingTop: 16 }}>
                <label style={lbl}>Vídeo do produto (opcional)</label>
                <VideoSection
                  previewUrl={newVideoPreview} existingUrl={null}
                  onSelect={(file, previewOrError) => {
                    if (!file) { setNewVideoError(previewOrError); return }
                    setNewVideoFile(file); setNewVideoPreview(previewOrError); setNewVideoError('')
                  }}
                  onRemovePreview={() => { setNewVideoFile(null); setNewVideoPreview(null); setNewVideoError('') }}
                  onRemoveExisting={null}
                  error={uploadingVideo ? 'Fazendo upload...' : newVideoError}
                  theme={theme}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setNewProdOpen(false)}
                style={{ flex: 1, height: 48, borderRadius: 12, border: '1px solid #ECECF1', background: '#F6F6F9', cursor: 'pointer', fontFamily: UI, fontWeight: 600, color: '#18181B', fontSize: 14 }}>
                Cancelar
              </button>
              <button
                onClick={handleAddProduto} disabled={!newCanSave}
                style={{
                  flex: 2, height: 48, borderRadius: 12, border: 'none',
                  background: newCanSave ? P : '#ECECF1',
                  cursor: newCanSave ? 'pointer' : 'not-allowed',
                  fontFamily: UI, fontWeight: 700,
                  color: newCanSave ? '#fff' : '#A1A1AA', fontSize: 14,
                  boxShadow: newCanSave ? '0 10px 22px -10px rgba(94,43,208,.6)' : 'none',
                }}
              >
                {newSaving ? (uploadingVideo ? 'Enviando vídeo...' : 'Salvando...') : 'Salvar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Editar Grade + Vídeo */}
      {editModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setEditModal(null)}
        >
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: UI, fontWeight: 800, fontSize: 16, color: '#18181B' }}>
                Editar Grade — {editModal.produto.nome}
              </p>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A93', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <GradeForm grade={editGrade} setGrade={setEditGrade} theme={theme} />
            <div style={{ borderTop: '1px solid #ECECF1', paddingTop: 16, marginTop: 16 }}>
              <label style={lbl}>Vídeo do produto</label>
              <VideoSection
                previewUrl={editVideoPreview}
                existingUrl={editVideoFile ? null : editVideoUrl}
                onSelect={(file, previewOrError) => {
                  if (!file) { setEditVideoError(previewOrError); return }
                  setEditVideoFile(file); setEditVideoPreview(previewOrError); setEditVideoError('')
                }}
                onRemovePreview={() => { setEditVideoFile(null); setEditVideoPreview(null); setEditVideoError('') }}
                onRemoveExisting={() => { setEditVideoUrl(''); setEditVideoError('') }}
                error={uploadingVideo ? 'Fazendo upload...' : editVideoError}
                theme={theme}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setEditModal(null)}
                style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid #ECECF1', background: '#F6F6F9', cursor: 'pointer', fontFamily: UI, fontWeight: 600, color: '#18181B', fontSize: 14 }}>
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit} disabled={editSaving}
                style={{
                  flex: 2, height: 46, borderRadius: 12, border: 'none',
                  background: editSaving ? '#ECECF1' : P,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  fontFamily: UI, fontWeight: 700,
                  color: editSaving ? '#A1A1AA' : '#fff', fontSize: 14,
                  boxShadow: editSaving ? 'none' : '0 10px 22px -10px rgba(94,43,208,.6)',
                }}
              >
                {editSaving ? (uploadingVideo ? 'Enviando vídeo...' : 'Salvando...') : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Confirmar Exclusão */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <p style={{ fontFamily: UI, fontWeight: 800, fontSize: 16, color: '#18181B', marginBottom: 10 }}>
              Excluir produto?
            </p>
            <p style={{ fontFamily: UI, fontSize: 14, color: '#8A8A93', lineHeight: 1.5, marginBottom: 20 }}>
              Tem certeza que quer excluir <strong style={{ color: '#18181B' }}>{deleteConfirm.produto.nome}</strong>? Essa ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid #ECECF1', background: '#F6F6F9', cursor: 'pointer', fontFamily: UI, fontWeight: 600, color: '#18181B', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={handleDeleteProduto} disabled={deleting}
                style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: deleting ? '#ECECF1' : '#DC2626', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: UI, fontWeight: 700, color: deleting ? '#A1A1AA' : '#fff', fontSize: 14 }}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
