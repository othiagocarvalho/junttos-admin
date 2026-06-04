import { useState } from 'react'
import { Target } from 'lucide-react'

const METALLIC = 'linear-gradient(135deg, #E8C0AF 0%, #D49E8A 22%, #B97766 42%, #7A3E33 58%, #B97766 72%, #DCAA96 88%, #F0C9B6 100%)'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 8,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  fontFamily: 'Manrope, sans-serif',
}

const inputBase = {
  width: '100%', height: 48,
  border: '1.5px solid var(--line)', borderRadius: 14,
  padding: '0 14px', fontFamily: 'Manrope, sans-serif', fontSize: 15,
  color: 'var(--ink)', background: 'var(--bg)',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color .18s, box-shadow .18s',
}

function focusIn(e) {
  e.target.style.borderColor = 'var(--rose-deep)'
  e.target.style.boxShadow = '0 0 0 3px rgba(180,122,107,0.12)'
  e.target.style.background = '#fff'
}
function focusOut(e) {
  e.target.style.borderColor = 'var(--line)'
  e.target.style.boxShadow = 'none'
  e.target.style.background = 'var(--bg)'
}

function ProgressRing({ pct, size = 180, stroke = 14 }) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E8C0AF" />
            <stop offset="22%" stopColor="#D49E8A" />
            <stop offset="42%" stopColor="#B97766" />
            <stop offset="58%" stopColor="#7A3E33" />
            <stop offset="72%" stopColor="#B97766" />
            <stop offset="88%" stopColor="#DCAA96" />
            <stop offset="100%" stopColor="#F0C9B6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="url(#ringGrad)" strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
      </svg>
      {/* Center text — rotated back */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
          {Math.min(pct, 100).toFixed(0)}%
        </span>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4, fontWeight: 600 }}>da meta</span>
      </div>
    </div>
  )
}

export default function Meta({ vendas, metas, salvarMeta, theme }) {
  const now = new Date()
  const currentYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  const [mes, setMes] = useState(currentYM)
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)

  const meta = metas[mes] || 0
  const [y, m] = mes.split('-').map(Number)

  const vendasMes = vendas.filter(v => {
    const d = new Date(v.data)
    return d.getFullYear() === y && d.getMonth() + 1 === m
  })

  const realizado = vendasMes.reduce((s, v) => s + Number(v.valor), 0)
  const diasNoMes = new Date(y, m, 0).getDate()
  const diaAtual = mes === currentYM ? now.getDate() : diasNoMes
  const diasRestantes = Math.max(diasNoMes - diaAtual, 0)
  const mediaDiaria = diaAtual > 0 ? realizado / diaAtual : 0
  const projecao = mediaDiaria * diasNoMes
  const pct = meta > 0 ? (realizado / meta) * 100 : 0
  const atingida = meta > 0 && realizado >= meta
  const precisaDia = diasRestantes > 0 && meta > realizado ? fmtR((meta - realizado) / diasRestantes) : null

  async function handleSave() {
    const v = parseFloat(valor.replace(',', '.'))
    if (!v || v <= 0) return
    setSaving(true)
    await salvarMeta(mes, v)
    setSaving(false)
    setValor('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Definir meta */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '20px 18px' }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16 }}>
          Definir Meta Mensal
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Mês / Ano</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              style={inputBase} onFocus={focusIn} onBlur={focusOut} />
          </div>
          <div>
            <label style={labelStyle}>
              Valor da meta{meta > 0 && <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}> — atual: {fmtR(meta)}</span>}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>R$</span>
                <input value={valor} onChange={e => setValor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="0,00"
                  style={{ ...inputBase, paddingLeft: 36 }} onFocus={focusIn} onBlur={focusOut} />
              </div>
              <button onClick={handleSave} disabled={saving || !valor}
                style={{
                  padding: '0 20px', borderRadius: 14, border: 'none', cursor: saving || !valor ? 'not-allowed' : 'pointer',
                  background: saving || !valor ? 'var(--line)' : METALLIC,
                  color: saving || !valor ? 'var(--muted)' : '#fff',
                  fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13,
                  boxShadow: saving || !valor ? 'none' : '0 3px 12px rgba(122,62,51,0.25)',
                }}>
                {saving ? '...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Acompanhamento */}
      {meta > 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', padding: '24px 18px' }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 24, textAlign: 'center' }}>
            {new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>

          {/* Ring */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <ProgressRing pct={pct} />
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Realizado', value: fmtR(realizado), sub: `${vendasMes.length} vendas` },
              { label: atingida ? 'Meta batida' : 'Faltam', value: atingida ? '🎉' : fmtR(Math.max(meta - realizado, 0)), sub: atingida ? 'Parabéns!' : `${diasRestantes}d restantes` },
              { label: 'Projeção', value: fmtR(projecao), sub: projecao >= meta ? '✅ No caminho' : '⚠️ Abaixo' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 3 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {precisaDia && !atingida && (
            <div style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                Para bater a meta, precisa de{' '}
                <span style={{ fontWeight: 700, color: 'var(--rose-deep)' }}>{precisaDia}/dia</span>
                {' '}nos {diasRestantes} dias restantes.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
          padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <Target size={28} color="var(--line)" />
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)' }}>Nenhuma meta definida para este mês.</p>
        </div>
      )}
    </div>
  )
}
