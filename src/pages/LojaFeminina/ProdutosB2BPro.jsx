import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Search, ChevronDown, ChevronRight, Package, Video, Image, Copy, Check, Link } from 'lucide-react'

const PROD_BASE = 'https://junttos-admin.vercel.app'
const TAMANHOS_SIMPLES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'Único']

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
  critico: { label: 'Crítico', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  atencao: { label: 'Atenção', bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
}

const TAMANHOS_DEFAULT = ['PP', 'P', 'M', 'G', 'GG', 'XG']
const EMPTY_GRADE = () => TAMANHOS_DEFAULT.map(t => ({ tamanho: t, quantidade: '' }))

const lbl = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6,
  fontFamily: 'var(--font-ui)',
}
const inp = {
  width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 'var(--r-input)',
  padding: '0 14px', fontFamily: 'var(--font-ui)', fontSize: 14,
  color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box',
}

// ── Grade form (shared between Novo e Editar) ────────────────
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
    height: 42, border: '1.5px solid var(--line)', borderRadius: 10,
    padding: '0 12px', fontFamily: 'var(--font-ui)', fontSize: 14,
    color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box', width: '100%',
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
                style={{ ...rowInp, flex: 1, textAlign: 'center' }}
              />
              <button
                onClick={() => removeTamanho(idx)}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: 'none',
                  background: 'var(--bg)', cursor: 'pointer', color: 'var(--muted)',
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
          padding: '7px 14px', borderRadius: 'var(--r-chip)',
          border: `1px dashed ${theme.primary}80`, background: `${theme.primary}08`,
          cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: theme.primary,
        }}
      >
        <Plus size={13} /> Adicionar tamanho
      </button>
    </div>
  )
}

// ── Converte grade form → variacoes para salvar ──────────────
function buildVariacoes(grade) {
  return grade
    .filter(t => t.tamanho.trim() && (parseInt(t.quantidade) || 0) >= 0)
    .map(t => ({ tamanho: t.tamanho.trim(), quantidade: parseInt(t.quantidade) || 0 }))
}

// ── Modo simples: salva tamanhos selecionados com quantidade fixa ──
function buildVariacoesModoSimples(tamanhos) {
  return tamanhos.map(t => ({ tamanho: t, quantidade: 9999 }))
}

function variacoeesToTamanhosSel(variacoes) {
  if (!variacoes?.length) return []
  return variacoes.map(v => {
    const key = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
    return key ? String(v[key]) : null
  }).filter(Boolean)
}

// ── Converte variacoes salvas → grade form ───────────────────
function variacaoesToGrade(variacoes) {
  if (!variacoes?.length) return EMPTY_GRADE()
  return variacoes.map(v => {
    const key = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
    return { tamanho: key ? String(v[key]) : '', quantidade: String(v.quantidade || 0) }
  })
}

// ── Seletor de tamanhos (modo simples) ───────────────────────
function SeletorTamanhos({ selected, onChange, theme }) {
  function toggle(t) {
    onChange(selected.includes(t) ? selected.filter(s => s !== t) : [...selected, t])
  }
  return (
    <div>
      <label style={lbl}>Tamanhos disponíveis</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TAMANHOS_SIMPLES.map(t => {
          const active = selected.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              style={{
                padding: '8px 16px', borderRadius: 20,
                border: `1.5px solid ${active ? theme.primary : 'var(--line)'}`,
                background: active ? theme.primary : 'var(--bg)',
                color: active ? '#fff' : 'var(--ink)',
                fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Seção de upload de vídeo (reutilizada nos dois modais) ───
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
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--status-bad-dot)', background: 'var(--status-bad-bg)', color: 'var(--status-bad-tx)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600 }}
        >
          <X size={12} /> Remover seleção
        </button>
        {error && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--status-bad-tx)' }}>{error}</p>}
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
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 34, borderRadius: 8, border: `1px solid ${theme.primary}`, color: theme.primary, fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Video size={12} /> Substituir
            </span>
          </label>
          <button
            onClick={onRemoveExisting}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: 34, borderRadius: 8, border: '1px solid var(--status-bad-dot)', background: 'var(--status-bad-bg)', color: 'var(--status-bad-tx)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600 }}
          >
            <X size={12} /> Remover
          </button>
        </div>
        {error && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--status-bad-tx)' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input type="file" accept="video/mp4,video/quicktime,video/webm,video/mov" style={{ display: 'none' }} onChange={e => pick(e.target.files[0])} />
        <div style={{ border: '1.5px dashed var(--line)', borderRadius: 'var(--r-input)', padding: '20px 16px', textAlign: 'center', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Video size={22} color="var(--muted)" />
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Selecionar vídeo</p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--muted)' }}>MP4, MOV ou WebM · Máx. 50MB</p>
        </div>
      </label>
      {error && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--status-bad-tx)', marginTop: 6 }}>{error}</p>}
    </div>
  )
}

// ── Seção de upload de fotos (múltiplas por produto) ─────────
function FotosSection({ fotos = [], fotoFiles = [], onAddFiles, onRemoveUrl, onRemoveFile, uploading, theme }) {
  const MAX = 10 * 1024 * 1024
  function pick(files) {
    const validos = Array.from(files).filter(f => f.size <= MAX && f.type.startsWith('image/'))
    if (!validos.length) return
    onAddFiles(validos.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) })))
  }
  const total = fotos.length + fotoFiles.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {total > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {fotos.map((url, i) => (
            <div key={`u${i}`} style={{ position: 'relative' }}>
              <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }} />
              <button onClick={() => onRemoveUrl(i)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--status-bad-tx)', border: '2px solid var(--surface)', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
            </div>
          ))}
          {fotoFiles.map(({ previewUrl }, i) => (
            <div key={`f${i}`} style={{ position: 'relative' }}>
              <img src={previewUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: `1.5px solid ${theme.primary}`, display: 'block' }} />
              <button onClick={() => onRemoveFile(i)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--status-bad-tx)', border: '2px solid var(--surface)', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => pick(e.target.files)} />
        <div style={{ border: '1.5px dashed var(--line)', borderRadius: 'var(--r-input)', padding: '14px 16px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Image size={18} color="var(--muted)" />
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
              {total > 0 ? 'Adicionar mais fotos' : 'Selecionar fotos'}
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--muted)' }}>JPG, PNG, WebP · Máx. 10MB cada</p>
          </div>
        </div>
      </label>
      {uploading && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: theme.primary }}>Enviando fotos...</p>}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────
export default function ProdutosB2BPro({
  produtosData = [],
  updateVariacoes,
  addProduto,
  updateProduto,
  fetchAll,
  theme,
  LOJA_ID,
  config = null,
}) {
  const modoSimples = !!config?.features?.catalogo_b2b_modo_simples
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

  // Video — novo produto
  const [newVideoFile, setNewVideoFile]       = useState(null)
  const [newVideoPreview, setNewVideoPreview] = useState(null)
  const [newVideoError, setNewVideoError]     = useState('')

  // Video — editar produto
  const [editVideoFile, setEditVideoFile]       = useState(null)
  const [editVideoPreview, setEditVideoPreview] = useState(null)
  const [editVideoUrl, setEditVideoUrl]         = useState('')
  const [editVideoError, setEditVideoError]     = useState('')

  const [uploadingVideo, setUploadingVideo] = useState(false)

  // Fotos — novo produto
  const [newFotoFiles, setNewFotoFiles]   = useState([])
  // Fotos — editar produto
  const [editFotos, setEditFotos]         = useState([])
  const [editFotoFiles, setEditFotoFiles] = useState([])

  const [uploadingFotos, setUploadingFotos] = useState(false)

  // Tamanhos modo simples
  const [newTamanhosSel,  setNewTamanhosSel]  = useState([])
  const [editTamanhosSel, setEditTamanhosSel] = useState([])
  const [loteTamanhosSel, setLoteTamanhosSel] = useState([])

  // Link copiado
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Lote
  const [loteOpen, setLoteOpen]             = useState(false)
  const [loteItems, setLoteItems]           = useState([])
  const [loteNomeBase, setLoteNomeBase]     = useState('')
  const [lotePrecoVenda, setLotePrecoVenda] = useState('')
  const [loteGrade, setLoteGrade]           = useState(EMPTY_GRADE)
  const [loteSaving, setLoteSaving]         = useState(false)
  const [loteError, setLoteError]           = useState('')

  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'Escape') return
      if (deleteConfirm) setDeleteConfirm(null)
      else if (loteOpen && !loteSaving) setLoteOpen(false)
      else if (editModal) setEditModal(null)
      else if (newProdOpen) setNewProdOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [deleteConfirm, loteOpen, loteSaving, editModal, newProdOpen])

  const b2bProdutos = produtosData.filter(p => p.disponivel_catalogo_b2b === true)
  const filtered = b2bProdutos.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  )

  const totalPecas = b2bProdutos.reduce((s, p) =>
    s + (p.variacoes || []).reduce((acc, v) => acc + Number(v.quantidade || 0), 0), 0)
  const totalVenda = b2bProdutos.reduce((s, p) => {
    const qtd = (p.variacoes || []).reduce((acc, v) => acc + Number(v.quantidade || 0), 0)
    return s + qtd * Number(p.preco_venda || 0)
  }, 0)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function copiarLinkCatalogo() {
    navigator.clipboard.writeText(`${PROD_BASE}/${LOJA_ID}/catalogo`)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
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

  async function uploadFoto(file, prefix) {
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${LOJA_ID}/${prefix}_${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('produtos-fotos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw new Error(error.message)
    const { data: { publicUrl } } = supabase.storage.from('produtos-fotos').getPublicUrl(path)
    return publicUrl
  }

  function openEdit(produto) {
    if (modoSimples) {
      setEditTamanhosSel(variacoeesToTamanhosSel(produto.variacoes))
    } else {
      setEditGrade(variacaoesToGrade(produto.variacoes))
    }
    setEditVideoUrl(produto.video_url || '')
    setEditVideoFile(null)
    setEditVideoPreview(null)
    setEditVideoError('')
    setEditFotos(produto.fotos || [])
    setEditFotoFiles([])
    setEditModal({ produto })
  }

  async function handleAddProduto() {
    if (!newProd.nome.trim() || newSaving) return
    const variacoes = modoSimples
      ? buildVariacoesModoSimples(newTamanhosSel)
      : buildVariacoes(newProd.grade)
    if (variacoes.length === 0) return
    setNewSaving(true)

    let videoUrl = null
    if (newVideoFile) {
      setUploadingVideo(true)
      try {
        videoUrl = await uploadVideo(newVideoFile, `prod_${Date.now()}`)
      } catch (e) {
        setNewVideoError('Erro no upload: ' + e.message)
        setNewSaving(false)
        setUploadingVideo(false)
        return
      }
      setUploadingVideo(false)
    }

    const fotoUrls = []
    if (newFotoFiles.length > 0) {
      setUploadingFotos(true)
      try {
        for (const { file } of newFotoFiles) {
          fotoUrls.push(await uploadFoto(file, `prod_${Date.now()}`))
        }
      } catch (e) {
        setNewSaving(false)
        setUploadingFotos(false)
        return
      }
      setUploadingFotos(false)
    }

    const err = await addProduto(newProd.nome.trim(), {
      precoCusto: parseFloat((newProd.precoCusto || '').replace(',', '.')) || 0,
      precoVenda: parseFloat((newProd.precoVenda || '').replace(',', '.')) || 0,
      variacoes,
      video_url: videoUrl,
      fotos: fotoUrls,
      disponivel_catalogo_b2b: true,
    })
    setNewSaving(false)
    if (!err) {
      setNewProdOpen(false)
      setNewProd({ nome: '', precoCusto: '', precoVenda: '', grade: EMPTY_GRADE() })
      setNewTamanhosSel([])
      setNewVideoFile(null)
      setNewVideoPreview(null)
      setNewVideoError('')
      setNewFotoFiles([])
    }
  }

  async function handleSaveEdit() {
    if (!editModal || editSaving) return
    const variacoes = modoSimples
      ? buildVariacoesModoSimples(editTamanhosSel)
      : buildVariacoes(editGrade)
    setEditSaving(true)

    let finalVideoUrl = editVideoUrl
    if (editVideoFile) {
      setUploadingVideo(true)
      try {
        finalVideoUrl = await uploadVideo(editVideoFile, editModal.produto.id)
      } catch (e) {
        setEditVideoError('Erro no upload: ' + e.message)
        setEditSaving(false)
        setUploadingVideo(false)
        return
      }
      setUploadingVideo(false)
    }

    let finalFotos = editFotos
    if (editFotoFiles.length > 0) {
      setUploadingFotos(true)
      try {
        const newUrls = []
        for (const { file } of editFotoFiles) {
          newUrls.push(await uploadFoto(file, editModal.produto.id))
        }
        finalFotos = [...finalFotos, ...newUrls]
      } catch (e) {
        setEditVideoError('Erro no upload de foto: ' + e.message)
        setEditSaving(false)
        setUploadingFotos(false)
        return
      }
      setUploadingFotos(false)
    }

    await updateProduto(editModal.produto.id, {
      variacoes,
      video_url: finalVideoUrl || null,
      fotos: finalFotos,
    })
    setEditSaving(false)
    setEditFotoFiles([])
    setEditModal(null)
  }

  async function handleDeleteProduto() {
    if (!deleteConfirm) return
    setDeleting(true)
    const error = await updateProduto(deleteConfirm.produto.id, { ativo: false })
    if (!error) {
      setDeleteConfirm(null)
      setDeleting(false)
      showToast('Produto excluído.')
    } else {
      setDeleting(false)
    }
  }

  async function handleLote() {
    if (!loteItems.length || loteSaving) return
    setLoteSaving(true)
    setLoteError('')
    const nomeBase = loteNomeBase.trim() || 'Produto'
    const variacoes = modoSimples
      ? buildVariacoesModoSimples(loteTamanhosSel)
      : buildVariacoes(loteGrade)
    try {
      for (let i = 0; i < loteItems.length; i++) {
        const item = loteItems[i]
        setUploadingFotos(true)
        const fotoUrl = await uploadFoto(item.file, `lote_${i}_${Date.now()}`)
        setUploadingFotos(false)
        await addProduto(`${nomeBase} ${i + 1}`, {
          precoVenda: parseFloat(lotePrecoVenda) || 0,
          fotos: [fotoUrl],
          disponivel_catalogo_b2b: true,
          variacoes,
        })
      }
      setLoteOpen(false)
      setLoteItems([])
      setLoteNomeBase('')
      setLotePrecoVenda('')
      setLoteGrade(EMPTY_GRADE())
      setLoteTamanhosSel([])
      setLoteError('')
    } catch (e) {
      setUploadingFotos(false)
      setLoteError('Erro: ' + e.message)
    }
    setLoteSaving(false)
  }

  const newCanSave = newProd.nome.trim() && !newSaving && (
    modoSimples ? newTamanhosSel.length > 0 : buildVariacoes(newProd.grade).length > 0
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: '#fff', padding: '10px 22px', borderRadius: 'var(--r-chip)',
          fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, zIndex: 400,
          whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}

      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: theme.primary, borderRadius: 'var(--r-card)', padding: '18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
              Valor em Estoque
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {fmtR(totalVenda)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{totalPecas}</p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>peças</p>
          </div>
        </div>
        <div style={{ background: `${theme.primary}12`, borderRadius: 'var(--r-card)', padding: '18px 14px', border: `1px solid ${theme.primary}25`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: theme.primary, color: '#fff', fontFamily: 'var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 6 }}>
            Pro
          </span>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: theme.primary }}>
            Grade de tamanho ativa
          </p>
        </div>
      </div>

      {/* Busca + Novo */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            style={{ width: '100%', height: 46, border: '1.5px solid var(--line)', borderRadius: 'var(--r-input)', padding: '0 14px 0 40px', fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div
          role="button" tabIndex={0}
          onClick={copiarLinkCatalogo}
          title="Copiar link do catálogo"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: 46, borderRadius: 'var(--r-input)', flexShrink: 0, background: linkCopiado ? 'var(--status-ok-bg, #f0fdf4)' : 'var(--bg)', color: linkCopiado ? 'var(--status-ok-tx, #15803d)' : 'var(--muted)', border: `1px solid ${linkCopiado ? 'var(--status-ok-dot, #16a34a)' : 'var(--line)'}`, fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        >
          {linkCopiado ? <Check size={14} /> : <Copy size={14} />}
          {linkCopiado ? 'Copiado!' : 'Link'}
        </div>
        <div
          role="button" tabIndex={0}
          onClick={() => { setLoteItems([]); setLoteNomeBase(''); setLotePrecoVenda(''); setLoteGrade(EMPTY_GRADE()); setLoteTamanhosSel([]); setLoteError(''); setLoteOpen(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 14px', height: 46, borderRadius: 'var(--r-input)', flexShrink: 0, background: `${theme.primary}18`, color: theme.primary, border: `1px solid ${theme.primary}40`, fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
        >
          <Image size={14} /> Lote
        </div>
        <div
          role="button" tabIndex={0}
          onClick={() => { setNewProd({ nome: '', precoCusto: '', precoVenda: '', grade: EMPTY_GRADE() }); setNewTamanhosSel([]); setNewVideoFile(null); setNewVideoPreview(null); setNewVideoError(''); setNewFotoFiles([]); setNewProdOpen(true) }}
          onKeyDown={e => e.key === 'Enter' && (setNewProd({ nome: '', precoCusto: '', precoVenda: '', grade: EMPTY_GRADE() }), setNewTamanhosSel([]), setNewProdOpen(true))}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 46, borderRadius: 'var(--r-input)', flexShrink: 0, background: theme.primary, color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
        >
          <Plus size={14} color="#fff" /> Novo
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)', padding: '48px 24px', textAlign: 'center' }}>
          <Package size={32} color="var(--line)" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--muted)' }}>
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
          <div key={produto.id} style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <button
              onClick={() => setExpanded(p => ({ ...p, [produto.id]: !p[produto.id] }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              {produto.fotos?.[0] && (
                <img src={produto.fotos[0]} alt="" style={{ width: 48, height: 60, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid var(--line)' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{produto.nome}</span>
                  {ps && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: BADGE[ps].bg, color: BADGE[ps].color, border: `1px solid ${BADGE[ps].border}`, fontFamily: 'var(--font-ui)' }}>
                      {BADGE[ps].label}
                    </span>
                  )}
                  {produto.video_url && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'var(--status-info-bg)', color: 'var(--status-info-tx)', border: '1px solid var(--status-info-dot)', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Video size={9} /> vídeo
                    </span>
                  )}
                  {variacoes.length === 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'var(--status-warn-bg)', color: 'var(--status-warn-tx)', border: '1px solid var(--status-warn-dot)', fontFamily: 'var(--font-ui)' }}>
                      Sem grade
                    </span>
                  )}
                  {produto.fotos?.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--line)', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Image size={9} /> {produto.fotos.length} foto{produto.fotos.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {/* Mini-grade pills */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {variacoes.map((v, idx) => {
                    const label = getLabel(v)
                    const s = statusOf(v.quantidade)
                    return (
                      <span key={idx} style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 7,
                        background: s ? BADGE[s].bg : `${theme.primary}10`,
                        color: s ? BADGE[s].color : theme.primary,
                        border: `1px solid ${s ? BADGE[s].border : theme.primary + '28'}`,
                        fontFamily: 'var(--font-ui)',
                      }}>
                        {label}: {v.quantidade}
                      </span>
                    )
                  })}
                  {variacoes.length === 0 && (
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--muted)' }}>Sem tamanhos cadastrados</span>
                  )}
                </div>
              </div>
              {isOpen
                ? <ChevronDown size={16} color="var(--muted)" />
                : <ChevronRight size={16} color="var(--muted)" />}
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--line)', padding: '12px 18px 16px' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                  {total} peça{total !== 1 ? 's' : ''} · {fmtR(produto.preco_venda)}/peça
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => openEdit(produto)}
                    style={{
                      flex: 1, height: 38, borderRadius: 'var(--r-chip)', border: `1px solid ${theme.primary}`,
                      background: 'none', color: theme.primary, fontFamily: 'var(--font-ui)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Editar grade
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ produto })}
                    style={{
                      height: 38, padding: '0 14px', borderRadius: 'var(--r-chip)',
                      border: '1px solid var(--status-bad-dot)', background: 'var(--status-bad-bg)',
                      color: 'var(--status-bad-tx)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setNewProdOpen(false)}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                Novo Produto com Grade
              </p>
              <button onClick={() => setNewProdOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Nome do Produto *</label>
                <input
                  value={newProd.nome}
                  onChange={e => setNewProd(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Vestido Floral, Blusa Básica..."
                  style={inp}
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Preço de Custo</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-ui)', pointerEvents: 'none' }}>R$</span>
                    <input type="number" min="0" step="0.01" value={newProd.precoCusto} onChange={e => setNewProd(p => ({ ...p, precoCusto: e.target.value }))} placeholder="0,00" style={{ ...inp, paddingLeft: 36 }} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Preço de Venda *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-ui)', pointerEvents: 'none' }}>R$</span>
                    <input type="number" min="0" step="0.01" value={newProd.precoVenda} onChange={e => setNewProd(p => ({ ...p, precoVenda: e.target.value }))} placeholder="0,00" style={{ ...inp, paddingLeft: 36 }} />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                {modoSimples ? (
                  <SeletorTamanhos
                    selected={newTamanhosSel}
                    onChange={setNewTamanhosSel}
                    theme={theme}
                  />
                ) : (
                  <GradeForm
                    grade={newProd.grade}
                    setGrade={g => setNewProd(p => ({ ...p, grade: g }))}
                    theme={theme}
                  />
                )}
              </div>

              {/* Upload de fotos */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                <label style={lbl}>Fotos do produto (opcional)</label>
                <FotosSection
                  fotos={[]}
                  fotoFiles={newFotoFiles}
                  onAddFiles={novos => setNewFotoFiles(p => [...p, ...novos])}
                  onRemoveUrl={() => {}}
                  onRemoveFile={i => setNewFotoFiles(p => p.filter((_, j) => j !== i))}
                  uploading={uploadingFotos}
                  theme={theme}
                />
              </div>

              {/* Upload de vídeo */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                <label style={lbl}>Vídeo do produto (opcional)</label>
                <VideoSection
                  previewUrl={newVideoPreview}
                  existingUrl={null}
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
                style={{ flex: 1, height: 48, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                Cancelar
              </button>
              <button
                onClick={handleAddProduto}
                disabled={!newCanSave}
                style={{
                  flex: 2, height: 48, borderRadius: 'var(--r-input)', border: 'none',
                  background: newCanSave ? theme.primary : 'var(--line)',
                  cursor: newCanSave ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-ui)', fontWeight: 700,
                  color: newCanSave ? '#fff' : 'var(--muted)', fontSize: 14,
                }}
              >
                {newSaving ? (uploadingFotos ? 'Enviando fotos...' : uploadingVideo ? 'Enviando vídeo...' : 'Salvando...') : 'Salvar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Editar Grade + Vídeo */}
      {editModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setEditModal(null)}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                Editar Grade — {editModal.produto.nome}
              </p>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {modoSimples ? (
              <SeletorTamanhos
                selected={editTamanhosSel}
                onChange={setEditTamanhosSel}
                theme={theme}
              />
            ) : (
              <GradeForm grade={editGrade} setGrade={setEditGrade} theme={theme} />
            )}

            {/* Upload de fotos */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 16 }}>
              <label style={lbl}>Fotos do produto</label>
              <FotosSection
                fotos={editFotos}
                fotoFiles={editFotoFiles}
                onAddFiles={novos => setEditFotoFiles(p => [...p, ...novos])}
                onRemoveUrl={i => setEditFotos(p => p.filter((_, j) => j !== i))}
                onRemoveFile={i => setEditFotoFiles(p => p.filter((_, j) => j !== i))}
                uploading={uploadingFotos}
                theme={theme}
              />
            </div>

            {/* Upload de vídeo */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 16 }}>
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
                style={{ flex: 1, height: 46, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                style={{
                  flex: 2, height: 46, borderRadius: 'var(--r-input)', border: 'none',
                  background: editSaving ? 'var(--line)' : theme.primary,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-ui)', fontWeight: 700,
                  color: editSaving ? 'var(--muted)' : '#fff', fontSize: 14,
                }}
              >
                {editSaving ? (uploadingFotos ? 'Enviando fotos...' : uploadingVideo ? 'Enviando vídeo...' : 'Salvando...') : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Cadastro em Lote */}
      {loteOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && !loteSaving && setLoteOpen(false)}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Cadastro em Lote</p>
              <button onClick={() => !loteSaving && setLoteOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {loteItems.length === 0 ? (
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
                  const files = Array.from(e.target.files)
                  if (!files.length) return
                  setLoteItems(files.map(file => ({ file, previewUrl: URL.createObjectURL(file) })))
                }} />
                <div style={{ border: '2px dashed var(--line)', borderRadius: 'var(--r-input)', padding: '48px 24px', textAlign: 'center', background: 'var(--bg)' }}>
                  <Image size={32} color="var(--muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Selecione as fotos</p>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>Cada foto vira um produto com grade pronta</p>
                </div>
              </label>
            ) : (
              <>
                {/* Campos globais aplicados a todas as peças do lote */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                  <div>
                    <label style={lbl}>Nome Base *</label>
                    <input
                      value={loteNomeBase}
                      onChange={e => setLoteNomeBase(e.target.value)}
                      placeholder='Ex: "Camisa Longline" → gera "Camisa Longline 1", "2"...'
                      style={inp}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={lbl}>Preço de Venda</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-ui)', pointerEvents: 'none' }}>R$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={lotePrecoVenda}
                        onChange={e => setLotePrecoVenda(e.target.value)}
                        placeholder="0,00"
                        style={{ ...inp, paddingLeft: 36 }}
                      />
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                    {modoSimples ? (
                      <SeletorTamanhos
                        selected={loteTamanhosSel}
                        onChange={setLoteTamanhosSel}
                        theme={theme}
                      />
                    ) : (
                      <GradeForm grade={loteGrade} setGrade={setLoteGrade} theme={theme} />
                    )}
                  </div>
                </div>

                {/* Grade de fotos — apenas thumbnails */}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginBottom: 14 }}>
                  <label style={{ ...lbl, marginBottom: 10 }}>
                    {loteItems.length} foto{loteItems.length !== 1 ? 's' : ''} selecionada{loteItems.length !== 1 ? 's' : ''}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {loteItems.map((item, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={item.previewUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }} />
                        <button
                          onClick={() => setLoteItems(f => f.filter((_, j) => j !== i))}
                          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--status-bad-tx)', border: '2px solid var(--surface)', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-chip)', border: '1px dashed var(--line)', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 16 }}>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
                    const novos = Array.from(e.target.files).map(file => ({ file, previewUrl: URL.createObjectURL(file) }))
                    setLoteItems(f => [...f, ...novos])
                  }} />
                  <Plus size={13} /> Adicionar mais fotos
                </label>

                {loteError && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--status-bad-tx)', marginBottom: 10 }}>{loteError}</p>}
                {uploadingFotos && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: theme.primary, marginBottom: 10 }}>Enviando fotos...</p>}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setLoteItems([]); setLoteNomeBase(''); setLotePrecoVenda(''); setLoteGrade(EMPTY_GRADE()); setLoteTamanhosSel([]); setLoteError('') }} disabled={loteSaving}
                    style={{ flex: 1, height: 46, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                    Limpar
                  </button>
                  <button onClick={handleLote} disabled={loteSaving || loteItems.length === 0}
                    style={{ flex: 2, height: 46, borderRadius: 'var(--r-input)', border: 'none', background: loteSaving ? 'var(--line)' : theme.primary, cursor: loteSaving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 700, color: loteSaving ? 'var(--muted)' : '#fff', fontSize: 14 }}>
                    {loteSaving ? 'Criando produtos...' : `Criar ${loteItems.length} produto${loteItems.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal — Confirmar Exclusão */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 10 }}>
              Excluir produto?
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 20 }}>
              Tem certeza que quer excluir <strong style={{ color: 'var(--ink)' }}>{deleteConfirm.produto.nome}</strong>? Essa ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                style={{ flex: 1, height: 46, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={handleDeleteProduto} disabled={deleting}
                style={{ flex: 1, height: 46, borderRadius: 'var(--r-input)', border: 'none', background: deleting ? 'var(--line)' : 'var(--status-bad-tx)', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 700, color: deleting ? 'var(--muted)' : '#fff', fontSize: 14 }}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
