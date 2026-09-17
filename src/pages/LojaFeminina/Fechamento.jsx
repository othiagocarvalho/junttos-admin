import { useState, useEffect } from 'react'
import { Wallet, History, Trash2, Info, CheckCircle2 } from 'lucide-react'
import Card, { HeroCard } from '../../components/studio/Card'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'
import { fmtR } from '../../utils/formatters'

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
  dinheiro: '', pix: '',
  debito: '', credito: '',
  saldo_ini: '', sangria: '', suprimento: '',
  valor_contado: '',
  despesas: '', obs: '',
}

/**
 * Deriva o modo de exibição da tela a partir da data escolhida — pura, sem
 * estado, para poder testar sem DOM (ver Fechamento.test.js).
 *
 * `modoConsulta`: fechamento já salvo para a data + não é gerente → mostra o
 * detalhe completo do registro salvo, somente-leitura.
 * `semFechamentoRetroativo`: data passada (nunca hoje) sem nenhum registro +
 * não é gerente → mostra o aviso de que os valores abaixo são estimativa.
 * Gerente nunca ativa nenhum dos dois (ver item 5 do pedido): mantém sempre o
 * aviso de bloqueio simples de antes desta feature.
 */
export function derivarModoFechamento(caixas, dataSelecionada, hoje, gerente) {
  const fechamentoSalvo = (caixas || []).find(c => c.data === dataSelecionada) || null
  const jaDuplicado = !!fechamentoSalvo
  const modoConsulta = jaDuplicado && !gerente
  const semFechamentoRetroativo = !jaDuplicado && dataSelecionada !== hoje && !gerente
  return { fechamentoSalvo, jaDuplicado, modoConsulta, semFechamentoRetroativo }
}

/**
 * Valores REAIS de um fechamento já salvo, no mesmo formato que os campos do
 * formulário esperam — nunca deriva de `vendas`/auto-fill. Recebe só o
 * registro de `lf_caixas`, então é estruturalmente impossível misturar com a
 * estimativa (a função nem tem acesso a `vendas`).
 */
export function valoresDoFechamentoSalvo(fechamentoSalvo) {
  if (!fechamentoSalvo) return null
  return {
    dinheiro: Number(fechamentoSalvo.dinheiro) || 0,
    pix: Number(fechamentoSalvo.pix) || 0,
    debito: Number(fechamentoSalvo.debito) || 0,
    credito: Number(fechamentoSalvo.credito) || 0,
    saldo_ini: Number(fechamentoSalvo.saldo_ini) || 0,
    sangria: Number(fechamentoSalvo.sangria) || 0,
    suprimento: Number(fechamentoSalvo.suprimento) || 0,
    valor_contado: fechamentoSalvo.valor_contado != null ? Number(fechamentoSalvo.valor_contado) : '',
    despesas: Number(fechamentoSalvo.despesas) || 0,
  }
}

// `readOnly` + `valores`: modo consulta (fechamento já salvo) exibe o valor
// REAL do registro, não o `form` — que é só rascunho de um fechamento novo.
function CurrField({ k, label, form, setForm, readOnly = false, valores }) {
  const value = readOnly ? (valores?.[k] ?? '') : form[k]
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', pointerEvents: 'none', zIndex: 1 }}>R$</span>
        <Input
          type="number" value={value} step="0.01" min="0"
          onChange={e => !readOnly && setForm({ ...form, [k]: e.target.value })}
          placeholder="0,00"
          mono
          readOnly={readOnly}
          disabled={readOnly}
          style={{ paddingLeft: 34, ...(readOnly ? { opacity: 0.75, cursor: 'default' } : {}) }}
        />
      </div>
    </div>
  )
}

export default function Fechamento({ caixas, fecharCaixa, deleteCaixa, vendas = [], gerente = false }) {
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

    const tot = { dinheiro: 0, pix: 0, debito: 0, credito: 0 }
    doDia.forEach(v => {
      parsePgtos(v.forma_pgto).forEach(p => {
        const val = Number(p.valor || 0)
        if (p.forma === 'Dinheiro') tot.dinheiro += val
        // Vendas antigas do modo atacado gravaram o Pix separado por banco;
        // aqui tudo volta a somar num Pix só.
        else if (p.forma === 'Pix' || p.forma === 'PIX Santander' || p.forma === 'PIX Banco do Brasil') tot.pix += val
        else if (p.forma === 'Cartão de Crédito') tot.credito += val
        else if (p.forma === 'Cartão de Débito') tot.debito += val
      })
    })

    setAutoFilled(doDia.length > 0)
    setForm(prev => ({
      ...prev,
      dinheiro: tot.dinheiro > 0 ? tot.dinheiro.toFixed(2) : '',
      pix:      tot.pix      > 0 ? tot.pix.toFixed(2)      : '',
      debito:   tot.debito   > 0 ? tot.debito.toFixed(2)   : '',
      credito:  tot.credito  > 0 ? tot.credito.toFixed(2)  : '',
    }))
  }, [dataSelecionada, vendas])

  // Fechamento já salvo para a data escolhida, e o modo de exibição derivado
  // disso — ver derivarModoFechamento() acima (função pura, testada em
  // Fechamento.test.js sem precisar de DOM).
  const { fechamentoSalvo, jaDuplicado, modoConsulta, semFechamentoRetroativo } =
    derivarModoFechamento(caixas, dataSelecionada, hoje, gerente)
  const valoresSalvos = valoresDoFechamentoSalvo(fechamentoSalvo)

  // Em modo consulta, todo cálculo abaixo lê do registro SALVO em vez do
  // `form` (que é só rascunho de fechamento novo) — sem duplicar as fórmulas
  // de totalVendas/saldoFinal/dinheiroEsperado/diferença, que continuam
  // exatamente as mesmas dos dois lados.
  const n = k => {
    if (modoConsulta) return Number(valoresSalvos[k]) || 0
    return parseFloat(form[k] || 0) || 0
  }
  const totalVendas = n('dinheiro') + n('pix') + n('debito') + n('credito')
  const saldoFinal = n('saldo_ini') + n('dinheiro') - n('sangria') + n('suprimento')
  const liquido = totalVendas - n('despesas')

  // Cash count verification
  const dinheiroEsperado = n('dinheiro') - n('sangria') + n('suprimento')
  const hasValorContado = modoConsulta ? fechamentoSalvo.valor_contado != null : form.valor_contado !== ''
  const diferenca = hasValorContado ? n('valor_contado') - dinheiroEsperado : null
  const temDivergenciaCaixa = diferenca !== null && Math.abs(diferenca) >= 0.01

  // Total real de vendas do sistema para a data escolhida (usado na validação de divergência
  // e no aviso de estimativa quando não há fechamento salvo)
  const vendasDoDia = vendas.filter(v => {
    try { return toLocalISO(new Date(v.data)) === dataSelecionada }
    catch { return false }
  })
  const totalVendasSistema = vendasDoDia.reduce((s, v) => s + Number(v.valor || 0), 0)
  const divergencia = Math.abs(totalVendas - totalVendasSistema)

  const canSave = !saving && !done && !jaDuplicado && totalVendas > 0

  async function salvarFechamento() {
    setSaving(true)
    const err = await fecharCaixa({
      data: dataSelecionada,
      dinheiro: n('dinheiro'),
      pix: n('pix'),
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
        <div style={{ marginBottom: (jaDuplicado || semFechamentoRetroativo) ? 16 : 0 }}>
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

        {/* Modo consulta (dono): selo de fechamento salvo, no lugar do aviso de bloqueio */}
        {modoConsulta && (
          <div style={{ background: 'color-mix(in srgb, var(--positive) 10%, white)', border: '1px solid color-mix(in srgb, var(--positive) 35%, white)', borderRadius: 'var(--r-input)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} color="var(--positive)" style={{ flexShrink: 0 }} />
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--positive)' }}>
              Fechamento salvo — {fmtDate(dataSelecionada)}
            </p>
          </div>
        )}

        {/* Aviso de duplicidade — comportamento de sempre para gerente; para
            dono só aparece se, por algum motivo, o modo consulta não coube
            (defensivo — hoje os dois são sempre complementares). */}
        {jaDuplicado && !modoConsulta && (
          <div style={{ background: 'color-mix(in srgb, var(--negative) 10%, white)', border: '1px solid color-mix(in srgb, var(--negative) 35%, white)', borderRadius: 'var(--r-input)', padding: '12px 14px' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--negative)', lineHeight: 1.5 }}>
              Já existe um fechamento registrado para {fmtDate(dataSelecionada)}. Não é possível fechar a mesma data duas vezes.
            </p>
          </div>
        )}

        {/* Data passada sem fechamento salvo: os valores abaixo são estimativa
            a partir de lf_vendas, não um fechamento de verdade. */}
        {semFechamentoRetroativo && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 'var(--r-input)', padding: '12px 14px' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>
              ⚠️ Nenhum fechamento foi registrado neste dia
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
              Os valores de venda abaixo são uma estimativa a partir do histórico de vendas — saldo inicial, sangria, suprimento e conferência de caixa não foram informados.
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
          {autoFilled && !modoConsulta && (
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
          <CurrField k="dinheiro" label="Dinheiro" form={form} setForm={setForm} readOnly={modoConsulta} valores={valoresSalvos} />
          <CurrField k="pix" label="Pix" form={form} setForm={setForm} readOnly={modoConsulta} valores={valoresSalvos} />
          <CurrField k="debito" label="Débito" form={form} setForm={setForm} readOnly={modoConsulta} valores={valoresSalvos} />
          <CurrField k="credito" label="Crédito" form={form} setForm={setForm} readOnly={modoConsulta} valores={valoresSalvos} />
        </div>
      </Card>

      {/* Caixa — saldo inicial + ajustes */}
      <Card>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Caixa</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CurrField k="saldo_ini" label="Saldo Inicial" form={form} setForm={setForm} readOnly={modoConsulta} valores={valoresSalvos} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CurrField k="sangria" label="Sangria" form={form} setForm={setForm} readOnly={modoConsulta} valores={valoresSalvos} />
            <CurrField k="suprimento" label="Suprimento" form={form} setForm={setForm} readOnly={modoConsulta} valores={valoresSalvos} />
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
        <CurrField k="valor_contado" label="Valor Físico Contado" form={form} setForm={setForm} readOnly={modoConsulta} valores={valoresSalvos} />

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
                {modoConsulta
                  ? 'Divergência registrada neste fechamento.'
                  : 'Divergência informativa — o fechamento pode ser confirmado normalmente.'}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Despesas */}
      <Card>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Despesas</p>
        <CurrField k="despesas" label="Despesas do Dia" form={form} setForm={setForm} readOnly={modoConsulta} valores={valoresSalvos} />
      </Card>

      {/* Observações */}
      <Card>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Observações</p>
        <Input
          value={modoConsulta ? (fechamentoSalvo.obs || '') : form.obs}
          onChange={e => !modoConsulta && setForm({ ...form, obs: e.target.value })}
          placeholder="Ocorrências, trocas, anotações..."
          readOnly={modoConsulta}
          disabled={modoConsulta}
          style={modoConsulta ? { opacity: 0.75, cursor: 'default' } : undefined}
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
        {done ? '✓ Caixa fechado!' : saving ? 'Salvando...' : modoConsulta ? 'Este dia já foi fechado' : jaDuplicado ? 'Data já fechada' : 'Fechar Caixa'}
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
            {caixas.slice(0, 10).map(c => {
              // Clicar na linha seleciona a data no seletor do topo, ativando
              // o modo consulta — só para quem não é gerente (ver item 5).
              const clicavel = !gerente
              const selecionado = clicavel && c.data === dataSelecionada
              return (
              <div
                key={c.id}
                onClick={clicavel ? () => setDataSelecionada(c.data) : undefined}
                role={clicavel ? 'button' : undefined}
                tabIndex={clicavel ? 0 : undefined}
                onKeyDown={clicavel ? (e => { if (e.key === 'Enter') setDataSelecionada(c.data) }) : undefined}
                style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 0',
                  borderBottom: '1px solid var(--line)', gap: 12,
                  cursor: clicavel ? 'pointer' : 'default',
                  background: selecionado ? 'color-mix(in srgb, var(--primary) 6%, white)' : 'transparent',
                }}
              >
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
                    onClick={e => { e.stopPropagation(); handleDeleteRequest(c) }}
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
              )
            })}
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
