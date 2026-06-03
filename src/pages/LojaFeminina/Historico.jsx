import { useState } from 'react'
import { Trash2, Search, Tag, Calendar, User } from 'lucide-react'
import Modal from '../../components/Modal'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtDate(s) {
  return new Date(s).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Historico({ vendas, deleteVenda, theme }) {
  const [search, setSearch] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)

  const filtered = vendas.filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (v.cliente_nome || '').toLowerCase().includes(q) ||
      (v.vendedora || '').toLowerCase().includes(q) ||
      (v.forma_pgto || '').toLowerCase().includes(q)
    )
  })

  async function handleDelete() {
    await deleteVenda(confirmDel.id)
    setConfirmDel(null)
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7B7390]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente, vendedora ou pagamento..."
          className="w-full bg-white border border-[#E6E0F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] transition"
        />
      </div>

      <p className="text-sm text-[#7B7390]">
        <span className="font-semibold text-[#16101F]">{filtered.length}</span> vendas
      </p>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E6E0F0] rounded-2xl p-16 flex flex-col items-center gap-3">
          <Tag className="w-8 h-8 text-[#E6E0F0]" />
          <p className="text-[#7B7390] text-sm">Nenhuma venda registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(v => (
            <div key={v.id} className="bg-white border border-[#E6E0F0] rounded-2xl p-5 group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#7B7390]" />
                      <span className="text-[#16101F] font-semibold text-sm">
                        {v.cliente_nome || 'Cliente não identificado'}
                      </span>
                    </div>
                    {v.forma_pgto && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#F6F3FA] text-[#7B7390] border border-[#E6E0F0]">
                        {v.forma_pgto}
                      </span>
                    )}
                    {v.vendedora && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full border"
                        style={{
                          background: theme.primary + '15',
                          color: theme.primary,
                          borderColor: theme.primary + '30',
                        }}
                      >
                        {v.vendedora}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#7B7390] mb-2">
                    <Calendar className="w-3 h-3" />
                    <span>{fmtDate(v.data)}</span>
                    {v.cliente_tel && <span>· {v.cliente_tel}</span>}
                  </div>

                  {v.produtos && v.produtos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {v.produtos.map((p, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-lg bg-[#F6F3FA] border border-[#E6E0F0] text-[#16101F]"
                        >
                          {p.nome}{p.obs ? ` — ${p.obs}` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {v.obs && <p className="text-xs text-[#7B7390] mt-2 italic">{v.obs}</p>}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="text-lg font-bold" style={{ color: theme.primary }}>
                    {fmtR(v.valor)}
                  </span>
                  <button
                    onClick={() => setConfirmDel(v)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-[#7B7390] hover:text-red-400 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Excluir venda" size="sm">
        <p className="text-sm text-[#16101F] mb-5">
          Excluir a venda de{' '}
          <span className="font-semibold">{fmtR(confirmDel?.valor || 0)}</span>?
          Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmDel(null)}
            className="flex-1 bg-[#E6E0F0] hover:bg-[#ddd8ec] text-[#16101F] text-sm font-semibold py-2.5 rounded-xl transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2.5 rounded-xl transition"
          >
            Excluir
          </button>
        </div>
      </Modal>
    </div>
  )
}
