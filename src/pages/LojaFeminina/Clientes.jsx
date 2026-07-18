import { useState, useEffect, useMemo } from 'react'
import { Users, Plus, Search, ChevronDown, ChevronUp, Pencil, Trash2, X, Check, MessageCircle } from 'lucide-react'
import UpgradeWall from '../../components/UpgradeWall'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'
import { temAcesso } from '../../utils/planos'
import {
  diasDesdeUltima,
  isInativo,
  ticketMedioLoja,
  isVip,
  badgeAniversario,
  tamanhoPreferido,
  categoriaFavorita,
  ticketMedioCliente,
  normalizeWaPhone,
} from '../../utils/crm'

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

// ── Modal ──────────────────────────────────────────────────────
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

// ── Segment badge pill ─────────────────────────────────────────
function Pill({ children, bg, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      background: bg, color, flexShrink: 0,
    }}>{children}</span>
  )
}

// ── ClienteCard ────────────────────────────────────────────────
function ClienteCard({
  cliente, vendas, produtosData, theme, onEditar, onExcluir,
  proMode, diasUltima, vip, badgeAniv, inativo,
}) {
  const [aberto, setAberto] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const vendasCliente = vendas.filter(v =>
    v.cliente_nome && v.cliente_nome.trim().toLowerCase() === cliente.nome.trim().toLowerCase()
  )
  const totalGasto = vendasCliente.reduce((s, v) => s + Number(v.valor || 0), 0)
  const ultimas = [...vendasCliente].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5)
  const inicial = (cliente.nome || '?')[0].toUpperCase()

  const proDetails = useMemo(() => {
    if (!proMode || !aberto) return null
    return {
      tamanho: tamanhoPreferido(vendas, cliente.nome),
      catFav:  categoriaFavorita(vendas, cliente.nome, produtosData),
      ticket:  ticketMedioCliente(vendas, cliente.nome),
    }
  }, [proMode, aberto, vendas, cliente.nome, produtosData])

  const waPhone = normalizeWaPhone(cliente.telefone)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', overflow: 'hidden', marginBottom: 10 }}>
      {/* Header */}
      <div
        onClick={() => setAberto(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
      >
        {/* Avatar */}
        <div style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          background: `color-mix(in srgb, ${theme.primary} 12%, white)`,
          border: `1.5px solid color-mix(in srgb, ${theme.primary} 30%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: theme.primary, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{inicial}</span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + Pro badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 2 }}>
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--ink)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{cliente.nome}</p>
            {proMode && badgeAniv === 'hoje' && <Pill bg="#dcfce7" color="#16a34a">Hoje</Pill>}
            {proMode && badgeAniv === 'mes'  && <Pill bg="#ede9fe" color="#7c3aed">Aniversário</Pill>}
            {proMode && vip                  && <Pill bg="#fef9c3" color="#a16207">VIP</Pill>}
            {proMode && inativo              && <Pill bg="#fef3c7" color="#d97706">Inativo {diasUltima}d</Pill>}
          </div>

          {cliente.telefone && (
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>{cliente.telefone}</p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {proMode ? (
              diasUltima !== null
                ? <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: 'var(--muted)' }}>Última: {diasUltima}d atrás</span>
                : <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: 'var(--muted)' }}>Sem compras</span>
            ) : (
              <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: 'var(--muted)' }}>
                {vendasCliente.length} compra{vendasCliente.length !== 1 ? 's' : ''}
              </span>
            )}
            {totalGasto > 0 && (
              <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: theme.primary }}>
                {fmtR(totalGasto)}
              </span>
            )}
          </div>
        </div>

        {/* WhatsApp button (Pro + has phone) */}
        {proMode && waPhone && (
          <a
            href={`https://wa.me/${waPhone}?text=${encodeURIComponent('Olá, ' + cliente.nome + '!')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: '#25D366',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            <MessageCircle size={16} color="#fff" />
          </a>
        )}

        {aberto
          ? <ChevronUp  size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
          : <ChevronDown size={16} color="var(--muted)" style={{ flexShrink: 0 }} />}
      </div>

      {/* Expanded */}
      {aberto && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '16px 16px 14px' }}>

          {/* Pro: preference tags */}
          {proMode && proDetails && (proDetails.tamanho || proDetails.catFav) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {proDetails.tamanho && (
                <span style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                  background: `color-mix(in srgb, ${theme.primary} 10%, white)`,
                  border: `1px solid color-mix(in srgb, ${theme.primary} 20%, transparent)`,
                  color: theme.primary, fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                  Tamanho: {proDetails.tamanho}
                </span>
              )}
              {proDetails.catFav && (
                <span style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                  background: `color-mix(in srgb, ${theme.primary} 10%, white)`,
                  border: `1px solid color-mix(in srgb, ${theme.primary} 20%, transparent)`,
                  color: theme.primary, fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                  {proDetails.catFav}
                </span>
              )}
            </div>
          )}

          {/* Pro: client stats mini-row */}
          {proMode && proDetails && (
            <div style={{
              display: 'flex', gap: 0, marginBottom: 14,
              background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--line)',
              overflow: 'hidden',
            }}>
              {[
                { label: 'Ticket médio', value: fmtR(proDetails.ticket) },
                { label: 'Compras',      value: String(vendasCliente.length) },
                { label: 'Total gasto',  value: fmtR(totalGasto) },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, padding: '10px 12px', borderRight: i < 2 ? '1px solid var(--line)' : 'none', minWidth: 0 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Plus Jakarta Sans, sans-serif', marginBottom: 3 }}>
                    {stat.label}
                  </p>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: i === 2 ? theme.primary : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Basic data (always shown) */}
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

          {/* Purchase history */}
          {ultimas.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                Últimas compras
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ultimas.map(v => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--r-chip)', border: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>{fmtDataHora(v.data)}</p>
                      {(v.produtos || []).length > 0 && (
                        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.produtos.map(p => p.nome + (p.variacao && p.variacao !== 'Único' ? ` (${p.variacao})` : '')).join(', ')}
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

          {/* Actions */}
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


// ── Main export ────────────────────────────────────────────────
export default function Clientes({ clientes, vendas, addCliente, updateCliente, deleteCliente, theme, produtosData = [], plano = 'starter' }) {
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(null)
  const [filtro, setFiltro] = useState('todos')

  const isPro = temAcesso(plano, 'pro')
  const hoje = new Date().toISOString().slice(0, 10)

  const ticket = useMemo(() => ticketMedioLoja(vendas, hoje), [vendas, hoje])

  const enriched = useMemo(() => clientes.map(c => {
    const norm = s => (s || '').trim().toLowerCase()
    const vendasC = vendas.filter(v => norm(v.cliente_nome) === norm(c.nome))
    const totalGasto = vendasC.reduce((s, v) => s + Number(v.valor || 0), 0)
    return {
      ...c,
      _diasUltima: diasDesdeUltima(vendas, c.nome, hoje),
      _vip:        isVip(totalGasto, ticket),
      _inativo:    isInativo(vendas, c.nome, hoje),
      _badgeAniv:  badgeAniversario(c.data_nascimento, hoje),
    }
  }), [clientes, vendas, hoje, ticket])

  const counts = useMemo(() => ({
    aniversariantes: enriched.filter(c => c._badgeAniv !== null).length,
    inativos:        enriched.filter(c => c._inativo).length,
    vip:             enriched.filter(c => c._vip).length,
  }), [enriched])

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase()
    let result = q
      ? enriched.filter(c => (c.nome || '').toLowerCase().includes(q) || (c.telefone || '').toLowerCase().includes(q))
      : enriched
    if (isPro) {
      if (filtro === 'aniversariantes') return result.filter(c => c._badgeAniv !== null)
      if (filtro === 'inativos')        return result.filter(c => c._inativo)
      if (filtro === 'vip')             return result.filter(c => c._vip)
    }
    return result
  }, [enriched, busca, filtro, isPro])

  if (!isPro) {
    return <UpgradeWall planoAtual={plano} planoNecessario="pro" funcionalidade="crm_avancado" theme={theme} />
  }

  async function handleSalvar(form) {
    if (modal === 'novo') {
      await addCliente(form)
    } else {
      await updateCliente(modal.id, {
        nome:             form.nome?.trim(),
        telefone:         form.telefone?.trim() || null,
        email:            form.email?.trim()    || null,
        data_nascimento:  form.data_nascimento  || null,
        observacoes:      form.observacoes?.trim() || null,
      })
    }
    setModal(null)
  }

  const FILTROS = [
    { id: 'todos',           label: 'Todos' },
    { id: 'aniversariantes', label: `Aniversários${counts.aniversariantes > 0 ? ` (${counts.aniversariantes})` : ''}` },
    { id: 'inativos',        label: `Inativos${counts.inativos > 0 ? ` (${counts.inativos})` : ''}` },
    { id: 'vip',             label: `VIP${counts.vip > 0 ? ` (${counts.vip})` : ''}` },
  ]

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

      {/* Pro filter tabs */}
      {isPro && clientes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              style={{
                padding: '7px 14px', borderRadius: 99, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600,
                border:      filtro === f.id ? 'none'             : '1px solid var(--line)',
                background:  filtro === f.id ? theme.primary      : 'var(--surface)',
                color:       filtro === f.id ? '#fff'             : 'var(--muted)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
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

      {/* Empty state — no clients at all */}
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

      {/* Empty state — no results in current filter */}
      {clientes.length > 0 && filtrados.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)' }}>
          <EmptyState
            icon={Search}
            title={busca ? `Nada encontrado para "${busca}"` : `Nenhum cliente neste filtro`}
            actionLabel={busca ? 'Limpar busca' : 'Ver todos'}
            onAction={() => { setBusca(''); setFiltro('todos') }}
          />
        </div>
      )}

      {/* Client list */}
      {filtrados.map(c => (
        <ClienteCard
          key={c.id}
          cliente={c}
          vendas={vendas}
          produtosData={produtosData}
          theme={theme}
          onEditar={cl => setModal(cl)}
          onExcluir={id => deleteCliente(id)}
          proMode={isPro}
          diasUltima={c._diasUltima}
          vip={c._vip}
          badgeAniv={c._badgeAniv}
          inativo={c._inativo}
        />
      ))}

      {/* Modal */}
      {modal && (
        <Modal
          initial={modal === 'novo' ? null : {
            nome:            modal.nome            || '',
            telefone:        modal.telefone        || '',
            email:           modal.email           || '',
            data_nascimento: modal.data_nascimento || '',
            observacoes:     modal.observacoes     || '',
          }}
          onSalvar={handleSalvar}
          onCancelar={() => setModal(null)}
          theme={theme}
        />
      )}
    </div>
  )
}
