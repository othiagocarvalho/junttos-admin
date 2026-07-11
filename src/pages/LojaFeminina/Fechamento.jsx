import { useState, useEffect } from 'react'
import { Wallet, History, Trash2, Info } from 'lucide-react'
import Card, { HeroCard } from '../../components/studio/Card'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtDate(s) { return new Date(String(s).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') }
// Retorna "YYYY-MM-DD" no fuso local do navegador (evita deslocamento UTC)
function toLocalISO(d = new Date()) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

// Parses forma_pgto JSON string from a venda
function parsePgtos(raw) {
  try {
    const arr = JSON.parse(raw || '[]')
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

const EMPTY = {
  dinheiro: '', pix: '', pix_santander: '', pix_bb: '',
  debito: '', credito: '',
  saldo_ini: '', sangria: '', suprimento: '',
  valor_contado: '',
  despesas: '', obs: '',
}

function CurrField({ k, label, form, setForm }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', pointerEvents: 'none', zIndex: 1 }}>R$</span>
        <Input
          type="number" value={form[k]} step="0.01" min="0"
          onChange={e => setForm({ ...form, [k]: e.target.value })}
          placeholder="0,00"
          mono
          style={{ paddingLeft: 34 }}
        />
      </div>
    </div>
  )
}

export default function Fechamento({ caixas, fecharCaixa, deleteCaixa, features, vendas = [] }) {
  const hoje = toLocalISO()
  const [dataSelecionada, setDataSelecionada] = useState(hoje)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [modalDivergencia, setModalDivergencia] = useState(false)
  const [caixaParaExcluir, setCaixaParaExcluir] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)

  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'Escape') return
      if (caixaParaExcluir && !deleting) handleDeleteCancel()
      else if (modalDivergencia) setModalDivergencia(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [caixaParaExcluir, modalDivergencia, deleting])

  // Auto-fill payment fields by summing registered sales for the selected date
  useEffect(() => {
    const doDia = vendas.filter(v => {
      try { return toLocalISO(new Date(v.data)) === dataSelecionada }
      catch { return false }
    })

    const tot = { dinheiro: 0, pix: 0, pix_santander: 0, pix_bb: 0, debito: 0, credito: 0 }
    doDia.forEach(v => {
      parsePgtos(v.forma_pgto).forEach(p => {
        const val = Number(p.valor || 0)
        if (p.forma === 'Dinheiro') tot.dinheiro += val
        else if (p.forma === 'Pix') tot.pix += val
        else if (p.forma === 'PIX Santander') tot.pix_santander += val
        else if (p.forma === 'PIX Banco do Brasil') tot.pix_bb += val
        else if (p.forma === 'Cartão de Crédito') tot.credito += val
        else if (p.forma === 'Cartão de Débito') tot.debito += val
      })
    })

    setAutoFilled(doDia.length > 0)
    setForm(prev => ({
      ...prev,
      dinheiro:      tot.dinheiro      > 0 ? tot.dinheiro.toFixed(2)      : '',
      pix:           tot.pix           > 0 ? tot.pix.toFixed(2)           : '',
      pix_santander: tot.pix_santander > 0 ? tot.pix_santander.toFixed(2) : '',
      pix_bb:        tot.pix_bb        > 0 ? tot.pix_bb.toFixed(2)        : '',
      debito:        tot.debito        > 0 ? tot.debito.toFixed(2)        : '',
      credito:       tot.credito       > 0 ? tot.credito.toFixed(2)       : '',
    }))
  }, [dataSelecionada, vendas])

  const n = k => parseFloat(form[k] || 0) || 0
  const totalVendas = features?.atacado
    ? n('dinheiro') + n('pix_santander') + n('pix_bb') + n('debito') + n('credito')
    : n('dinheiro') + n('pix') + n('debito') + n('credito')
  const saldoFinal = n('saldo_ini') + n('dinheiro') - n('sangria') + n('suprimento')
  const liquido = totalVendas - n('despesas')

  // Cash count verification
  const dinheiroEsperado = n('dinheiro') - n('sangria') + n('suprimento')
  const hasValorContado = form.valor_contado !== ''
  const diferenca = hasValorContado ? n('valor_contado') - dinheiroEsperado : null
  const temDivergenciaCaixa = diferenca !== null && Math.abs(diferenca) >= 0.01

  // Total real de vendas do sistema para a data escolhida (usado na validação de divergência)
  const vendasDoDia = vendas.filter(v => {
    try { return toLocalISO(new Date(v.data)) === dataSelecionada }
    catch { return false }
  })
  const totalVendasSistema = vendasDoDia.reduce((s, v) => s + Number(v.valor || 0), 0)
  const divergencia = Math.abs(totalVendas - totalVendasSistema)

  // Bloqueio de data duplicada
  const jaDuplicado = caixas.some(c => c.data === dataSelecionada)
  const canSave = !saving && !done && !jaDuplicado && totalVendas > 0

  async function salvarFechamento() {
    setSaving(true)
    const err = await fecharCaixa({
      data: dataSelecionada,
      dinheiro: n('dinheiro'),
      pix: features?.atacado ? n('pix_santander') + n('pix_bb') : n('pix'),
      ...(features?.atacado ? { pix_santander: n('pix_santander'), pix_bb: n('pix_bb') } : {}),
      debito: n('debito'), credito: n('credito'),
      saldo_ini: n('saldo_ini'), sangria: n('sangria'),
      suprimento: n('suprimento'),
      valor_contado: hasValorContado ? n('valor_contado') : null,
      diferenca: hasValorContado ? diferenca : null,
      despesas: n('despesas'), obs: form.obs || null,
      total: totalVendas,
    })
    setSaving(false)
    if (!err) {
      setModalDivergencia(false)
      setDone(true)
      setTimeout(() => { setDone(false); setForm(EMPTY) }, 2200)
    }
  }

  function handleDeleteRequest(c) {
    setDeleteError('')
    setCaixaParaExcluir(c)
  }

  function handleDeleteCancel() {
    if (deleting) return
    setCaixaParaExcluir(null)
    setDeleteError('')
  }

  async function handleDeleteConfirm() {
    setDeleting(true)
    setDeleteError('')
    const err = await deleteCaixa(caixaParaExcluir.id)
    setDeleting(false)
    if (err) {
      setDeleteError(err.message || 'Erro ao excluir. Tente novamente.')
    } else {
      setCaixaParaExcluir(null)
    }
  }

  async function handleSave() {
    if (!canSave) return
    // Se há vendas registradas no sistema para essa data e o total diverge, exibe aviso
    if (vendasDoDia.length > 0 && divergencia >= 0.01) {
      setModalDivergencia(true)
      return
    }
    await salvarFechamento()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Seletor de data + avisos */}
      <Card>
        <div style={{ marginBottom: jaDuplicado ? 16 : 0 }}>
          <Label>Data do Fechamento</Label>
          <Input
            type="date"
            value={dataSelecionada}
            onChange={e => setDataSelecionada(e.target.value)}
            style={{ fontWeight: 600 }}
          />
          {dataSelecionada !== hoje && (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--primary)', marginTop: 8, fontWeight: 600 }}>
              Fechamento retroativo — {fmtDate(dataSelecionada)}
            </p>
          )}
        </div>

        {/* Aviso de duplicidade (bloqueio real) */}
        {jaDuplicado && (
          <div style={{ background: 'color-mix(in srgb, var(--negative) 10%, white)', border: '1px solid color-mix(in srgb, var(--negative) 35%, white)', borderRadius: 'var(--r-input)', padding: '12px 14px' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--negative)', lineHeight: 1.5 }}>
              Já existe um fechamento registrado para {fmtDate(dataSelecionada)}. Não é possível fechar a mesma data duas vezes.
            </p>
          </div>
        )}
      </Card>

      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Valores do Caixa — {fmtDate(dataSelecionada)}
      </p>

      {/* Recebimentos — pré-preenchidos automaticamente */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>Recebimentos</p>
          {autoFilled && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
              color: 'var(--primary)',
              background: 'color-mix(in srgb, var(--primary) 10%, white)',
              padding: '3px 9px', borderRadius: 99,
            }}>
              <Info size={10} /> Pré-preenchido pelo sistema
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <CurrField k="dinheiro" label="Dinheiro" form={form} setForm={setForm} />
          {features?.atacado ? (
            <>
              <CurrField k="pix_santander" label="PIX Santander" form={form} setForm={setForm} />
              <CurrField k="pix_bb" label="PIX Banco do Brasil" form={form} setForm={setForm} />
            </>
          ) : (
            <CurrField k="pix" label="Pix" form={form} setForm={setForm} />
          )}
          <CurrField k="debito" label="Débito" form={form} setForm={setForm} />
          <CurrField k="credito" label="Crédito" form={form} setForm={setForm} />
        </div>
      </Card>

      {/* Caixa — saldo inicial + ajustes */}
      <Card>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Caixa</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CurrField k="saldo_ini" label="Saldo Inicial" form={form} setForm={setForm} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CurrField k="sangria" label="Sangria" form={form} setForm={setForm} />
            <CurrField k="suprimento" label="Suprimento" form={form} setForm={setForm} />
          </div>
        </div>
      </Card>

      {/* Conferência de Caixa */}
      <Card>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
          Conferência de Caixa
        </p>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.55 }}>
          Dinheiro esperado em caixa:{' '}
          <strong style={{ color: 'var(--ink)', fontFamily: "'Space Mono', monospace", fontSize: 13 }}>
            {fmtR(dinheiroEsperado)}
          </strong>
          {' '}(vendas − sangria + suprimento)
        </p>
        <CurrField k="valor_contado" label="Valor Físico Contado" form={form} setForm={setForm} />

        {hasValorContado && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 'var(--r-input)',
            background: temDivergenciaCaixa
              ? 'color-mix(in srgb, var(--negative) 10%, white)'
              : 'color-mix(in srgb, var(--positive) 10%, white)',
            border: `1px solid color-mix(in srgb, ${temDivergenciaCaixa ? 'var(--negative)' : 'var(--positive)'} 30%, white)`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700,
                color: temDivergenciaCaixa ? 'var(--negative)' : 'var(--positive)',
              }}>
                {temDivergenciaCaixa
                  ? (diferenca > 0 ? 'Sobra no caixa' : 'Falta no caixa')
                  : 'Caixa conferido ✓'}
              </p>
              {temDivergenciaCaixa && (
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--negative)' }}>
                  {diferenca > 0 ? '+' : ''}{fmtR(diferenca)}
                </p>
              )}
            </div>
            {temDivergenciaCaixa && (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Divergência informativa — o fechamento pode ser confirmado normalmente.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Despesas */}
      <Card>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Despesas</p>
        <CurrField k="despesas" label="Despesas do Dia" form={form} setForm={setForm} />
      </Card>

      {/* Observações */}
      <Card>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Observações</p>
        <Input
          value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })}
          placeholder="Ocorrências, trocas, anotações..."
        />
      </Card>

      {/* Hero total */}
      <HeroCard tone="primary" style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
          Total de Vendas
        </p>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 38, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
          {fmtR(totalVendas)}
        </p>
      </HeroCard>

      {/* Resumo de fechamento */}
      <HeroCard tone="dark">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Saldo Final em Caixa</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#fff' }}>{fmtR(saldoFinal)}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Resultado Líquido</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: liquido >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{fmtR(liquido)}</p>
          </div>
        </div>
      </HeroCard>

      <Button
        variant="primary" fullWidth
        onClick={handleSave} disabled={!canSave}
        style={{ height: 50, borderRadius: 'var(--r-pill)', ...(done ? { background: 'var(--positive)' } : {}) }}
      >
        {done ? '✓ Caixa fechado!' : saving ? 'Salvando...' : jaDuplicado ? 'Data já fechada' : 'Fechar Caixa'}
      </Button>

      {/* Histórico — ordenado por data de referência (c.data), garantido pelo useLojaData */}
      <Card>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={16} color="var(--primary)" /> Histórico de Fechamentos
        </p>
        {caixas.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum fechamento registrado"
            subtitle="Os fechamentos de caixa salvos aparecerão aqui."
          />
        ) : (
          <div>
            {caixas.slice(0, 10).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--line)', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{fmtDate(c.data)}</p>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                    Din. {fmtR(c.dinheiro)} · Pix {fmtR(c.pix)} · Déb. {fmtR(c.debito)} · Créd. {fmtR(c.credito)}
                  </p>
                  {c.diferenca != null && Math.abs(c.diferenca) >= 0.01 && (
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--negative)', marginTop: 2, fontWeight: 600 }}>
                      {c.diferenca > 0 ? 'Sobra' : 'Falta'}: {fmtR(Math.abs(c.diferenca))}
                    </p>
                  )}
                  {c.obs && <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 3, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{c.obs}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 4 }}>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{fmtR(c.total)}</p>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: 'var(--muted)' }}>desp. {fmtR(c.despesas)}</p>
                  <button
                    onClick={() => handleDeleteRequest(c)}
                    title="Excluir fechamento"
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'var(--status-bad-tx)', padding: '2px 4px', borderRadius: 6,
                      display: 'flex', alignItems: 'center', opacity: 0.65,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal de confirmação de exclusão */}
      {caixaParaExcluir && (
        <div onClick={() => !deleting && handleDeleteCancel()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 14 }}>
              Excluir fechamento?
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 22 }}>
              O fechamento de <strong style={{ color: 'var(--ink)' }}>{fmtDate(caixaParaExcluir.data)}</strong> ({fmtR(caixaParaExcluir.total)}) será removido permanentemente. Esta ação não pode ser desfeita.
            </p>
            {deleteError && (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--status-bad-tx)', marginBottom: 14, background: 'var(--status-bad-bg)', borderRadius: 'var(--r-input)', padding: '8px 12px' }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                style={{
                  flex: 1, height: 46, borderRadius: 'var(--r-input)',
                  border: '1.5px solid var(--line)', background: 'var(--bg)',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600,
                  color: 'var(--ink)', fontSize: 13,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                style={{
                  flex: 1, height: 46, borderRadius: 'var(--r-input)',
                  border: 'none',
                  background: deleting ? 'var(--line)' : 'var(--status-bad-tx)',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
                  color: deleting ? 'var(--muted)' : '#fff', fontSize: 13,
                }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de divergência de valores (aviso, não bloqueio) */}
      {modalDivergencia && (
        <div onClick={() => setModalDivergencia(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 14 }}>
              Atenção — Valores divergentes
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 8 }}>
              O valor informado no fechamento é <strong style={{ color: 'var(--ink)' }}>{fmtR(totalVendas)}</strong>, mas o total de vendas registradas no sistema para {fmtDate(dataSelecionada)} é <strong style={{ color: 'var(--ink)' }}>{fmtR(totalVendasSistema)}</strong>.
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>
              Diferença: <strong style={{ color: 'var(--negative)' }}>{fmtR(divergencia)}</strong>. Deseja continuar mesmo assim?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                variant="secondary" fullWidth
                onClick={() => setModalDivergencia(false)}
                disabled={saving}
                style={{ height: 46 }}
              >
                Revisar valores
              </Button>
              <Button
                variant="primary" fullWidth
                onClick={salvarFechamento}
                disabled={saving}
                style={{ height: 46 }}
              >
                {saving ? 'Salvando...' : 'Continuar mesmo assim'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
