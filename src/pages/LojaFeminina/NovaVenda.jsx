import { useState } from 'react'
import { User, Phone, ShoppingBag, CreditCard, Check, Plus, X, ChevronRight, ChevronLeft } from 'lucide-react'

const PGTOS = ['Dinheiro', 'Pix', 'Débito', 'Crédito', 'Fiado']
const EMPTY = { nome: '', tel: '', produtos: [], valor: '', pgto: 'Pix', obs: '', vendedora: '' }
const STEPS = ['Cliente', 'Produtos', 'Pagamento']

export default function NovaVenda({ produtos, addVenda, addProduto, theme }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY)
  const [newProd, setNewProd] = useState('')
  const [addingProd, setAddingProd] = useState(false)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  function toggleProd(nome) {
    const exists = form.produtos.find(p => p.nome === nome)
    setForm({
      ...form,
      produtos: exists
        ? form.produtos.filter(p => p.nome !== nome)
        : [...form.produtos, { nome, obs: '' }],
    })
  }

  function setProdObs(nome, obs) {
    setForm({ ...form, produtos: form.produtos.map(p => p.nome === nome ? { ...p, obs } : p) })
  }

  async function handleAddProd() {
    if (!newProd.trim()) return
    await addProduto(newProd.trim())
    setNewProd('')
    setAddingProd(false)
  }

  async function handleSave() {
    setSaving(true)
    const err = await addVenda({
      cliente_nome: form.nome || null,
      cliente_tel: form.tel || null,
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      forma_pgto: form.pgto,
      obs: form.obs || null,
      produtos: form.produtos,
      vendedora: form.vendedora || null,
      data: new Date().toISOString(),
    })
    setSaving(false)
    if (!err) {
      setDone(true)
      setTimeout(() => { setDone(false); setForm(EMPTY); setStep(0) }, 2200)
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-16 flex flex-col items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: theme.primary }}
        >
          <Check className="w-7 h-7 text-white" />
        </div>
        <p className="text-[#16101F] font-semibold text-lg">Venda registrada!</p>
        <p className="text-[#7B7390] text-sm">Salva com sucesso no histórico.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E6E0F0] rounded-2xl overflow-hidden">
      {/* Step indicator */}
      <div className="px-6 py-4 border-b border-[#E6E0F0]">
        <div className="flex items-center gap-3">
          {STEPS.map((s, i) => {
            const past = i < step
            const active = i === step
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && (
                  <div
                    className="w-10 h-px hidden sm:block"
                    style={{ background: past ? theme.primary : '#E6E0F0' }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={
                      past
                        ? { background: theme.primary, color: '#fff' }
                        : active
                          ? { background: 'transparent', color: theme.primary, border: `2px solid ${theme.primary}` }
                          : { background: '#F6F3FA', color: '#7B7390' }
                    }
                  >
                    {past ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span
                    className="text-sm font-medium hidden sm:block"
                    style={{ color: active ? theme.primary : past ? '#16101F' : '#7B7390' }}
                  >
                    {s}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-6">
        {/* ── Step 0: Cliente ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <p className="text-[#16101F] font-semibold text-base mb-0.5">Dados da Cliente</p>
              <p className="text-[#7B7390] text-sm">Identificação opcional</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome da Cliente" Icon={User}>
                <input
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Maria Silva"
                  className={inp}
                />
              </Field>
              <Field label="Telefone" Icon={Phone}>
                <input
                  value={form.tel}
                  onChange={e => setForm({ ...form, tel: e.target.value })}
                  placeholder="(85) 99999-0000"
                  className={inp}
                />
              </Field>
            </div>
            <Field label="Vendedora">
              <input
                value={form.vendedora}
                onChange={e => setForm({ ...form, vendedora: e.target.value })}
                placeholder="Quem está realizando a venda"
                className={inp}
              />
            </Field>
            <div className="flex justify-end pt-2">
              <Btn primary theme={theme} onClick={() => setStep(1)}>
                Próximo — Produtos
                <ChevronRight className="w-4 h-4" />
              </Btn>
            </div>
          </div>
        )}

        {/* ── Step 1: Produtos ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#16101F] font-semibold text-base mb-0.5">Produtos Vendidos</p>
                <p className="text-[#7B7390] text-sm">
                  {form.produtos.length > 0
                    ? `${form.produtos.length} produto(s) selecionado(s)`
                    : 'Selecione os produtos desta venda'}
                </p>
              </div>
              <button
                onClick={() => setAddingProd(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition"
                style={{
                  borderColor: theme.primary + '40',
                  color: theme.primary,
                  background: theme.primary + '10',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Novo produto
              </button>
            </div>

            {addingProd && (
              <div className="flex gap-2">
                <input
                  value={newProd}
                  onChange={e => setNewProd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddProd()}
                  placeholder="Nome do produto..."
                  className={inp + ' flex-1'}
                  autoFocus
                />
                <button
                  onClick={handleAddProd}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: theme.primary }}
                >
                  OK
                </button>
                <button
                  onClick={() => { setAddingProd(false); setNewProd('') }}
                  className="px-3 py-2.5 rounded-xl text-sm border border-[#E6E0F0] text-[#7B7390]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="space-y-2">
              {produtos.map(nome => {
                const sel = form.produtos.find(p => p.nome === nome)
                return (
                  <div
                    key={nome}
                    className="border rounded-xl overflow-hidden transition-all"
                    style={{ borderColor: sel ? theme.primary : '#E6E0F0' }}
                  >
                    <button
                      onClick={() => toggleProd(nome)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F6F3FA] transition"
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                        style={
                          sel
                            ? { background: theme.primary }
                            : { background: '#fff', border: '2px solid #E6E0F0' }
                        }
                      >
                        {sel && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-[#16101F]">{nome}</span>
                    </button>
                    {sel && (
                      <div className="px-4 pb-3">
                        <input
                          value={sel.obs}
                          onChange={e => setProdObs(nome, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          placeholder="Obs: cor, tamanho, modelo..."
                          className={inp}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <Btn outline onClick={() => setStep(0)}>
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Btn>
              <Btn primary theme={theme} onClick={() => setStep(2)}>
                Próximo — Pagamento
                <ChevronRight className="w-4 h-4" />
              </Btn>
            </div>
          </div>
        )}

        {/* ── Step 2: Pagamento ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <p className="text-[#16101F] font-semibold text-base mb-0.5">Pagamento</p>
              <p className="text-[#7B7390] text-sm">Valor e forma de pagamento</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Valor (R$)" Icon={CreditCard}>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#7B7390]">R$</span>
                  <input
                    value={form.valor}
                    onChange={e => setForm({ ...form, valor: e.target.value })}
                    placeholder="0,00"
                    className={inp + ' pl-9 text-lg font-semibold'}
                    autoFocus
                  />
                </div>
              </Field>
              <Field label="Forma de Pagamento" Icon={ShoppingBag}>
                <div className="flex gap-2 flex-wrap">
                  {PGTOS.map(p => (
                    <button
                      key={p}
                      onClick={() => setForm({ ...form, pgto: p })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition"
                      style={
                        form.pgto === p
                          ? { background: theme.primary, color: '#fff', borderColor: theme.primary }
                          : { background: '#F6F3FA', color: '#7B7390', borderColor: '#E6E0F0' }
                      }
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="Observações">
              <input
                value={form.obs}
                onChange={e => setForm({ ...form, obs: e.target.value })}
                placeholder="Anotações sobre esta venda..."
                className={inp}
              />
            </Field>

            {form.produtos.length > 0 && (
              <div className="bg-[#F6F3FA] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#7B7390] uppercase tracking-wider mb-2">Resumo dos produtos</p>
                <div className="flex flex-wrap gap-1.5">
                  {form.produtos.map(p => (
                    <span
                      key={p.nome}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white border border-[#E6E0F0] text-[#16101F]"
                    >
                      {p.nome}{p.obs ? ` — ${p.obs}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Btn outline onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Btn>
              <button
                disabled={saving || !form.valor}
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white ml-auto transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: theme.accent }}
              >
                {saving ? 'Salvando...' : 'Confirmar Venda'}
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, Icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-[#7B7390] uppercase tracking-wider mb-2">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </label>
      {children}
    </div>
  )
}

function Btn({ primary, outline, theme, onClick, children, disabled }) {
  const base = 'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition'
  if (primary) return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={base + ' text-white ml-auto hover:opacity-90 disabled:opacity-50'}
      style={{ background: theme.primary }}
    >
      {children}
    </button>
  )
  if (outline) return (
    <button
      onClick={onClick}
      className={base + ' border border-[#E6E0F0] text-[#7B7390] hover:bg-[#F6F3FA]'}
    >
      {children}
    </button>
  )
  return null
}

const inp =
  'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] focus:ring-1 focus:ring-[#5E2BD0]/15 transition'
