import { useState, useEffect } from 'react'
import { Users, Plus, Search, ChevronDown, ChevronUp, Pencil, Trash2, X, Check } from 'lucide-react'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtData(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function fmtDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const FORM_VAZIO = { nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '' }

function Modal({ initial, onSalvar, onCancelar, theme }) {
  const [form, setForm] = useState(initial || FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onCancelar() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancelar])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function handleSalvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    setSalvando(true)
    try {
      await onSalvar(form)
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.')
      setSalvando(false)
    }
  }

  const textareaStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg)', border: '1.5px solid var(--line)',
    borderRadius: 'var(--r-input)', padding: '10px 14px',
    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)', outline: 'none',
    resize: 'vertical', lineHeight: 1.5,
  }

  return (
    <div onClick={onCancelar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 520, padding: '24px 20px',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
            {initial ? 'Editar cliente' : 'Novo cliente'}
          </p>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="Nome completo" autoFocus />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={e => set('telefone', e.target.value)}
              placeholder="(00) 00000-0000" type="tel" mono />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="email@exemplo.com" type="email" />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input value={form.data_nascimento} onChange={e => set('data_nascimento', e.target.value)}
              type="date" />
          </div>
          <div>
            <Label>Observações</Label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              placeholder="Preferências, tamanho, anotações..." rows={3}
              style={textareaStyle}
              onFocus={e => { e.target.style.borderColor = theme.primary; e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20` }}
              onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none' }} />
          </div>
        </div>

        {erro && (
          <p style={{ marginTop: 10, fontSize: 13, color: '#ef4444', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{erro}</p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button variant="secondary" onClick={onCancelar} style={{ flex: 1 }}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={salvando ? undefined : Check}
            disabled={salvando}
            onClick={handleSalvar}
            style={{ flex: 2, background: theme.primary }}
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ClienteCard({ cliente, vendas, theme, onEditar, onExcluir }) {
  const [aberto, setAberto] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const vendasCliente = vendas.filter(v =>
    v.cliente_nome && v.cliente_nome.trim().toLowerCase() === cliente.nome.trim().toLowerCase()
  )
  const totalGasto = vendasCliente.reduce((s, v) => s + Number(v.valor || 0), 0)
  const ultimas5 = [...vendasCliente].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5)
  const inicial = (cliente.nome || '?')[0].toUpperCase()

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', overflow: 'hidden', marginBottom: 10 }}>
      {/* Cabeçalho clicável — vira um "card" empilhado em telas estreitas */}
      <div
        onClick={() => setAberto(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
      >
        <div style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          background: `color-mix(in srgb, ${theme.primary} 12%, white)`,
          border: `1.5px solid color-mix(in srgb, ${theme.primary} 30%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: theme.primary, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{inicial}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{cliente.nome}</p>
          {cliente.telefone && (
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: 'var(--muted)' }}>{cliente.telefone}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: 'var(--muted)' }}>
              {vendasCliente.length} compra{vendasCliente.length !== 1 ? 's' : ''}
            </span>
            {totalGasto > 0 && (
              <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: theme.primary }}>
                {fmtR(totalGasto)}
              </span>
            )}
          </div>
        </div>
        {aberto ? <ChevronUp size={16} color="var(--muted)" style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color="var(--muted)" style={{ flexShrink: 0 }} />}
      </div>

      {/* Detalhes expandidos */}
      {aberto && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '16px 16px 14px' }}>
          {/* Dados extras */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {cliente.email && (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink-soft)', overflowWrap: 'anywhere' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>E-mail: </span>{cliente.email}
              </p>
            )}
            {cliente.data_nascimento && (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink-soft)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Nascimento: </span>{fmtData(cliente.data_nascimento)}
              </p>
            )}
            {cliente.observacoes && (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink-soft)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Obs: </span>{cliente.observacoes}
              </p>
            )}
          </div>

          {/* Histórico de compras */}
          {ultimas5.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                Últimas compras
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ultimas5.map(v => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--r-chip)', border: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>{fmtDataHora(v.data)}</p>
                      {(v.produtos || []).length > 0 && (
                        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.produtos.map(p => p.nome).join(', ')}
                        </p>
                      )}
                    </div>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: theme.primary, flexShrink: 0 }}>
                      {fmtR(v.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botões de ação */}
          {!confirmDel ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="ghost" icon={Pencil} onClick={() => onEditar(cliente)}
                style={{ flex: 1, border: `1.5px solid ${theme.primary}`, color: theme.primary, height: 38, minHeight: 38, fontSize: 13 }}
              >
                Editar
              </Button>
              <button onClick={() => setConfirmDel(true)}
                style={{ flex: 1, height: 38, borderRadius: 'var(--r-input)', border: '1.5px solid #fca5a5', background: 'transparent', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Trash2 size={13} /> Excluir
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
                Confirmar exclusão de <strong style={{ color: 'var(--ink)' }}>{cliente.nome}</strong>?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={() => setConfirmDel(false)} style={{ flex: 1, height: 38, minHeight: 38, fontSize: 13 }}>
                  Cancelar
                </Button>
                <button onClick={() => onExcluir(cliente.id)}
                  style={{ flex: 1, height: 38, borderRadius: 'var(--r-input)', border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  Excluir
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Clientes({ clientes, vendas, addCliente, updateCliente, deleteCliente, theme }) {
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(null) // null | 'novo' | { cliente }

  const filtrados = clientes.filter(c => {
    const q = busca.toLowerCase()
    return (c.nome || '').toLowerCase().includes(q) || (c.telefone || '').toLowerCase().includes(q)
  })

  async function handleSalvar(form) {
    if (modal === 'novo') {
      await addCliente(form)
    } else {
      await updateCliente(modal.id, {
        nome: form.nome?.trim(),
        telefone: form.telefone?.trim() || null,
        email: form.email?.trim() || null,
        data_nascimento: form.data_nascimento || null,
        observacoes: form.observacoes?.trim() || null,
      })
    }
    setModal(null)
  }

  async function handleExcluir(id) {
    await deleteCliente(id)
  }

  return (
    <div style={{ paddingTop: 8, width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
          Clientes
        </p>
        <Button
          variant="primary" icon={Plus} onClick={() => setModal('novo')}
          style={{ background: theme.primary, flexShrink: 0 }}
        >
          Novo cliente
        </Button>
      </div>

      {/* Busca */}
      {clientes.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }} />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            style={{ paddingLeft: 38 }}
          />
        </div>
      )}

      {/* Estado vazio */}
      {clientes.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
          <EmptyState
            icon={Users}
            title="Nenhum cliente ainda"
            subtitle="Cadastre suas clientes para acompanhar o histórico e faturar mais no crediário."
            actionLabel="Cadastrar primeira cliente"
            onAction={() => setModal('novo')}
          />
        </div>
      )}

      {/* Lista */}
      {filtrados.length > 0 && filtrados.map(c => (
        <ClienteCard
          key={c.id}
          cliente={c}
          vendas={vendas}
          theme={theme}
          onEditar={c => setModal(c)}
          onExcluir={handleExcluir}
        />
      ))}

      {/* Sem resultados de busca */}
      {clientes.length > 0 && filtrados.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
          <EmptyState
            icon={Search}
            title={`Nada encontrado para "${busca}"`}
            actionLabel="Limpar busca"
            onAction={() => setBusca('')}
          />
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal
          initial={modal === 'novo' ? null : {
            nome: modal.nome || '',
            telefone: modal.telefone || '',
            email: modal.email || '',
            data_nascimento: modal.data_nascimento || '',
            observacoes: modal.observacoes || '',
          }}
          onSalvar={handleSalvar}
          onCancelar={() => setModal(null)}
          theme={theme}
        />
      )}
    </div>
  )
}
