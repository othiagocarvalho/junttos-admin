import { useState, useEffect, useRef } from 'react'
import { Search, Plus, X, ChevronDown, ChevronRight, Package, Pencil, History } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { HeroCard } from '../../components/studio/Card'
import StatusPill from '../../components/studio/StatusPill'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'
import { fmtR } from '../../utils/formatters'
import { rotuloTipo, toneTipo, fmtDelta, labelsDeVariacoes, filtrarPorVariacao, tabelaAusente } from '../../utils/estoqueMov'
import { limiteBalancoValido } from '../../utils/balanco'

function fmtDataHora(s) {
  return new Date(s).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

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
  if (q <= 3) return 'critico'
  if (q <= 6) return 'atencao'
  return null
}

function productStatus(variacoes) {
  if (!variacoes?.length) return null
  if (variacoes.some(v => statusOf(v.quantidade) === 'critico')) return 'critico'
  if (variacoes.some(v => statusOf(v.quantidade) === 'atencao')) return 'atencao'
  return null
}

const EMPTY_NEW = { nome: '', precoCusto: '', precoVenda: '', variacoes: [], referencia: '', quantidade_total: '', valor_lote: '', data_vencimento: '', status_pgto: 'a_pagar' }

// Inicializa o form "Editar Produto" a partir do objeto produto do banco.
export function initProdForm(produto) {
  return {
    nome:            produto.nome            || '',
    preco_custo:     produto.preco_custo  != null ? String(produto.preco_custo)  : '',
    preco_venda:     produto.preco_venda  != null ? String(produto.preco_venda)  : '',
    referencia:      produto.referencia      || '',
    valor_lote:      produto.valor_lote   != null ? String(produto.valor_lote)   : '',
    data_vencimento: produto.data_vencimento || '',
    status_pgto:     produto.status_pgto     || 'a_pagar',
  }
}

// Monta o payload para updateProduto a partir do form state.
//
// `fornecedor` saiu daqui junto com o campo na tela. updateProduto faz update
// parcial, então a coluna simplesmente não é tocada: o que já estava gravado
// em lf_produtos continua lá, só deixou de ter interface.
export function buildProdPayload(form) {
  return {
    nome:        form.nome.trim(),
    preco_custo: parseFloat((form.preco_custo || '').replace(',', '.')) || 0,
    preco_venda: parseFloat((form.preco_venda || '').replace(',', '.')) || 0,
    referencia:  (form.referencia || '').trim() || null,
  }
}

export default function EstoqueMobile({ produtosData = [], updateVariacoes, addProduto, updateProduto, features = {}, theme, LOJA_ID = '', fetchAll }) {
  // Balanço que está travando as vendas desta loja. Fica aqui porque o Estoque
  // é a única tela que a lojista alcança — o /balanco é do admin, então sem
  // isso ela não tem como destravar sozinha uma sessão aberta em outro
  // dispositivo ou deixada pela metade.
  const [balTrava, setBalTrava]         = useState(null)
  const [encerrandoBal, setEncerrandoBal] = useState(false)
  const [search, setSearch]         = useState('')
  const [expanded, setExpanded]     = useState({})
  const [modal, setModal]           = useState(null) // { mode, produto, idx? }
  const [form, setForm]             = useState({ cor: '', quantidade: '0', custo: '', referencia: '' })
  const [saving, setSaving]         = useState(false)
  const [newProdOpen, setNewProdOpen] = useState(false)
  const [newProd, setNewProd]         = useState(EMPTY_NEW)
  const [newProdSaving, setNewProdSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { produto }
  const [deleting, setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleteToast, setDeleteToast] = useState('')
  const [editProdModal, setEditProdModal] = useState(null) // { produto }
  const [prodForm, setProdForm]           = useState(initProdForm({}))
  const [prodSaving, setProdSaving]       = useState(false)
  const [movModal, setMovModal]     = useState(null) // { produto }
  const [movs, setMovs]             = useState([])
  const [movLoading, setMovLoading] = useState(false)
  const [movErro, setMovErro]       = useState(null)
  const [movFiltro, setMovFiltro]   = useState('')
  const [movVenda, setMovVenda]     = useState(null) // { id, carregando, venda }

  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'Escape') return
      if (deleteConfirm && !deleting) { setDeleteConfirm(null); setDeleteError(null) }
      else if (movModal) setMovModal(null)
      else if (editProdModal && !prodSaving) setEditProdModal(null)
      else if (modal) setModal(null)
      else if (newProdOpen) setNewProdOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [deleteConfirm, deleting, editProdModal, prodSaving, modal, newProdOpen, movModal])

  // Descarta a resposta de um produto que não é mais o aberto (abrir A e B em
  // sequência rápida devolveria a lista errada).
  const movReq = useRef(0)

  // Exclui produtos do catálogo B2B — gerenciados em ProdutosB2BPro.
  //
  // Loja 100% atacado (ex: Tropicale) tem todo o catálogo marcado como B2B —
  // o filtro esvaziava a tela inteira e a lojista não tinha como desfazer,
  // porque o botão que desliga a flag vive dentro do card que sumiu.
  const semB2b = produtosData.filter(p => !p.disponivel_catalogo_b2b)
  const estoqueData = semB2b.length > 0 ? semB2b : produtosData

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

  function openEditProd(produto) {
    setProdForm(initProdForm(produto))
    setEditProdModal({ produto })
  }

  // variacao: abre já filtrado naquela variação (vindo do modal de edição).
  // A tabela é append-only e só cresce, então limita nas mais recentes.
  async function openMov(produto, variacao = '') {
    const req = ++movReq.current
    setMovFiltro(variacao)
    setMovVenda(null)
    setMovModal({ produto })
    setMovLoading(true)
    setMovErro(null)
    setMovs([])

    const { data, error } = await supabase
      .from('lf_estoque_mov')
      .select('*')
      .eq('loja_id', LOJA_ID || produto.loja_id)
      .eq('produto_id', produto.id)
      .order('created_at', { ascending: false })
      .limit(200)
    if (req !== movReq.current) return

    if (error) {
      setMovErro(tabelaAusente(error)
        ? 'O histórico de movimentação ainda não foi ativado nesta loja.'
        : 'Não foi possível carregar a movimentação.')
    } else {
      setMovs(data || [])
    }
    setMovLoading(false)
  }

  // A origem 'venda' guarda o id em lf_vendas — busca sob demanda, só quando a
  // pessoa clica, para não puxar venda de todas as linhas do extrato.
  async function abrirVenda(vendaId) {
    if (movVenda?.id === vendaId) { setMovVenda(null); return }
    setMovVenda({ id: vendaId, carregando: true, venda: null })
    const { data } = await supabase
      .from('lf_vendas')
      .select('id, data, cliente_nome, valor, forma_pgto, vendedora, produtos')
      .eq('id', vendaId)
      .maybeSingle()
    setMovVenda(prev => (prev?.id === vendaId ? { id: vendaId, carregando: false, venda: data || null } : prev))
  }

  async function handleSaveProd() {
    if (!prodForm.nome.trim() || prodSaving) return
    setProdSaving(true)
    await updateProduto(editProdModal.produto.id, buildProdPayload(prodForm))
    setProdSaving(false)
    setEditProdModal(null)
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
      referencia: null,
    })
    setNewProdSaving(false)
    if (!err) { setNewProdOpen(false); setNewProd(EMPTY_NEW) }
  }

  useEffect(() => {
    let vivo = true
    async function carregar() {
      if (!LOJA_ID) return
      const { data } = await supabase
        .from('bal_sessoes')
        .select('id, criado_em')
        .eq('loja_id', LOJA_ID)
        .eq('status', 'aberta')
        .eq('travar_vendas', true)
        .gte('criado_em', limiteBalancoValido())
        .limit(1)
      if (vivo) setBalTrava(data?.[0] ?? null)
    }
    carregar()
    return () => { vivo = false }
  }, [LOJA_ID])

  async function encerrarBalanco() {
    if (!balTrava || encerrandoBal) return
    setEncerrandoBal(true)
    // 'cancelada' e não 'concluida': nenhum ajuste de estoque foi aplicado.
    const { error } = await supabase
      .from('bal_sessoes')
      .update({ status: 'cancelada' })
      .eq('id', balTrava.id)
      .eq('loja_id', LOJA_ID)
    setEncerrandoBal(false)
    if (!error) setBalTrava(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8, overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>

      {balTrava && (
        <div style={{ background: 'var(--status-warn-bg, #FEF3C7)', border: '1px solid var(--status-warn-dot, #F59E0B)', borderRadius: 'var(--r-card)', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--status-warn-tx, #92400E)', marginBottom: 3 }}>
              Balanço de estoque em andamento
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--status-warn-tx, #92400E)', lineHeight: 1.5 }}>
              Enquanto ele estiver aberto, as vendas ficam travadas. Se ninguém está contando estoque agora, pode encerrar.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={encerrarBalanco}
            disabled={encerrandoBal}
            style={{ background: '#fff', color: 'var(--status-warn-tx, #92400E)', fontWeight: 700, flexShrink: 0 }}
          >
            {encerrandoBal ? 'Encerrando...' : 'Encerrar balanço'}
          </Button>
        </div>
      )}

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
      ) : (
        filtered.map(produto => {
          const variacoes = produto.variacoes || []
          const isOpen    = !!expanded[produto.id]
          const total     = variacoes.reduce((s, v) => s + Number(v.quantidade || 0), 0)
          const ps        = productStatus(variacoes)

          return (
            <div key={produto.id} style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>

              {/* Cabeçalho colapsável */}
              <div
                onClick={() => toggleExpand(produto.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && toggleExpand(produto.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', cursor: 'pointer', userSelect: 'none' }}
              >
                {/* Miniatura da foto, com o ícone como reserva.
                    48x60 (retrato) em vez do quadrado de 40: é a proporção que
                    ProdutosB2BPro já usa, e roupa fotografada de corpo inteiro
                    fica irreconhecível cortada em quadrado. overflow:hidden
                    porque a foto preenche a caixa e precisa respeitar o raio.
                    Produto sem foto — `fotos` vem como [] na maioria das
                    lojas — cai no Package de antes, sem mudança visual. */}
                <div style={{
                  width: 48, height: 60, borderRadius: 12, flexShrink: 0,
                  background: `color-mix(in srgb, ${theme.primary} 10%, white)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {produto.fotos?.[0] ? (
                    <img
                      src={produto.fotos[0]}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <Package size={18} color={theme.primary} strokeWidth={2} />
                  )}
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
                <button
                  onClick={e => { e.stopPropagation(); openEditProd(produto) }}
                  aria-label="Editar produto"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 6, borderRadius: 8, flexShrink: 0 }}
                >
                  <Pencil size={14} />
                </button>
                {isOpen
                  ? <ChevronDown size={16} color="var(--muted)" />
                  : <ChevronRight size={16} color="var(--muted)" />
                }
              </div>

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

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                    <button
                      onClick={() => openMov(produto)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 10,
                        border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer',
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink)',
                      }}
                    >
                      <History size={13} /> Ver movimentação
                    </button>
                  </div>

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
                  onClick={() => {
                    const label = modal.produto.variacoes[modal.idx]?.cor || ''
                    const produto = modal.produto
                    setModal(null)
                    openMov(produto, label)
                  }}
                  style={{
                    width: '100%', height: 40, borderRadius: 10, marginBottom: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    border: '1px solid var(--line)', background: 'var(--bg)',
                    cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: 12, fontWeight: 700, color: 'var(--ink)',
                  }}
                >
                  <History size={14} /> Ver movimentação
                </button>
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
      {/* Modal — Editar Produto */}
      {editProdModal && (
        <div
          onClick={() => !prodSaving && setEditProdModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                Editar Produto
              </p>
              <button
                onClick={() => setEditProdModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Nome */}
              <div>
                <label style={{ ...labelStyle, color: theme.primary }}>Nome do Produto *</label>
                <input
                  value={prodForm.nome}
                  onChange={e => setProdForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Vestido Floral..."
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {/* Preços */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ ...labelStyle, color: theme.primary }}>Preço de Custo</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', pointerEvents: 'none' }}>R$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={prodForm.preco_custo}
                      onChange={e => setProdForm(p => ({ ...p, preco_custo: e.target.value }))}
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
                      value={prodForm.preco_venda}
                      onChange={e => setProdForm(p => ({ ...p, preco_venda: e.target.value }))}
                      placeholder="0,00"
                      style={{ ...inputStyle, paddingLeft: 36 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setEditProdModal(null)}
                style={{ flex: 1, height: 48, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProd}
                disabled={!prodForm.nome.trim() || prodSaving}
                style={{
                  flex: 2, height: 48, borderRadius: 14, border: 'none',
                  background: prodForm.nome.trim() && !prodSaving ? theme.primary : 'var(--line)',
                  cursor: prodForm.nome.trim() && !prodSaving ? 'pointer' : 'not-allowed',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
                  color: prodForm.nome.trim() && !prodSaving ? '#fff' : 'var(--muted)', fontSize: 14,
                }}
              >
                {prodSaving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom sheet — movimentação do produto */}
      {movModal && (() => {
        const produto  = movModal.produto
        const labels   = labelsDeVariacoes(produto)
        const listadas = filtrarPorVariacao(movs, movFiltro)
        const chipBase = {
          padding: '6px 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700,
          whiteSpace: 'nowrap', flexShrink: 0,
        }
        const chipStyle = ativo => ({
          ...chipBase,
          border: `1px solid ${ativo ? theme.primary : 'var(--line)'}`,
          background: ativo ? `${theme.primary}14` : 'var(--bg)',
          color: ativo ? theme.primary : 'var(--muted)',
        })

        return (
          <div
            onClick={e => e.target === e.currentTarget && setMovModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 250, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                    Movimentação
                  </p>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    {produto.nome}
                  </p>
                </div>
                <button
                  onClick={() => setMovModal(null)}
                  aria-label="Fechar"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: 4, flexShrink: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              {labels.length > 1 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
                  <button onClick={() => setMovFiltro('')} style={chipStyle(movFiltro === '')}>Todas</button>
                  {labels.map(l => (
                    <button key={l} onClick={() => setMovFiltro(l)} style={chipStyle(movFiltro === l)}>{l}</button>
                  ))}
                </div>
              )}

              {movLoading ? (
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '28px 0' }}>
                  Carregando...
                </p>
              ) : movErro ? (
                <EmptyState icon={History} title="Movimentação indisponível" subtitle={movErro} />
              ) : listadas.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="Nada registrado ainda"
                  subtitle={movFiltro
                    ? `Nenhuma movimentação de "${movFiltro}" até agora.`
                    : 'As entradas, ajustes e saídas deste produto aparecem aqui a partir de agora.'}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {listadas.map(mov => {
                    const positivo = Number(mov.delta) > 0
                    const clicavel = mov.origem_tipo === 'venda' && !!mov.origem_id
                    const aberta   = movVenda?.id === mov.origem_id
                    return (
                      <div key={mov.id} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                              <StatusPill tone={toneTipo(mov.tipo)} label={rotuloTipo(mov.tipo)} />
                              {mov.variacao_label && (
                                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                                  {mov.variacao_label}
                                </span>
                              )}
                            </div>
                            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                              {fmtDataHora(mov.created_at)}
                              {mov.motivo ? ` · ${mov.motivo}` : ''}
                              {mov.usuario ? ` · ${mov.usuario}` : ''}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: positivo ? 'var(--status-ok-tx)' : 'var(--status-bad-tx)', lineHeight: 1 }}>
                              {fmtDelta(mov.delta)}
                            </p>
                            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                              saldo {mov.qtd_nova}
                            </p>
                          </div>
                        </div>

                        {clicavel && (
                          <button
                            onClick={() => abrirVenda(mov.origem_id)}
                            style={{
                              marginTop: 8, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700,
                              color: theme.primary, textDecoration: 'underline',
                            }}
                          >
                            {aberta ? 'Ocultar venda' : 'Ver venda'}
                          </button>
                        )}

                        {clicavel && aberta && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                            {movVenda.carregando ? (
                              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>Carregando venda...</p>
                            ) : !movVenda.venda ? (
                              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>Venda não encontrada — pode ter sido excluída.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>
                                  {fmtR(movVenda.venda.valor)} · {fmtDataHora(movVenda.venda.data)}
                                </p>
                                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
                                  {movVenda.venda.cliente_nome || 'Sem cliente'}
                                  {movVenda.venda.vendedora ? ` · ${movVenda.venda.vendedora}` : ''}
                                </p>
                                {(movVenda.venda.produtos || []).length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                                    {movVenda.venda.produtos.map((p, i) => (
                                      <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--r-chip)', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                                        {p.quantidade || 1}× {p.nome}{p.variacao ? ` (${p.variacao})` : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {!movLoading && !movErro && (
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 14, lineHeight: 1.5 }}>
                  O registro vale a partir da ativação do histórico — movimentações anteriores a isso não foram guardadas.
                </p>
              )}
            </div>
          </div>
        )
      })()}

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
