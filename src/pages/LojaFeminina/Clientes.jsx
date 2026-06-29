import { useState } from 'react'
import { User, Plus, Search, ChevronDown, ChevronUp, Pencil, Trash2, X, Check } from 'lucide-react'

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

  const inp = {
    width: '100%', height: 44, boxSizing: 'border-box',
    background: 'var(--bg)', border: '1.5px solid var(--line)',
    borderRadius: 10, padding: '0 14px',
    fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--ink)', outline: 'none',
  }
  const lbl = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    marginBottom: 6, letterSpacing: '0.12em', textTransform: 'uppercase',
    fontFamily: 'Manrope, sans-serif',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 520, padding: '24px 20px',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        maxHeight: '90dvh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
            {initial ? 'Editar cliente' : 'Novo cliente'}
          </p>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Nome *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="Nome completo" autoFocus style={inp}
              onFocus={e => { e.target.style.borderColor = theme.primary; e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20` }}
              onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none' }} />
          </div>
          <div>
            <label style={lbl}>Telefone</label>
            <input value={form.telefone} onChange={e => set('telefone', e.target.value)}
              placeholder="(00) 00000-0000" type="tel" style={inp}
              onFocus={e => { e.target.style.borderColor = theme.primary; e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20` }}
              onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none' }} />
          </div>
          <div>
            <label style={lbl}>E-mail</label>
            <input value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="email@exemplo.com" type="email" style={inp}
              onFocus={e => { e.target.style.borderColor = theme.primary; e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20` }}
              onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none' }} />
          </div>
          <div>
            <label style={lbl}>Data de nascimento</label>
            <input value={form.data_nascimento} onChange={e => set('data_nascimento', e.target.value)}
              type="date" style={inp}
              onFocus={e => { e.target.style.borderColor = theme.primary; e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20` }}
              onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none' }} />
          </div>
          <div>
            <label style={lbl}>Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              placeholder="Preferências, tamanho, anotações..." rows={3}
              style={{ ...inp, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.5 }}
              onFocus={e => { e.target.style.borderColor = theme.primary; e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20` }}
              onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none' }} />
          </div>
        </div>

        {erro && (
          <p style={{ marginTop: 10, fontSize: 13, color: '#ef4444', fontFamily: 'Manrope, sans-serif' }}>{erro}</p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onCancelar}
            style={{ flex: 1, height: 48, borderRadius: 12, border: '1.5px solid var(--line)', background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={salvando}
            style={{ flex: 2, height: 48, borderRadius: 12, border: 'none', background: salvando ? 'var(--line)' : theme.primary, cursor: salvando ? 'not-allowed' : 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {salvando ? 'Salvando...' : <><Check size={15} /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function ClienteCard({ cliente, vendas, theme, onEditar, onExcluir }) {
  const [aberto, setAberto] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const vendasCliente = vendas.filter(v =>
    v.cliente_nome && v.cliente_nome.toLowerCase() === cliente.nome.toLowerCase()
  )
  const totalGasto = vendasCliente.reduce((s, v) => s + Number(v.valor || 0), 0)
  const ultimas5 = [...vendasCliente].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5)
  const inicial = (cliente.nome || '?')[0].toUpperCase()

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
      {/* Cabeçalho clicável */}
      <div
        onClick={() => setAberto(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: `${theme.primary}20`, border: `1.5px solid ${theme.primary}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: theme.primary, fontFamily: 'Manrope, sans-serif' }}>{inicial}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>{cliente.nome}</p>
          {cliente.telefone && (
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>{cliente.telefone}</p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontFamily: 'Manrope, sans-serif', color: 'var(--muted)' }}>
              {vendasCliente.length} compra{vendasCliente.length !== 1 ? 's' : ''}
            </span>
            {totalGasto > 0 && (
              <span style={{ fontSize: 11, fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: theme.primary }}>
                {fmtR(totalGasto)}
              </span>
            )}
          </div>
        </div>
        {aberto ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
      </div>

      {/* Detalhes expandidos */}
      {aberto && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '16px 16px 14px' }}>
          {/* Dados extras */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {cliente.email && (
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--ink-soft)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>E-mail: </span>{cliente.email}
              </p>
            )}
            {cliente.data_nascimento && (
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--ink-soft)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Nascimento: </span>{fmtData(cliente.data_nascimento)}
              </p>
            )}
            {cliente.observacoes && (
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--ink-soft)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Obs: </span>{cliente.observacoes}
              </p>
            )}
          </div>

          {/* Histórico de compras */}
          {ultimas5.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                Últimas compras
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ultimas5.map(v => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'var(--muted)' }}>{fmtDataHora(v.data)}</p>
                      {(v.produtos || []).length > 0 && (
                        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.produtos.map(p => p.nome).join(', ')}
                        </p>
                      )}
                    </div>
                    <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: theme.primary, marginLeft: 10, flexShrink: 0 }}>
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
              <button onClick={() => onEditar(cliente)}
                style={{ flex: 1, height: 38, borderRadius: 10, border: `1.5px solid ${theme.primary}`, background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Pencil size={13} /> Editar
              </button>
              <button onClick={() => setConfirmDel(true)}
                style={{ flex: 1, height: 38, borderRadius: 10, border: '1.5px solid #fca5a5', background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Trash2 size={13} /> Excluir
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
                Confirmar exclusão de <strong style={{ color: 'var(--ink)' }}>{cliente.nome}</strong>?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDel(false)}
                  style={{ flex: 1, height: 38, borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                  Cancelar
                </button>
                <button onClick={() => onExcluir(cliente.id)}
                  style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
          Clientes
        </p>
        <button
          onClick={() => setModal('novo')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, border: 'none',
            background: theme.primary, color: '#fff', cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700,
          }}
        >
          <Plus size={14} /> Novo cliente
        </button>
      </div>

      {/* Busca */}
      {clientes.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            style={{
              width: '100%', height: 44, boxSizing: 'border-box',
              background: 'var(--surface)', border: '1.5px solid var(--line)',
              borderRadius: 12, paddingLeft: 38, paddingRight: 14,
              fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--ink)', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = theme.primary }}
            onBlur={e => { e.target.style.borderColor = 'var(--line)' }}
          />
        </div>
      )}

      {/* Estado vazio */}
      {clientes.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${theme.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <User size={26} color={theme.primary} />
          </div>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>
            Nenhum cliente cadastrado
          </p>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
            Cadastre seus clientes para acompanhar o histórico de compras
          </p>
          <button
            onClick={() => setModal('novo')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 12, border: 'none', background: theme.primary, color: '#fff', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700 }}
          >
            <Plus size={15} /> Cadastrar primeiro cliente
          </button>
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
        <div style={{ textAlign: 'center', padding: '32px 24px' }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)' }}>Nenhum cliente encontrado para "{busca}"</p>
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
