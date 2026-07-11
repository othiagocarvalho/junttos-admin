import { useState, useEffect } from 'react'
import { Search, Plus, X, ArrowLeft, Truck, Phone, Calendar, Check, Trash2, Receipt } from 'lucide-react'
import { HeroCard } from '../../components/studio/Card'
import { StatGrid } from '../../components/studio/StatCard'
import StatCard from '../../components/studio/StatCard'
import StatusPill from '../../components/studio/StatusPill'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtData(d) {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
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

const EMPTY_FORNECEDOR = { nome: '', contato: '', documento: '', prazo_pagamento_dias: '', observacoes: '' }
const EMPTY_COMPRA = { descricao: '', valor: '', data_compra: new Date().toISOString().slice(0, 10), data_vencimento: '', status_pgto: 'pendente' }

export default function Fornecedores({
  fornecedores = [], addFornecedor, updateFornecedor, removeFornecedor,
  compras = [], addCompra, marcarCompraPaga, deleteCompra,
  theme = {},
}) {
  const [search, setSearch]             = useState('')
  const [selecionado, setSelecionado]   = useState(null) // fornecedor selecionado (detalhe)
  const [modalForm, setModalForm]       = useState(null) // 'novo' | 'editar' | null
  const [form, setForm]                 = useState(EMPTY_FORNECEDOR)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [compraModal, setCompraModal]   = useState(false)
  const [compraForm, setCompraForm]     = useState(EMPTY_COMPRA)
  const [compraSaving, setCompraSaving] = useState(false)
  const [confirmRemover, setConfirmRemover] = useState(null)

  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'Escape') return
      if (confirmRemover) setConfirmRemover(null)
      else if (compraModal) setCompraModal(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [confirmRemover, compraModal])

  const ativos = fornecedores.filter(f => f.ativo !== false)
  const filtrados = ativos.filter(f => f.nome.toLowerCase().includes(search.toLowerCase()))

  const comprasPendentes = compras.filter(c => c.status_pgto !== 'pago')
  const totalEmAberto = comprasPendentes.reduce((s, c) => s + Number(c.valor || 0), 0)

  function comprasDoFornecedor(fornecedorId) {
    return compras.filter(c => c.fornecedor_id === fornecedorId)
  }

  function abrirNovo() {
    setForm(EMPTY_FORNECEDOR); setError(''); setModalForm('novo')
  }

  function abrirEditar(fornecedor) {
    setForm({
      nome: fornecedor.nome || '',
      contato: fornecedor.contato || '',
      documento: fornecedor.documento || '',
      prazo_pagamento_dias: fornecedor.prazo_pagamento_dias != null ? String(fornecedor.prazo_pagamento_dias) : '',
      observacoes: fornecedor.observacoes || '',
    })
    setError(''); setModalForm('editar')
  }

  async function handleSalvarFornecedor() {
    if (!form.nome.trim() || saving) return
    setSaving(true); setError('')
    try {
      const dados = {
        nome: form.nome.trim(),
        contato: form.contato.trim() || null,
        documento: form.documento.trim() || null,
        prazo_pagamento_dias: form.prazo_pagamento_dias ? parseInt(form.prazo_pagamento_dias) : null,
        observacoes: form.observacoes.trim() || null,
      }
      if (modalForm === 'novo') {
        const criado = await addFornecedor(dados)
        setSelecionado(criado)
      } else if (selecionado) {
        const atualizado = await updateFornecedor(selecionado.id, dados)
        setSelecionado(atualizado)
      }
      setModalForm(null)
    } catch (e) {
      setError(e.message || 'Erro ao salvar fornecedor.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemover() {
    if (!confirmRemover) return
    await removeFornecedor(confirmRemover.id)
    setConfirmRemover(null)
    if (selecionado?.id === confirmRemover.id) setSelecionado(null)
  }

  function abrirNovaCompra() {
    setCompraForm(EMPTY_COMPRA); setCompraModal(true)
  }

  async function handleSalvarCompra() {
    if (!selecionado || !compraForm.valor || compraSaving) return
    setCompraSaving(true)
    try {
      await addCompra({
        fornecedor_id: selecionado.id,
        descricao: compraForm.descricao,
        valor: parseFloat((compraForm.valor || '').toString().replace(',', '.')) || 0,
        data_compra: compraForm.data_compra,
        data_vencimento: compraForm.data_vencimento || null,
        status_pgto: compraForm.status_pgto,
      })
      setCompraModal(false)
    } finally {
      setCompraSaving(false)
    }
  }

  // ── Detalhe do fornecedor ──────────────────────────────────
  if (selecionado) {
    const historico = comprasDoFornecedor(selecionado.id).sort((a, b) => new Date(b.data_compra) - new Date(a.data_compra))
    const totalFornecedor = historico.reduce((s, c) => s + Number(c.valor || 0), 0)
    const emAbertoFornecedor = historico.filter(c => c.status_pgto !== 'pago').reduce((s, c) => s + Number(c.valor || 0), 0)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8, overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
        <button
          onClick={() => setSelecionado(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, padding: 0, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={16} /> Fornecedores
        </button>

        <HeroCard tone="primary" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 18, fontWeight: 800, color: '#fff' }}>{selecionado.nome}</p>
              {selecionado.contato && (
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={12} /> {selecionado.contato}
                </p>
              )}
            </div>
            <button
              onClick={() => abrirEditar(selecionado)}
              style={{ background: 'rgba(255,255,255,0.16)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
            >Editar</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <StatusPill tone="info" label={selecionado.prazo_pagamento_dias ? `Prazo: ${selecionado.prazo_pagamento_dias} dias` : 'Prazo não definido'} />
            {selecionado.documento && <StatusPill tone="ok" label={selecionado.documento} />}
          </div>
          {selecionado.observacoes && (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.5, marginTop: 4 }}>
              {selecionado.observacoes}
            </p>
          )}
        </HeroCard>

        <StatGrid>
          <StatCard label="Total comprado" value={fmtR(totalFornecedor)} icon={Receipt} />
          <StatCard label="Em aberto" value={fmtR(emAbertoFornecedor)} icon={Calendar} iconColor={emAbertoFornecedor > 0 ? '#DD4F3E' : undefined} />
        </StatGrid>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Histórico de compras</p>
          <Button variant="primary" icon={Plus} style={{ height: 38, padding: '0 14px', fontSize: 13 }} onClick={abrirNovaCompra}>Registrar compra</Button>
        </div>

        {historico.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
            <EmptyState icon={Receipt} title="Nenhuma compra registrada" subtitle="Registre a primeira compra deste fornecedor." actionLabel="Registrar compra" onAction={abrirNovaCompra} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historico.map(c => {
              const vencida = c.status_pgto !== 'pago' && c.data_vencimento && new Date(c.data_vencimento + 'T12:00:00') < new Date()
              const tone = c.status_pgto === 'pago' ? 'ok' : (vencida ? 'bad' : 'warn')
              const label = c.status_pgto === 'pago' ? 'Pago' : (vencida ? 'Vencido' : 'Pendente')
              return (
                <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.descricao || 'Compra'}
                    </p>
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                      {fmtData(c.data_compra)}{c.data_vencimento ? ` · vence ${fmtData(c.data_vencimento)}` : ''}
                    </p>
                  </div>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>{fmtR(c.valor)}</span>
                  <StatusPill tone={tone} label={label} />
                  {c.status_pgto !== 'pago' && (
                    <button
                      onClick={() => marcarCompraPaga(c.id)}
                      title="Marcar como pago"
                      style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--muted)', display: 'flex', flexShrink: 0 }}
                    ><Check size={14} /></button>
                  )}
                  <button
                    onClick={() => deleteCompra(c.id)}
                    title="Excluir"
                    style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--muted)', display: 'flex', flexShrink: 0 }}
                  ><Trash2 size={14} /></button>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal editar fornecedor */}
        {modalForm && (
          <FornecedorFormModal
            modo={modalForm} form={form} setForm={setForm} error={error} saving={saving}
            onClose={() => setModalForm(null)} onSave={handleSalvarFornecedor}
          />
        )}

        {/* Modal nova compra */}
        {compraModal && (
          <div onClick={() => setCompraModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 480, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Registrar compra</p>
                <button onClick={() => setCompraModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Descrição</label>
                  <input value={compraForm.descricao} onChange={e => setCompraForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Lote de vestidos" style={inputStyle} autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Valor (R$)</label>
                    <input type="number" min="0" step="0.01" value={compraForm.valor} onChange={e => setCompraForm(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Data da compra</label>
                    <input type="date" value={compraForm.data_compra} onChange={e => setCompraForm(p => ({ ...p, data_compra: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Vencimento</label>
                    <input type="date" value={compraForm.data_vencimento} onChange={e => setCompraForm(p => ({ ...p, data_vencimento: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select value={compraForm.status_pgto} onChange={e => setCompraForm(p => ({ ...p, status_pgto: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                    </select>
                  </div>
                </div>
                <Button variant="primary" fullWidth disabled={!compraForm.valor || compraSaving} onClick={handleSalvarCompra} style={{ marginTop: 4 }}>
                  {compraSaving ? 'Salvando...' : 'Registrar compra'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Lista de fornecedores ──────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8, overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
      <StatGrid>
        <StatCard label="Fornecedores ativos" value={ativos.length} icon={Truck} />
        <StatCard label="Em aberto" value={fmtR(totalEmAberto)} icon={Calendar} iconColor={totalEmAberto > 0 ? '#DD4F3E' : undefined} />
      </StatGrid>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar fornecedor..."
            style={{ ...inputStyle, height: 46, paddingLeft: 40, background: 'var(--surface)' }}
          />
        </div>
        <Button variant="primary" icon={Plus} style={{ height: 46, flexShrink: 0, background: theme.primary }} onClick={abrirNovo}>Novo</Button>
      </div>

      {ativos.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
          <EmptyState icon={Truck} title="Nenhum fornecedor cadastrado" subtitle="Cadastre seus fornecedores para acompanhar compras e prazos de pagamento." actionLabel="Novo fornecedor" onAction={abrirNovo} />
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
          <EmptyState icon={Search} title={`Nada encontrado para "${search}"`} actionLabel="Limpar busca" onAction={() => setSearch('')} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map(f => {
            const emAberto = comprasDoFornecedor(f.id).filter(c => c.status_pgto !== 'pago').reduce((s, c) => s + Number(c.valor || 0), 0)
            return (
              <button
                key={f.id}
                onClick={() => setSelecionado(f)}
                style={{ width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `color-mix(in srgb, ${theme.primary || 'var(--primary)'} 10%, white)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={18} color={theme.primary || 'var(--primary)'} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nome}</p>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                    {f.prazo_pagamento_dias ? `Prazo: ${f.prazo_pagamento_dias} dias` : 'Prazo não definido'}
                  </p>
                </div>
                {emAberto > 0 && <StatusPill tone="warn" label={fmtR(emAberto)} />}
              </button>
            )
          })}
        </div>
      )}

      {modalForm && (
        <FornecedorFormModal
          modo={modalForm} form={form} setForm={setForm} error={error} saving={saving}
          onClose={() => setModalForm(null)} onSave={handleSalvarFornecedor}
          onRemover={modalForm === 'editar' ? () => setConfirmRemover(selecionado) : undefined}
        />
      )}

      {confirmRemover && (
        <div onClick={() => setConfirmRemover(null)} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', padding: 22, maxWidth: 340, width: '100%' }}>
            {comprasDoFornecedor(confirmRemover.id).length > 0 ? (
              <>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 8 }}>Não é possível remover</p>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
                  Este fornecedor tem {comprasDoFornecedor(confirmRemover.id).length} compra{comprasDoFornecedor(confirmRemover.id).length > 1 ? 's' : ''} registrada{comprasDoFornecedor(confirmRemover.id).length > 1 ? 's' : ''} e não pode ser removido.
                </p>
                <Button variant="secondary" fullWidth onClick={() => setConfirmRemover(null)}>Fechar</Button>
              </>
            ) : (
              <>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 8 }}>Remover fornecedor?</p>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
                  "{confirmRemover.nome}" será removido da lista.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button variant="secondary" fullWidth onClick={() => setConfirmRemover(null)}>Cancelar</Button>
                  <Button variant="primary" fullWidth style={{ background: '#DD4F3E' }} onClick={handleRemover}>Remover</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FornecedorFormModal({ modo, form, setForm, error, saving, onClose, onSave, onRemover }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
            {modo === 'novo' ? 'Novo Fornecedor' : 'Editar Fornecedor'}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nome *</label>
            <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Confecções Ana Ltda" style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Contato</label>
            <input value={form.contato} onChange={e => setForm(p => ({ ...p, contato: e.target.value }))} placeholder="Telefone, e-mail ou WhatsApp" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>CNPJ/CPF (opcional)</label>
              <input value={form.documento} onChange={e => setForm(p => ({ ...p, documento: e.target.value }))} placeholder="00.000.000/0000-00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Prazo de pagamento (dias)</label>
              <input type="number" min="0" value={form.prazo_pagamento_dias} onChange={e => setForm(p => ({ ...p, prazo_pagamento_dias: e.target.value }))} placeholder="Ex: 30" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea
              value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
              placeholder="Notas sobre este fornecedor..." rows={3}
              style={{ ...inputStyle, height: 'auto', padding: '12px 14px', resize: 'vertical', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            />
          </div>

          {error && (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, color: '#DD4F3E' }}>{error}</p>
          )}

          <Button variant="primary" fullWidth disabled={!form.nome.trim() || saving} onClick={onSave}>
            {saving ? 'Salvando...' : (modo === 'novo' ? 'Cadastrar fornecedor' : 'Salvar alterações')}
          </Button>
          {onRemover && (
            <button
              onClick={onRemover}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DD4F3E', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            ><Trash2 size={14} /> Remover fornecedor</button>
          )}
        </div>
      </div>
    </div>
  )
}
