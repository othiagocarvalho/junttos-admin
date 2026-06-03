import { useState } from 'react'
import { Wallet, History } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtDate(s) { return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') }

const EMPTY = { dinheiro: '', pix: '', debito: '', credito: '', saldo_ini: '', sangria: '', despesas: '', obs: '' }

export default function Fechamento({ caixas, fecharCaixa, theme }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const n = k => parseFloat(form[k] || 0) || 0
  const totalVendas = n('dinheiro') + n('pix') + n('debito') + n('credito')
  const saldoFinal = n('saldo_ini') + n('dinheiro') - n('sangria')
  const liquido = totalVendas - n('despesas')

  async function handleSave() {
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const err = await fecharCaixa({
      data: today,
      dinheiro: n('dinheiro'),
      pix: n('pix'),
      debito: n('debito'),
      credito: n('credito'),
      saldo_ini: n('saldo_ini'),
      sangria: n('sangria'),
      despesas: n('despesas'),
      obs: form.obs || null,
      total: totalVendas,
    })
    setSaving(false)
    if (!err) {
      setDone(true)
      setTimeout(() => { setDone(false); setForm(EMPTY) }, 2000)
    }
  }

  function CurrField({ k, label }) {
    return (
      <div>
        <label className="text-xs font-semibold text-[#7B7390] uppercase tracking-wider mb-1.5 block">{label}</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#7B7390]">R$</span>
          <input
            type="number"
            value={form[k]}
            onChange={e => setForm({ ...form, [k]: e.target.value })}
            placeholder="0,00"
            step="0.01"
            min="0"
            className="w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] transition"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
        <p className="text-sm font-semibold text-[#16101F] mb-4 flex items-center gap-2">
          <Wallet className="w-4 h-4" style={{ color: theme.primary }} />
          Fechamento de Caixa — {new Date().toLocaleDateString('pt-BR')}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <CurrField k="dinheiro" label="Dinheiro" />
          <CurrField k="pix" label="Pix" />
          <CurrField k="debito" label="Débito" />
          <CurrField k="credito" label="Crédito" />
          <CurrField k="saldo_ini" label="Saldo Inicial" />
          <CurrField k="sangria" label="Sangria / Retirada" />
        </div>

        <CurrField k="despesas" label="Despesas do Dia" />

        <div className="mt-3">
          <label className="text-xs font-semibold text-[#7B7390] uppercase tracking-wider mb-1.5 block">Observações</label>
          <input
            value={form.obs}
            onChange={e => setForm({ ...form, obs: e.target.value })}
            placeholder="Ocorrências, trocas, anotações..."
            className="w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] transition"
          />
        </div>

        {/* Total banner */}
        <div className="mt-4 rounded-xl p-4 text-center" style={{ background: theme.primary }}>
          <p className="text-xs text-white/70 uppercase tracking-wider mb-1">Total de Vendas do Dia</p>
          <p className="text-3xl font-bold text-white">{fmtR(totalVendas)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-[#F6F3FA] rounded-xl p-3 text-center">
            <p className="text-xs text-[#7B7390] mb-1">Saldo Final em Caixa</p>
            <p className="text-base font-bold text-[#16101F]">{fmtR(saldoFinal)}</p>
          </div>
          <div className="bg-[#F6F3FA] rounded-xl p-3 text-center">
            <p className="text-xs text-[#7B7390] mb-1">Resultado Líquido</p>
            <p className="text-base font-bold" style={{ color: liquido >= 0 ? '#16a34a' : '#dc2626' }}>
              {fmtR(liquido)}
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || done || totalVendas === 0}
          className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: done ? '#16a34a' : theme.accent }}
        >
          {done ? '✓ Caixa fechado!' : saving ? 'Salvando...' : 'Fechar Caixa'}
        </button>
      </div>

      {/* History */}
      {caixas.length > 0 && (
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
          <p className="text-sm font-semibold text-[#16101F] mb-4 flex items-center gap-2">
            <History className="w-4 h-4" style={{ color: theme.primary }} />
            Histórico de Fechamentos
          </p>
          <div className="space-y-0">
            {caixas.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-start justify-between py-3 border-b border-[#E6E0F0] last:border-0 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#16101F]">{fmtDate(c.data)}</p>
                  <p className="text-xs text-[#7B7390] mt-0.5">
                    Dinheiro {fmtR(c.dinheiro)} · Pix {fmtR(c.pix)} · Débito {fmtR(c.debito)} · Crédito {fmtR(c.credito)}
                  </p>
                  {c.obs && <p className="text-xs text-[#7B7390] italic mt-0.5">{c.obs}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold" style={{ color: theme.primary }}>{fmtR(c.total)}</p>
                  <p className="text-xs text-[#7B7390]">despesas {fmtR(c.despesas)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
