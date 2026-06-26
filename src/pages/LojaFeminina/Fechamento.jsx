import { useState } from 'react'
import { Wallet, History } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtDate(s) { return new Date(String(s).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') }

const EMPTY = { dinheiro: '', pix: '', pix_santander: '', pix_bb: '', debito: '', credito: '', saldo_ini: '', sangria: '', despesas: '', obs: '' }

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 7,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  fontFamily: 'Manrope, sans-serif',
}

function CurrField({ k, label, form, setForm, theme }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>R$</span>
        <input
          type="number" value={form[k]} step="0.01" min="0"
          onChange={e => setForm({ ...form, [k]: e.target.value })}
          placeholder="0,00"
          style={{
            width: '100%', height: 46,
            border: '1.5px solid var(--line)', borderRadius: 14,
            paddingLeft: 32, paddingRight: 14,
            fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 600,
            color: 'var(--ink)', background: 'var(--bg)',
            outline: 'none', boxSizing: 'border-box',
            transition: 'border-color .18s',
          }}
          onFocus={e => { e.target.style.borderColor = theme.primary; e.target.style.background = '#fff' }}
          onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.background = 'var(--bg)' }}
        />
      </div>
    </div>
  )
}

export default function Fechamento({ caixas, fecharCaixa, theme, features }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const n = k => parseFloat(form[k] || 0) || 0
  const totalVendas = features?.atacado
    ? n('dinheiro') + n('pix_santander') + n('pix_bb') + n('debito') + n('credito')
    : n('dinheiro') + n('pix') + n('debito') + n('credito')
  const saldoFinal = n('saldo_ini') + n('dinheiro') - n('sangria')
  const liquido = totalVendas - n('despesas')

  async function handleSave() {
    setSaving(true)
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const err = await fecharCaixa({
      data: today,
      dinheiro: n('dinheiro'),
      pix: features?.atacado ? n('pix_santander') + n('pix_bb') : n('pix'),
      ...(features?.atacado ? { pix_santander: n('pix_santander'), pix_bb: n('pix_bb') } : {}),
      debito: n('debito'), credito: n('credito'),
      saldo_ini: n('saldo_ini'), sangria: n('sangria'),
      despesas: n('despesas'), obs: form.obs || null,
      total: totalVendas,
    })
    setSaving(false)
    if (!err) {
      setDone(true)
      setTimeout(() => { setDone(false); setForm(EMPTY) }, 2200)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Form card */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '20px 18px' }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 18 }}>
          Fechamento de Caixa — {new Date().toLocaleDateString('pt-BR')}
        </p>

        {/* Recebimentos */}
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: theme.primary, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Recebimentos</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <CurrField k="dinheiro" label="Dinheiro" form={form} setForm={setForm} theme={theme} />
          {features?.atacado ? (
            <>
              <CurrField k="pix_santander" label="PIX Santander" form={form} setForm={setForm} theme={theme} />
              <CurrField k="pix_bb" label="PIX Banco do Brasil" form={form} setForm={setForm} theme={theme} />
            </>
          ) : (
            <CurrField k="pix" label="Pix" form={form} setForm={setForm} theme={theme} />
          )}
          <CurrField k="debito" label="Débito" form={form} setForm={setForm} theme={theme} />
          <CurrField k="credito" label="Crédito" form={form} setForm={setForm} theme={theme} />
        </div>

        {/* Caixa */}
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: theme.primary, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Caixa</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <CurrField k="saldo_ini" label="Saldo Inicial" form={form} setForm={setForm} theme={theme} />
          <CurrField k="sangria" label="Sangria" form={form} setForm={setForm} theme={theme} />
        </div>
        <CurrField k="despesas" label="Despesas do Dia" form={form} setForm={setForm} theme={theme} />

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Observações</label>
          <input value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })}
            placeholder="Ocorrências, trocas, anotações..."
            style={{
              width: '100%', height: 46, border: '1.5px solid var(--line)', borderRadius: 14,
              padding: '0 14px', fontFamily: 'Manrope, sans-serif', fontSize: 14,
              color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = theme.primary; e.target.style.background = '#fff' }}
            onBlur={e => { e.target.style.borderColor = 'var(--line)'; e.target.style.background = 'var(--bg)' }}
          />
        </div>

        {/* Hero total */}
        <div style={{ marginTop: 18, background: theme.primary, borderRadius: 16, padding: '22px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
            Total de Vendas do Dia
          </p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            {fmtR(totalVendas)}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Saldo Final em Caixa</p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(saldoFinal)}</p>
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Resultado Líquido</p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: liquido >= 0 ? '#16a34a' : '#dc2626' }}>{fmtR(liquido)}</p>
          </div>
        </div>

        <button
          onClick={handleSave} disabled={saving || done || totalVendas === 0}
          style={{
            width: '100%', height: 50, marginTop: 14, border: 'none', borderRadius: 99, cursor: saving || done || totalVendas === 0 ? 'not-allowed' : 'pointer',
            background: done ? '#16a34a' : (saving || totalVendas === 0) ? 'var(--line)' : theme.primary,
            color: done || (!saving && totalVendas > 0) ? '#fff' : 'var(--muted)',
            fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700,
            boxShadow: done || saving || totalVendas === 0 ? 'none' : '0 4px 16px rgba(0,0,0,0.18)',
            transition: 'opacity .18s',
          }}
        >
          {done ? '✓ Caixa fechado!' : saving ? 'Salvando...' : 'Fechar Caixa'}
        </button>
      </div>

      {/* Histórico */}
      {caixas.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '20px 18px' }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16 }}>
            Histórico de Fechamentos
          </p>
          <div>
            {caixas.slice(0, 10).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--line)', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{fmtDate(c.data)}</p>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                    Din. {fmtR(c.dinheiro)} · Pix {fmtR(c.pix)} · Déb. {fmtR(c.debito)} · Créd. {fmtR(c.credito)}
                  </p>
                  {c.obs && <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 3, fontFamily: 'Manrope, sans-serif' }}>{c.obs}</p>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: theme.primary }}>{fmtR(c.total)}</p>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, color: 'var(--muted)' }}>desp. {fmtR(c.despesas)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
