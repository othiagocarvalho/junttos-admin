import { useState } from 'react'
import { TrendingUp, Target } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

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
  const pct = meta > 0 ? Math.min((realizado / meta) * 100, 100) : 0
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
    <div className="space-y-4">
      {/* Define goal */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
        <p className="text-sm font-semibold text-[#16101F] mb-4 flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: theme.primary }} />
          Definir Meta Mensal
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-[#7B7390] uppercase tracking-wider mb-1.5 block">Mês / Ano</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-[#7B7390] uppercase tracking-wider mb-1.5 block">
              Valor da meta {meta > 0 && <span className="text-[#7B7390] font-normal">(atual: {fmtR(meta)})</span>}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#7B7390]">R$</span>
                <input
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="0,00"
                  className={inp + ' pl-9'}
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !valor}
                className="px-5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: theme.primary }}
              >
                {saving ? '...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tracking */}
      {meta > 0 ? (
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
          <p className="text-sm font-semibold text-[#16101F] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: theme.primary }} />
            Acompanhamento —{' '}
            {new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>

          <div className="mb-1">
            <div className="flex justify-between text-xs text-[#7B7390] mb-2">
              <span>{fmtR(realizado)} realizados</span>
              <span>Meta: {fmtR(meta)}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: '#E6E0F0' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: atingida
                    ? 'linear-gradient(90deg, #4ade80, #16a34a)'
                    : `linear-gradient(90deg, ${theme.primary}80, ${theme.primary})`,
                }}
              />
            </div>
            <p className="text-right text-xs text-[#7B7390] mt-1">{pct.toFixed(1)}% atingido</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Realizado', value: fmtR(realizado), sub: `${vendasMes.length} vendas` },
              {
                label: 'Faltam',
                value: atingida ? '—' : fmtR(Math.max(meta - realizado, 0)),
                sub: atingida ? '🎉 Meta batida!' : `${diasRestantes}d restantes`,
              },
              {
                label: 'Projeção',
                value: fmtR(projecao),
                sub: projecao >= meta ? '✅ No caminho' : '⚠️ Abaixo',
              },
            ].map(s => (
              <div key={s.label} className="bg-[#F6F3FA] rounded-xl p-3 text-center">
                <p className="text-[10px] font-semibold text-[#7B7390] uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-base font-bold text-[#16101F]">{s.value}</p>
                <p className="text-[10px] text-[#7B7390] mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {precisaDia && !atingida && (
            <p className="mt-4 text-xs text-center text-[#7B7390] bg-[#F6F3FA] rounded-xl p-3">
              Para bater a meta, precisa vender em média{' '}
              <span className="font-semibold" style={{ color: theme.primary }}>{precisaDia}</span>
              {' '}por dia nos {diasRestantes} dias restantes.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-16 flex flex-col items-center gap-3">
          <Target className="w-8 h-8 text-[#E6E0F0]" />
          <p className="text-[#7B7390] text-sm">Nenhuma meta definida para este mês.</p>
        </div>
      )}
    </div>
  )
}

const inp =
  'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] focus:ring-1 focus:ring-[#5E2BD0]/15 transition'
