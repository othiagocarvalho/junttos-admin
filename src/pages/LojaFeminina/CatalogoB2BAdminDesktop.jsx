import { useState, useEffect } from 'react'
import { Package, ShoppingBag, Settings, Save } from 'lucide-react'
import EstoqueMobile from './EstoqueMobile'
import PedidosCatalogo from './PedidosCatalogo'

const PRESETS = [
  { label: 'Junttos',  primary: '#5E2BD0' },
  { label: 'Rosê',     primary: '#C9956C' },
  { label: 'Verde',    primary: '#16a34a' },
  { label: 'Azul',     primary: '#2563eb' },
  { label: 'Borgonha', primary: '#9D174D' },
]

const NAV = [
  { id: 'produtos', label: 'Produtos',       Icon: Package },
  { id: 'pedidos',  label: 'Pedidos',        Icon: ShoppingBag },
  { id: 'config',   label: 'Configurações',  Icon: Settings },
]

// ── Sidebar (mesmo padrão collapse do ClientDashboardDesktop) ──
function B2BSidebar({ tab, setTab, theme, config, nivel, onSwitchToMobile }) {
  const [open, setOpen] = useState(false)
  const primary = config?.cor_primaria || theme.primary

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'fixed', left: 0, top: 0,
        width: open ? 196 : 56, height: '100dvh',
        background: '#F8F7F5',
        display: 'flex', flexDirection: 'column',
        zIndex: 50, fontFamily: 'Manrope, sans-serif',
        borderRight: '1px solid #e8e4df',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div style={{
        padding: open ? '18px 14px 16px' : '12px 0',
        borderBottom: '1px solid #e8e4df',
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
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
              {config?.nome || 'Catálogo B2B'}
            </p>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
              background: `${primary}20`, color: primary,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: 'Manrope, sans-serif',
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
                background: active ? 'var(--surface)' : 'transparent',
                border: active ? '1px solid var(--line)' : '1px solid transparent',
                borderLeft: `3px solid ${active ? primary : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left',
                color: active ? 'var(--ink)' : 'var(--ink-soft)',
                fontSize: 14, fontWeight: active ? 600 : 400,
                fontFamily: 'Manrope, sans-serif', transition: 'all .15s',
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {open && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: open ? '10px 10px 14px' : '10px 0 14px', borderTop: '1px solid #e8e4df', flexShrink: 0 }}>
        {open ? (
          <>
            <button onClick={onSwitchToMobile} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10, width: '100%',
              border: '1px solid #e8e4df',
              background: 'transparent', cursor: 'pointer',
              color: '#999', fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF6B47', display: 'inline-block', flexShrink: 0 }} />
              Versão Celular
            </button>
            <p style={{ fontSize: 10, color: '#bbb', fontFamily: 'Manrope, sans-serif', textAlign: 'center', margin: '8px 0 0' }}>
              jun<span style={{ color: '#F4613A' }}>tt</span>os
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF6B47', display: 'inline-block' }} />
          </div>
        )}
      </div>

      <style>{`.cb2b-nav-btn:hover { background: #f0ece8 !important; color: #2C1F14 !important; }`}</style>
    </aside>
  )
}

// ── Config Desktop (2 colunas) ─────────────────────────────────
function ConfigB2BDesktop({ config, saveConfig, theme }) {
  const [nome,     setNome]     = useState(config?.nome           || '')
  const [chavePix, setChavePix] = useState(config?.chave_pix      || '')
  const [whatsapp, setWhatsapp] = useState(config?.whatsapp_loja  || '')
  const [primary,  setPrimary]  = useState(config?.cor_primaria    || '#5E2BD0')
  const [logoUrl,  setLogoUrl]  = useState(config?.logo_url        || '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    if (!config) return
    setNome(config.nome           || '')
    setChavePix(config.chave_pix  || '')
    setWhatsapp(config.whatsapp_loja || '')
    setPrimary(config.cor_primaria  || '#5E2BD0')
    setLogoUrl(config.logo_url      || '')
  }, [config])

  async function handleSave() {
    setSaving(true)
    await saveConfig({
      nome:          nome         || 'Catálogo',
      chave_pix:     chavePix     || null,
      whatsapp_loja: whatsapp     || null,
      cor_primaria:  primary,
      logo_url:      logoUrl      || null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const lbl = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    marginBottom: 7, letterSpacing: '0.12em', textTransform: 'uppercase',
    fontFamily: 'Manrope, sans-serif',
  }
  const inp = {
    width: '100%', height: 44, boxSizing: 'border-box',
    background: 'var(--bg)', border: '1.5px solid var(--line)',
    borderRadius: 12, padding: '0 14px',
    fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--ink)', outline: 'none',
  }
  const section = {
    background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px 28px',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: Identidade */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={section}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>Identidade</p>
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
                  style={{ ...inp, fontFamily: 'monospace', flex: 1 }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Pagamento & Pedido Mínimo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={section}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>Pagamento &amp; Contato</p>
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

        {/* Placeholder para pedido mínimo — implementar na etapa 5c */}
        <div style={{ ...section, opacity: 0.4, pointerEvents: 'none' }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Pedido Mínimo</p>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--muted)' }}>Disponível na próxima etapa.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            height: 50, borderRadius: 14, border: 'none',
            background: saved ? '#16a34a' : theme.primary,
            color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700,
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
    produtos: (
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
      <PedidosCatalogo
        pedidos={data.pedidos || []}
        updatePedido={data.updatePedido}
        theme={theme}
        lojaId={lojaId}
      />
    ),
    config: (
      <ConfigB2BDesktop
        config={data.config}
        saveConfig={data.saveConfig}
        theme={theme}
      />
    ),
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif', ...contentVars }}>
      <B2BSidebar
        tab={tab}
        setTab={setTab}
        theme={theme}
        config={data.config}
        nivel={nivel}
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
