import { useState, useEffect } from 'react'
import { Package, ShoppingBag, Settings, Save, Users, UserPlus, CreditCard } from 'lucide-react'
import EstoqueMobile from './EstoqueMobile'
import PedidosCatalogo from './PedidosCatalogo'
import ProdutosB2BPro from './ProdutosB2BPro'
import PedidosConsolidados from './PedidosConsolidados'
import FinanceiroDesktop from '../cliente/FinanceiroDesktop'
import { supabase } from '../../lib/supabase'
import { useClientAuth } from '../../context/ClientAuthContext'
import { temAcesso } from '../../utils/planos'

const PRESETS = [
  { label: 'Junttos',  primary: '#5E2BD0' },
  { label: 'Rosê',     primary: '#C9956C' },
  { label: 'Verde',    primary: '#16a34a' },
  { label: 'Azul',     primary: '#2563eb' },
  { label: 'Borgonha', primary: '#9D174D' },
]

const NAV_BASE = [
  { id: 'produtos', label: 'Produtos',      Icon: Package },
  { id: 'pedidos',  label: 'Pedidos',       Icon: ShoppingBag },
]
const NAV_USUARIOS   = { id: 'usuarios',   label: 'Usuários',       Icon: Users }
const NAV_FINANCEIRO = { id: 'financeiro', label: 'Financeiro',     Icon: CreditCard }
const NAV_CONFIG     = { id: 'config',     label: 'Configurações',  Icon: Settings }

// ── Gerenciamento de usuários (exclusivo pro) ──────────────────
function UsuariosB2BDesktop({ lojaId, theme }) {
  const { user } = useClientAuth()
  const primary = theme.primary

  const [usuarios, setUsuarios] = useState([])
  const [loadingU, setLoadingU] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ email: '', nome: '', senha: '' })
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState(null)

  async function fetchUsuarios() {
    setLoadingU(true)
    const { data } = await supabase
      .from('lf_usuarios')
      .select('*')
      .eq('loja_id', lojaId)
      .eq('ativo', true)
      .order('criado_em')
    setUsuarios(data || [])
    setLoadingU(false)
  }

  useEffect(() => { fetchUsuarios() }, [lojaId])

  async function handleConvidar(e) {
    e.preventDefault()
    const { email, nome, senha } = form
    if (!email || !nome || !senha) { setMsg({ type: 'error', text: 'Preencha todos os campos.' }); return }
    setSaving(true); setMsg(null)
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('create-user', {
        body: { email, password: senha, loja_id: lojaId, nome },
      })
      if (fnErr || fnData?.error) throw new Error(fnData?.error || fnErr?.message || 'Erro ao criar usuário.')
      if (!fnData?.user?.id) throw new Error('Usuário criado mas ID não retornado.')
      const { error: insErr } = await supabase.from('lf_usuarios').insert({
        loja_id: lojaId, auth_user_id: fnData.user.id, email, nome, ativo: true,
      })
      if (insErr) throw new Error(insErr.message)
      setMsg({ type: 'success', text: 'Colaboradora convidada com sucesso!' })
      setForm({ email: '', nome: '', senha: '' })
      setShowForm(false)
      setTimeout(() => setMsg(null), 4000)
      await fetchUsuarios()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDesativar(id) {
    await supabase.from('lf_usuarios').update({ ativo: false }).eq('id', id)
    await fetchUsuarios()
  }

  const section = {
    background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)', padding: '24px 28px',
  }
  const inp = {
    width: '100%', height: 44, boxSizing: 'border-box',
    background: 'var(--bg)', border: '1.5px solid var(--line)',
    borderRadius: 'var(--r-input)', padding: '0 14px',
    fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)', outline: 'none',
  }
  const lbl = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    marginBottom: 7, letterSpacing: '0.12em', textTransform: 'uppercase',
    fontFamily: 'var(--font-ui)',
  }
  const msgStyle = (type) => ({
    padding: '10px 14px', borderRadius: 'var(--r-chip)', fontSize: 13,
    fontFamily: 'var(--font-ui)',
    ...(type === 'success'
      ? { background: 'var(--status-ok-bg)', color: 'var(--status-ok-tx)' }
      : { background: 'var(--status-bad-bg)', color: 'var(--status-bad-tx)' }),
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

      {/* Lista de colaboradoras */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            Colaboradoras ativas
          </p>
          <button
            onClick={() => { setShowForm(v => !v); setMsg(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 'var(--r-chip)', border: 'none',
              background: primary, color: '#fff',
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <UserPlus size={14} />
            Convidar colaboradora
          </button>
        </div>

        {!showForm && msg && <div style={{ ...msgStyle(msg.type), marginBottom: 16 }}>{msg.text}</div>}

        {loadingU ? (
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--muted)' }}>Carregando...</p>
        ) : usuarios.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--muted)' }}>
            Nenhuma colaboradora cadastrada.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {usuarios.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 'var(--r-chip)',
                background: 'var(--bg)', border: '1px solid var(--line)',
              }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                    {u.nome || u.email}
                  </p>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>{u.email}</p>
                </div>
                {u.auth_user_id === user?.id ? (
                  <span style={{
                    padding: '4px 12px', borderRadius: 8,
                    background: `${primary}15`, color: primary,
                    fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
                  }}>
                    Você
                  </span>
                ) : (
                  <button
                    onClick={() => handleDesativar(u.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--status-bad-dot)',
                      background: 'transparent', color: 'var(--status-bad-tx)',
                      fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Desativar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulário de convite */}
      {showForm ? (
        <div style={section}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>
            Nova colaboradora
          </p>
          <form onSubmit={handleConvidar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>Nome</label>
              <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Maria" style={inp} />
            </div>
            <div>
              <label style={lbl}>E-mail de acesso</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="colaboradora@email.com" style={inp} />
            </div>
            <div>
              <label style={lbl}>Senha temporária</label>
              <input type="text" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" style={inp} />
            </div>
            {msg && <div style={msgStyle(msg.type)}>{msg.text}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setShowForm(false); setMsg(null) }} style={{
                flex: 1, height: 44, borderRadius: 'var(--r-input)', border: '1.5px solid var(--line)',
                background: 'transparent', color: 'var(--muted)', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600,
              }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{
                flex: 2, height: 44, borderRadius: 'var(--r-input)', border: 'none',
                background: saving ? 'var(--line)' : primary, color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700,
              }}>
                {saving ? 'Convidando...' : 'Convidar colaboradora'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ ...section, opacity: 0.5, pointerEvents: 'none' }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            Nova colaboradora
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--muted)' }}>
            Clique em "Convidar colaboradora" para adicionar uma nova usuária a esta loja.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Sidebar (mesmo padrão collapse do ClientDashboardDesktop) ──
function B2BSidebar({ tab, setTab, theme, config, nivel, isBusiness, onSwitchToMobile }) {
  const [open, setOpen] = useState(false)
  const primary = config?.cor_primaria || theme.primary

  const NAV = [
    ...NAV_BASE,
    ...(nivel === 'pro' ? [NAV_USUARIOS] : []),
    ...(isBusiness ? [NAV_FINANCEIRO] : []),
    NAV_CONFIG,
  ]

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'fixed', left: 0, top: 0,
        width: open ? 196 : 56, height: '100dvh',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
        zIndex: 50, fontFamily: 'var(--font-ui)',
        borderRight: '1px solid var(--line)',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div style={{
        padding: open ? '18px 14px 16px' : '12px 0',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        minHeight: 64, flexShrink: 0,
      }}>
        <svg width="32" height="32" viewBox="18 21 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect x="20" y="55" width="60" height="28" rx="14" fill="#5E2BD0" />
          <circle cx="40" cy="37" r="14" fill="#341780" />
          <circle cx="64" cy="39" r="14" fill="#FF6F5E" />
        </svg>
        {open && (
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
              {config?.nome || 'Catálogo B2B'}
            </p>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
              background: `${primary}20`, color: primary,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: 'var(--font-ui)',
            }}>
              {nivel === 'pro' ? 'Pro' : 'Simples'}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: open ? '12px 10px' : '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={active ? '' : 'cb2b-nav-btn'}
              title={!open ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: open ? 10 : 0,
                justifyContent: open ? 'flex-start' : 'center',
                padding: open ? '10px 12px 10px 10px' : '10px 0',
                borderRadius: 10, width: '100%',
                background: active ? 'var(--bg)' : 'transparent',
                border: active ? '1px solid var(--line)' : '1px solid transparent',
                borderLeft: `3px solid ${active ? primary : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left',
                color: active ? 'var(--ink)' : 'var(--ink-soft)',
                fontSize: 14, fontWeight: active ? 600 : 400,
                fontFamily: 'var(--font-ui)', transition: 'all .15s',
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {open && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: open ? '10px 10px 14px' : '10px 0 14px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        {open ? (
          <>
            <button onClick={onSwitchToMobile} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10, width: '100%',
              border: '1px solid var(--line)',
              background: 'transparent', cursor: 'pointer',
              color: 'var(--muted)', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
              Versão Celular
            </button>
            <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-ui)', textAlign: 'center', margin: '8px 0 0' }}>
              jun<span style={{ color: 'var(--accent)' }}>tt</span>os
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          </div>
        )}
      </div>

      <style>{`.cb2b-nav-btn:hover { background: var(--bg) !important; color: var(--ink) !important; }`}</style>
    </aside>
  )
}

// ── Config Desktop (2 colunas) ─────────────────────────────────
function ConfigB2BDesktop({ config, saveConfig, theme, nivel }) {
  const [nome,     setNome]     = useState(config?.nome           || '')
  const [chavePix, setChavePix] = useState(config?.chave_pix      || '')
  const [whatsapp, setWhatsapp] = useState(config?.whatsapp_loja  || '')
  const [primary,  setPrimary]  = useState(config?.cor_primaria    || '#5E2BD0')
  const [logoUrl,  setLogoUrl]  = useState(config?.logo_url        || '')
  const [pmTipo,   setPmTipo]   = useState(config?.pedido_minimo_tipo  || 'nenhum')
  const [pmValor,  setPmValor]  = useState(config?.pedido_minimo_valor || '')
  const [pmQtd,    setPmQtd]    = useState(config?.pedido_minimo_qtd   || '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    if (!config) return
    setNome(config.nome              || '')
    setChavePix(config.chave_pix     || '')
    setWhatsapp(config.whatsapp_loja || '')
    setPrimary(config.cor_primaria   || '#5E2BD0')
    setLogoUrl(config.logo_url       || '')
    setPmTipo(config.pedido_minimo_tipo   || 'nenhum')
    setPmValor(config.pedido_minimo_valor || '')
    setPmQtd(config.pedido_minimo_qtd     || '')
  }, [config])

  async function handleSave() {
    setSaving(true)
    await saveConfig({
      nome:                nome     || 'Catálogo',
      chave_pix:           chavePix || null,
      whatsapp_loja:       whatsapp || null,
      cor_primaria:        primary,
      logo_url:            logoUrl  || null,
      pedido_minimo_tipo:  pmTipo   || 'nenhum',
      pedido_minimo_valor: pmTipo === 'valor'      ? (parseFloat(String(pmValor).replace(',', '.')) || null) : null,
      pedido_minimo_qtd:   pmTipo === 'quantidade' ? (parseInt(pmQtd) || null) : null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const lbl = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    marginBottom: 7, letterSpacing: '0.12em', textTransform: 'uppercase',
    fontFamily: 'var(--font-ui)',
  }
  const inp = {
    width: '100%', height: 44, boxSizing: 'border-box',
    background: 'var(--bg)', border: '1.5px solid var(--line)',
    borderRadius: 'var(--r-input)', padding: '0 14px',
    fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)', outline: 'none',
  }
  const section = {
    background: 'var(--surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--line)', padding: '24px 28px',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: Identidade */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={section}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>Identidade</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>Nome da Loja</label>
              <input value={nome} onChange={e => setNome(e.target.value)} style={inp} placeholder="Ex: Loja Moda Feminina" />
            </div>
            <div>
              <label style={lbl}>URL do Logo</label>
              <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} style={inp} placeholder="https://..." />
            </div>
            <div>
              <label style={lbl}>Cor Principal</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setPrimary(p.primary)}
                    title={p.label}
                    style={{
                      width: 30, height: 30, borderRadius: '50%', background: p.primary,
                      border: primary === p.primary ? '3px solid #fff' : '2px solid transparent',
                      outline: primary === p.primary ? `2px solid ${p.primary}` : 'none',
                      cursor: 'pointer', boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
                  style={{ width: 44, height: 40, borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer', padding: 2, background: 'var(--surface)' }} />
                <input value={primary} onChange={e => setPrimary(e.target.value)}
                  style={{ ...inp, fontFamily: 'var(--font-mono)', flex: 1 }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Pagamento & Pedido Mínimo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={section}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>Pagamento &amp; Contato</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>Chave Pix</label>
              <input value={chavePix} onChange={e => setChavePix(e.target.value)} style={inp} placeholder="CPF, CNPJ, e-mail ou chave aleatória" />
            </div>
            <div>
              <label style={lbl}>WhatsApp da Loja</label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inp} placeholder="(85) 99999-0000" type="tel" />
            </div>
          </div>
        </div>

        {nivel === 'pro' ? (
          <div style={section}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>Pedido Mínimo</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Tipo de mínimo</label>
                <select
                  value={pmTipo}
                  onChange={e => setPmTipo(e.target.value)}
                  style={{ ...inp, cursor: 'pointer' }}
                >
                  <option value="nenhum">Nenhum</option>
                  <option value="valor">Por valor (R$)</option>
                  <option value="quantidade">Por quantidade de peças</option>
                </select>
              </div>
              {pmTipo === 'valor' && (
                <div>
                  <label style={lbl}>Valor mínimo do pedido</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-ui)', pointerEvents: 'none' }}>R$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={pmValor}
                      onChange={e => setPmValor(e.target.value)}
                      placeholder="Ex: 300"
                      style={{ ...inp, paddingLeft: 36 }}
                    />
                  </div>
                </div>
              )}
              {pmTipo === 'quantidade' && (
                <div>
                  <label style={lbl}>Quantidade mínima de peças</label>
                  <input
                    type="number" min="1" step="1"
                    value={pmQtd}
                    onChange={e => setPmQtd(e.target.value)}
                    placeholder="Ex: 10"
                    style={inp}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ ...section, opacity: 0.4, pointerEvents: 'none' }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Pedido Mínimo</p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--muted)' }}>Exclusivo do nível Pro.</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            height: 50, borderRadius: 'var(--r-input)', border: 'none',
            background: saved ? 'var(--status-ok-tx)' : theme.primary,
            color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Save size={16} />
          {saved ? 'Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────
export default function CatalogoB2BAdminDesktop({ data, theme, lojaId, nivel, onSwitchToMobile }) {
  const [tab, setTab] = useState('produtos')
  const [pedidosView, setPedidosView] = useState('lista')
  const plano = data.config?.plano || 'starter'
  const isBusiness = temAcesso(plano, 'business')

  const isDark = theme.isDark || theme.primary === '#D4A017'
  const contentVars = {
    '--primary': theme.primary,
    ...(isDark ? {
      '--bg':      '#0A0A0A',
      '--surface': '#0F0E0C',
      '--line':    'rgba(212,160,23,0.18)',
      '--ink':     '#D4A017',
      '--ink-soft':'#A07830',
      '--muted':   '#A07830',
    } : {}),
  }

  const effectiveLogo = data.config?.logo_url || (lojaId ? `/logos/${lojaId}.svg` : null)

  const content = {
    produtos: nivel === 'pro' ? (
      <ProdutosB2BPro
        produtosData={data.produtosData}
        updateVariacoes={data.updateVariacoes}
        addProduto={data.addProduto}
        updateProduto={data.updateProduto}
        theme={theme}
        LOJA_ID={lojaId}
        fetchAll={data.fetchAll}
      />
    ) : (
      <EstoqueMobile
        produtosData={data.produtosData}
        updateVariacoes={data.updateVariacoes}
        addProduto={data.addProduto}
        updateProduto={data.updateProduto}
        features={data.features}
        theme={theme}
        LOJA_ID={lojaId}
        fetchAll={data.fetchAll}
      />
    ),
    pedidos: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {nivel === 'pro' && (
          <div style={{ display: 'inline-flex', gap: 3, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-chip)', padding: 4, alignSelf: 'flex-start' }}>
            {[
              { id: 'lista',       label: 'Lista' },
              { id: 'consolidado', label: 'Consolidado' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setPedidosView(opt.id)}
                style={{
                  height: 36, padding: '0 20px', borderRadius: 8, border: 'none',
                  background: pedidosView === opt.id ? theme.primary : 'transparent',
                  color: pedidosView === opt.id ? '#fff' : 'var(--muted)',
                  fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {(nivel !== 'pro' || pedidosView === 'lista') && (
          <PedidosCatalogo
            pedidos={data.pedidos || []}
            updatePedido={data.updatePedido}
            theme={theme}
            lojaId={lojaId}
          />
        )}
        {nivel === 'pro' && pedidosView === 'consolidado' && (
          <PedidosConsolidados
            pedidos={data.pedidos || []}
            theme={theme}
          />
        )}
      </div>
    ),
    usuarios: nivel === 'pro' ? (
      <UsuariosB2BDesktop lojaId={lojaId} theme={theme} />
    ) : null,
    financeiro: isBusiness ? (
      <FinanceiroDesktop data={data} theme={theme} />
    ) : null,
    config: (
      <ConfigB2BDesktop
        config={data.config}
        saveConfig={data.saveConfig}
        theme={theme}
        nivel={nivel}
      />
    ),
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)', fontFamily: 'var(--font-ui)', ...contentVars }}>
      <B2BSidebar
        tab={tab}
        setTab={setTab}
        theme={theme}
        config={data.config}
        nivel={nivel}
        isBusiness={isBusiness}
        onSwitchToMobile={onSwitchToMobile}
      />
      <div style={{ marginLeft: 56, flex: 1, padding: '40px 44px', minHeight: '100dvh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {content[tab]}
        </div>
      </div>
    </div>
  )
}
