import { useState, useEffect } from 'react'
import { Package, ShoppingBag, Settings, Save, Users, UserPlus, Monitor, CreditCard } from 'lucide-react'
import EstoqueMobile from './EstoqueMobile'
import PedidosCatalogo from './PedidosCatalogo'
import ProdutosB2BPro from './ProdutosB2BPro'
import PedidosConsolidados from './PedidosConsolidados'
import Financeiro from './Financeiro'
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

const TABS_BASE      = [
  { id: 'produtos', label: 'Produtos', Icon: Package },
  { id: 'pedidos',  label: 'Pedidos',  Icon: ShoppingBag },
]
const TAB_FINANCEIRO = { id: 'financeiro', label: 'Financeiro', Icon: CreditCard }
const TAB_USUARIOS   = { id: 'usuarios',   label: 'Usuários',   Icon: Users }
const TAB_CONFIG     = { id: 'config',     label: 'Config',     Icon: Settings }

const lbl = {
  display: 'block', fontSize: 10, fontWeight: 700,
  color: '#8A8A93', textTransform: 'uppercase', letterSpacing: '0.1em',
  marginBottom: 6, fontFamily: UI,
}
const inp = {
  width: '100%', height: 44, border: '1px solid #ECECF1', borderRadius: 12,
  padding: '0 14px', fontFamily: UI, fontSize: 14,
  color: '#18181B', background: '#F6F6F9', outline: 'none', boxSizing: 'border-box',
}
const card = {
  background: '#fff', border: '1px solid #ECECF1',
  borderRadius: 16, padding: '16px 16px 20px', marginBottom: 12,
}

// ── Usuários (mobile) ──────────────────────────────────────────
function UsuariosB2B({ lojaId }) {
  const { user } = useClientAuth()

  const [usuarios,  setUsuarios]  = useState([])
  const [loadingU,  setLoadingU]  = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({ email: '', nome: '', senha: '' })
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState(null)

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
    if (!email || !nome || !senha) {
      setMsg({ type: 'error', text: 'Preencha todos os campos.' })
      return
    }
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
    padding: '9px 12px', borderRadius: 10, fontSize: 13, fontFamily: UI,
    ...(type === 'success'
      ? { background: '#DCF3E6', color: '#1E7A4D' }
      : { background: '#fee2e2', color: '#dc2626' }),
  })

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontFamily: UI, fontSize: 14, fontWeight: 700, color: '#18181B' }}>
          Colaboradoras ativas
        </p>
        <button
          onClick={() => { setShowForm(v => !v); setMsg(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: P, color: '#fff',
            fontFamily: UI, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 10px 22px -10px rgba(94,43,208,.55)',
          }}
        >
          <UserPlus size={14} />
          Convidar
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleConvidar} style={{ ...card, marginBottom: 16 }}>
          <p style={{ fontFamily: UI, fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 12 }}>
            Nova colaboradora
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" style={inp} />
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="E-mail de acesso" style={inp} />
            <input type="text" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} placeholder="Senha temporária" style={inp} />
          </div>
          {msg && <div style={{ ...msgStyle(msg.type), marginTop: 10 }}>{msg.text}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => { setShowForm(false); setMsg(null) }} style={{
              flex: 1, height: 42, borderRadius: 10, border: '1px solid #ECECF1',
              background: '#F6F6F9', color: '#8A8A93', cursor: 'pointer',
              fontFamily: UI, fontSize: 13, fontWeight: 600,
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{
              flex: 1, height: 42, borderRadius: 10, border: 'none',
              background: saving ? '#ECECF1' : P, color: saving ? '#A1A1AA' : '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: UI, fontSize: 13, fontWeight: 700,
              boxShadow: saving ? 'none' : '0 10px 22px -10px rgba(94,43,208,.55)',
            }}>
              {saving ? 'Convidando...' : 'Convidar'}
            </button>
          </div>
        </form>
      )}

      {!showForm && msg && <div style={{ ...msgStyle(msg.type), marginBottom: 12 }}>{msg.text}</div>}

      {loadingU ? (
        <p style={{ fontFamily: UI, fontSize: 13, color: '#8A8A93', padding: '12px 0' }}>Carregando...</p>
      ) : usuarios.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '32px 16px' }}>
          <Users size={28} color="#ECECF1" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontFamily: UI, fontSize: 13, color: '#8A8A93' }}>Nenhuma colaboradora cadastrada.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usuarios.map(u => (
            <div key={u.id} style={{
              ...card, marginBottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ fontFamily: UI, fontSize: 14, fontWeight: 600, color: '#18181B', marginBottom: 2 }}>
                  {u.nome || u.email}
                </p>
                <p style={{ fontFamily: MONO, fontSize: 11, color: '#8A8A93' }}>{u.email}</p>
              </div>
              {u.auth_user_id === user?.id ? (
                <span style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: '#ECE6FB', color: P,
                  fontFamily: UI, fontSize: 11, fontWeight: 700,
                }}>
                  Você
                </span>
              ) : (
                <button
                  onClick={() => handleDesativar(u.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid #fca5a5',
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
  )
}

// ── Config (mobile) ────────────────────────────────────────────
function ConfigB2B({ config, saveConfig, nivel }) {
  const [nome,     setNome]     = useState(config?.nome            || '')
  const [chavePix, setChavePix] = useState(config?.chave_pix       || '')
  const [whatsapp, setWhatsapp] = useState(config?.whatsapp_loja   || '')
  const [primary,  setPrimary]  = useState(config?.cor_primaria     || '#5E2BD0')
  const [logoUrl,  setLogoUrl]  = useState(config?.logo_url         || '')
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
    <div style={{ paddingTop: 8 }}>
      <div style={card}>
        <p style={{ fontFamily: UI, fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 14 }}>Identidade</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setPrimary(p.primary)}
                  title={p.label}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: p.primary,
                    border: primary === p.primary ? '3px solid #fff' : '2px solid transparent',
                    outline: primary === p.primary ? `2px solid ${p.primary}` : 'none',
                    cursor: 'pointer', boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
            <input
              type="color" value={primary} onChange={e => setPrimary(e.target.value)}
              style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #ECECF1', cursor: 'pointer', padding: 2, background: '#fff' }}
            />
          </div>
        </div>
      </div>

      <div style={card}>
        <p style={{ fontFamily: UI, fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 14 }}>Pagamento &amp; Contato</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        <div style={card}>
          <p style={{ fontFamily: UI, fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 14 }}>Pedido Mínimo</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        <div style={{ ...card, opacity: 0.45, pointerEvents: 'none' }}>
          <p style={{ fontFamily: UI, fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 6 }}>Pedido Mínimo</p>
          <p style={{ fontFamily: UI, fontSize: 12, color: '#8A8A93' }}>Exclusivo do nível Pro.</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', height: 48, borderRadius: 14, border: 'none',
          background: saved ? '#1E7A4D' : P,
          color: '#fff', fontFamily: UI, fontSize: 14, fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: saved ? 'none' : '0 10px 22px -10px rgba(94,43,208,.55)',
        }}
      >
        <Save size={15} />
        {saved ? 'Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────
export default function CatalogoB2BAdmin({ data, theme, lojaId, nivel, plano, onSwitchToDesktop }) {
  const [tab, setTab]               = useState('produtos')
  const [pedidosView, setPedidosView] = useState('lista')

  const isBusiness = temAcesso(plano, 'business')
  const TABS = nivel === 'pro'
    ? [...TABS_BASE, ...(isBusiness ? [TAB_FINANCEIRO] : []), TAB_USUARIOS, TAB_CONFIG]
    : [...TABS_BASE, TAB_CONFIG]

  const studioVars = {
    '--bg':      '#F6F6F9',
    '--surface': '#FFFFFF',
    '--line':    '#ECECF1',
    '--ink':     '#18181B',
    '--ink-soft':'#52525B',
    '--muted':   '#8A8A93',
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F6F6F9', fontFamily: UI, ...studioVars }}>

      {/* Header */}
      <header style={{
        background: P, height: 58, paddingLeft: 20, paddingRight: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, boxShadow: '0 2px 12px rgba(94,43,208,.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="18 21 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect x="20" y="55" width="60" height="28" rx="14" fill="rgba(255,255,255,0.9)" />
            <circle cx="40" cy="37" r="14" fill="rgba(255,255,255,0.85)" />
            <circle cx="64" cy="39" r="14" fill={ACCENT} />
          </svg>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: UI, fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
              {data.config?.nome || 'Catálogo B2B'}
            </p>
            <p style={{ fontFamily: UI, fontSize: 10, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Catálogo {nivel === 'pro' ? 'Pro' : 'Simples'}
            </p>
          </div>
        </div>
        <button
          onClick={onSwitchToDesktop}
          title="Versão Computador"
          style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', padding: 8, borderRadius: 8,
          }}
        >
          <Monitor size={16} color="rgba(255,255,255,0.8)" />
        </button>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 96px', boxSizing: 'border-box' }}>
        {tab === 'produtos' && (
          <div style={{ paddingTop: 16 }}>
            {nivel === 'pro' ? (
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
            )}
          </div>
        )}

        {tab === 'pedidos' && (
          <div style={{ paddingTop: 16 }}>
            {nivel === 'pro' && (
              <div style={{ display: 'flex', gap: 3, background: '#fff', border: '1px solid #ECECF1', borderRadius: 12, padding: 4, marginBottom: 16 }}>
                {[
                  { id: 'lista',       label: 'Lista' },
                  { id: 'consolidado', label: 'Consolidado' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPedidosView(opt.id)}
                    style={{
                      flex: 1, height: 36, borderRadius: 9, border: 'none',
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
        )}

        {tab === 'financeiro' && isBusiness && (
          <Financeiro lojaId={lojaId} vendas={data.vendas || []} theme={theme} />
        )}

        {tab === 'usuarios' && nivel === 'pro' && (
          <UsuariosB2B lojaId={lojaId} />
        )}

        {tab === 'config' && (
          <ConfigB2B
            config={data.config}
            saveConfig={data.saveConfig}
            nivel={nivel}
          />
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: '#fff', borderTop: '1px solid #ECECF1',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{
          height: 64, width: '100%',
          display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          alignItems: 'center',
        }}>
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  height: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                }}
              >
                <Icon size={20} color={active ? P : '#A1A1AA'} strokeWidth={active ? 2.2 : 1.6} />
                <span style={{
                  fontFamily: UI, fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  color: active ? P : '#A1A1AA',
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: 9, color: '#A1A1AA', margin: '0 0 3px', fontFamily: UI, textAlign: 'center' }}>
          jun<span style={{ color: ACCENT }}>tt</span>os
        </p>
      </nav>
    </div>
  )
}
