import { useState, useMemo, useRef } from 'react'
import { MessageCircle, Check, X, Plus } from 'lucide-react'
import {
  gerarSugestoesAuto,
  combinarFeed,
  normalizeWaPhone,
} from '../../utils/crm'
import Clientes from './Clientes'

const BADGE_CONFIG = {
  aniversario: { label: 'Aniversário', bg: '#fdf4ff', color: '#7e22ce' },
  inativo:     { label: 'Inativo',     bg: '#fffbeb', color: '#92400e' },
  vip:         { label: 'VIP',         bg: '#fefce8', color: '#854d0e' },
  lembrete:    { label: 'Lembrete',    bg: '#eff6ff', color: '#1d4ed8' },
}

function Pill({ tipo, subtipo }) {
  const key = tipo === 'lembrete' ? 'lembrete' : (subtipo || 'lembrete')
  const cfg = BADGE_CONFIG[key] || BADGE_CONFIG.lembrete
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 99,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      background: cfg.bg, color: cfg.color, flexShrink: 0,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>
      {cfg.label}
    </span>
  )
}

function waMensagem(item) {
  const nome = (item.cliente_nome || '').split(' ')[0]
  if (item.subtipo === 'aniversario') return `Olá, ${nome}! Feliz aniversário! Que seu dia seja muito especial.`
  if (item.subtipo === 'vip') return `Olá, ${nome}! Você é uma cliente especial pra gente! Temos novidades incríveis essa semana — venha conferir!`
  if (item.subtipo === 'inativo') return `Olá, ${nome}! Sentimos sua falta! Temos novidades na loja e adoraríamos a sua visita.`
  return `Olá, ${nome}!`
}

function FeedCard({ item, onDispensar, onConcluir }) {
  const waPhone = normalizeWaPhone(item.cliente_telefone)
  const waLink = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMensagem(item))}`
    : null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r-card)', padding: '12px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
          <Pill tipo={item.tipo} subtipo={item.subtipo} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {item.cliente_nome}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.4 }}>
          {item.nota}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', marginTop: 2 }}>
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 32, padding: '0 11px', borderRadius: 'var(--r-pill)',
              background: '#25D366', color: '#fff',
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            <MessageCircle size={13} /> Chamar
          </a>
        ) : (
          <span style={{
            height: 32, padding: '0 10px', borderRadius: 'var(--r-pill)',
            background: 'var(--bg)', border: '1px solid var(--line)',
            display: 'inline-flex', alignItems: 'center',
            fontSize: 11, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>
            Sem tel.
          </span>
        )}
        <button
          onClick={item.tipo === 'lembrete' ? onConcluir : onDispensar}
          title={item.tipo === 'lembrete' ? 'Marcar como feito' : 'Dispensar'}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '1.5px solid var(--line)', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--muted)', flexShrink: 0,
          }}
        >
          <Check size={13} />
        </button>
      </div>
    </div>
  )
}

function FormLembrete({ clientes, onSalvar, onCancelar, theme }) {
  const primary = theme?.primary || '#5E2BD0'
  const hoje = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ cliente_nome: '', nota: '', data_lembrete: hoje })
  const [busca, setBusca] = useState('')
  const [showSugestoes, setShowSugestoes] = useState(false)
  const [saving, setSaving] = useState(false)

  const sugestoes = useMemo(() => {
    if (!busca.trim()) return []
    return (clientes || [])
      .filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))
      .slice(0, 6)
  }, [busca, clientes])

  function selecionarCliente(nome) {
    setForm(f => ({ ...f, cliente_nome: nome }))
    setBusca(nome)
    setShowSugestoes(false)
  }

  async function handleSalvar() {
    if (!form.cliente_nome.trim() || !form.data_lembrete) return
    setSaving(true)
    try {
      await onSalvar(form)
      onCancelar()
    } catch (e) {
      console.error('[FormLembrete]', e)
    } finally {
      setSaving(false)
    }
  }

  const inpStyle = {
    width: '100%', height: 40, boxSizing: 'border-box',
    background: 'var(--bg)', border: '1.5px solid var(--line)',
    borderRadius: 'var(--r-input)', padding: '0 12px',
    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13.5, color: 'var(--ink)', outline: 'none',
  }
  const lblStyle = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    marginBottom: 5, letterSpacing: '0.1em', textTransform: 'uppercase',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  }

  return (
    <div style={{
      background: 'var(--surface)', border: `1.5px solid ${primary}30`,
      borderRadius: 'var(--r-card)', padding: 16, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Novo lembrete
        </p>
        <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, lineHeight: 0 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <label style={lblStyle}>Cliente</label>
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); setShowSugestoes(true); setForm(f => ({ ...f, cliente_nome: e.target.value })) }}
            onFocus={() => setShowSugestoes(true)}
            onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
            placeholder="Buscar cliente…"
            style={inpStyle}
          />
          {showSugestoes && sugestoes.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: 'var(--surface)', border: '1.5px solid var(--line)',
              borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.10)',
              maxHeight: 180, overflowY: 'auto', marginTop: 2,
            }}>
              {sugestoes.map(c => (
                <button
                  key={c.id || c.nome}
                  onMouseDown={() => selecionarCliente(c.nome)}
                  style={{
                    display: 'block', width: '100%', padding: '9px 12px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: 13.5, color: 'var(--ink)',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                  }}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label style={lblStyle}>Data</label>
          <input
            type="date"
            value={form.data_lembrete}
            onChange={e => setForm(f => ({ ...f, data_lembrete: e.target.value }))}
            style={inpStyle}
          />
        </div>

        <div>
          <label style={lblStyle}>Nota (opcional)</label>
          <textarea
            value={form.nota}
            onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
            placeholder="Ex: Ligar sobre a encomenda…"
            rows={2}
            style={{ ...inpStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button
            onClick={handleSalvar}
            disabled={saving || !form.cliente_nome.trim() || !form.data_lembrete}
            style={{
              flex: 1, height: 38, borderRadius: 'var(--r-pill)',
              background: primary, color: '#fff', border: 'none', cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13.5, fontWeight: 700,
              opacity: (saving || !form.cliente_nome.trim() || !form.data_lembrete) ? 0.5 : 1,
            }}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            onClick={onCancelar}
            style={{
              height: 38, padding: '0 14px', borderRadius: 'var(--r-pill)',
              background: 'var(--bg)', border: '1.5px solid var(--line)',
              color: 'var(--muted)', cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13.5, fontWeight: 600,
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <p style={{
        margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--muted)',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}>
        {title}
      </p>
      {count > 0 && (
        <span style={{
          fontSize: 10.5, fontWeight: 700, background: 'var(--line)',
          color: 'var(--muted)', padding: '1px 7px', borderRadius: 99,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

function FollowUpsTab({ clientes, vendas, lembretes, addLembrete, concluirLembrete, dispensados, dispensarFollowup, theme }) {
  const primary = theme?.primary || '#5E2BD0'
  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [showForm, setShowForm] = useState(false)

  const sugestoesAuto = useMemo(
    () => gerarSugestoesAuto(clientes || [], vendas || [], hoje),
    [clientes, vendas, hoje]
  )

  const feed = useMemo(
    () => combinarFeed(sugestoesAuto, lembretes || [], dispensados || [], hoje),
    [sugestoesAuto, lembretes, dispensados, hoje]
  )

  const feedHoje = feed.filter(f => f.data <= hoje)
  const feedProximo = feed.filter(f => f.data > hoje)

  async function handleDispensar(item) {
    if (!item.data_referencia) return
    await dispensarFollowup(item.cliente_nome, item.subtipo, item.data_referencia)
  }

  async function handleConcluir(item) {
    if (!item.lembrete_id) return
    await concluirLembrete(item.lembrete_id)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Follow-ups
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Sugestões automáticas + seus lembretes
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 14px', borderRadius: 'var(--r-pill)',
            background: primary, color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700,
            flexShrink: 0,
          }}
        >
          <Plus size={14} /> Novo
        </button>
      </div>

      {showForm && (
        <FormLembrete
          clientes={clientes}
          onSalvar={addLembrete}
          onCancelar={() => setShowForm(false)}
          theme={theme}
        />
      )}

      {feed.length === 0 && !showForm && (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>
          <MessageCircle size={40} color="var(--line)" style={{ marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>
            Nenhum follow-up pendente
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Clique em "Novo" para criar um lembrete manual.
          </p>
        </div>
      )}

      {feedHoje.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel title="Hoje" count={feedHoje.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feedHoje.map(item => (
              <FeedCard
                key={item.id}
                item={item}
                theme={theme}
                onDispensar={() => handleDispensar(item)}
                onConcluir={() => handleConcluir(item)}
              />
            ))}
          </div>
        </div>
      )}

      {feedProximo.length > 0 && (
        <div>
          <SectionLabel title="Próximos dias" count={feedProximo.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feedProximo.map(item => (
              <FeedCard
                key={item.id}
                item={item}
                theme={theme}
                onDispensar={() => handleDispensar(item)}
                onConcluir={() => handleConcluir(item)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CRM({
  clientes,
  vendas,
  addCliente,
  updateCliente,
  deleteCliente,
  lembretes = [],
  addLembrete,
  concluirLembrete,
  dispensados = [],
  dispensarFollowup,
  theme,
  produtosData = [],
  plano = 'starter',
  lojaId,
}) {
  const primary = theme?.primary || '#5E2BD0'
  const [aba, setAba] = useState('followups')

  const totalFeed = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const sugs = gerarSugestoesAuto(clientes || [], vendas || [], hoje)
    return combinarFeed(sugs, lembretes || [], dispensados || [], hoje).length
  }, [clientes, vendas, lembretes, dispensados])

  function tabStyle(active) {
    return {
      height: 36, padding: '0 16px', borderRadius: 'var(--r-pill)',
      border: active ? 'none' : '1.5px solid var(--line)',
      background: active ? primary : 'var(--bg)',
      color: active ? '#fff' : 'var(--muted)',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 13, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabStyle(aba === 'followups')} onClick={() => setAba('followups')}>
          Follow-ups
          {totalFeed > 0 && (
            <span style={{
              background: aba === 'followups' ? 'rgba(255,255,255,.25)' : `${primary}22`,
              color: aba === 'followups' ? '#fff' : primary,
              borderRadius: 99, fontSize: 10.5, fontWeight: 700, padding: '1px 6px',
            }}>
              {totalFeed}
            </span>
          )}
        </button>
        <button style={tabStyle(aba === 'clientes')} onClick={() => setAba('clientes')}>
          Clientes
        </button>
      </div>

      {aba === 'followups' && (
        <FollowUpsTab
          clientes={clientes || []}
          vendas={vendas || []}
          lembretes={lembretes || []}
          addLembrete={addLembrete}
          concluirLembrete={concluirLembrete}
          dispensados={dispensados || []}
          dispensarFollowup={dispensarFollowup}
          theme={theme}
        />
      )}

      {aba === 'clientes' && (
        <Clientes
          clientes={clientes || []}
          vendas={vendas || []}
          addCliente={addCliente}
          updateCliente={updateCliente}
          deleteCliente={deleteCliente}
          theme={theme}
          produtosData={produtosData}
          plano={plano}
        />
      )}
    </div>
  )
}
