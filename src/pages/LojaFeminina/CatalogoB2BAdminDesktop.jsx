import { useState, useEffect } from 'react'
import { Label } from '../../components/studio/Input'
import { Package, ShoppingBag, Settings, Save, Users, UserPlus, CreditCard } from 'lucide-react'
import { Palette, Wallet, ShoppingCart } from 'lucide-react'
import SecaoTitulo from '../../components/studio/SecaoTitulo'
import EstoqueMobile from './EstoqueMobile'
import PedidosCatalogo from './PedidosCatalogo'
import ProdutosB2BPro from './ProdutosB2BPro'
import PedidosConsolidados from './PedidosConsolidados'
import FinanceiroDesktop from '../cliente/FinanceiroDesktop'
import { supabase } from '../../lib/supabase'
import VideoTopoConfig from '../../components/catalogo/VideoTopoConfig'
import { videoTopoDaConfig, videoTopoParaConfig } from '../../utils/videoTopo'
import { useClientAuth } from '../../context/ClientAuthContext'
import { temAcesso } from '../../utils/planos'
import { precisaAvisarPedidoMinimo } from '../../utils/modeloVenda'
import {
  salvarCredencialMercadoPago, podeAtivarMercadoPago,
  validarAccessTokenMP, pareceTokenDeTeste,
} from '../../utils/credenciaisPagamento'
import AvisoPedidoMinimo from '../../components/catalogo/AvisoPedidoMinimo'

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
    await supabase.from('lf_usuarios').update({ ativo: false }).eq('id', id).eq('loja_id', lojaId)
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
              <Label>Nome</Label>
              <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Maria" style={inp} />
            </div>
            <div>
              <Label>E-mail de acesso</Label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="colaboradora@email.com" style={inp} />
            </div>
            <div>
              <Label>Senha temporária</Label>
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
// Exportado para o CatalogoB2BModuloDesktop (dashboard completo) reaproveitar
// o mesmo formulário — ver a nota equivalente em CatalogoB2BAdmin.jsx.
export function ConfigB2BDesktop({ config, saveConfig, theme, nivel, lojaId }) {
  const [nome,     setNome]     = useState(config?.nome           || '')
  const [chavePix, setChavePix] = useState(config?.chave_pix      || '')
  const [whatsapp, setWhatsapp] = useState(config?.whatsapp_loja  || '')
  const [primary,  setPrimary]  = useState(config?.cor_primaria    || '#5E2BD0')
  const [logoUrl,  setLogoUrl]  = useState(config?.logo_url        || '')
  const [pmTipo,   setPmTipo]   = useState(config?.pedido_minimo_tipo  || 'nenhum')
  const [pmValor,  setPmValor]  = useState(config?.pedido_minimo_valor || '')
  const [pmQtd,    setPmQtd]    = useState(config?.pedido_minimo_qtd   || '')
  const [checkout, setCheckout] = useState(config?.catalogo_checkout_online === true)
  // Nascem vazios: a tabela de credenciais não tem policy de SELECT, então nem
  // esta tela lê o token de volta. Vazio + já configurado = manter o gravado.
  const [mpToken,  setMpToken]  = useState('')
  const [mpSecret, setMpSecret] = useState('')
  const [mpAtivo,  setMpAtivo]  = useState(config?.mercadopago_ativo === true)
  // Faixa de vídeo do topo do catálogo. Vinha SEM tela desde o início: só dava
  // para ligar escrevendo o jsonb catalogo_video_topo direto no banco.
  const [videoTopo, setVideoTopo] = useState(() => videoTopoDaConfig(config))
  const [mpErro,   setMpErro]   = useState('')
  // Erro do salvamento em lf_config. Separado de mpErro porque são duas
  // gravações independentes: a credencial pode falhar e o resto passar, e a
  // pessoa precisa saber exatamente o que não foi.
  const [erroSalvar, setErroSalvar] = useState('')
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
    setCheckout(config.catalogo_checkout_online === true)
    setMpAtivo(config.mercadopago_ativo === true)
    setVideoTopo(videoTopoDaConfig(config))
  }, [config])

  const mpJaConfigurado = config?.mercadopago_ativo === true

  async function handleSave() {
    setSaving(true)
    setMpErro('')
    setErroSalvar('')

    // Credencial vai em tabela própria com RLS — nunca em lf_config, que o
    // catálogo público lê inteira sem autenticação.
    // Barra na origem o valor que não é access token — foi assim que a
    // Tropicale ficou com 14 caracteres gravados e o MP devolvendo 403.
    const problemaToken = validarAccessTokenMP(mpToken)
    if (problemaToken) {
      setMpErro(problemaToken)
      setSaving(false)
      return
    }

    let mpOk = true
    if (mpToken.trim() || mpSecret.trim()) {
      const { error } = await salvarCredencialMercadoPago(supabase, lojaId, {
        token: mpToken, webhookSecret: mpSecret,
      })
      if (error) {
        mpOk = false
        setMpErro('Não foi possível salvar a credencial do Mercado Pago: ' + error.message)
      }
    }

    // saveConfig DEVOLVE o erro (useLojaData.js) — e este retorno era jogado
    // fora. Era metade do "a tela finge que salvou": mesmo com o upsert de
    // lf_config falhando, o botão ficava verde escrito "Configurações
    // salvas!".
    const erroConfig = await saveConfig({
      nome:                nome     || 'Catálogo',
      chave_pix:           chavePix || null,
      whatsapp_loja:       whatsapp || null,
      cor_primaria:        primary,
      logo_url:            logoUrl  || null,
      pedido_minimo_tipo:  pmTipo   || 'nenhum',
      pedido_minimo_valor: pmTipo === 'valor'      ? (parseFloat(String(pmValor).replace(',', '.')) || null) : null,
      pedido_minimo_qtd:   pmTipo === 'quantidade' ? (parseInt(pmQtd) || null) : null,
      catalogo_checkout_online: checkout,
      // videoTopoParaConfig desliga `ativo` quando não há mídia: ligado e
      // vazio, a faixa vira uma tarja preta de até 340px no topo.
      catalogo_video_topo: videoTopoParaConfig(videoTopo),
      mercadopago_ativo: mpOk && mpAtivo && podeAtivarMercadoPago({
        token: mpToken, jaConfigurado: mpJaConfigurado,
      }),
    })
    setSaving(false)

    if (erroConfig) {
      setErroSalvar('Não foi possível salvar as configurações: ' + (erroConfig.message || erroConfig))
    }

    // Ligar o QR sem credencial confirmada era uma falha SILENCIOSA: o
    // checkbox voltava sozinho para desmarcado e a tela dizia "Configurações
    // salvas!". A tabela de credenciais não tem policy de SELECT, então esta
    // tela não consegue conferir no banco se já existe token — a única prova
    // que ela tem é o valor digitado agora, ou a flag já estar ligada.
    // `mpOk &&` para não pisar por cima do erro real da gravação, que é mais
    // grave e já está na tela.
    const qrPedidoSemCredencial = mpOk
      && mpAtivo
      && !podeAtivarMercadoPago({ token: mpToken, jaConfigurado: mpJaConfigurado })
    if (qrPedidoSemCredencial) {
      setMpErro(
        'Para ligar o QR Code do Mercado Pago, cole o Access Token nesta mesma tela. '
        + 'Por segurança a chave não volta do banco, então o sistema não consegue '
        + 'confirmar sozinho que já existe uma salva — e o QR ficaria desligado sem aviso.',
      )
    }

    // Só limpa os campos e comemora quando as DUAS gravações deram certo.
    // Limpar o token depois de uma falha seria pior ainda: a pessoa perderia o
    // valor colado e não teria o que repetir.
    if (mpOk && !erroConfig) {
      setMpToken(''); setMpSecret('')
      // Sem "Configurações salvas!" em verde quando o QR pedido não pôde ser
      // ligado: o resto gravou, mas comemorar esconderia o aviso vermelho.
      if (!qrPedidoSemCredencial) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2200)
      }
    }
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
          <SecaoTitulo Icon={Palette} titulo="Identidade" theme={theme} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Label>Nome da Loja</Label>
              <input value={nome} onChange={e => setNome(e.target.value)} style={inp} placeholder="Ex: Loja Moda Feminina" />
            </div>
            <div>
              <Label>URL do Logo</Label>
              <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} style={inp} placeholder="https://..." />
            </div>
            <div>
              <Label>Cor Principal</Label>
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
          <SecaoTitulo Icon={Wallet} titulo="Pagamento & Contato" theme={theme} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Label>Chave Pix</Label>
              <input value={chavePix} onChange={e => setChavePix(e.target.value)} style={inp} placeholder="CPF, CNPJ, e-mail ou chave aleatória" />
            </div>
            <div>
              <Label>WhatsApp da Loja</Label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inp} placeholder="(85) 99999-0000" type="tel" />
            </div>
            {/* Sem este toggle a Chave Pix não aparece para ninguém: o catálogo
                só mostra o bloco de Pix quando catalogo_checkout_online é true,
                e até agora nenhuma tela escrevia esse campo. */}
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={checkout}
                onChange={e => setCheckout(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, cursor: 'pointer', accentColor: theme.primary }}
              />
              <span>
                <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                  Mostrar Pix no catálogo
                </span>
                <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>
                  A cliente copia a chave e paga no banco dela. Precisa da Chave Pix preenchida acima.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div style={section}>
          <SecaoTitulo Icon={CreditCard} titulo="Mercado Pago" descricao="Pix com QR Code e confirmação automática" theme={theme} style={{ marginBottom: 10 }} />
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 18 }}>
            Com o Mercado Pago o catálogo mostra QR Code e confirma o pagamento sozinho.
            Sem isso, o Pix continua funcionando no modo copia-e-cola acima.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Label>
                Access token {mpJaConfigurado && <span style={{ color: 'var(--status-ok-tx)' }}>· configurado</span>}
              </Label>
              <input
                value={mpToken} onChange={e => setMpToken(e.target.value)} style={inp}
                type="password" autoComplete="off"
                placeholder={mpJaConfigurado ? 'Deixe vazio para manter o atual' : 'APP_USR-...'}
              />
            </div>
            <div>
              <Label>Chave secreta do webhook</Label>
              <input
                value={mpSecret} onChange={e => setMpSecret(e.target.value)} style={inp}
                type="password" autoComplete="off"
                placeholder={mpJaConfigurado ? 'Deixe vazio para manter a atual' : 'Mercado Pago -> Webhooks'}
              />
            </div>
            {pareceTokenDeTeste(mpToken) && (
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: '#b45309', lineHeight: 1.45 }}>
                Esse é um token de TESTE. Em produção o Mercado Pago recusa, e o catálogo
                volta sozinho para o Pix copia-e-cola.
              </p>
            )}
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
              Por segurança estas chaves não são exibidas depois de salvas.
            </p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox" checked={mpAtivo} onChange={e => setMpAtivo(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, cursor: 'pointer', accentColor: theme.primary }}
              />
              <span>
                <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                  Usar QR Code do Mercado Pago
                </span>
                <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>
                  Se o Mercado Pago falhar, o catálogo volta sozinho para o copia-e-cola.
                </span>
              </span>
            </label>
            {mpErro && (
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--status-bad-tx)', lineHeight: 1.45 }}>
                {mpErro}
              </p>
            )}
          </div>
        </div>

        {/* Faixa de vídeo do topo do catálogo. Entra depois de Pagamento porque
            é aparência, não regra de venda — e antes do Pedido Mínimo, que é a
            seção que muda de nível de plano. */}
        <div style={section}>
          <VideoTopoConfig
            valor={videoTopo}
            aoMudar={setVideoTopo}
            lojaId={lojaId}
            client={supabase}
            theme={theme}
          />
        </div>

        {nivel === 'pro' ? (
          <div style={section}>
            <SecaoTitulo Icon={ShoppingCart} titulo="Pedido Mínimo" theme={theme} />
            {/* Some assim que ela escolhe outro tipo — segue pmTipo, não o banco. */}
            {precisaAvisarPedidoMinimo(nivel, pmTipo) && <AvisoPedidoMinimo />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Label>Tipo de mínimo</Label>
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
                  <Label>Valor mínimo do pedido</Label>
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
                  <Label>Quantidade mínima de peças</Label>
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

        {erroSalvar && (
          <p role="alert" style={{
            fontFamily: 'var(--font-ui)', fontSize: 12.5, lineHeight: 1.5,
            color: 'var(--status-bad-tx)', background: 'rgba(180,56,31,.08)',
            border: '1px solid var(--status-bad-tx)', borderRadius: 'var(--r-input)',
            padding: '10px 12px', margin: '0 0 10px',
          }}>{erroSalvar}</p>
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
        config={data.config}
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
            cancelarPedido={data.cancelarPedido}
            excluirPedido={data.excluirPedido}
            config={data.config}
            saveConfig={data.saveConfig}
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
        lojaId={lojaId}
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
