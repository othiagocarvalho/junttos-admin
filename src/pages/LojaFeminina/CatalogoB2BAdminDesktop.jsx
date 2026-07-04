import { useState, useEffect } from 'react'
import { Package, ShoppingBag, Settings, Save, Users, UserPlus, Smartphone, CreditCard } from 'lucide-react'
import EstoqueMobile from './EstoqueMobile'
import PedidosCatalogo from './PedidosCatalogo'
import ProdutosB2BPro from './ProdutosB2BPro'
import PedidosConsolidados from './PedidosConsolidados'
import FinanceiroDesktop from '../cliente/FinanceiroDesktop'
import { supabase } from '../../lib/supabase'
import { useClientAuth } from '../../context/ClientAuthContext'
import { temAcesso } from '../../utils/planos'

const UI   = "'Plus Jakarta Sans', sans-serif"
const MONO = "'Space Mono', monospace"

const P      = '#5E2BD0'
const ACCENT = '#F2643C'

const PRESETS = [
  { label: 'Junttos',  primary: '#5E2BD0' },
  { label: 'Rosê',     primary: '#C9956C' },
  { label: 'Verde',    primary: '#16a34a' },
  { label: 'Azul',     primary: '#2563eb' },
  { label: 'Borgonha', primary: '#9D174D' },
]

const NAV_BASE       = [
  { id: 'produtos', label: 'Produtos',      Icon: Package },
  { id: 'pedidos',  label: 'Pedidos',       Icon: ShoppingBag },
]
const NAV_FINANCEIRO = { id: 'financeiro', label: 'Financeiro',     Icon: CreditCard }
const NAV_USUARIOS   = { id: 'usuarios',   label: 'Usuários',       Icon: Users }
const NAV_CONFIG     = { id: 'config',     label: 'Configurações',  Icon: Settings }

const lbl = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#8A8A93',
  marginBottom: 7, letterSpacing: '0.1em', textTransform: 'uppercase',
  fontFamily: UI,
}
const inp = {
  width: '100%', height: 44, boxSizing: 'border-box',
  background: '#F6F6F9', border: '1px solid #ECECF1',
  borderRadius: 12, padding: '0 14px',
  fontFamily: UI, fontSize: 14, color: '#18181B', outline: 'none',
}
const section = {
  background: '#fff', borderRadius: 16, border: '1px solid #ECECF1', padding: '24px 28px',
}

// ── Gerenciamento de usuários ──────────────────────────────────
function UsuariosB2BDesktop({ lojaId }) {
  const { user } = useClientAuth()

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

  const msgStyle = (type) => ({
    padding: '10px 14px', borderRadius: 10, fontSize: 13, fontFamily: UI,
    ...(type === 'success'
      ? { background: '#DCF3E6', color: '#1E7A4D' }
      : { background: '#fee2e2', color: '#dc2626' }),
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Lista */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontFamily: UI, fontSize: 15, fontWeight: 700, color: '#18181B' }}>
            Colaboradoras ativas
          </p>
          <button
            onClick={() => { setShowForm(v => !v); setMsg(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: P, color: '#fff', fontFamily: UI, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 10px 22px -10px rgba(94,43,208,.55)',
            }}
          >
            <UserPlus size={14} />
            Convidar colaboradora
          </button>
        </div>

        {!showForm && msg && <div style={{ ...msgStyle(msg.type), marginBottom: 16 }}>{msg.text}</div>}

        {loadingU ? (
          <p style={{ fontFamily: UI, fontSize: 13, color: '#8A8A93' }}>Carregando...</p>
        ) : usuarios.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <Users size={32} color="#ECECF1" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontFamily: UI, fontSize: 14, color: '#8A8A93' }}>
              Nenhuma colaboradora cadastrada.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {usuarios.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 12,
                background: '#F6F6F9', border: '1px solid #ECECF1',
              }}>
                <div>
                  <p style={{ fontFamily: UI, fontSize: 14, fontWeight: 600, color: '#18181B', marginBottom: 2 }}>
                    {u.nome || u.email}
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: 11, color: '#8A8A93' }}>{u.email}</p>
                </div>
                {u.auth_user_id === user?.id ? (
                  <span style={{
                    padding: '4px 12px', borderRadius: 8,
                    background: '#ECE6FB', color: P,
                    fontFamily: UI, fontSize: 11, fontWeight: 700,
                  }}>
                    Você
                  </span>
                ) : (
                  <button
                    onClick={() => handleDesativar(u.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 8, border: '1px solid #fca5a5',
                      background: '#fee2e2', color: '#dc2626',
                      fontFamily: UI, fontSize: 12, fontWeight: 600, cursor: 'pointer',
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

      {/* Formulário / Placeholder */}
      {showForm ? (
        <div style={section}>
          <p style={{ fontFamily: UI, fontSize: 15, fontWeight: 700, color: '#18181B', marginBottom: 20 }}>
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
                flex: 1, height: 44, borderRadius: 12, border: '1px solid #ECECF1',
                background: '#F6F6F9', color: '#8A8A93', cursor: 'pointer',
                fontFamily: UI, fontSize: 14, fontWeight: 600,
              }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{
                flex: 2, height: 44, borderRadius: 12, border: 'none',
                background: saving ? '#ECECF1' : P, color: saving ? '#A1A1AA' : '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: UI, fontSize: 14, fontWeight: 700,
                boxShadow: saving ? 'none' : '0 10px 22px -10px rgba(94,43,208,.55)',
              }}>
                {saving ? 'Convidando...' : 'Convidar colaboradora'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ ...section, opacity: 0.5, pointerEvents: 'none' }}>
          <p style={{ fontFamily: UI, fontSize: 15, fontWeight: 700, color: '#18181B', marginBottom: 8 }}>
            Nova colaboradora
          </p>
          <p style={{ fontFamily: UI, fontSize: 13, color: '#8A8A93', lineHeight: 1.5 }}>
            Clique em "Convidar colaboradora" para adicionar uma nova usuária a esta loja.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Config Desktop ─────────────────────────────────────────────
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Esquerda: Identidade */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={section}>
          <p style={{ fontFamily: UI, fontSize: 15, fontWeight: 700, color: '#18181B', marginBottom: 20 }}>Identidade</p>
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
                  style={{ width: 44, height: 40, borderRadius: 8, border: '1px solid #ECECF1', cursor: 'pointer', padding: 2, background: '#fff' }} />
                <input value={primary} onChange={e => setPrimary(e.target.value)}
                  style={{ ...inp, fontFamily: MONO, flex: 1 }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Direita: Pagamento & Pedido Mínimo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={section}>
          <p style={{ fontFamily: UI, fontSize: 15, fontWeight: 700, color: '#18181B', marginBottom: 20 }}>Pagamento &amp; Contato</p>
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
            <p style={{ fontFamily: UI, fontSize: 15, fontWeight: 700, color: '#18181B', marginBottom: 20 }}>Pedido Mínimo</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Tipo de mínimo</label>
                <select value={pmTipo} onChange={e => setPmTipo(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="nenhum">Nenhum</option>
                  <option value="valor">Por valor (R$)</option>
                  <option value="quantidade">Por quantidade de peças</option>
                </select>
              </div>
              {pmTipo === 'valor' && (
                <div>
                  <label style={lbl}>Valor mínimo do pedido</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8A8A93', fontFamily: UI, pointerEvents: 'none' }}>R$</span>
                    <input type="number" min="0" step="0.01" value={pmValor} onChange={e => setPmValor(e.target.value)} placeholder="Ex: 300" style={{ ...inp, paddingLeft: 36 }} />
                  </div>
                </div>
              )}
              {pmTipo === 'quantidade' && (
                <div>
                  <label style={lbl}>Quantidade mínima de peças</label>
                  <input type="number" min="1" step="1" value={pmQtd} onChange={e => setPmQtd(e.target.value)} placeholder="Ex: 10" style={inp} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ ...section, opacity: 0.4, pointerEvents: 'none' }}>
            <p style={{ fontFamily: UI, fontSize: 15, fontWeight: 700, color: '#18181B', marginBottom: 8 }}>Pedido Mínimo</p>
            <p style={{ fontFamily: UI, fontSize: 13, color: '#8A8A93' }}>Exclusivo do nível Pro.</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            height: 50, borderRadius: 14, border: 'none',
            background: saved ? '#1E7A4D' : P,
            color: '#fff', fontFamily: UI, fontSize: 15, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: saved ? 'none' : '0 10px 22px -10px rgba(94,43,208,.6)',
          }}
        >
          <Save size={16} />
          {saved ? 'Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────
function B2BSidebar({ tab, setTab, config, nivel, isBusiness, onSwitchToMobile }) {
  const NAV = nivel === 'pro'
    ? [...NAV_BASE, ...(isBusiness ? [NAV_FINANCEIRO] : []), NAV_USUARIOS, NAV_CONFIG]
    : [...NAV_BASE, NAV_CONFIG]

  const storeName = config?.nome || 'Catálogo B2B'

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0,
      width: 236, height: '100dvh',
      background: '#fff',
      display: 'flex', flexDirection: 'column',
      zIndex: 50, fontFamily: UI,
      borderRight: '1px solid #ECECF1',
    }}>
      {/* Logo area */}
      <div style={{
        padding: '20px 20px 18px',
        borderBottom: '1px solid #ECECF1',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <svg width="32" height="32" viewBox="18 21 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect x="20" y="55" width="60" height="28" rx="14" fill={P} />
          <circle cx="40" cy="37" r="14" fill="#341780" />
          <circle cx="64" cy="39" r="14" fill={ACCENT} />
        </svg>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontFamily: UI, fontSize: 13, fontWeight: 700, color: '#18181B',
            lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 148,
          }}>
            {storeName}
          </p>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
            background: '#ECE6FB', color: P,
            letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: UI,
          }}>
            {nivel === 'pro' ? 'Pro' : 'Simples'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10, width: '100%',
                background: active ? P : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                color: active ? '#fff' : '#71717A',
                fontSize: 14, fontWeight: active ? 600 : 500,
                fontFamily: UI, transition: 'all .15s',
                boxShadow: active ? '0 10px 22px -10px rgba(94,43,208,.55)' : 'none',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F6F6F9' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} color={active ? '#fff' : '#71717A'} />
              <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 12px 20px', borderTop: '1px solid #ECECF1', flexShrink: 0 }}>
        <button onClick={onSwitchToMobile} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 14px', borderRadius: 10, width: '100%',
          border: '1px solid #ECECF1',
          background: 'transparent', cursor: 'pointer',
          color: '#71717A', fontFamily: UI, fontSize: 12, fontWeight: 500,
          whiteSpace: 'nowrap', transition: 'all .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F9'; e.currentTarget.style.color = '#18181B' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717A' }}
        >
          <Smartphone size={14} />
          Versão Celular
        </button>
        <p style={{ fontSize: 10, color: '#A1A1AA', fontFamily: UI, textAlign: 'center', margin: '10px 0 0' }}>
          jun<span style={{ color: ACCENT }}>tt</span>os
        </p>
      </div>
    </aside>
  )
}

// ── Page header metadata ───────────────────────────────────────
const PAGE_META = {
  produtos:   { title: 'Produtos',       sub: 'Gerencie seu catálogo' },
  pedidos:    { title: 'Pedidos',        sub: 'Acompanhe os pedidos do catálogo' },
  financeiro: { title: 'Financeiro',     sub: 'Resumo financeiro do catálogo' },
  usuarios:   { title: 'Usuários',       sub: 'Colaboradoras com acesso ao painel' },
  config:     { title: 'Configurações',  sub: 'Personalize seu catálogo' },
}

// ── Main export ────────────────────────────────────────────────
export default function CatalogoB2BAdminDesktop({ data, theme, lojaId, nivel, plano, onSwitchToMobile }) {
  const [tab, setTab]               = useState('produtos')
  const [pedidosView, setPedidosView] = useState('lista')

  const isBusiness = temAcesso(plano, 'business')
  const isDark = theme.isDark || theme.primary === '#D4A017'

  const contentVars = {
    '--primary': theme.primary,
    '--bg':      '#F6F6F9',
    '--surface': '#FFFFFF',
    '--line':    '#ECECF1',
    '--ink':     '#18181B',
    '--ink-soft':'#52525B',
    '--muted':   '#8A8A93',
    ...(isDark ? {
      '--bg':      '#0A0A0A',
      '--surface': '#0F0E0C',
      '--line':    'rgba(212,160,23,0.18)',
      '--ink':     '#D4A017',
      '--ink-soft':'#A07830',
      '--muted':   '#A07830',
    } : {}),
  }

  const meta = PAGE_META[tab] || PAGE_META.produtos

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {nivel === 'pro' && (
          <div style={{ display: 'inline-flex', gap: 3, background: '#fff', border: '1px solid #ECECF1', borderRadius: 12, padding: 4, alignSelf: 'flex-start' }}>
            {[
              { id: 'lista',       label: 'Lista' },
              { id: 'consolidado', label: 'Consolidado' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setPedidosView(opt.id)}
                style={{
                  height: 36, padding: '0 20px', borderRadius: 9, border: 'none',
                  background: pedidosView === opt.id ? P : 'transparent',
                  color: pedidosView === opt.id ? '#fff' : '#8A8A93',
                  fontFamily: UI, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all .15s',
                  boxShadow: pedidosView === opt.id ? '0 10px 22px -10px rgba(94,43,208,.5)' : 'none',
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
    <div style={{ display: 'flex', minHeight: '100dvh', background: '#F6F6F9', fontFamily: UI, ...contentVars }}>
      <B2BSidebar
        tab={tab}
        setTab={setTab}
        config={data.config}
        nivel={nivel}
        isBusiness={isBusiness}
        onSwitchToMobile={onSwitchToMobile}
      />

      <div style={{ marginLeft: 236, flex: 1, minHeight: '100dvh' }}>
        {/* Page header */}
        <div style={{ padding: '32px 44px 20px' }}>
          <h1 style={{
            fontFamily: UI, fontSize: 26, fontWeight: 800, color: '#18181B',
            letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 4,
          }}>
            {meta.title}
          </h1>
          <p style={{ fontFamily: UI, fontSize: 14, color: '#8A8A93' }}>{meta.sub}</p>
        </div>

        {/* Content */}
        <div style={{ padding: '0 44px 48px', maxWidth: 1244 }}>
          {content[tab]}
        </div>
      </div>
    </div>
  )
}
