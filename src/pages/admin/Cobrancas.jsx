import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  AlertCircle, AlertTriangle, Loader2, CreditCard, Check, X, ChevronDown,
  Pencil, RotateCcw, History, Percent,
} from 'lucide-react'
import { T } from '../../theme/tokens'
import { fmtR } from '../../utils/formatters'
import {
  diaISO, statusEfetivo, totaisPorPeriodo, calcularMRR, isLojaAtiva,
  rotuloDesconto, aplicarDesconto, valorCheioMensalidade,
  TIPO_IMPLANTACAO, TIPO_MENSALIDADE,
} from '../../utils/cobrancas'
import { useGeracaoCobrancas } from '../../hooks/useGeracaoCobrancas'
import { registrarHistorico, autorDeUsuario, ACAO } from '../../lib/historicoCobranca'
import { useAuth } from '../../context/AuthContext'

function fmtDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

function getMonthOptions() {
  const opts = []
  const now = new Date()
  for (let i = -6; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    opts.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

function currentMonthVal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function inicioDoMes() {
  const d = new Date()
  return diaISO(new Date(d.getFullYear(), d.getMonth(), 1))
}
function fimDoMes() {
  const d = new Date()
  return diaISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

const STATUS_STYLE = {
  pago:     { bg: '#E6F6EE', color: '#1F8A5B', label: 'Pago' },
  pendente: { bg: '#FFF4E0', color: '#B7791F', label: 'Pendente' },
  atrasado: { bg: '#FEE8E8', color: '#C0392B', label: 'Atrasado' },
}

const TIPO_STYLE = {
  [TIPO_IMPLANTACAO]: { bg: T.tintLilac,  color: T.purpleText, label: 'Implantação' },
  [TIPO_MENSALIDADE]: { bg: T.mist,       color: T.muted,      label: 'Mensalidade' },
}

const inp = {
  width: '100%', height: 44, boxSizing: 'border-box',
  background: T.mist, border: `1.5px solid ${T.line}`,
  borderRadius: T.rInput, padding: '0 14px',
  fontFamily: T.ui, fontSize: 14, color: T.ink, outline: 'none',
}
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }
const btnBase = {
  height: 44, borderRadius: T.rInput, cursor: 'pointer',
  fontSize: 14, fontWeight: 700, fontFamily: T.ui,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}

function Avatar({ nome }) {
  const initials = (nome || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: T.iconGrad, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, color: T.white, letterSpacing: '0.02em',
    }}>{initials}</div>
  )
}

function Chip({ bg, color, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 9px',
      borderRadius: T.rPill, background: bg, color, fontSize: 11.5, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function Erro({ children }) {
  if (!children) return null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '10px 12px', marginTop: 14 }}>
      <AlertCircle size={13} color={T.coralText} style={{ flexShrink: 0, marginTop: 2 }} />
      <p style={{ fontSize: 12, color: T.coralText, lineHeight: 1.5 }}>{children}</p>
    </div>
  )
}

function ModalShell({ open, onClose, titulo, sub, children, maxWidth = 460 }) {
  useEffect(() => {
    if (!open) return
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', boxShadow: T.darkCardShadow, fontFamily: T.ui }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '22px 24px 0', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink }}>{titulo}</h2>
            {sub && <p style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{sub}</p>}
          </div>
          <button onClick={onClose} style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={15} color={T.muted} />
          </button>
        </div>
        <div style={{ padding: '18px 24px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Aviso de atraso na geração ───────────────────────────────────
// Decisão do Thiago: o atraso tem que ficar óbvio na tela, não escondido em
// log. Aparece quando existe cobrança que já deveria ter sido criada e não foi
// — ou seja, quando a checagem automática rodou e não conseguiu gravar.
function AvisoAtraso({ atrasadas, erro, nomeMap, rodando }) {
  if (rodando || (atrasadas.length === 0 && !erro)) return null
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: '#FEE8E8', border: '1px solid #C0392B44',
      borderRadius: T.rCard, padding: '16px 18px', marginBottom: 20,
    }}>
      <AlertTriangle size={17} color="#C0392B" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: '#C0392B', marginBottom: 4 }}>
          {atrasadas.length > 0
            ? `${atrasadas.length} ${atrasadas.length === 1 ? 'cobrança atrasada não foi gerada' : 'cobranças atrasadas não foram geradas'}`
            : 'A geração automática de cobranças falhou'}
        </p>
        {atrasadas.length > 0 && (
          <ul style={{ margin: '0 0 6px', paddingLeft: 18, fontSize: 12.5, color: '#C0392B', lineHeight: 1.7 }}>
            {atrasadas.map((a, i) => (
              <li key={`${a.loja_id}-${a.vencimento}-${i}`}>
                <strong>{nomeMap[a.loja_id] || a.loja_id}</strong> — {fmtR(a.valor)}, venceu em {fmtDate(a.vencimento)}
              </li>
            ))}
          </ul>
        )}
        {erro && <p style={{ fontSize: 12, color: '#C0392B', fontFamily: T.mono, wordBreak: 'break-word' }}>{erro}</p>}
      </div>
    </div>
  )
}

// ── Modal de uma cobrança: editar, pagar, desfazer, histórico ────
// Montado com key={cobranca.id} pelo pai: trocar de cobrança remonta o
// componente e o estado nasce dos props, sem efeito de sincronização.
function CobrancaModal({ cobranca, nome, historico, autor, onClose, onSalvo }) {
  const pago = cobranca.status === 'pago'

  const [vencimento, setVencimento]   = useState(cobranca.vencimento || '')
  const [valor, setValor]             = useState(String(cobranca.valor ?? ''))
  const [observacoes, setObservacoes] = useState(cobranca.observacoes || '')
  // Data de pagamento escolhível, com hoje só como sugestão: é o que permite
  // lançar retroativamente os pagamentos que aconteceram fora do sistema.
  const [dataPgto, setDataPgto]       = useState(cobranca.data_pagamento || diaISO(new Date()))
  const [saving, setSaving]           = useState(false)
  const [erro, setErro]               = useState('')
  const [verHistorico, setVerHistorico] = useState(false)

  const linhas = historico.filter(h => h.cobranca_id === cobranca.id)

  async function aplicar(patch, entradasHistorico) {
    setSaving(true); setErro('')
    try {
      const { error } = await supabase
        .from('jt_cobrancas')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', cobranca.id)
      if (error) throw new Error(error.message)
      await registrarHistorico(entradasHistorico, autor)
      await onSalvo()
      onClose()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function salvarEdicao() {
    const novoValor = parseFloat(String(valor).replace(',', '.'))
    if (!vencimento) { setErro('Informe a data de vencimento.'); return }
    if (!isFinite(novoValor) || novoValor < 0) { setErro('Valor inválido.'); return }

    const patch = {}
    const entradas = []
    const base = { cobranca_id: cobranca.id, loja_id: cobranca.loja_id }

    if (vencimento !== cobranca.vencimento) {
      patch.vencimento = vencimento
      entradas.push({ ...base, acao: ACAO.VENCIMENTO, campo: 'vencimento', valor_anterior: cobranca.vencimento, valor_novo: vencimento })
    }
    if (novoValor !== Number(cobranca.valor)) {
      patch.valor = novoValor
      entradas.push({ ...base, acao: ACAO.VALOR, campo: 'valor', valor_anterior: cobranca.valor, valor_novo: novoValor })
    }
    if ((observacoes || '') !== (cobranca.observacoes || '')) {
      patch.observacoes = observacoes || null
      entradas.push({ ...base, acao: ACAO.OBSERVACOES, campo: 'observacoes', valor_anterior: cobranca.observacoes, valor_novo: observacoes })
    }
    if (entradas.length === 0) { onClose(); return }
    await aplicar(patch, entradas)
  }

  async function marcarPago() {
    if (!dataPgto) { setErro('Informe a data em que o pagamento entrou.'); return }
    await aplicar(
      { status: 'pago', data_pagamento: dataPgto },
      [{
        cobranca_id: cobranca.id, loja_id: cobranca.loja_id,
        acao: ACAO.PAGO, campo: 'data_pagamento',
        valor_anterior: cobranca.data_pagamento, valor_novo: dataPgto,
      }],
    )
  }

  async function desfazerPagamento() {
    await aplicar(
      { status: 'pendente', data_pagamento: null },
      [{
        cobranca_id: cobranca.id, loja_id: cobranca.loja_id,
        acao: ACAO.PAGAMENTO_DESFEITO, campo: 'status',
        valor_anterior: `pago em ${cobranca.data_pagamento || '—'}`, valor_novo: 'pendente',
      }],
    )
  }

  const tipoSt = TIPO_STYLE[cobranca.tipo] || TIPO_STYLE[TIPO_MENSALIDADE]

  return (
    <ModalShell
      open
      onClose={onClose}
      titulo={nome}
      sub={`${tipoSt.label} · criada em ${fmtDate(String(cobranca.created_at || '').slice(0, 10))}`}
      maxWidth={520}
    >
      {pago ? (
        <>
          <div style={{ background: T.statusAtivoBg, border: `1px solid ${T.statusAtivoTx}33`, borderRadius: T.rInput, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.statusAtivoTx, marginBottom: 2 }}>
              Pago — {fmtR(cobranca.valor)}
            </p>
            <p style={{ fontSize: 12.5, color: T.statusAtivoTx }}>
              Recebido em {fmtDate(cobranca.data_pagamento)} · venceu em {fmtDate(cobranca.vencimento)}
            </p>
          </div>

          <label style={lbl}>Corrigir a data do pagamento</label>
          <input type="date" value={dataPgto} onChange={e => setDataPgto(e.target.value)} style={inp} />
          <button onClick={marcarPago} disabled={saving} style={{ ...btnBase, width: '100%', marginTop: 10, border: `1.5px solid ${T.line}`, background: T.mist, color: T.ink }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
            Salvar nova data
          </button>

          <div style={{ height: 1, background: T.line, margin: '18px 0' }} />

          <button onClick={desfazerPagamento} disabled={saving} style={{ ...btnBase, width: '100%', border: `1.5px solid ${T.coral}55`, background: T.tintCoral, color: T.coralText }}>
            <RotateCcw size={14} /> Desfazer pagamento
          </button>
          <p style={{ fontSize: 11.5, color: T.muted, marginTop: 7, lineHeight: 1.55 }}>
            A cobrança volta para pendente e a data de pagamento é apagada. Fica registrado no histórico.
          </p>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Vencimento</label>
              <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Valor (R$)</label>
              <input type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} style={inp} />
            </div>
          </div>

          {cobranca.valor_cheio != null && (
            <p style={{ fontSize: 11.5, color: T.muted, marginTop: -6, marginBottom: 14 }}>
              Valor cheio {fmtR(cobranca.valor_cheio)} — desconto da loja aplicado na geração.
            </p>
          )}

          <label style={lbl}>Observações</label>
          <input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional — ex: motivo do reajuste" style={inp} />

          <button onClick={salvarEdicao} disabled={saving} style={{ ...btnBase, width: '100%', marginTop: 14, border: 'none', background: T.purple, color: T.white }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Pencil size={14} />}
            Salvar alterações
          </button>

          <div style={{ height: 1, background: T.line, margin: '18px 0' }} />

          <label style={lbl}>Data em que o pagamento entrou</label>
          <input type="date" value={dataPgto} onChange={e => setDataPgto(e.target.value)} style={inp} />
          <p style={{ fontSize: 11.5, color: T.muted, margin: '6px 0 10px', lineHeight: 1.55 }}>
            Pode ser retroativa — use para lançar pagamentos que aconteceram fora do sistema.
          </p>
          <button onClick={marcarPago} disabled={saving} style={{ ...btnBase, width: '100%', border: 'none', background: T.statusAtivoTx, color: T.white }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
            Registrar pagamento
          </button>
        </>
      )}

      <Erro>{erro}</Erro>

      <button
        onClick={() => setVerHistorico(v => !v)}
        style={{ marginTop: 18, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: T.muted, fontFamily: T.ui }}
      >
        <History size={13} />
        Histórico ({linhas.length})
        <ChevronDown size={13} style={{ transform: verHistorico ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {verHistorico && (
        <div style={{ marginTop: 10, border: `1px solid ${T.line}`, borderRadius: T.rInput, overflow: 'hidden' }}>
          {linhas.length === 0 ? (
            <p style={{ padding: '12px 14px', fontSize: 12.5, color: T.muted }}>Nenhuma alteração registrada.</p>
          ) : linhas.map((h, i) => (
            <div key={h.id} style={{ padding: '10px 14px', borderBottom: i < linhas.length - 1 ? `1px solid ${T.line}` : 'none', background: i % 2 ? T.mist : T.white }}>
              <p style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>
                {h.acao}{h.campo ? ` · ${h.campo}` : ''}
              </p>
              {(h.valor_anterior || h.valor_novo) && (
                <p style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, wordBreak: 'break-word' }}>
                  {h.valor_anterior ?? '—'} → {h.valor_novo ?? '—'}
                </p>
              )}
              <p style={{ fontSize: 11, color: T.muted2, marginTop: 2 }}>
                {h.autor_nome || 'autor desconhecido'} · {new Date(h.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  )
}

// ── Modal de desconto permanente da loja ─────────────────────────
// Também montado com key pelo pai — mesmo motivo do CobrancaModal.
function DescontoModal({ loja, cobrancasDaLoja, autor, onClose, onSalvo }) {
  const [tipo, setTipo]     = useState(loja.desconto_tipo || '')
  const [valor, setValor]   = useState(loja.desconto_valor != null ? String(loja.desconto_valor) : '')
  const [motivo, setMotivo] = useState(loja.desconto_motivo || '')
  const [saving, setSaving] = useState(false)
  const [erro, setErro]     = useState('')

  const cheio = valorCheioMensalidade(loja, cobrancasDaLoja)
  const num = parseFloat(String(valor).replace(',', '.'))
  const previa = aplicarDesconto(cheio, tipo, isFinite(num) ? num : 0)

  async function salvar() {
    const temDesconto = !!tipo && isFinite(num) && num > 0
    if (tipo && (!isFinite(num) || num <= 0)) { setErro('Informe o valor do desconto.'); return }
    if (tipo === 'percentual' && num > 100) { setErro('Percentual não pode passar de 100.'); return }

    setSaving(true); setErro('')
    try {
      const patch = {
        desconto_tipo:   temDesconto ? tipo : null,
        desconto_valor:  temDesconto ? num : null,
        desconto_motivo: temDesconto ? (motivo || null) : null,
      }
      const { error } = await supabase.from('lf_config').update(patch).eq('loja_id', loja.loja_id)
      if (error) throw new Error(error.message)

      await registrarHistorico([{
        // Desconto é da loja, não de uma cobrança específica — por isso
        // cobranca_id fica nulo aqui.
        cobranca_id:    null,
        loja_id:        loja.loja_id,
        acao:           ACAO.DESCONTO,
        campo:          'desconto',
        valor_anterior: rotuloDesconto(loja.desconto_tipo, loja.desconto_valor) || 'sem desconto',
        valor_novo:     (rotuloDesconto(temDesconto ? tipo : null, num) || 'sem desconto') + (temDesconto && motivo ? ` — ${motivo}` : ''),
      }], autor)
      await onSalvo()
      onClose()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell open onClose={onClose} titulo={`Desconto — ${loja.nome}`} sub="Vale para toda mensalidade gerada daqui em diante.">
      <label style={lbl}>Tipo</label>
      <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
        <option value="">Sem desconto</option>
        <option value="percentual">Percentual (%)</option>
        <option value="fixo">Valor fixo (R$)</option>
      </select>

      {tipo && (
        <>
          <label style={{ ...lbl, marginTop: 14 }}>
            {tipo === 'percentual' ? 'Percentual de desconto' : 'Valor abatido por mês (R$)'}
          </label>
          <input type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} style={inp} />

          <label style={{ ...lbl, marginTop: 14 }}>Motivo</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: parceria de indicação" style={inp} />

          <div style={{ background: T.mist, borderRadius: T.rInput, padding: '12px 14px', marginTop: 14 }}>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: 3 }}>Próxima mensalidade gerada</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>
              {fmtR(cheio)} → <span style={{ color: T.purpleText }}>{fmtR(previa)}</span>
            </p>
          </div>
        </>
      )}

      <p style={{ fontSize: 11.5, color: T.muted, marginTop: 12, lineHeight: 1.55 }}>
        Não altera cobranças já criadas — para mudar uma delas, edite a cobrança direto na tabela.
      </p>

      <Erro>{erro}</Erro>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button onClick={onClose} style={{ ...btnBase, flex: 1, border: `1px solid ${T.line}`, background: T.mist, color: T.muted }}>Cancelar</button>
        <button onClick={salvar} disabled={saving} style={{ ...btnBase, flex: 1, border: 'none', background: T.purple, color: T.white }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
          Salvar
        </button>
      </div>
    </ModalShell>
  )
}

// ── Relatório por período ────────────────────────────────────────
// Eixo diferente da tabela do mês de propósito: aqui é data_pagamento (quando
// o dinheiro entrou), lá é vencimento (quando era devido).
function RelatorioPeriodo({ cobrancas, nomeMap }) {
  const [de, setDe]   = useState(inicioDoMes)
  const [ate, setAte] = useState(fimDoMes)

  const r = useMemo(() => totaisPorPeriodo(cobrancas, de, ate), [cobrancas, de, ate])

  const cards = [
    { label: 'Implantação', valor: r.implantacao, qtd: r.qtdImplantacao, color: T.purpleText },
    { label: 'Mensalidade', valor: r.mensalidade, qtd: r.qtdMensalidade, color: T.purpleText },
    { label: 'Total recebido', valor: r.total, qtd: r.qtd, color: T.statusAtivoTx },
  ]

  return (
    <div style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Recebido no período</p>
          <p style={{ fontSize: 12.5, color: T.muted }}>Por data de pagamento — quando o dinheiro entrou.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div>
            <label style={{ ...lbl, fontSize: 11 }}>De</label>
            <input type="date" value={de} onChange={e => setDe(e.target.value)} style={{ ...inp, height: 38, width: 158 }} />
          </div>
          <div>
            <label style={{ ...lbl, fontSize: 11 }}>Até</label>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ ...inp, height: 38, width: 158 }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 14 }}>
        {cards.map(({ label, valor, qtd, color }) => (
          <div key={label} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '18px 20px', boxShadow: T.cardShadow }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>{label}</p>
            <p style={{ fontSize: 23, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{fmtR(valor)}</p>
            <p style={{ fontSize: 12, color: T.muted }}>{qtd} {qtd === 1 ? 'pagamento' : 'pagamentos'}</p>
          </div>
        ))}
      </div>

      <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, boxShadow: T.cardShadow, overflow: 'hidden' }}>
        {r.pagas.length === 0 ? (
          <p style={{ padding: '28px 24px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>
            Nenhum pagamento registrado neste período.
          </p>
        ) : r.pagas.map((c, i) => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '12px 20px', borderBottom: i < r.pagas.length - 1 ? `1px solid ${T.line}` : 'none',
          }}>
            <span style={{ fontSize: 13, color: T.muted, fontFamily: T.mono, width: 86 }}>{fmtDate(c.data_pagamento)}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, flex: 1, minWidth: 120 }}>{nomeMap[c.loja_id] || c.loja_id}</span>
            <Chip {...(TIPO_STYLE[c.tipo] || TIPO_STYLE[TIPO_MENSALIDADE])}>
              {(TIPO_STYLE[c.tipo] || TIPO_STYLE[TIPO_MENSALIDADE]).label}
            </Chip>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, width: 96, textAlign: 'right' }}>{fmtR(c.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Assinaturas: dia de vencimento e desconto por loja ───────────
function PainelAssinaturas({ lojas, cobrancas, onDesconto }) {
  const ativas = lojas.filter(l => isLojaAtiva(l.status))
  if (ativas.length === 0) return null

  return (
    <div style={{ marginTop: 34 }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Assinaturas ativas</p>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
        Só lojas com status ativo entram na geração automática. Sem dia de vencimento, a loja fica de fora.
      </p>
      <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, boxShadow: T.cardShadow, overflow: 'hidden' }}>
        {ativas.map((l, i) => {
          const rotulo = rotuloDesconto(l.desconto_tipo, l.desconto_valor)
          const cheio = valorCheioMensalidade(l, cobrancas.filter(c => c.loja_id === l.loja_id))
          return (
            <div key={l.loja_id} style={{
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              padding: '13px 20px', borderBottom: i < ativas.length - 1 ? `1px solid ${T.line}` : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{l.nome}</p>
                <p style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{l.loja_id}</p>
              </div>
              {l.vencimento_dia
                ? <Chip bg={T.mist} color={T.muted}>vence dia {l.vencimento_dia}</Chip>
                : <Chip bg="#FFF4E0" color="#B7791F">sem dia definido</Chip>}
              {rotulo
                ? <Chip bg={T.tintPurple} color={T.purpleText}>{rotulo}</Chip>
                : <span style={{ fontSize: 12, color: T.muted2 }}>sem desconto</span>}
              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, width: 96, textAlign: 'right' }}>
                {fmtR(aplicarDesconto(cheio, l.desconto_tipo, l.desconto_valor))}
              </span>
              <button
                onClick={() => onDesconto(l)}
                style={{ ...btnBase, height: 34, padding: '0 12px', fontSize: 12.5, border: `1px solid ${T.line}`, background: T.mist, color: T.muted }}
              >
                <Percent size={12} /> Desconto
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function Cobrancas() {
  // Autor do histórico. Vem da sessão do Supabase Auth via AuthContext — esta
  // tela roda dentro do AuthProvider, então dá para passar direto e evitar um
  // getSession() a cada clique.
  const { user } = useAuth()
  const autor = useMemo(() => autorDeUsuario(user), [user])

  const [configs, setConfigs]     = useState([])
  const [cobrancas, setCobrancas] = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [selecionada, setSelecionada] = useState(null)
  const [lojaDesconto, setLojaDesconto] = useState(null)
  const monthOptions = getMonthOptions()
  const [selectedMonth, setSelectedMonth] = useState(currentMonthVal)

  const fetchData = useCallback(async () => {
    setError('')
    try {
      const [cfgRes, cobRes, histRes] = await Promise.all([
        supabase.from('lf_config').select('*'),
        supabase.from('jt_cobrancas').select('*').order('vencimento', { ascending: false }),
        supabase.from('jt_cobrancas_historico').select('*').order('created_at', { ascending: false }),
      ])
      if (cfgRes.error) throw new Error(cfgRes.error.message)
      if (cobRes.error) throw new Error(cobRes.error.message)
      setConfigs(cfgRes.data || [])
      setCobrancas(cobRes.data || [])
      // O histórico é registro, não pré-requisito: se a tabela ainda não
      // existir, a tela continua funcionando sem ele.
      setHistorico(histRes.error ? [] : (histRes.data || []))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Geração automática ao abrir a tela — sem cron no plano gratuito, é aqui
  // (e no Dashboard) que o ciclo recorrente acontece.
  const geracao = useGeracaoCobrancas({ aoGerar: fetchData })

  const ativos = configs.filter(c => isLojaAtiva(c.status))
  const mrr = calcularMRR(configs, cobrancas)
  const nomeMap = Object.fromEntries(configs.map(c => [c.loja_id, c.nome]))

  const [selY, selM] = selectedMonth.split('-').map(Number)
  const filtered = cobrancas.filter(c => {
    if (!c.vencimento) return false
    const [y, m] = c.vencimento.split('-').map(Number)
    return y === selY && m === selM
  })

  const recebido = filtered.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valor || 0), 0)
  const pendente = filtered.filter(c => statusEfetivo(c) !== 'pago').reduce((s, c) => s + Number(c.valor || 0), 0)

  const metrics = [
    { label: 'MRR', value: fmtR(mrr), sub: 'só mensalidades de lojas ativas', color: T.purple },
    { label: 'Recebido este mês', value: fmtR(recebido), sub: `${filtered.filter(c => c.status === 'pago').length} pagamentos`, color: T.statusAtivoTx },
    { label: 'Pendente', value: fmtR(pendente), sub: `${filtered.filter(c => statusEfetivo(c) !== 'pago').length} cobranças`, color: '#B7791F' },
    { label: 'Clientes ativos', value: ativos.length, sub: 'planos ativos', color: T.purple },
  ]

  return (
    <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Cobranças</h1>
          <p style={{ fontSize: 13.5, color: T.muted }}>Gestão financeira e recorrência dos clientes Junttos.</p>
        </div>
        {geracao.rodando && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: T.muted }}>
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Verificando cobranças do ciclo...
          </span>
        )}
      </div>

      <AvisoAtraso
        atrasadas={geracao.atrasadas}
        erro={geracao.erro}
        nomeMap={nomeMap}
        rodando={geracao.rodando}
      />

      {geracao.criadas.length > 0 && (
        <div style={{ background: T.statusAtivoBg, border: `1px solid ${T.statusAtivoTx}44`, borderRadius: T.rCard, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Check size={15} color={T.statusAtivoTx} />
          <p style={{ fontSize: 13, color: T.statusAtivoTx }}>
            {geracao.criadas.length} {geracao.criadas.length === 1 ? 'cobrança gerada' : 'cobranças geradas'} automaticamente agora.
          </p>
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 28 }}>
        {metrics.map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '20px 22px', boxShadow: T.cardShadow }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{value}</p>
            <p style={{ fontSize: 12, color: T.muted }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Table header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Cobranças do mês</p>
          <p style={{ fontSize: 12.5, color: T.muted }}>Por data de vencimento.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              height: 38, padding: '0 36px 0 14px', borderRadius: T.rInput,
              border: `1.5px solid ${T.line}`, background: T.white,
              fontFamily: T.ui, fontSize: 13, fontWeight: 600, color: T.ink,
              outline: 'none', cursor: 'pointer', appearance: 'none',
            }}
          >
            {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} color={T.muted} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 14, padding: 32 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...
        </div>
      ) : error ? (
        <div style={{ background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rCard, padding: '20px 24px', display: 'flex', gap: 12 }}>
          <AlertCircle size={16} color={T.coralText} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13, color: T.coralText }}>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, padding: '48px 24px', textAlign: 'center', boxShadow: T.cardShadow }}>
          <CreditCard size={32} color={T.line} style={{ margin: '0 auto 12px' }} />
          <p style={{ color: T.muted, fontSize: 14 }}>Nenhuma cobrança neste mês.</p>
        </div>
      ) : (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, boxShadow: T.cardShadow, overflow: 'hidden' }}>
          {filtered.map((row, i) => {
            const st = statusEfetivo(row)
            const { bg, color, label } = STATUS_STYLE[st]
            const tipoSt = TIPO_STYLE[row.tipo] || TIPO_STYLE[TIPO_MENSALIDADE]
            const nome = nomeMap[row.loja_id] || row.loja_id
            return (
              <div key={row.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.line}` : 'none',
                transition: 'background .12s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = T.mist}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar nome={nome} />
                <div style={{ flex: 1, minWidth: 130 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.ink, lineHeight: 1.2 }}>{nome}</p>
                  <p style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{row.loja_id}</p>
                </div>
                <Chip bg={tipoSt.bg} color={tipoSt.color}>{tipoSt.label}</Chip>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, width: 100, textAlign: 'right' }}>{fmtR(row.valor)}</span>
                <span style={{ fontSize: 13, color: T.muted, width: 92, textAlign: 'right' }}>{fmtDate(row.vencimento)}</span>
                <Chip bg={bg} color={color}>{label}</Chip>
                <button
                  onClick={() => setSelecionada(row)}
                  style={{ ...btnBase, height: 34, padding: '0 12px', fontSize: 12.5, border: `1px solid ${T.line}`, background: T.white, color: T.muted }}
                >
                  <Pencil size={12} /> Gerenciar
                </button>
              </div>
            )
          })}
        </div>
      )}

      <PainelAssinaturas lojas={configs} cobrancas={cobrancas} onDesconto={setLojaDesconto} />

      <RelatorioPeriodo cobrancas={cobrancas} nomeMap={nomeMap} />

      {selecionada && (
        <CobrancaModal
          key={selecionada.id}
          cobranca={selecionada}
          nome={nomeMap[selecionada.loja_id] || selecionada.loja_id}
          historico={historico}
          autor={autor}
          onClose={() => setSelecionada(null)}
          onSalvo={fetchData}
        />
      )}

      {lojaDesconto && (
        <DescontoModal
          key={lojaDesconto.loja_id}
          loja={lojaDesconto}
          cobrancasDaLoja={cobrancas.filter(c => c.loja_id === lojaDesconto.loja_id)}
          autor={autor}
          onClose={() => setLojaDesconto(null)}
          onSalvo={fetchData}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
