import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { T } from '../../theme/tokens'
import {
  Plus, X, Loader2, AlertCircle, ChevronDown, ChevronUp,
  RefreshCw, Share2, Link2, Unlink, Building2,
} from 'lucide-react'

// ── shared input style ───────────────────────────────────────────
const inp = {
  width: '100%', height: 44, boxSizing: 'border-box',
  background: T.mist, border: `1.5px solid ${T.line}`,
  borderRadius: T.rInput, padding: '0 14px',
  fontFamily: T.ui, fontSize: 14, color: T.ink, outline: 'none',
}

function Section({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 14px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{title}</p>
      <div style={{ flex: 1, height: 1, background: T.line }} />
    </div>
  )
}

// ── Modal: criar nova rede ───────────────────────────────────────
function NovaRedeModal({ open, onClose, onCreated }) {
  const [nome,     setNome]     = useState('')
  const [donoNome, setDonoNome] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!open) return
    setNome(''); setDonoNome(''); setError(''); setSaving(false)
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  async function handleSave(e) {
    e.preventDefault()
    if (!nome.trim()) { setError('Nome da rede é obrigatório.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('jt_redes').insert({ nome: nome.trim(), dono_nome: donoNome.trim() || null })
    if (err) { setError(err.message); setSaving(false); return }
    onCreated()
    onClose()
  }

  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 460, boxShadow: T.darkCardShadow, fontFamily: T.ui }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 0' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 2 }}>Nova Rede</h2>
            <p style={{ fontSize: 13, color: T.muted }}>Agrupe lojas do mesmo dono ou franquia.</p>
          </div>
          <button onClick={onClose} style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={T.muted} />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ padding: '20px 28px 28px' }}>
          <Section title="Dados da rede" />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Nome da rede *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Grupo Maria Fashion" style={inp} autoFocus />
          </div>
          <div style={{ marginBottom: 4 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Responsável / dono</label>
            <input value={donoNome} onChange={e => setDonoNome(e.target.value)} placeholder="Ex: Maria Silva (opcional)" style={inp} />
          </div>
          {error && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '12px 14px', marginTop: 16 }}>
              <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: T.coralText }}>{error}</p>
            </div>
          )}
          <button type="submit" disabled={saving} style={{
            marginTop: 20, width: '100%', height: 48, borderRadius: T.rCard,
            background: saving ? T.mist : T.purple, color: saving ? T.muted : T.white,
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: T.ui, fontSize: 15, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: saving ? 'none' : '0 4px 16px rgba(94,43,208,0.28)',
          }}>
            {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Criando...</> : <><Plus size={16} /> Criar Rede</>}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Rede card ────────────────────────────────────────────────────
function RedeCard({ rede, lojas, allLojas, onRefresh }) {
  const [expanded,      setExpanded]      = useState(false)
  const [linkingLojaId, setLinkingLojaId] = useState('')
  const [linking,       setLinking]       = useState(false)
  const [unlinking,     setUnlinking]     = useState(null) // loja_id being unlinked
  const [linkError,     setLinkError]     = useState('')

  // Lojas that can be linked: currently unassigned OR already in this rede
  const lojasDaRede    = lojas.filter(l => l.rede_id === rede.id)
  const lojasDisponiveis = allLojas.filter(l => !l.rede_id)

  async function handleLink(e) {
    e.preventDefault()
    if (!linkingLojaId) return
    setLinking(true); setLinkError('')
    const { error } = await supabase
      .from('lf_config')
      .update({ rede_id: rede.id })
      .eq('loja_id', linkingLojaId)
    if (error) { setLinkError(error.message); setLinking(false); return }
    setLinkingLojaId('')
    setLinking(false)
    onRefresh()
  }

  async function handleUnlink(lojaId) {
    setUnlinking(lojaId)
    const { error } = await supabase
      .from('lf_config')
      .update({ rede_id: null })
      .eq('loja_id', lojaId)
    setUnlinking(null)
    if (!error) onRefresh()
  }

  return (
    <div style={{ background: T.white, borderRadius: T.rCard, border: `1px solid ${T.line}`, boxShadow: T.cardShadow, overflow: 'hidden', fontFamily: T.ui }}>
      {/* Header */}
      <div
        role="button" tabIndex={0}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', cursor: 'pointer', userSelect: 'none' }}
      >
        {/* Icon */}
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.tintPurple, border: `1px solid ${T.purple}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Share2 size={18} color={T.purple} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rede.nome}
          </p>
          {rede.dono_nome && (
            <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>{rede.dono_nome}</p>
          )}
        </div>

        {/* Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.purpleText, background: T.tintPurple, padding: '3px 10px', borderRadius: 99 }}>
            {lojasDaRede.length} {lojasDaRede.length === 1 ? 'loja' : 'lojas'}
          </span>
          {expanded
            ? <ChevronUp  size={16} color={T.muted} />
            : <ChevronDown size={16} color={T.muted} />
          }
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.line}`, padding: '18px 20px' }}>

          {/* Lojas vinculadas */}
          <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Lojas vinculadas
          </p>
          {lojasDaRede.length === 0 ? (
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 16, fontStyle: 'italic' }}>Nenhuma loja vinculada ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {lojasDaRede.map(loja => (
                <div key={loja.loja_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: T.mist, borderRadius: T.rInput, border: `1px solid ${T.line}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: T.tintPurple, border: `1px solid ${T.purple}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={14} color={T.purple} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {loja.nome}
                    </p>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0, fontFamily: T.mono }}>/{loja.slug || loja.loja_id}</p>
                  </div>
                  <button
                    onClick={() => handleUnlink(loja.loja_id)}
                    disabled={unlinking === loja.loja_id}
                    title="Desvincular loja"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.muted, flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.coral; e.currentTarget.style.color = T.coralText }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.color = T.muted }}
                  >
                    {unlinking === loja.loja_id
                      ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Unlink size={12} />
                    }
                    Desvincular
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Vincular nova loja */}
          <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Vincular loja
          </p>
          {lojasDisponiveis.length === 0 ? (
            <p style={{ fontSize: 13, color: T.muted, fontStyle: 'italic' }}>
              Todas as lojas já pertencem a uma rede.
            </p>
          ) : (
            <form onSubmit={handleLink} style={{ display: 'flex', gap: 8 }}>
              <select
                value={linkingLojaId}
                onChange={e => setLinkingLojaId(e.target.value)}
                style={{ ...inp, flex: 1, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%237B7390' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
              >
                <option value="">Selecione uma loja...</option>
                {lojasDisponiveis.map(l => (
                  <option key={l.loja_id} value={l.loja_id}>{l.nome} (/{l.slug || l.loja_id})</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!linkingLojaId || linking}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 18px', height: 44, borderRadius: T.rInput, border: 'none', background: linkingLojaId && !linking ? T.purple : T.mist, color: linkingLojaId && !linking ? T.white : T.muted, cursor: linkingLojaId && !linking ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, flexShrink: 0, fontFamily: T.ui }}
              >
                {linking ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Link2 size={14} />}
                Vincular
              </button>
            </form>
          )}
          {linkError && (
            <p style={{ fontSize: 12, color: T.coralText, marginTop: 8 }}>{linkError}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function Redes() {
  const [redes,      setRedes]      = useState([])
  const [lojas,      setLojas]      = useState([])
  const [fetching,   setFetching]   = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)

  const fetchAll = useCallback(async () => {
    setFetching(true); setFetchError('')
    const [redesRes, lojasRes] = await Promise.all([
      supabase.from('jt_redes').select('*').order('nome'),
      supabase.from('lf_config').select('loja_id, slug, nome, rede_id').order('nome'),
    ])
    if (redesRes.error) { setFetchError(redesRes.error.message); setFetching(false); return }
    if (lojasRes.error) { setFetchError(lojasRes.error.message); setFetching(false); return }
    setRedes(redesRes.data || [])
    setLojas(lojasRes.data || [])
    setFetching(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const totalVinculadas = lojas.filter(l => l.rede_id).length

  return (
    <div style={{ maxWidth: 860, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Redes</h1>
          <p style={{ fontSize: 13.5, color: T.muted }}>
            Agrupamentos de lojas do mesmo dono ou franquia.
            {!fetching && redes.length > 0 && (
              <span> — {redes.length} {redes.length === 1 ? 'rede' : 'redes'}, {totalVinculadas} {totalVinculadas === 1 ? 'loja vinculada' : 'lojas vinculadas'}</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={fetchAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.mist, border: `1px solid ${T.line}`, borderRadius: T.rInput, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.muted }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.line }}
          >
            <RefreshCw size={13} /> Atualizar
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', borderRadius: T.rPill, background: T.purple, color: T.white, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(94,43,208,0.28)' }}
            onMouseEnter={e => { e.currentTarget.style.background = T.purpleDeep }}
            onMouseLeave={e => { e.currentTarget.style.background = T.purple }}
          >
            <Plus size={16} /> Nova Rede
          </button>
        </div>
      </div>

      {/* Content */}
      {fetching ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 14, padding: 24 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Carregando redes...
        </div>
      ) : fetchError ? (
        <div style={{ background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rCard, padding: '20px 24px', display: 'flex', gap: 12 }}>
          <AlertCircle size={16} color={T.coralText} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.coralText, marginBottom: 4 }}>Erro ao carregar redes</p>
            <p style={{ fontSize: 12, color: T.coralText }}>{fetchError}</p>
          </div>
        </div>
      ) : redes.length === 0 ? (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, boxShadow: T.cardShadow, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: T.tintPurple, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Share2 size={24} color={T.purple} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Nenhuma rede criada</p>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>Crie uma rede para agrupar lojas do mesmo dono ou franquia.</p>
          <button onClick={() => setModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', borderRadius: T.rPill, background: T.purple, color: T.white, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: T.ui }}>
            <Plus size={15} /> Nova Rede
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {redes.map(rede => (
            <RedeCard
              key={rede.id}
              rede={rede}
              lojas={lojas}
              allLojas={lojas}
              onRefresh={fetchAll}
            />
          ))}
        </div>
      )}

      <NovaRedeModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={fetchAll} />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
