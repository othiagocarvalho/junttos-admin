import { useState, useEffect } from 'react'
import { Search, Plus, X, ChevronDown, ChevronRight, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { HeroCard } from '../../components/studio/Card'
import StatusPill from '../../components/studio/StatusPill'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

const BADGE = {
  critico: { label: 'Crítico', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  atencao: { label: 'Atenção', bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
}

const labelStyle = {
  display: 'block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6,
}

const inputStyle = {
  width: '100%', height: 46, border: '1.5px solid var(--line)', borderRadius: 12,
  padding: '0 14px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600,
  color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box',
}

function statusOf(qty) {
  const q = Number(qty || 0)
  if (q <= 2) return 'critico'
  if (q <= 5) return 'atencao'
  return null
}

function productStatus(variacoes) {
  if (!variacoes?.length) return null
  if (variacoes.some(v => statusOf(v.quantidade) === 'critico')) return 'critico'
  if (variacoes.some(v => statusOf(v.quantidade) === 'atencao')) return 'atencao'
  return null
}

const EMPTY_NEW = { nome: '', precoCusto: '', precoVenda: '', variacoes: [], referencia: '', fornecedor: '', fornecedor_id: '', quantidade_total: '', valor_lote: '', data_vencimento: '', status_pgto: 'a_pagar' }

export default function EstoqueMobile({ produtosData = [], updateVariacoes, addProduto, updateProduto, features = {}, theme, LOJA_ID = '', fetchAll, fornecedores = [] }) {
  const [search, setSearch]         = useState('')
  const [expanded, setExpanded]     = useState({})
  const [modal, setModal]           = useState(null) // { mode, produto, idx? }
  const [form, setForm]             = useState({ cor: '', quantidade: '0', custo: '', referencia: '', fornecedor: '' })
  const [saving, setSaving]         = useState(false)
  const [newProdOpen, setNewProdOpen] = useState(false)
  const [newProd, setNewProd]         = useState(EMPTY_NEW)
  const [newProdSaving, setNewProdSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { produto }
  const [deleting, setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleteToast, setDeleteToast] = useState('')

  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'Escape') return
      if (deleteConfirm && !deleting) { setDeleteConfirm(null); setDeleteError(null) }
      else if (modal) setModal(null)
      else if (newProdOpen) setNewProdOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [deleteConfirm, deleting, modal, newProdOpen])

  // Exclui produtos do catálogo B2B — gerenciados em ProdutosB2BPro
  const estoqueData = produtosData.filter(p => !p.disponivel_catalogo_b2b)

  const filtered = estoqueData.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  )

  const totalPecas = estoqueData.reduce((s, p) =>
    s + (p.variacoes || []).reduce((acc, v) => acc + Number(v.quantidade || 0), 0), 0
  )
  const totalCusto = estoqueData.reduce((s, p) => {
    const qtd = (p.variacoes || []).reduce((acc, v) => acc + Number(v.quantidade || 0), 0)
    return s + qtd * Number(p.preco_custo || 0)
  }, 0)
  const totalVenda = estoqueData.reduce((s, p) => {
    const qtd = (p.variacoes || []).reduce((acc, v) => acc + Number(v.quantidade || 0), 0)
    return s + qtd * Number(p.preco_venda || 0)
  }, 0)

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function openAdd(produto) {
    setForm({ cor: '', quantidade: '0', custo: '' })
    setModal({ mode: 'add', produto })
  }

  function openEdit(produto, idx) {
    const v = produto.variacoes[idx]
    setForm({
      cor: v.cor, quantidade: String(v.quantidade), custo: v.custo ? String(v.custo) : '',
      referencia: produto.referencia || '',
      fornecedor: produto.fornecedor || '',
    })
    setModal({ mode: 'edit', produto, idx })
  }

  async function handleSave() {
    if (!form.cor.trim()) return
    setSaving(true)
    const item = {
      cor: form.cor.trim(),
      quantidade: parseInt(form.quantidade) || 0,
      custo: parseFloat((form.custo || '').replace(',', '.')) || 0,
    }
    const current = modal.produto.variacoes || []
    const updated = modal.mode === 'add'
      ? [...current, item]
      : current.map((v, i) => i === modal.idx ? item : v)
    await updateVariacoes(modal.produto.id, updated)
    if (features?.atacado && updateProduto) {
      await updateProduto(modal.produto.id, {
        referencia: form.referencia || null,
        fornecedor: form.fornecedor || null,
      })
    }
    setSaving(false)
    setModal(null)
  }

  async function handleDelete() {
    setSaving(true)
    const updated = (modal.produto.variacoes || []).filter((_, i) => i !== modal.idx)
    await updateVariacoes(modal.produto.id, updated)
    setSaving(false)
    setModal(null)
  }

  async function handleDeleteProduto() {
    if (!deleteConfirm) return
    setDeleting(true)
    setDeleteError(null)
    const lojaIdUsado = LOJA_ID || deleteConfirm.produto.loja_id
    const { error } = await supabase
      .from('lf_produtos')
      .delete()
      .eq('id', deleteConfirm.produto.id)
      .eq('loja_id', lojaIdUsado)
    if (error) {
      setDeleteError('Erro ao excluir. Tente novamente.')
      setDeleting(false)
      return
    }
    setDeleteConfirm(null)
    setModal(null)
    setDeleting(false)
    setDeleteToast('Produto excluído.')
    setTimeout(() => setDeleteToast(''), 2500)
    if (fetchAll) fetchAll()
  }

  const canSave = form.cor.trim() && !saving

  function addNewVar() {
    setNewProd(prev => ({ ...prev, variacoes: [...prev.variacoes, { nome: '', quantidade: '1' }] }))
  }

  function removeNewVar(idx) {
    setNewProd(prev => ({ ...prev, variacoes: prev.variacoes.filter((_, i) => i !== idx) }))
  }

  function setNewVar(idx, field, val) {
    setNewProd(prev => ({
      ...prev,
      variacoes: prev.variacoes.map((v, i) => i === idx ? { ...v, [field]: val } : v),
    }))
  }

  async function handleAddProduto() {
    if (!newProd.nome.trim() || newProdSaving) return
    const semVariacoes = newProd.variacoes.filter(v => v.nome.trim()).length === 0
    if (semVariacoes && (parseInt(newProd.quantidade_total) || 0) < 1) return
    setNewProdSaving(true)
    const variacoes = semVariacoes
      ? [{ cor: 'Único', quantidade: parseInt(newProd.quantidade_total) || 0 }]
      : newProd.variacoes
          .filter(v => v.nome.trim())
          .map(v => ({ cor: v.nome.trim(), quantidade: parseInt(v.quantidade) || 0 }))
    const err = await addProduto(newProd.nome.trim(), {
      precoCusto: parseFloat((newProd.precoCusto || '').replace(',', '.')) || 0,
      precoVenda: parseFloat((newProd.precoVenda || '').replace(',', '.')) || 0,
      variacoes,
      referencia: features?.atacado ? (newProd.referencia || null) : null,
      fornecedor: features?.atacado ? (newProd.fornecedor || null) : null,
      fornecedor_id: newProd.fornecedor_id || null,
      ...(features?.atacado ? {
        valor_lote:      parseFloat(newProd.valor_lote) || null,
        data_vencimento: newProd.data_vencimento || null,
        status_pgto:     newProd.status_pgto || 'a_pagar',
      } : {}),
    })
    setNewProdSaving(false)
    if (!err) { setNewProdOpen(false); setNewProd(EMPTY_NEW) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8, overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>

      {deleteToast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1e1b4b', color: '#fff', padding: '10px 22px', borderRadius: 12, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, zIndex: 400, whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
          {deleteToast}
        </div>
      )}

      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Custo total */}
        <HeroCard tone="primary" style={{ padding: '18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
              Custo Total do Estoque
            </p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {fmtR(totalCusto)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{totalPecas}</p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>peças</p>
          </div>
        </HeroCard>
        {/* Venda total */}
        <HeroCard tone="dark" style={{ padding: '18px 14px', display: 'flex', alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
              Venda Total
            </p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {fmtR(totalVenda)}
            </p>
          </div>
        </HeroCard>
      </div>

      {/* Busca + botão novo produto */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            style={{
              width: '100%', height: 46, border: '1.5px solid var(--line)', borderRadius: 'var(--r-input)',
              padding: '0 14px 0 40px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14,
              color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <Button
          variant="primary" icon={Plus} style={{ height: 46, flexShrink: 0, background: theme.primary }}
          onClick={() => { setNewProd(EMPTY_NEW); setNewProdOpen(true) }}
        >
          Novo
        </Button>
      </div>

      {/* Lista */}
      {estoqueData.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
          <EmptyState
            icon={Package}
            title="Nenhum produto"
            subtitle="Cadastre seu primeiro produto para começar a vender."
            actionLabel="Novo produto"
            onAction={() => { setNewProd(EMPTY_NEW); setNewProdOpen(true) }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
          <EmptyState
            icon={Package}
            title={`Nada encontrado para "${search}"`}
            actionLabel="Limpar busca"
            onAction={() => setSearch('')}
          />
        </div>
      ) : features?.atacado ? (
        /* ── Modo Atacado: tabela plana por variação ── */
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)', overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Plus Jakarta Sans, sans-serif', minWidth: 700 }}>
              <thead>
                <tr style={{ background: theme.primary }}>
                  {['Referência', 'Descrição', 'Fornecedor', 'Tamanho', 'Custo', 'Venda', 'Qtd', ''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.flatMap(produto => {
                  const vars = produto.variacoes || []
                  const tdBase = { padding: '10px 14px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--line)', verticalAlign: 'middle' }
                  if (vars.length === 0) {
                    return [(
                      <tr key={produto.id} style={{ background: 'var(--surface)' }}>
                        <td style={tdBase}>{produto.referencia || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                        <td style={{ ...tdBase, fontWeight: 600 }}>{produto.nome}</td>
                        <td style={tdBase}>{produto.fornecedor || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                        <td style={{ ...tdBase, color: 'var(--muted)' }}>—</td>
                        <td style={tdBase}>{fmtR(produto.preco_custo)}</td>
                        <td style={tdBase}>{fmtR(produto.preco_venda)}</td>
                        <td style={{ ...tdBase, color: 'var(--muted)' }}>—</td>
                        <td style={{ ...tdBase, textAlign: 'right' }}>
                          <button onClick={() => openAdd(produto)} style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${theme.primary}`, background: 'none', color: theme.primary, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Var</button>
                        </td>
                      </tr>
                    )]
                  }
                  return vars.map((v, idx) => {
                    const s = statusOf(v.quantidade)
                    const labelKey = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
                    const tamanho = labelKey ? String(v[labelKey]) : '—'
                    const isFirst = idx === 0
                    return (
                      <tr key={`${produto.id}-${idx}`} style={{ background: idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                        <td style={{ ...tdBase, color: 'var(--muted)', fontSize: 12 }}>{produto.referencia || '—'}</td>
                        <td style={{ ...tdBase, fontWeight: 600 }}>{produto.nome}</td>
                        <td style={{ ...tdBase, color: 'var(--muted)', fontSize: 12 }}>{isFirst ? (produto.fornecedor || '—') : ''}</td>
                        <td style={tdBase}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {tamanho}
                            {s && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: BADGE[s].bg, color: BADGE[s].color, border: `1px solid ${BADGE[s].border}`, fontWeight: 700 }}>{BADGE[s].label}</span>}
                          </span>
                        </td>
                        <td style={{ ...tdBase, color: 'var(--muted)' }}>{fmtR(produto.preco_custo)}</td>
                        <td style={{ ...tdBase, color: 'var(--muted)' }}>{fmtR(produto.preco_venda)}</td>
                        <td style={{ ...tdBase, fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: s ? BADGE[s].color : 'var(--ink)' }}>{v.quantidade}</td>
                        <td style={{ ...tdBase, textAlign: 'right' }}>
                          <button onClick={() => openEdit(produto, idx)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'none', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        filtered.map(produto => {
          const variacoes = produto.variacoes || []
          const isOpen    = !!expanded[produto.id]
          const total     = variacoes.reduce((s, v) => s + Number(v.quantidade || 0), 0)
          const ps        = productStatus(variacoes)

          return (
            <div key={produto.id} style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>

              {/* Cabeçalho colapsável */}
              <button
                onClick={() => toggleExpand(produto.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: `color-mix(in srgb, ${theme.primary} 10%, white)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Package size={18} color={theme.primary} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{produto.nome}</span>
                    {ps && <StatusPill tone={ps === 'critico' ? 'bad' : 'warn'} label={BADGE[ps].label} />}
                  </div>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                    {variacoes.length} variação{variacoes.length !== 1 ? 'ões' : ''} · {total} peça{total !== 1 ? 's' : ''}
                  </p>
                </div>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>
                  {fmtR(produto.preco_venda)}
                </span>
                {isOpen
                  ? <ChevronDown size={16} color="var(--muted)" />
                  : <ChevronRight size={16} color="var(--muted)" />
                }
              </button>

              {/* Variações expandidas */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--line)', padding: '12px 18px 16px' }}>
                  {variacoes.length === 0 ? (
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginBottom: 10, textAlign: 'center' }}>
                      Nenhuma variação cadastrada.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                      {variacoes.map((v, idx) => {
                        const s = statusOf(v.quantidade)
                        return (
                          <div key={idx} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                            background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--line)',
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: produto.preco_custo > 0 ? 2 : 0 }}>
                                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{v.cor}</span>
                                {s && <StatusPill tone={s === 'critico' ? 'bad' : 'warn'} label={BADGE[s].label} />}
                              </div>
                              {produto.preco_custo > 0 && (
                                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                                  {fmtR(produto.preco_custo)} / peça
                                </p>
                              )}
                            </div>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>
                              {v.quantidade}
                            </span>
                            <button
                              onClick={() => openEdit(produto, idx)}
                              style={{
                                background: 'none', border: '1px solid var(--line)', borderRadius: 8,
                                padding: '5px 11px', cursor: 'pointer',
                                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--muted)',
                              }}
                            >
                              Editar
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => openAdd(produto)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 10,
                      border: '1px dashed var(--line)', background: 'none', cursor: 'pointer',
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: theme.primary,
                    }}
                  >
                    <Plus size={13} /> Adicionar variação
                  </button>

                  {features?.catalogo_b2b && (
                    <div style={{ marginTop: 14 }}>
                      <button
                        onClick={() => updateProduto(produto.id, { disponivel_catalogo_b2b: !produto.disponivel_catalogo_b2b })}
                        style={{
                          width: '100%', height: 36, borderRadius: 10,
                          border: `1px solid ${produto.disponivel_catalogo_b2b ? theme.primary : 'var(--line)'}`,
                          background: produto.disponivel_catalogo_b2b ? `${theme.primary}14` : 'var(--bg)',
                          cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                          fontSize: 12, fontWeight: 700,
                          color: produto.disponivel_catalogo_b2b ? theme.primary : 'var(--muted)',
                        }}
                      >
                        {produto.disponivel_catalogo_b2b ? '✓ Disponível no Catálogo B2B' : 'Catálogo B2B: desativado'}
                      </button>
                    </div>
                  )}

                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    <button
                      onClick={() => setDeleteConfirm({ produto })}
                      style={{
                        width: '100%', height: 36, borderRadius: 10,
                        border: '1px solid #fca5a5', background: '#fee2e2',
                        cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: 12, fontWeight: 700, color: '#dc2626',
                      }}
                    >
                      Excluir produto
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Modal — Novo Produto */}
      {newProdOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setNewProdOpen(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                Novo Produto
              </p>
              <div role="button" tabIndex={0} onClick={() => setNewProdOpen(false)}
                onKeyDown={e => e.key === 'Enter' && setNewProdOpen(false)}
                style={{ cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Nome */}
              <div>
                <label style={{ ...labelStyle, color: theme.primary }}>Nome do Produto *</label>
                <input
                  value={newProd.nome} onChange={e => setNewProd(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Vestido Floral, Blusa Básica..."
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {/* Fornecedor cadastrado (opcional) */}
              {fornecedores.length > 0 && (
                <div>
                  <label style={labelStyle}>Fornecedor (opcional)</label>
                  <select
                    value={newProd.fornecedor_id}
                    onChange={e => setNewProd(p => ({ ...p, fornecedor_id: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Nenhum</option>
                    {fornecedores.filter(f => f.ativo !== false).map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Referência e Fornecedor — apenas modo atacado */}
              {features?.atacado && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ ...labelStyle, color: theme.primary }}>Referência</label>
                    <input
                      value={newProd.referencia} onChange={e => setNewProd(p => ({ ...p, referencia: e.target.value }))}
                      placeholder="Ex: DC-001"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: theme.primary }}>Fornecedor</label>
                    <input
                      value={newProd.fornecedor} onChange={e => setNewProd(p => ({ ...p, fornecedor: e.target.value }))}
                      placeholder="Nome do fornecedor"
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {/* Pagamento ao fornecedor — apenas Du Charme (atacado) */}
              {features?.atacado && (
                <div>
                  <div style={{ borderTop: '1px dashed var(--line)', margin: '4px 0 12px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      Pagamento ao fornecedor
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 99, background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      novo
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={{ ...labelStyle, color: theme.primary }}>Valor total do lote</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', pointerEvents: 'none' }}>R$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={newProd.valor_lote}
                          onChange={e => setNewProd(p => ({ ...p, valor_lote: e.target.value }))}
                          placeholder="0,00"
                          style={{ ...inputStyle, paddingLeft: 36 }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: theme.primary }}>Vencimento</label>
                      <input
                        type="date"
                        value={newProd.data_vencimento}
                        onChange={e => setNewProd(p => ({ ...p, data_vencimento: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <label style={{ ...labelStyle, color: theme.primary, marginBottom: 8 }}>Status do pagamento</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { val: 'pago',    label: 'Pago',     bg: '#E6F6EE', border: '#9ED8B8', color: '#1F8A5B' },
                      { val: 'a_pagar', label: 'A pagar',  bg: '#FFF4E0', border: '#F0C870', color: '#B7791F' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setNewProd(p => ({ ...p, status_pgto: opt.val }))}
                        style={{
                          flex: 1, height: 42, borderRadius: 10, cursor: 'pointer',
                          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700,
                          background: newProd.status_pgto === opt.val ? opt.bg : 'var(--bg)',
                          border: newProd.status_pgto === opt.val ? `2px solid ${opt.border}` : '1px solid var(--line)',
                          color: newProd.status_pgto === opt.val ? opt.color : 'var(--muted)',
                          transition: 'all .15s',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preços */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ ...labelStyle, color: theme.primary }}>Preço de Custo</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', pointerEvents: 'none' }}>R$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={newProd.precoCusto} onChange={e => setNewProd(p => ({ ...p, precoCusto: e.target.value }))}
                      placeholder="0,00"
                      style={{ ...inputStyle, paddingLeft: 36 }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, color: theme.primary }}>Preço de Venda</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', pointerEvents: 'none' }}>R$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={newProd.precoVenda} onChange={e => setNewProd(p => ({ ...p, precoVenda: e.target.value }))}
                      placeholder="0,00"
                      style={{ ...inputStyle, paddingLeft: 36 }}
                    />
                  </div>
                </div>
              </div>

              {/* Variações */}
              <div>
                <label style={{ ...labelStyle, color: theme.primary, marginBottom: 10 }}>Variações</label>
                {newProd.variacoes.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {newProd.variacoes.map((v, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          value={v.nome} onChange={e => setNewVar(idx, 'nome', e.target.value)}
                          placeholder="Ex: P, M, G, Preta, Azul..."
                          style={{ ...inputStyle, flex: 2, height: 42 }}
                        />
                        <input
                          type="number" min="0"
                          value={v.quantidade} onChange={e => setNewVar(idx, 'quantidade', e.target.value)}
                          placeholder="Qtd"
                          style={{ ...inputStyle, flex: 1, height: 42, textAlign: 'center' }}
                        />
                        <div role="button" tabIndex={0}
                          onClick={() => removeNewVar(idx)}
                          onKeyDown={e => e.key === 'Enter' && removeNewVar(idx)}
                          style={{
                            width: 36, height: 42, borderRadius: 10, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--bg)', border: '1px solid var(--line)',
                            cursor: 'pointer', color: 'var(--muted)',
                          }}>
                          <X size={14} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div role="button" tabIndex={0}
                  onClick={addNewVar}
                  onKeyDown={e => e.key === 'Enter' && addNewVar()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10,
                    border: `1px dashed ${theme.primary}80`, background: `${theme.primary}08`,
                    cursor: 'pointer', userSelect: 'none',
                    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: theme.primary,
                  }}>
                  <Plus size={13} /> Adicionar variação
                </div>
                {newProd.variacoes.length === 0 && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ ...labelStyle, color: theme.primary }}>Quantidade em Estoque *</label>
                    <input
                      type="number" min="1"
                      value={newProd.quantidade_total}
                      onChange={e => setNewProd(p => ({ ...p, quantidade_total: e.target.value }))}
                      placeholder="Ex: 10"
                      style={{
                        ...inputStyle,
                        border: `1.5px solid ${theme.primary}`,
                        boxShadow: `0 0 0 3px ${theme.primary}22`,
                      }}
                    />
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      Produto sem variações — informe a quantidade total.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <div role="button" tabIndex={0}
                onClick={() => setNewProdOpen(false)}
                onKeyDown={e => e.key === 'Enter' && setNewProdOpen(false)}
                style={{
                  flex: 1, height: 48, borderRadius: 14, border: '1px solid var(--line)',
                  background: 'var(--bg)', cursor: 'pointer', userSelect: 'none',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                Cancelar
              </div>
              <div role="button" tabIndex={0}
                onClick={handleAddProduto}
                onKeyDown={e => e.key === 'Enter' && handleAddProduto()}
                style={{
                  flex: 2, height: 48, borderRadius: 14,
                  background: (newProd.nome.trim() && !newProdSaving && (newProd.variacoes.some(v => v.nome.trim()) || (parseInt(newProd.quantidade_total) || 0) >= 1)) ? theme.primary : 'var(--line)',
                  cursor: (newProd.nome.trim() && !newProdSaving && (newProd.variacoes.some(v => v.nome.trim()) || (parseInt(newProd.quantidade_total) || 0) >= 1)) ? 'pointer' : 'not-allowed',
                  userSelect: 'none',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
                  color: (newProd.nome.trim() && !newProdSaving && (newProd.variacoes.some(v => v.nome.trim()) || (parseInt(newProd.quantidade_total) || 0) >= 1)) ? '#fff' : 'var(--muted)', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {newProdSaving ? 'Salvando...' : 'Salvar Produto'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Editar/Adicionar variação existente */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 20px 36px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                {modal.mode === 'add' ? `Nova variação — ${modal.produto.nome}` : `Editar — ${modal.produto.variacoes[modal.idx].cor}`}
              </p>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {features?.atacado && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 4, borderBottom: '1px solid var(--line)', marginBottom: 2 }}>
                  <div>
                    <label style={labelStyle}>Referência</label>
                    <input
                      value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })}
                      placeholder="Ex: DC-001"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Fornecedor</label>
                    <input
                      value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })}
                      placeholder="Nome do fornecedor"
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Cor / Variação</label>
                <input
                  value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}
                  placeholder="ex: Preto, Rosa, M, GG..."
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Quantidade</label>
                  <input
                    type="number" min="0" value={form.quantidade}
                    onChange={e => setForm({ ...form, quantidade: e.target.value })}
                    placeholder="0" style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Custo (R$)</label>
                  <input
                    type="number" min="0" step="0.01" value={form.custo}
                    onChange={e => setForm({ ...form, custo: e.target.value })}
                    placeholder="0,00" style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {modal.mode === 'edit' && (
                <button
                  onClick={handleDelete} disabled={saving}
                  style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: '#fee2e2', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#dc2626', fontSize: 14 }}
                >
                  Excluir
                </button>
              )}
              <button onClick={() => setModal(null)}
                style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
                Cancelar
              </button>
              <button
                onClick={handleSave} disabled={!canSave}
                style={{
                  flex: 2, height: 46, borderRadius: 12, border: 'none',
                  background: canSave ? theme.primary : 'var(--line)',
                  cursor: canSave ? 'pointer' : 'not-allowed',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
                  color: canSave ? '#fff' : 'var(--muted)', fontSize: 14,
                }}
              >
                {saving ? 'Salvando...' : modal.mode === 'add' ? 'Adicionar' : 'Salvar'}
              </button>
            </div>

            {modal.mode === 'edit' && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <button
                  onClick={() => setDeleteConfirm({ produto: modal.produto })}
                  style={{
                    width: '100%', height: 40, borderRadius: 10,
                    border: '1px solid #fca5a5', background: '#fee2e2',
                    cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: 12, fontWeight: 700, color: '#dc2626',
                  }}
                >
                  Excluir produto "{modal.produto.nome}"
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal de confirmação — excluir produto */}
      {deleteConfirm && (
        <div onClick={() => !deleting && (setDeleteConfirm(null), setDeleteError(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 10 }}>
              Excluir produto?
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 20 }}>
              Tem certeza que quer excluir <strong style={{ color: 'var(--ink)' }}>{deleteConfirm.produto.nome}</strong>? Essa ação não pode ser desfeita.
            </p>
            {deleteError && (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: '#dc2626', marginBottom: 14, padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteError(null) }}
                disabled={deleting}
                style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProduto}
                disabled={deleting}
                style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: deleting ? 'var(--line)' : '#DC2626', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
