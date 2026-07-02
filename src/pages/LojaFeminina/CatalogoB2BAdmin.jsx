import { useState, useEffect } from 'react'
import { Package, ShoppingBag, Settings, Monitor, Save } from 'lucide-react'
import EstoqueMobile from './EstoqueMobile'
import PedidosCatalogo from './PedidosCatalogo'

const PRESETS = [
  { label: 'Junttos',  primary: '#5E2BD0' },
  { label: 'Rosê',     primary: '#C9956C' },
  { label: 'Verde',    primary: '#16a34a' },
  { label: 'Azul',     primary: '#2563eb' },
  { label: 'Borgonha', primary: '#9D174D' },
]

const TABS = [
  { id: 'produtos', label: 'Produtos', Icon: Package },
  { id: 'pedidos',  label: 'Pedidos',  Icon: ShoppingBag },
  { id: 'config',   label: 'Config',   Icon: Settings },
]

const lbl = {
  display: 'block', fontSize: 10, fontWeight: 700,
  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em',
  marginBottom: 6, fontFamily: 'Manrope, sans-serif',
}
const inp = {
  width: '100%', height: 44, border: '1.5px solid var(--line)', borderRadius: 12,
  padding: '0 14px', fontFamily: 'Manrope, sans-serif', fontSize: 14,
  color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box',
}
const card = {
  background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 14, padding: '16px 16px 20px', marginBottom: 12,
}

function ConfigB2B({ config, saveConfig, theme }) {
  const [nome,      setNome]      = useState(config?.nome            || '')
  const [chavePix,  setChavePix]  = useState(config?.chave_pix       || '')
  const [whatsapp,  setWhatsapp]  = useState(config?.whatsapp_loja   || '')
  const [primary,   setPrimary]   = useState(config?.cor_primaria     || '#5E2BD0')
  const [logoUrl,   setLogoUrl]   = useState(config?.logo_url         || '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    if (!config) return
    setNome(config.nome            || '')
    setChavePix(config.chave_pix   || '')
    setWhatsapp(config.whatsapp_loja || '')
    setPrimary(config.cor_primaria  || '#5E2BD0')
    setLogoUrl(config.logo_url      || '')
  }, [config])

  async function handleSave() {
    setSaving(true)
    await saveConfig({
      nome:          nome          || 'Catálogo',
      chave_pix:     chavePix      || null,
      whatsapp_loja: whatsapp      || null,
      cor_primaria:  primary,
      logo_url:      logoUrl       || null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={card}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>
          Identidade
        </p>
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
              type="color"
              value={primary}
              onChange={e => setPrimary(e.target.value)}
              style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer', padding: 2, background: 'var(--surface)' }}
            />
          </div>
        </div>
      </div>

      <div style={card}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>
          Pagamento &amp; Contato
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lbl}>Chave Pix</label>
            <input
              value={chavePix}
              onChange={e => setChavePix(e.target.value)}
              style={inp}
              placeholder="CPF, CNPJ, e-mail ou chave aleatória"
            />
          </div>
          <div>
            <label style={lbl}>WhatsApp da Loja</label>
            <input
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              style={inp}
              placeholder="(85) 99999-0000"
              type="tel"
            />
          </div>
        </div>
      </div>

      {/* Placeholder para pedido mínimo — implementar na etapa 5c */}
      <div style={{ ...card, opacity: 0.45, pointerEvents: 'none' }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
          Pedido Mínimo
        </p>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
          Disponível na próxima etapa.
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', height: 48, borderRadius: 14, border: 'none',
          background: saved ? '#16a34a' : theme.primary,
          color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <Save size={15} />
        {saved ? 'Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </div>
  )
}

export default function CatalogoB2BAdmin({ data, theme, lojaId, nivel, onSwitchToDesktop }) {
  const [tab, setTab] = useState('produtos')
  const primary = theme.primary

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif' }}>

      {/* Header */}
      <header style={{
        background: primary, height: 56, paddingLeft: 20, paddingRight: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="18 21 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect x="20" y="55" width="60" height="28" rx="14" fill="rgba(255,255,255,0.9)" />
            <circle cx="40" cy="37" r="14" fill="rgba(255,255,255,0.85)" />
            <circle cx="64" cy="39" r="14" fill="rgba(255,255,255,0.65)" />
          </svg>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
              {data.config?.nome || 'Catálogo B2B'}
            </p>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Catálogo {nivel === 'pro' ? 'Pro' : 'Simples'}
            </p>
          </div>
        </div>
        <button
          onClick={onSwitchToDesktop}
          title="Versão Computador"
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
        >
          <Monitor size={16} color="rgba(255,255,255,0.6)" />
        </button>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 88px', boxSizing: 'border-box' }}>
        {tab === 'produtos' && (
          <div style={{ paddingTop: 8 }}>
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
          </div>
        )}
        {tab === 'pedidos' && (
          <div style={{ paddingTop: 8 }}>
            <PedidosCatalogo
              pedidos={data.pedidos || []}
              updatePedido={data.updatePedido}
              theme={theme}
              lojaId={lojaId}
            />
          </div>
        )}
        {tab === 'config' && (
          <ConfigB2B
            config={data.config}
            saveConfig={data.saveConfig}
            theme={theme}
          />
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: '#F8F7F5', borderTop: '1px solid #e8e4df',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{
          height: 62, width: '100%',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
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
                <Icon size={19} color={active ? primary : '#bbb'} strokeWidth={active ? 2.2 : 1.5} />
                <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: active ? 700 : 400, color: active ? primary : '#bbb' }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: 10, color: '#bbb', margin: '0 0 4px', fontFamily: 'Manrope, sans-serif', textAlign: 'center' }}>
          jun<span style={{ color: '#F4613A' }}>tt</span>os
        </p>
      </nav>
    </div>
  )
}
