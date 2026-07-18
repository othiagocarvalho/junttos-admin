import { X, MessageCircle, Printer } from 'lucide-react'
import { parsePgtosRecibo, numeracaoRecibo, formatarReciboTexto } from '../utils/recibo'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtDT(s) {
  const d = new Date(s)
  return d.toLocaleDateString('pt-BR') + ' · ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ReciboVenda({ venda, vendas = [], theme, onFechar }) {
  const nomeFantasia = theme?.nome || 'Loja'
  const isTroca = venda.tipo_venda === 'troca'
  const pgtos = parsePgtosRecibo(venda)
  const allVendas = vendas.some(v => v.id === venda.id) ? vendas : [...vendas, venda]
  const numero = numeracaoRecibo(allVendas, venda.id)

  function handleWhatsApp() {
    const texto = formatarReciboTexto(venda, nomeFantasia, numero)
    const tel = (venda.cliente_tel || '').replace(/\D/g, '')
    const url = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleImprimir() {
    const pgtoHTML = pgtos
      .map(p => `<div class="row"><span>${p.forma}</span><span>${fmtR(p.valor)}</span></div>`)
      .join('')
    const prodHTML = (venda.produtos || [])
      .map(p => {
        const qtd = p.quantidade || 1
        const nome = p.variacao ? `${p.nome} (${p.variacao})` : p.nome
        return `<div>${qtd}x ${nome}</div>`
      })
      .join('')
    const numStr = numero ? `<div class="center">N° ${String(numero).padStart(4, '0')}</div>` : ''
    const clienteHTML = venda.cliente_nome
      ? `<div class="row"><span>Cliente:</span><span>${venda.cliente_nome}</span></div>`
      : ''
    const vendedoraHTML = venda.vendedora
      ? `<div class="row"><span>Vendedor(a):</span><span>${venda.vendedora}</span></div>`
      : ''
    const sepPessoa = (venda.cliente_nome || venda.vendedora) ? '<hr class="sep">' : ''
    const obsHTML = venda.obs
      ? `<div class="row" style="margin-top:5px"><span>Obs:</span><span>${venda.obs}</span></div>`
      : ''

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
@page{size:80mm auto;margin:4mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;font-size:11px;color:#000;width:72mm}
.center{text-align:center;margin-bottom:2px}
.title{font-size:14px;font-weight:bold}
.sep{border:none;border-top:1px dashed #000;margin:5px 0}
.row{display:flex;justify-content:space-between;margin:2px 0}
.total{display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin:4px 0}
.small{font-size:9px;text-align:center;margin-top:8px;color:#555}
</style></head><body>
<div class="center title">${nomeFantasia}</div>
<div class="center">${isTroca ? 'RECIBO DE TROCA' : 'RECIBO DE VENDA'}</div>
${numStr}
<div class="center">${fmtDT(venda.data)}</div>
<hr class="sep">
${clienteHTML}
${vendedoraHTML}
${sepPessoa}
${prodHTML}
<hr class="sep">
<div class="total"><span>TOTAL</span><span>${fmtR(venda.valor)}</span></div>
<hr class="sep">
${pgtoHTML}
${obsHTML}
<div class="small">Documento sem valor fiscal</div>
</body></html>`

    const w = window.open('', '_blank', 'width=340,height=500')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
  }

  return (
    <div
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isTroca ? 'Recibo de Troca' : 'Recibo de Venda'}
              {numero && (
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
                  #{String(numero).padStart(4, '0')}
                </span>
              )}
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmtDT(venda.data)}</p>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Receipt preview */}
        <div style={{ padding: '16px 20px', fontFamily: "'Courier New', Courier, monospace", fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--line)', maxHeight: 360, overflowY: 'auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {nomeFantasia}
          </p>

          {(venda.cliente_nome || venda.vendedora) && (
            <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed var(--line)' }}>
              {venda.cliente_nome && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>Cliente</span>
                  <span style={{ fontWeight: 600 }}>{venda.cliente_nome}</span>
                </div>
              )}
              {venda.vendedora && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>Vendedor(a)</span>
                  <span style={{ fontWeight: 600 }}>{venda.vendedora}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            {(venda.produtos || []).map((p, i) => {
              const qtd = p.quantidade || 1
              const nome = p.variacao ? `${p.nome} (${p.variacao})` : p.nome
              return (
                <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>
                  {qtd}x {nome}
                </div>
              )
            })}
          </div>

          <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
              <span>TOTAL</span>
              <span style={{ fontFamily: "'Space Mono', monospace", color: theme?.primary }}>{fmtR(venda.valor)}</span>
            </div>
          </div>

          <div style={{ marginBottom: venda.obs ? 8 : 0 }}>
            {pgtos.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 1 }}>
                <span>{p.forma}</span>
                <span>{fmtR(p.valor)}</span>
              </div>
            ))}
          </div>

          {venda.obs && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
              Obs: {venda.obs}
            </div>
          )}

          <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px dashed var(--line)', textAlign: 'center', fontSize: 10, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Documento sem valor fiscal
          </div>
        </div>

        {/* Buttons */}
        <div style={{ padding: '14px 20px', display: 'flex', gap: 10 }}>
          <button
            onClick={handleWhatsApp}
            style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: '#25D366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}
          >
            <MessageCircle size={15} />
            WhatsApp
          </button>
          <button
            onClick={handleImprimir}
            style={{ flex: 1, height: 44, borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}
          >
            <Printer size={15} />
            Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  )
}
