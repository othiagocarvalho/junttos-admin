import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, FileText, Download, AlertCircle, Loader2, Check, ExternalLink,
  PenLine, Link2, X, Copy, Pencil, ArrowUpDown, Gift,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { T } from '../../theme/tokens'
import { PLANOS, valorPlano, fmtValorPlano, nomeModulo } from '../../utils/planos'
import { fmtR } from '../../utils/formatters'
import {
  aplicarDesconto, rotuloDesconto, statusEfetivo,
  TIPO_MENSALIDADE, isLojaAtiva,
} from '../../utils/cobrancas'
import { registrarHistorico, autorDeUsuario, ACAO } from '../../lib/historicoCobranca'
import { useAuth } from '../../context/AuthContext'
import CamposContratante from '../../components/admin/CamposContratante'
import { CONTRATANTE_VAZIO, apenasContratante } from '../../components/admin/contratante'

// Sem estes o contrato sai com cláusula pela metade: os três primeiros deixam o
// documento sem partes identificadas, e os demais produzem coisas como "foro da
// comarca de não informado" ou "vigora a partir de não informado".
// plano e valor_mensal ficam de fora porque sempre existem — plano tem default
// em lf_config e o valor cai na tabela de preço quando não há cobrança.
const OBRIGATORIOS = [
  { key: 'razao_social',     label: 'Razão social / Nome completo' },
  { key: 'cpf_cnpj',         label: 'CPF / CNPJ' },
  { key: 'responsavel_nome', label: 'Responsável' },
  { key: 'cidade',           label: 'Cidade — usada no foro (cláusula 7)' },
  { key: 'estado',           label: 'UF — usada no foro (cláusula 7)' },
  { key: 'contrato_inicio',  label: 'Início do contrato — vigência (cláusula 3)' },
  { key: 'vencimento_dia',   label: 'Dia de vencimento — pagamento (cláusula 2)' },
]

// O snapshot em jt_contratos é montado pela Edge Function, não aqui: a tabela
// guarda dado pessoal e fica com RLS ligada, sem policy — nem leitura nem
// escrita passam pela anon key. Esta tela só lê lf_config (para exibir e
// validar) e conversa com a function para listar, gerar e baixar.

// 'gerado' não é mais gravado — a geração salta para aguardando_assinatura —
// mas segue no mapa porque contratos anteriores à Fase 4 pararam nele.
const STATUS = {
  rascunho:              { label: 'Rascunho',              bg: T.statusTrialBg, tx: T.statusTrialTx },
  gerado:                { label: 'Gerado',                bg: T.statusAtivoBg, tx: T.statusAtivoTx },
  aguardando_assinatura: { label: 'Aguardando assinatura', bg: T.tintPurple,    tx: T.purpleText   },
  assinado:              { label: 'Assinado',              bg: T.statusAtivoBg, tx: T.statusAtivoTx },
  cancelado:             { label: 'Cancelado',             bg: T.tintCoral,     tx: T.coralText    },
}

function StatusPill({ status }) {
  const s = STATUS[status] || { label: status || '—', bg: T.mist, tx: T.muted }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: T.rPill,
      background: s.bg, color: s.tx, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

function fmtData(v) {
  if (!v) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'
}
function fmtDataHora(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function Campo({ label, value, mono }) {
  const vazio = value === null || value === undefined || String(value).trim() === ''
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase',
        letterSpacing: '0.12em', marginBottom: 4,
      }}>{label}</p>
      <p style={{
        fontSize: 13.5, color: vazio ? T.muted2 : T.ink,
        fontFamily: mono && !vazio ? T.mono : T.ui,
        wordBreak: 'break-word',
      }}>{vazio ? '— não preenchido' : value}</p>
    </div>
  )
}

// Modal com o comprovante do aceite. O traço vem como SVG pronto da function,
// então é injetado direto — é conteúdo que nós mesmos geramos no canvas e
// gravamos, nunca entrada livre de terceiros.
function ModalAssinatura({ dados, onFechar }) {
  useEffect(() => {
    function esc(e) { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar])

  return (
    <div
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 520, boxShadow: T.darkCardShadow, padding: '26px 26px 22px', fontFamily: T.ui, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 3 }}>Assinatura do contrato</h2>
            <p style={{ fontSize: 12.5, color: T.muted }}>
              Aceite eletrônico registrado em {fmtDataHora(dados.assinado_em)}
            </p>
          </div>
          <button onClick={onFechar} style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={15} color={T.muted} />
          </button>
        </div>

        <div style={{ background: T.white, border: `1.5px solid ${T.line}`, borderRadius: T.rInput, padding: 10, marginBottom: 18 }}>
          {dados.assinatura_svg
            ? <div style={{ width: '100%' }} dangerouslySetInnerHTML={{ __html: dados.assinatura_svg }} />
            : <p style={{ fontSize: 12.5, color: T.muted2, textAlign: 'center', padding: '28px 0' }}>Sem traço de assinatura registrado</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <Campo label="Razão social / Nome" value={dados.razao_social} />
          <Campo label="CPF / CNPJ"          value={dados.cpf_cnpj} mono />
          <Campo label="Responsável"         value={dados.responsavel_nome} />
          <Campo label="Data e hora"         value={fmtDataHora(dados.assinado_em)} />
          <Campo label="Endereço IP"         value={dados.assinante_ip} mono />
        </div>

        <div style={{ marginTop: 14 }}>
          <Campo label="Navegador (user-agent)" value={dados.assinante_user_agent} />
        </div>

        <p style={{ fontSize: 11, color: T.muted2, lineHeight: 1.6, marginTop: 16 }}>
          Assinatura eletrônica simples, nos termos da MP 2.200-2/2001. A integridade do
          documento é verificável pelo SHA-256 registrado na geração.
        </p>
      </div>
    </div>
  )
}

/**
 * Edição dos dados do contratante de uma loja que já existe. Só estes 14
 * campos: nome, cores, plano, segmento e slug ficam de fora de propósito —
 * segmento troca o painel que a lojista usa e slug é a chave lógica de todas
 * as tabelas, então mudá-los aqui quebraria a loja.
 *
 * Salva o que estiver preenchido, sem exigir os obrigatórios: o preenchimento
 * costuma ser incremental (o CNPJ chega depois). Quem cobra os 7 campos é a
 * geração do contrato, na seção abaixo.
 */
function ModalEditarContratante({ lojaId, lojaNome, inicial, onFechar, onSalvo }) {
  const [form, setForm]   = useState({ ...CONTRATANTE_VAZIO, ...apenasContratante(inicial) })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]   = useState('')

  useEffect(() => {
    function esc(e) { if (e.key === 'Escape' && !salvando) onFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar, salvando])

  async function handleSalvar(e) {
    e.preventDefault()
    setSalvando(true); setErro('')
    // jt_contratantes tem RLS e nenhuma policy — quem grava é a function, e o
    // contratante-salvar já faz upsert por loja_id, servindo a criar e editar.
    const { data, error } = await supabase.functions.invoke('gerar-contrato', {
      body: { action: 'contratante-salvar', loja_id: lojaId, contratante: form },
    })
    const msg = error?.message || data?.error
    if (msg) { setErro(`Não foi possível salvar: ${msg}`); setSalvando(false); return }
    setSalvando(false)
    onSalvo()
  }

  return (
    <div
      onClick={() => { if (!salvando) onFechar() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 540, boxShadow: T.darkCardShadow, maxHeight: '90vh', overflowY: 'auto', fontFamily: T.ui }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '24px 28px 0' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 2 }}>Dados do contratante</h2>
            <p style={{ fontSize: 13, color: T.muted, wordBreak: 'break-word' }}>{lojaNome}</p>
          </div>
          <button
            type="button" onClick={onFechar} disabled={salvando}
            style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 36, height: 36, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <X size={16} color={T.muted} />
          </button>
        </div>

        <form onSubmit={handleSalvar} style={{ padding: '18px 28px 28px' }}>
          <CamposContratante
            valores={form}
            onChange={(campo, valor) => setForm(p => ({ ...p, [campo]: valor }))}
            intro="Preencha o que já tiver — dá para completar depois. Os campos obrigatórios só são cobrados na hora de gerar o contrato."
          />

          {erro && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '12px 14px', marginTop: 16 }}>
              <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: T.coralText, lineHeight: 1.5 }}>{erro}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button
              type="button" onClick={onFechar} disabled={salvando}
              style={{ flex: 1, height: 46, borderRadius: T.rInput, border: `1.5px solid ${T.line}`, background: T.mist, cursor: salvando ? 'not-allowed' : 'pointer', fontFamily: T.ui, fontWeight: 600, color: T.muted, fontSize: 14 }}
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={salvando}
              style={{
                flex: 2, height: 46, borderRadius: T.rInput, border: 'none',
                background: salvando ? T.mist : T.purple,
                color: salvando ? T.muted : T.white,
                cursor: salvando ? 'not-allowed' : 'pointer',
                fontFamily: T.ui, fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: salvando ? 'none' : '0 4px 16px rgba(94,43,208,0.28)',
              }}
            >
              {salvando
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
                : <><Check size={15} /> Salvar dados</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Botões de ação de cada linha do histórico.
const btnLinha = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 36, padding: '0 14px', borderRadius: T.rInput,
  border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer',
  fontFamily: T.ui, fontSize: 13, fontWeight: 600, color: T.ink,
  whiteSpace: 'nowrap',
}

function Secao({ title, children, right }) {
  return (
    <div style={{
      background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard,
      boxShadow: T.cardShadow, padding: '22px 24px', marginBottom: 18,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 18, flexWrap: 'wrap',
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{title}</p>
        {right}
      </div>
      {children}
    </div>
  )
}

// Overlay compartilhado pelos dois modais de decisão desta tela. Os modais
// antigos (assinatura, contratante) seguem com o markup próprio deles — não
// foram tocados.
function ModalConfirm({ titulo, sub, children, onFechar, bloqueado }) {
  useEffect(() => {
    function esc(e) { if (e.key === 'Escape' && !bloqueado) onFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar, bloqueado])

  return (
    <div
      onClick={() => { if (!bloqueado) onFechar() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1600, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 500, boxShadow: T.darkCardShadow, maxHeight: '90vh', overflowY: 'auto', fontFamily: T.ui, padding: '26px 28px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 3 }}>{titulo}</h2>
            {sub && <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.55 }}>{sub}</p>}
          </div>
          <button
            type="button" onClick={onFechar} disabled={bloqueado}
            style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 34, height: 34, cursor: bloqueado ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <X size={15} color={T.muted} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const btnModal = {
  height: 46, borderRadius: T.rInput, cursor: 'pointer',
  fontFamily: T.ui, fontWeight: 700, fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}

/**
 * Troca de plano.
 *
 * Grava só lf_config.plano e lf_config.valor_mensal. Não encosta em
 * jt_cobrancas: cobrança já criada é passado, e mexer nela mudaria o que já
 * foi combinado (ou já foi pago) com o cliente. O novo preço entra na próxima
 * mensalidade que o ciclo gerar, via valorCheioMensalidade().
 *
 * features.legado e o resto do controle de acesso ficam intactos de propósito
 * — temAcesso() lê o campo plano direto, então trocar o plano já basta.
 */
function ModalTrocarPlano({ loja, planoNovo, autor, onFechar, onSalvo }) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const cheioAtual = valorPlano(loja.segmento, loja.plano)
  const cheioNovo  = valorPlano(loja.segmento, planoNovo)
  const finalNovo  = aplicarDesconto(cheioNovo, loja.desconto_tipo, loja.desconto_valor)
  const desconto   = rotuloDesconto(loja.desconto_tipo, loja.desconto_valor)

  async function confirmar() {
    setSalvando(true); setErro('')
    try {
      const { error } = await supabase
        .from('lf_config')
        .update({ plano: planoNovo, valor_mensal: cheioNovo })
        .eq('loja_id', loja.loja_id)
      if (error) throw new Error(error.message)

      await registrarHistorico([{
        // Ação da loja, não de uma cobrança — mesma convenção do desconto.
        cobranca_id:    null,
        loja_id:        loja.loja_id,
        acao:           ACAO.PLANO,
        campo:          'plano',
        valor_anterior: `${PLANOS[loja.plano]?.label || loja.plano} — R$ ${fmtValorPlano(cheioAtual)}`,
        valor_novo:     `${PLANOS[planoNovo]?.label || planoNovo} — R$ ${fmtValorPlano(cheioNovo)}`,
      }], autor)

      await onSalvo()
      onFechar()
    } catch (e) {
      setErro(
        /valor_mensal|gratuito|column/i.test(e.message)
          ? `${e.message} — rode supabase/migration_plano_gratuito.sql antes de usar esta tela.`
          : e.message,
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalConfirm
      titulo="Trocar o plano desta loja?"
      sub={loja.nome}
      onFechar={onFechar}
      bloqueado={salvando}
    >
      <div style={{ background: T.mist, borderRadius: T.rInput, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700, color: T.ink, flexWrap: 'wrap' }}>
          <span>{PLANOS[loja.plano]?.label || loja.plano}</span>
          <ArrowUpDown size={14} color={T.muted} style={{ transform: 'rotate(90deg)' }} />
          <span style={{ color: T.purpleText }}>{PLANOS[planoNovo]?.label || planoNovo}</span>
        </div>
        <p style={{ fontSize: 12.5, color: T.muted, marginTop: 8 }}>
          Mensalidade cheia: {fmtR(cheioAtual)} → <strong style={{ color: T.ink }}>{fmtR(cheioNovo)}</strong>
        </p>
        {desconto && (
          <p style={{ fontSize: 12.5, color: T.purpleText, marginTop: 4 }}>
            Desconto {desconto} preservado — a loja passa a pagar <strong>{fmtR(finalNovo)}</strong>.
          </p>
        )}
      </div>

      <ul style={{ margin: '0 0 4px 18px', padding: 0 }}>
        <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
          Vale a partir da <strong style={{ color: T.ink }}>próxima</strong> mensalidade gerada pelo ciclo.
        </li>
        <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
          Cobranças já criadas — pendentes, vencidas ou pagas — não mudam.
        </li>
        <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
          O acesso às funcionalidades do novo plano passa a valer imediatamente.
        </li>
      </ul>

      {erro && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '12px 14px', marginTop: 14 }}>
          <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: T.coralText, lineHeight: 1.5 }}>{erro}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button type="button" onClick={onFechar} disabled={salvando}
          style={{ ...btnModal, flex: 1, border: `1.5px solid ${T.line}`, background: T.mist, color: T.muted }}>
          Cancelar
        </button>
        <button type="button" onClick={confirmar} disabled={salvando}
          style={{ ...btnModal, flex: 2, border: 'none', background: salvando ? T.mist : T.purple, color: salvando ? T.muted : T.white }}>
          {salvando
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Trocando...</>
            : <><Check size={15} /> Confirmar troca</>}
        </button>
      </div>
    </ModalConfirm>
  )
}

/**
 * Liga/desliga a cortesia.
 *
 * Nenhuma cobrança é criada, alterada ou apagada aqui — nem as pendentes que
 * já existem. Elas são listadas para o admin saber que continuam de pé e
 * resolver uma a uma na tela de Cobranças, que é onde cobrança se edita.
 */
function ModalGratuito({ loja, pendentes, autor, onFechar, onSalvo }) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ciente, setCiente] = useState(false)

  const ligando = !loja.gratuito
  const totalPendente = pendentes.reduce((s, c) => s + (Number(c.valor) || 0), 0)
  // Só exige o "estou ciente" quando há dinheiro pendente em aberto para
  // resolver — desligar a cortesia ou ligar sem pendência é decisão simples.
  const exigeCiente = ligando && pendentes.length > 0
  const podeConfirmar = !exigeCiente || ciente

  async function confirmar() {
    if (!podeConfirmar) return
    setSalvando(true); setErro('')
    try {
      const { error } = await supabase
        .from('lf_config')
        .update({ gratuito: ligando })
        .eq('loja_id', loja.loja_id)
      if (error) throw new Error(error.message)

      await registrarHistorico([{
        cobranca_id:    null,
        loja_id:        loja.loja_id,
        acao:           ACAO.GRATUITO,
        campo:          'gratuito',
        valor_anterior: loja.gratuito ? 'gratuito' : 'cobrança normal',
        valor_novo:     ligando ? 'gratuito' : 'cobrança normal',
      }], autor)

      await onSalvo()
      onFechar()
    } catch (e) {
      setErro(
        /gratuito|column/i.test(e.message)
          ? `${e.message} — rode supabase/migration_plano_gratuito.sql antes de usar esta tela.`
          : e.message,
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalConfirm
      titulo={ligando ? 'Marcar como loja gratuita?' : 'Voltar a cobrar esta loja?'}
      sub={loja.nome}
      onFechar={onFechar}
      bloqueado={salvando}
    >
      <ul style={{ margin: '0 0 4px 18px', padding: 0 }}>
        {ligando ? (
          <>
            <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
              A loja <strong style={{ color: T.ink }}>mantém o plano {PLANOS[loja.plano]?.label || loja.plano} e todo o acesso</strong> — nada muda para quem usa o sistema.
            </li>
            <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
              O ciclo automático para de gerar mensalidade para ela.
            </li>
            <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
              Ela sai do cálculo do MRR na tela de Cobranças.
            </li>
            <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
              Reversível a qualquer momento por este mesmo botão.
            </li>
          </>
        ) : (
          <>
            <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
              O ciclo automático volta a gerar a mensalidade nos próximos meses.
            </li>
            <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
              Ela volta a contar no MRR.
            </li>
            <li style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
              Os meses em que ficou isenta <strong style={{ color: T.ink }}>não</strong> são cobrados retroativamente.
            </li>
          </>
        )}
      </ul>

      {ligando && pendentes.length > 0 && (
        <div style={{ background: '#FFF4E0', border: '1px solid #B7791F44', borderRadius: T.rInput, padding: '13px 15px', marginTop: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#B7791F', marginBottom: 6 }}>
            Esta loja tem {pendentes.length} {pendentes.length === 1 ? 'cobrança em aberto' : 'cobranças em aberto'} — {fmtR(totalPendente)}
          </p>
          <ul style={{ margin: '0 0 8px 18px', padding: 0 }}>
            {pendentes.map(c => (
              <li key={c.id} style={{ fontSize: 12, color: '#B7791F', lineHeight: 1.6 }}>
                {c.tipo === TIPO_MENSALIDADE ? 'Mensalidade' : 'Implantação'} de {fmtR(c.valor)} — vence {fmtData(c.vencimento)}
                {statusEfetivo(c) === 'atrasado' ? ' (atrasada)' : ''}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, color: '#B7791F', lineHeight: 1.6 }}>
            Elas <strong>continuam de pé</strong>. Nada é apagado nem alterado aqui: se a cortesia também vale para elas,
            resolva uma a uma na tela de Cobranças.
          </p>
        </div>
      )}

      {exigeCiente && (
        <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)} style={{ marginTop: 2, cursor: 'pointer' }} />
          <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.55 }}>
            Entendi que as cobranças já em aberto continuam existindo e não serão apagadas.
          </span>
        </label>
      )}

      {erro && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '12px 14px', marginTop: 14 }}>
          <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: T.coralText, lineHeight: 1.5 }}>{erro}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button type="button" onClick={onFechar} disabled={salvando}
          style={{ ...btnModal, flex: 1, border: `1.5px solid ${T.line}`, background: T.mist, color: T.muted }}>
          Cancelar
        </button>
        <button type="button" onClick={confirmar} disabled={salvando || !podeConfirmar}
          style={{
            ...btnModal, flex: 2, border: 'none',
            background: (salvando || !podeConfirmar) ? T.mist : T.purple,
            color: (salvando || !podeConfirmar) ? T.muted : T.white,
            cursor: (salvando || !podeConfirmar) ? 'not-allowed' : 'pointer',
          }}>
          {salvando
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
            : <><Check size={15} /> {ligando ? 'Marcar como gratuita' : 'Voltar a cobrar'}</>}
        </button>
      </div>
    </ModalConfirm>
  )
}

export default function LojaDetalhe() {
  const { slug } = useParams()
  // Autor do histórico — esta tela roda dentro do AuthProvider, mesma
  // convenção da tela de Cobranças.
  const { user } = useAuth()
  const autor = autorDeUsuario(user)
  const [loja, setLoja]           = useState(null)
  const [contratante, setContratante] = useState(null)
  const [contratos, setContratos] = useState([])
  const [valorMensal, setValorMensal] = useState(null)
  const [fetching, setFetching]   = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [erro, setErro]           = useState('')
  const [gerando, setGerando]     = useState(false)
  const [baixando, setBaixando]   = useState(null)
  const [assinatura, setAssinatura] = useState(null)  // dados do modal
  const [abrindoAss, setAbrindoAss] = useState(null)
  const [copiando, setCopiando]     = useState(null)
  const [copiado, setCopiado]       = useState(null)
  const [editando, setEditando]     = useState(false)
  const [cobrancasLoja, setCobrancasLoja] = useState([])
  const [planoSel, setPlanoSel]     = useState('')
  const [confirmandoPlano, setConfirmandoPlano] = useState(null)  // plano destino
  const [confirmandoGratuito, setConfirmandoGratuito] = useState(false)

  const fetchTudo = useCallback(async () => {
    setFetching(true); setFetchError('')
    const { data: cfg, error: cfgErr } = await supabase
      .from('lf_config').select('*')
      .or(`loja_id.eq.${slug},slug.eq.${slug}`)
      .maybeSingle()
    if (cfgErr) { setFetchError(cfgErr.message); setFetching(false); return }
    if (!cfg)   { setLoja(null); setFetching(false); return }
    setLoja(cfg)

    setPlanoSel(cfg.plano || 'starter')

    const [listaRes, cobrancaRes, contratanteRes, todasCobRes] = await Promise.all([
      supabase.functions.invoke('gerar-contrato', {
        body: { action: 'listar', loja_id: cfg.loja_id },
      }),
      // Só para exibir no cabeçalho. O valor que vai para o contrato é
      // recalculado na function, que é quem grava o snapshot.
      // tipo='mensalidade' é obrigatório: sem o filtro, a taxa de implantação
      // de R$ 300 vira "valor mensal" da loja no cabeçalho.
      supabase.from('jt_cobrancas').select('valor')
        .eq('loja_id', cfg.loja_id).eq('tipo', 'mensalidade')
        .order('created_at', { ascending: false }).limit(1),
      // jt_contratantes é invisível para o navegador (RLS sem policy).
      supabase.functions.invoke('gerar-contrato', {
        body: { action: 'contratante-obter', loja_id: cfg.loja_id },
      }),
      // Todas as cobranças da loja — usadas só para avisar o que fica em
      // aberto ao marcar a loja como gratuita. Esta tela nunca as altera.
      supabase.from('jt_cobrancas').select('*')
        .eq('loja_id', cfg.loja_id)
        .order('vencimento', { ascending: true }),
    ])
    setCobrancasLoja(todasCobRes.error ? [] : (todasCobRes.data || []))
    const listaErro = listaRes.error?.message || listaRes.data?.error
    if (listaErro) setErro(`Erro ao carregar os contratos: ${listaErro}`)
    setContratos(listaRes.data?.contratos || [])

    const ctErro = contratanteRes.error?.message || contratanteRes.data?.error
    if (ctErro) setErro(`Erro ao carregar os dados do contratante: ${ctErro}`)
    setContratante(contratanteRes.data?.contratante || null)

    // lf_config.valor_mensal manda quando existe — é o que a troca de plano
    // grava. Nulo (ou coluna ainda inexistente) cai na última mensalidade,
    // exatamente como antes.
    const doBanco = cfg.valor_mensal ?? cobrancaRes.data?.[0]?.valor
    setValorMensal(
      doBanco !== undefined && doBanco !== null
        ? Number(doBanco)
        : valorPlano(cfg.segmento, cfg.plano),
    )
    setFetching(false)
  }, [slug])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  // vencimento_dia é número: 0 passaria no teste de string vazia e viraria
  // "todo dia 0 de cada mês". O CHECK do banco e o formulário já barram, mas a
  // validação não deve depender disso.
  const faltando = loja
    ? OBRIGATORIOS.filter(({ key }) => key === 'vencimento_dia'
        ? !Number(contratante?.[key])
        : !String(contratante?.[key] ?? '').trim())
    : []
  const podeGerar = loja && faltando.length === 0

  // A function faz tudo: lê lf_config, monta o snapshot, grava e gera o PDF.
  // A validação abaixo é só para não deixar o clique sair à toa — quem decide
  // de verdade é a function, que revalida com os dados do banco.
  async function handleGerar() {
    if (!podeGerar || gerando) return
    setGerando(true); setErro('')

    const { data, error } = await supabase.functions
      .invoke('gerar-contrato', { body: { action: 'gerar', loja_id: loja.loja_id } })
    const msg = error?.message || data?.error
    if (msg) setErro(`Não foi possível gerar o contrato: ${msg}`)

    await fetchTudo()
    setGerando(false)
  }

  async function handleBaixar(contrato) {
    setBaixando(contrato.id); setErro('')
    const { data, error } = await supabase.functions
      .invoke('gerar-contrato', { body: { action: 'link', contrato_id: contrato.id } })
    const msg = error?.message || data?.error
    if (msg) { setErro(`Erro ao gerar o link: ${msg}`); setBaixando(null); return }
    window.open(data.url, '_blank', 'noopener,noreferrer')
    setBaixando(null)
  }

  // O token não vem na listagem — é buscado só quando o admin vai enviar o
  // link, para a credencial do link público não ficar circulando à toa.
  async function handleCopiarLink(contrato) {
    setCopiando(contrato.id); setErro('')
    const { data, error } = await supabase.functions
      .invoke('gerar-contrato', { body: { action: 'link-assinatura', contrato_id: contrato.id } })
    const msg = error?.message || data?.error
    if (msg) { setErro(`Erro ao obter o link: ${msg}`); setCopiando(null); return }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/contrato/${data.token}`)
      setCopiado(contrato.id)
      setTimeout(() => setCopiado(null), 2500)
    } catch {
      setErro(`Não foi possível copiar. O link é: ${window.location.origin}/contrato/${data.token}`)
    }
    setCopiando(null)
  }

  async function handleVerAssinatura(contrato) {
    setAbrindoAss(contrato.id); setErro('')
    const { data, error } = await supabase.functions
      .invoke('gerar-contrato', { body: { action: 'assinatura-obter', contrato_id: contrato.id } })
    const msg = error?.message || data?.error
    if (msg) { setErro(`Erro ao carregar a assinatura: ${msg}`); setAbrindoAss(null); return }
    setAssinatura(data.assinatura)
    setAbrindoAss(null)
  }

  // ── Estados de carregamento / loja inexistente ──
  if (fetching) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 14, padding: 24, fontFamily: T.ui }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        Carregando loja...
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (fetchError || !loja) {
    return (
      <div style={{ maxWidth: 720, fontFamily: T.ui }}>
        <Link to="/clientes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: T.muted, textDecoration: 'none', marginBottom: 18 }}>
          <ArrowLeft size={14} /> Lojas
        </Link>
        <div style={{ background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rCard, padding: '20px 24px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={16} color={T.coralText} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.coralText, marginBottom: 4 }}>
              {fetchError ? 'Erro ao carregar a loja' : 'Loja não encontrada'}
            </p>
            <p style={{ fontSize: 12, color: T.coralText, lineHeight: 1.6 }}>
              {fetchError || `Nenhuma loja com o slug "${slug}".`}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const planoLabel = PLANOS[loja.plano]?.label || loja.plano || '—'
  const contratoAtual = contratos[0] || null
  const ehGratuita = loja.gratuito === true
  // Em aberto = tudo que ainda não foi pago, vencido ou não.
  const pendentes = cobrancasLoja.filter(c => statusEfetivo(c) !== 'pago')
  const descontoLoja = rotuloDesconto(loja.desconto_tipo, loja.desconto_valor)
  const cheioPlanoAtual = valorPlano(loja.segmento, loja.plano)

  return (
    <div style={{ maxWidth: 900, fontFamily: T.ui }}>
      {/* Header */}
      <Link to="/clientes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: T.muted, textDecoration: 'none', marginBottom: 16 }}>
        <ArrowLeft size={14} /> Lojas
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 23, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', marginBottom: 6 }}>
            {loja.nome}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: T.muted, fontFamily: T.mono }}>/{loja.slug || loja.loja_id}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: T.rPill, background: T.tintPurple, color: T.purpleText }}>
              {nomeModulo(loja.segmento)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: T.rPill, background: T.mist, color: T.muted, border: `1px solid ${T.line}` }}>
              {planoLabel}{valorMensal != null ? ` · R$ ${fmtValorPlano(valorMensal)}/mês` : ''}
            </span>
            {ehGratuita && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: T.rPill, background: T.statusAtivoBg, color: T.statusAtivoTx }}>
                <Gift size={11} /> Gratuito
              </span>
            )}
          </div>
        </div>
        <a
          href={`${window.location.origin}/${loja.slug || loja.loja_id}/`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', borderRadius: T.rInput, border: `1px solid ${T.line}`, background: T.mist, color: T.muted, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
        >
          <ExternalLink size={13} /> Abrir painel
        </a>
      </div>

      {erro && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '12px 14px', marginBottom: 18 }}>
          <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: T.coralText, lineHeight: 1.5 }}>{erro}</p>
        </div>
      )}

      {/* ── Dados do contratante ── */}
      <Secao
        title="Dados do contratante"
        right={
          <button
            type="button"
            onClick={() => setEditando(true)}
            style={{ ...btnLinha, height: 34 }}
          >
            <Pencil size={13} /> {contratante ? 'Editar' : 'Preencher'}
          </button>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
          <Campo label="Razão social / Nome" value={contratante?.razao_social} />
          <Campo label="CPF / CNPJ"          value={contratante?.cpf_cnpj} mono />
          <Campo label="Endereço"            value={[contratante?.endereco, contratante?.numero, contratante?.complemento].filter(Boolean).join(', ')} />
          <Campo label="Bairro"              value={contratante?.bairro} />
          <Campo label="Cidade / UF"         value={[contratante?.cidade, contratante?.estado].filter(Boolean).join('/')} />
          <Campo label="CEP"                 value={contratante?.cep} mono />
          <Campo label="Responsável"         value={contratante?.responsavel_nome} />
          <Campo label="E-mail"              value={contratante?.responsavel_email} />
          <Campo label="Telefone"            value={contratante?.responsavel_telefone} />
          <Campo label="Início do contrato"  value={contratante?.contrato_inicio ? fmtData(contratante.contrato_inicio) : ''} />
          <Campo label="Dia de vencimento"   value={contratante?.vencimento_dia ? `Todo dia ${contratante.vencimento_dia}` : ''} />
        </div>
      </Secao>

      {/* ── Plano e cobrança ── */}
      <Secao
        title="Plano e cobrança"
        right={
          <span style={{ fontSize: 12, color: T.muted }}>
            {ehGratuita ? 'Fora da cobrança automática' : 'Entra no ciclo automático'}
          </span>
        }
      >
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 18 }}>
          <div style={{ minWidth: 190, flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
              Plano
            </p>
            <select
              value={planoSel}
              onChange={e => setPlanoSel(e.target.value)}
              style={{
                width: '100%', height: 44, boxSizing: 'border-box',
                background: T.mist, border: `1.5px solid ${T.line}`, borderRadius: T.rInput,
                padding: '0 14px', fontFamily: T.ui, fontSize: 14, color: T.ink,
                outline: 'none', cursor: 'pointer',
              }}
            >
              {Object.entries(PLANOS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label} — R$ {fmtValorPlano(valorPlano(loja.segmento, key))}/mês
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setConfirmandoPlano(planoSel)}
            disabled={planoSel === loja.plano}
            style={{
              ...btnLinha, height: 44, padding: '0 18px',
              cursor: planoSel === loja.plano ? 'not-allowed' : 'pointer',
              background: planoSel === loja.plano ? T.mist : T.purple,
              color: planoSel === loja.plano ? T.muted : T.white,
              border: planoSel === loja.plano ? `1px solid ${T.line}` : 'none',
              fontWeight: 700,
            }}
          >
            <ArrowUpDown size={14} /> Trocar plano
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18, marginBottom: 18 }}>
          <Campo label="Plano atual" value={planoLabel} />
          <Campo label="Mensalidade cheia do plano" value={`R$ ${fmtValorPlano(cheioPlanoAtual)}`} />
          <Campo label="Desconto permanente" value={descontoLoja || ''} />
          <Campo
            label="Próxima mensalidade gerada"
            value={ehGratuita
              ? 'Nenhuma — loja gratuita'
              : `R$ ${fmtValorPlano(aplicarDesconto(valorMensal ?? cheioPlanoAtual, loja.desconto_tipo, loja.desconto_valor))}`}
          />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
          background: ehGratuita ? T.statusAtivoBg : T.mist,
          border: `1px solid ${ehGratuita ? `${T.statusAtivoTx}33` : T.line}`,
          borderRadius: T.rInput, padding: '14px 16px',
        }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Gift size={14} color={ehGratuita ? T.statusAtivoTx : T.muted} />
              Loja gratuita — não gera cobrança
            </p>
            <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.55 }}>
              Mantém o plano e todo o acesso. Só sai da geração automática e do MRR.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmandoGratuito(true)}
            style={{
              ...btnLinha, height: 40, padding: '0 16px', fontWeight: 700,
              background: ehGratuita ? T.white : T.mist,
              color: ehGratuita ? T.statusAtivoTx : T.ink,
              border: `1px solid ${ehGratuita ? `${T.statusAtivoTx}55` : T.line}`,
            }}
          >
            {ehGratuita ? 'Voltar a cobrar' : 'Marcar como gratuita'}
          </button>
        </div>

        {!isLojaAtiva(loja.status) && !ehGratuita && (
          <p style={{ fontSize: 11.5, color: T.muted, marginTop: 12, lineHeight: 1.6 }}>
            Esta loja está com status <strong style={{ color: T.ink }}>{loja.status}</strong> — só loja
            com status “ativo” entra na geração automática, independentemente do plano.
          </p>
        )}
      </Secao>

      {/* ── Contrato ── */}
      <Secao
        title="Contrato"
        right={contratoAtual ? <StatusPill status={contratoAtual.status} /> : (
          <span style={{ fontSize: 12, color: T.muted }}>Nenhum contrato gerado</span>
        )}
      >
        {faltando.length > 0 && (
          <div style={{ background: T.statusTrialBg, border: `1px solid ${T.statusTrialTx}33`, borderRadius: T.rInput, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.statusTrialTx, marginBottom: 6 }}>
              Faltam dados obrigatórios para gerar o contrato
            </p>
            <ul style={{ margin: '0 0 10px 18px', padding: 0 }}>
              {faltando.map(({ key, label }) => (
                <li key={key} style={{ fontSize: 12.5, color: T.statusTrialTx, lineHeight: 1.7 }}>{label}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setEditando(true)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: T.ui, fontSize: 12.5, fontWeight: 700, color: T.purpleText }}
            >
              Preencher os dados do contratante →
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleGerar}
          disabled={!podeGerar || gerando}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 44, padding: '0 22px', borderRadius: T.rInput, border: 'none',
            background: !podeGerar || gerando ? T.mist : T.purple,
            color: !podeGerar || gerando ? T.muted : T.white,
            cursor: !podeGerar || gerando ? 'not-allowed' : 'pointer',
            fontFamily: T.ui, fontSize: 14, fontWeight: 700,
            boxShadow: !podeGerar || gerando ? 'none' : '0 4px 16px rgba(94,43,208,0.28)',
          }}
        >
          {gerando
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</>
            : <><FileText size={15} /> Gerar contrato</>}
        </button>

        {contratos.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
              Histórico
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contratos.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, flexWrap: 'wrap',
                  background: T.mist, border: `1px solid ${T.line}`,
                  borderRadius: T.rInput, padding: '12px 14px',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <StatusPill status={c.status} />
                      <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>
                        {c.gerado_em ? `Gerado em ${fmtDataHora(c.gerado_em)}` : `Criado em ${fmtDataHora(c.created_at)}`}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, wordBreak: 'break-all' }}>
                      {c.pdf_hash ? `SHA-256 ${c.pdf_hash.slice(0, 16)}…` : 'PDF ainda não gerado'}
                    </p>
                    {c.assinado_em && (
                      <p style={{ fontSize: 11.5, color: T.statusAtivoTx, fontWeight: 600, marginTop: 3 }}>
                        Assinado em {fmtDataHora(c.assinado_em)}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                    {c.status === 'assinado' && (
                      <button
                        type="button"
                        onClick={() => handleVerAssinatura(c)}
                        disabled={abrindoAss === c.id}
                        style={btnLinha}
                      >
                        {abrindoAss === c.id
                          ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Abrindo...</>
                          : <><PenLine size={13} /> Ver assinatura</>}
                      </button>
                    )}
                    {['gerado', 'aguardando_assinatura'].includes(c.status) && (
                      <button
                        type="button"
                        onClick={() => handleCopiarLink(c)}
                        disabled={copiando === c.id}
                        style={btnLinha}
                      >
                        {copiando === c.id
                          ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> ...</>
                          : copiado === c.id
                            ? <><Check size={13} color={T.statusAtivoTx} /> Copiado</>
                            : <><Link2 size={13} /> Copiar link</>}
                      </button>
                    )}
                    {c.tem_pdf && (
                      <button
                        type="button"
                        onClick={() => handleBaixar(c)}
                        disabled={baixando === c.id}
                        style={btnLinha}
                      >
                        {baixando === c.id
                          ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Abrindo...</>
                          : <><Download size={13} /> Baixar PDF</>}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {['gerado', 'aguardando_assinatura'].includes(contratoAtual?.status) && (
          <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: T.muted, marginTop: 14, lineHeight: 1.6 }}>
            <Copy size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            Envie o link de assinatura ao cliente — ele vale 7 dias
            {contratoAtual?.token_expira_em ? ` (até ${fmtDataHora(contratoAtual.token_expira_em)})` : ''} e
            deixa de funcionar assim que for assinado. Gerar um contrato novo cancela este e emite outro link.
          </p>
        )}
      </Secao>

      {editando && (
        <ModalEditarContratante
          lojaId={loja.loja_id}
          lojaNome={loja.nome}
          inicial={contratante}
          onFechar={() => setEditando(false)}
          onSalvo={async () => { setEditando(false); await fetchTudo() }}
        />
      )}

      {assinatura && <ModalAssinatura dados={assinatura} onFechar={() => setAssinatura(null)} />}

      {confirmandoPlano && (
        <ModalTrocarPlano
          loja={loja}
          planoNovo={confirmandoPlano}
          autor={autor}
          onFechar={() => setConfirmandoPlano(null)}
          onSalvo={fetchTudo}
        />
      )}

      {confirmandoGratuito && (
        <ModalGratuito
          loja={loja}
          pendentes={pendentes}
          autor={autor}
          onFechar={() => setConfirmandoGratuito(false)}
          onSalvo={fetchTudo}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
