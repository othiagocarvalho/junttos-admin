import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { T } from '../../theme/tokens'
import {
  Plus, X, Loader2, AlertCircle, ChevronDown, ChevronUp,
  RefreshCw, Share2, Link2, Unlink, Building2,
  FileText, Download, Copy, Check,
} from 'lucide-react'
import CamposContratante from '../../components/admin/CamposContratante'
import { CONTRATANTE_VAZIO, apenasContratante } from '../../components/admin/contratante'

// ── shared input style ───────────────────────────────────────────
const inp = {
  width: '100%', height: 44, boxSizing: 'border-box',
  background: T.mist, border: `1.5px solid ${T.line}`,
  borderRadius: T.rInput, padding: '0 14px',
  fontFamily: T.ui, fontSize: 14, color: T.ink, outline: 'none',
}

// Mesmo mapa de status de LojaDetalhe.jsx, duplicado aqui de propósito: os
// dois arquivos não compartilham um módulo de UI hoje, e criar um só para
// isto arriscaria mexer no fluxo de contrato individual à toa.
const STATUS_CONTRATO = {
  rascunho:              { label: 'Rascunho',              bg: T.statusTrialBg, tx: T.statusTrialTx },
  gerado:                { label: 'Gerado',                bg: T.statusAtivoBg, tx: T.statusAtivoTx },
  aguardando_assinatura: { label: 'Aguardando assinatura', bg: T.tintPurple,    tx: T.purpleText   },
  assinado:              { label: 'Assinado',              bg: T.statusAtivoBg, tx: T.statusAtivoTx },
  cancelado:             { label: 'Cancelado',             bg: T.tintCoral,     tx: T.coralText    },
}

function StatusPillContrato({ status }) {
  const s = STATUS_CONTRATO[status] || { label: status || '—', bg: T.mist, tx: T.muted }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: T.rPill,
      background: s.bg, color: s.tx, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

function fmtDataHora(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function Section({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 14px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{title}</p>
      <div style={{ flex: 1, height: 1, background: T.line }} />
    </div>
  )
}

// ── Modal: criar nova rede ───────────────────────────────────────
function NovaRedeModal({ open, onClose, onCreated }) {
  const [nome,     setNome]     = useState('')
  const [donoNome, setDonoNome] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!open) return
    setNome(''); setDonoNome(''); setError(''); setSaving(false)
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  async function handleSave(e) {
    e.preventDefault()
    if (!nome.trim()) { setError('Nome da rede é obrigatório.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('jt_redes').insert({ nome: nome.trim(), dono_nome: donoNome.trim() || null })
    if (err) { setError(err.message); setSaving(false); return }
    onCreated()
    onClose()
  }

  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 460, boxShadow: T.darkCardShadow, fontFamily: T.ui }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 0' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 2 }}>Nova Rede</h2>
            <p style={{ fontSize: 13, color: T.muted }}>Agrupe lojas do mesmo dono ou franquia.</p>
          </div>
          <button onClick={onClose} style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={T.muted} />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ padding: '20px 28px 28px' }}>
          <Section title="Dados da rede" />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Nome da rede *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Grupo Maria Fashion" style={inp} autoFocus />
          </div>
          <div style={{ marginBottom: 4 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Responsável / dono</label>
            <input value={donoNome} onChange={e => setDonoNome(e.target.value)} placeholder="Ex: Maria Silva (opcional)" style={inp} />
          </div>
          {error && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '12px 14px', marginTop: 16 }}>
              <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: T.coralText }}>{error}</p>
            </div>
          )}
          <button type="submit" disabled={saving} style={{
            marginTop: 20, width: '100%', height: 48, borderRadius: T.rCard,
            background: saving ? T.mist : T.purple, color: saving ? T.muted : T.white,
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: T.ui, fontSize: 15, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: saving ? 'none' : '0 4px 16px rgba(94,43,208,0.28)',
          }}>
            {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Criando...</> : <><Plus size={16} /> Criar Rede</>}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// Mesmos 7 campos obrigatórios de LojaDetalhe.jsx (OBRIGATORIOS) — sem eles o
// contrato sai com cláusula pela metade. Duplicado aqui pelo mesmo motivo do
// StatusPillContrato acima.
const OBRIGATORIOS_REDE = [
  { key: 'razao_social',     label: 'Razão social / Nome completo' },
  { key: 'cpf_cnpj',         label: 'CPF / CNPJ' },
  { key: 'responsavel_nome', label: 'Responsável' },
  { key: 'cidade',           label: 'Cidade — usada no foro' },
  { key: 'estado',           label: 'UF — usada no foro' },
  { key: 'contrato_inicio',  label: 'Início do contrato' },
  { key: 'vencimento_dia',   label: 'Dia de vencimento' },
]

/**
 * Gera um contrato cobrindo várias lojas da rede de uma vez, um contratante
 * único, um link de assinatura só.
 *
 * A lista de lojas vem com TODAS pré-marcadas, nunca "todas obrigatoriamente"
 * — quem gera decide na hora quais entram neste contrato específico.
 * Loja que já tem contrato individual em aberto ou assinado ganha um aviso ao
 * lado (não é desmarcada sozinha): é informação para quem gera decidir, não
 * uma regra automática que poderia errar em algum caso que a tela não previu.
 */
function ModalContratoRede({ rede, lojasDaRede, onFechar, onGerado }) {
  const [carregando, setCarregando]   = useState(true)
  const [contratante, setContratante] = useState({ ...CONTRATANTE_VAZIO })
  const [selecionadas, setSelecionadas] = useState(() => new Set(lojasDaRede.map(l => l.loja_id)))
  const [comContratoIndividual, setComContratoIndividual] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [resultado, setResultado] = useState(null) // contrato recém-gerado
  const [copiando, setCopiando]   = useState(false)
  const [copiado, setCopiado]     = useState(false)

  useEffect(() => {
    let vivo = true
    async function carregar() {
      setCarregando(true)
      const [ctRes, ...listaRes] = await Promise.all([
        supabase.functions.invoke('gerar-contrato', { body: { action: 'contratante-obter', rede_id: rede.id } }),
        // Uma chamada 'listar' por loja da rede, só para saber se ela já tem
        // contrato individual — mesma action que LojaDetalhe já usa, sem
        // precisar de rota nova na function.
        ...lojasDaRede.map(l => supabase.functions.invoke('gerar-contrato', { body: { action: 'listar', loja_id: l.loja_id } })),
      ])
      if (!vivo) return
      setContratante({ ...CONTRATANTE_VAZIO, ...apenasContratante(ctRes.data?.contratante || {}) })
      const flags = {}
      lojasDaRede.forEach((l, i) => {
        const contratos = listaRes[i]?.data?.contratos || []
        flags[l.loja_id] = contratos.some(c => c.status !== 'cancelado')
      })
      setComContratoIndividual(flags)
      setCarregando(false)
    }
    carregar()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rede.id])

  useEffect(() => {
    function esc(e) { if (e.key === 'Escape' && !salvando) onFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar, salvando])

  function toggleLoja(lojaId) {
    setSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(lojaId)) next.delete(lojaId); else next.add(lojaId)
      return next
    })
  }

  const faltando = OBRIGATORIOS_REDE.filter(({ key }) => key === 'vencimento_dia'
    ? !Number(contratante[key])
    : !String(contratante[key] ?? '').trim())
  const podeGerar = !carregando && faltando.length === 0 && selecionadas.size > 0 && !salvando

  async function handleGerar(e) {
    e.preventDefault()
    if (!podeGerar) return
    setSalvando(true); setErro('')

    // Salva o contratante da rede primeiro — fica pronto para a próxima
    // geração reaproveitar sem redigitar CNPJ/endereço.
    const salvarRes = await supabase.functions.invoke('gerar-contrato', {
      body: { action: 'contratante-salvar', rede_id: rede.id, contratante },
    })
    const msgSalvar = salvarRes.error?.message || salvarRes.data?.error
    if (msgSalvar) { setErro(`Não foi possível salvar o contratante: ${msgSalvar}`); setSalvando(false); return }

    const gerarRes = await supabase.functions.invoke('gerar-contrato', {
      body: { action: 'gerar', rede_id: rede.id, lojas_ids: [...selecionadas] },
    })
    const msgGerar = gerarRes.error?.message || gerarRes.data?.error
    if (msgGerar) { setErro(`Não foi possível gerar o contrato: ${msgGerar}`); setSalvando(false); return }

    setResultado(gerarRes.data.contrato)
    setSalvando(false)
    onGerado()
  }

  async function handleCopiarLink() {
    if (!resultado) return
    setCopiando(true); setErro('')
    const { data, error } = await supabase.functions.invoke('gerar-contrato', {
      body: { action: 'link-assinatura', contrato_id: resultado.id },
    })
    const msg = error?.message || data?.error
    if (msg) { setErro(`Erro ao obter o link: ${msg}`); setCopiando(false); return }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/contrato/${data.token}`)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro(`Não foi possível copiar. O link é: ${window.location.origin}/contrato/${data.token}`)
    }
    setCopiando(false)
  }

  return (
    <div
      onClick={() => { if (!salvando) onFechar() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(22,16,31,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: T.white, borderRadius: T.rCard + 4, width: '100%', maxWidth: 560, boxShadow: T.darkCardShadow, maxHeight: '90vh', overflowY: 'auto', fontFamily: T.ui }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '24px 28px 0' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 2 }}>Gerar contrato da rede</h2>
            <p style={{ fontSize: 13, color: T.muted, wordBreak: 'break-word' }}>{rede.nome}</p>
          </div>
          <button
            type="button" onClick={onFechar} disabled={salvando}
            style={{ background: T.mist, border: 'none', borderRadius: T.rInput, width: 36, height: 36, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <X size={16} color={T.muted} />
          </button>
        </div>

        {carregando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 14, padding: 28 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Carregando dados da rede...
          </div>
        ) : resultado ? (
          <div style={{ padding: '20px 28px 28px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.statusAtivoBg, borderRadius: T.rInput, padding: '14px 16px', marginBottom: 16 }}>
              <Check size={16} color={T.statusAtivoTx} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: T.statusAtivoTx, marginBottom: 3 }}>Contrato gerado</p>
                <p style={{ fontSize: 12.5, color: T.statusAtivoTx, lineHeight: 1.55 }}>
                  Cobrindo {selecionadas.size} {selecionadas.size === 1 ? 'loja' : 'lojas'} — total R$ {Number(resultado.valor_mensal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês.
                  Copie o link abaixo e envie ao responsável da rede para assinar — vale 7 dias e cobre todas as lojas listadas de uma vez.
                </p>
              </div>
            </div>
            <button
              type="button" onClick={handleCopiarLink} disabled={copiando}
              style={{
                width: '100%', height: 46, borderRadius: T.rInput, border: 'none',
                background: copiando ? T.mist : T.purple, color: copiando ? T.muted : T.white,
                cursor: copiando ? 'not-allowed' : 'pointer', fontFamily: T.ui, fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {copiando
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> ...</>
                : copiado
                  ? <><Check size={15} /> Link copiado</>
                  : <><Link2 size={15} /> Copiar link de assinatura</>}
            </button>
            {erro && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rInput, padding: '12px 14px', marginTop: 14 }}>
                <AlertCircle size={14} color={T.coralText} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: T.coralText, lineHeight: 1.5 }}>{erro}</p>
              </div>
            )}
            <button
              type="button" onClick={onFechar}
              style={{ width: '100%', height: 44, marginTop: 10, borderRadius: T.rInput, border: `1.5px solid ${T.line}`, background: T.mist, cursor: 'pointer', fontFamily: T.ui, fontWeight: 600, color: T.muted, fontSize: 13.5 }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleGerar} style={{ padding: '18px 28px 28px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
              Lojas incluídas neste contrato
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {lojasDaRede.map(l => (
                <label key={l.loja_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: T.mist, borderRadius: T.rInput, border: `1px solid ${T.line}`, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selecionadas.has(l.loja_id)} onChange={() => toggleLoja(l.loja_id)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</p>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0, fontFamily: T.mono }}>/{l.slug || l.loja_id}</p>
                  </div>
                  {comContratoIndividual[l.loja_id] && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: T.rPill, background: T.statusTrialBg, color: T.statusTrialTx, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      já tem contrato individual
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>
              Desmarque lojas que já têm contrato individual próprio, se este contrato de rede não deve cobri-las também — gerar aqui nunca cancela um contrato individual existente.
            </p>

            <CamposContratante
              valores={contratante}
              onChange={(campo, valor) => setContratante(p => ({ ...p, [campo]: valor }))}
              intro="Dados do contratante da rede — reaproveitados na próxima vez que gerar contrato para esta rede."
            />

            {faltando.length > 0 && selecionadas.size > 0 && (
              <div style={{ background: T.statusTrialBg, border: `1px solid ${T.statusTrialTx}33`, borderRadius: T.rInput, padding: '12px 14px', marginTop: 4, marginBottom: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: T.statusTrialTx, marginBottom: 4 }}>Faltam dados obrigatórios</p>
                <ul style={{ margin: '0 0 0 16px', padding: 0 }}>
                  {faltando.map(({ key, label }) => (
                    <li key={key} style={{ fontSize: 11.5, color: T.statusTrialTx, lineHeight: 1.6 }}>{label}</li>
                  ))}
                </ul>
              </div>
            )}

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
                type="submit" disabled={!podeGerar}
                style={{
                  flex: 2, height: 46, borderRadius: T.rInput, border: 'none',
                  background: podeGerar ? T.purple : T.mist,
                  color: podeGerar ? T.white : T.muted,
                  cursor: podeGerar ? 'pointer' : 'not-allowed',
                  fontFamily: T.ui, fontWeight: 700, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {salvando
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</>
                  : <><FileText size={15} /> Gerar contrato ({selecionadas.size})</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Rede card ────────────────────────────────────────────────────
function RedeCard({ rede, lojas, allLojas, onRefresh }) {
  const [expanded,      setExpanded]      = useState(false)
  const [linkingLojaId, setLinkingLojaId] = useState('')
  const [linking,       setLinking]       = useState(false)
  const [unlinking,     setUnlinking]     = useState(null) // loja_id being unlinked
  const [linkError,     setLinkError]     = useState('')

  // Contrato de rede — modal de geração e histórico dos já gerados.
  const [contratoModalAberto,  setContratoModalAberto]  = useState(false)
  const [contratosRede,        setContratosRede]        = useState([])
  const [carregandoContratos,  setCarregandoContratos]  = useState(false)
  const [baixando,             setBaixando]             = useState(null)
  const [copiandoHist,         setCopiandoHist]         = useState(null)
  const [copiadoHist,          setCopiadoHist]          = useState(null)

  // Lojas that can be linked: currently unassigned OR already in this rede
  const lojasDaRede    = lojas.filter(l => l.rede_id === rede.id)
  const lojasDisponiveis = allLojas.filter(l => !l.rede_id)

  const carregarContratosRede = useCallback(async () => {
    setCarregandoContratos(true)
    const { data, error } = await supabase.functions.invoke('gerar-contrato', {
      body: { action: 'listar', rede_id: rede.id },
    })
    if (!error && !data?.error) setContratosRede(data?.contratos || [])
    setCarregandoContratos(false)
  }, [rede.id])

  // Só busca quando expande — evita N chamadas extras por rede na tela toda
  // carregar de uma vez.
  useEffect(() => { if (expanded) carregarContratosRede() }, [expanded, carregarContratosRede])

  async function handleBaixarContrato(contrato) {
    setBaixando(contrato.id)
    const { data, error } = await supabase.functions
      .invoke('gerar-contrato', { body: { action: 'link', contrato_id: contrato.id } })
    const msg = error?.message || data?.error
    if (msg) { setBaixando(null); return }
    window.open(data.url, '_blank', 'noopener,noreferrer')
    setBaixando(null)
  }

  async function handleCopiarLinkContrato(contrato) {
    setCopiandoHist(contrato.id)
    const { data, error } = await supabase.functions
      .invoke('gerar-contrato', { body: { action: 'link-assinatura', contrato_id: contrato.id } })
    const msg = error?.message || data?.error
    if (msg) { setCopiandoHist(null); return }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/contrato/${data.token}`)
      setCopiadoHist(contrato.id)
      setTimeout(() => setCopiadoHist(null), 2500)
    } catch { /* clipboard indisponível — sem crash, só não copia */ }
    setCopiandoHist(null)
  }

  async function handleLink(e) {
    e.preventDefault()
    if (!linkingLojaId) return
    setLinking(true); setLinkError('')
    const { error } = await supabase
      .from('lf_config')
      .update({ rede_id: rede.id })
      .eq('loja_id', linkingLojaId)
    if (error) { setLinkError(error.message); setLinking(false); return }
    setLinkingLojaId('')
    setLinking(false)
    onRefresh()
  }

  async function handleUnlink(lojaId) {
    setUnlinking(lojaId)
    const { error } = await supabase
      .from('lf_config')
      .update({ rede_id: null })
      .eq('loja_id', lojaId)
    setUnlinking(null)
    if (!error) onRefresh()
  }

  return (
    <div style={{ background: T.white, borderRadius: T.rCard, border: `1px solid ${T.line}`, boxShadow: T.cardShadow, overflow: 'hidden', fontFamily: T.ui }}>
      {/* Header */}
      <div
        role="button" tabIndex={0}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', cursor: 'pointer', userSelect: 'none' }}
      >
        {/* Icon */}
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.tintPurple, border: `1px solid ${T.purple}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Share2 size={18} color={T.purple} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rede.nome}
          </p>
          {rede.dono_nome && (
            <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>{rede.dono_nome}</p>
          )}
        </div>

        {/* Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.purpleText, background: T.tintPurple, padding: '3px 10px', borderRadius: 99 }}>
            {lojasDaRede.length} {lojasDaRede.length === 1 ? 'loja' : 'lojas'}
          </span>
          {expanded
            ? <ChevronUp  size={16} color={T.muted} />
            : <ChevronDown size={16} color={T.muted} />
          }
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.line}`, padding: '18px 20px' }}>

          {/* Lojas vinculadas */}
          <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Lojas vinculadas
          </p>
          {lojasDaRede.length === 0 ? (
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 16, fontStyle: 'italic' }}>Nenhuma loja vinculada ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {lojasDaRede.map(loja => (
                <div key={loja.loja_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: T.mist, borderRadius: T.rInput, border: `1px solid ${T.line}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: T.tintPurple, border: `1px solid ${T.purple}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={14} color={T.purple} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {loja.nome}
                    </p>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0, fontFamily: T.mono }}>/{loja.slug || loja.loja_id}</p>
                  </div>
                  <button
                    onClick={() => handleUnlink(loja.loja_id)}
                    disabled={unlinking === loja.loja_id}
                    title="Desvincular loja"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.muted, flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.coral; e.currentTarget.style.color = T.coralText }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.color = T.muted }}
                  >
                    {unlinking === loja.loja_id
                      ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Unlink size={12} />
                    }
                    Desvincular
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Vincular nova loja */}
          <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Vincular loja
          </p>
          {lojasDisponiveis.length === 0 ? (
            <p style={{ fontSize: 13, color: T.muted, fontStyle: 'italic' }}>
              Todas as lojas já pertencem a uma rede.
            </p>
          ) : (
            <form onSubmit={handleLink} style={{ display: 'flex', gap: 8 }}>
              <select
                value={linkingLojaId}
                onChange={e => setLinkingLojaId(e.target.value)}
                style={{ ...inp, flex: 1, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%237B7390' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
              >
                <option value="">Selecione uma loja...</option>
                {lojasDisponiveis.map(l => (
                  <option key={l.loja_id} value={l.loja_id}>{l.nome} (/{l.slug || l.loja_id})</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!linkingLojaId || linking}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 18px', height: 44, borderRadius: T.rInput, border: 'none', background: linkingLojaId && !linking ? T.purple : T.mist, color: linkingLojaId && !linking ? T.white : T.muted, cursor: linkingLojaId && !linking ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, flexShrink: 0, fontFamily: T.ui }}
              >
                {linking ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Link2 size={14} />}
                Vincular
              </button>
            </form>
          )}
          {linkError && (
            <p style={{ fontSize: 12, color: T.coralText, marginTop: 8 }}>{linkError}</p>
          )}

          {/* Contrato da rede */}
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Contrato da rede
              </p>
              <button
                type="button"
                onClick={() => setContratoModalAberto(true)}
                disabled={lojasDaRede.length === 0}
                title={lojasDaRede.length === 0 ? 'Vincule ao menos uma loja para gerar contrato' : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px',
                  borderRadius: T.rInput, border: 'none',
                  background: lojasDaRede.length === 0 ? T.mist : T.purple,
                  color: lojasDaRede.length === 0 ? T.muted : T.white,
                  cursor: lojasDaRede.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: T.ui, fontSize: 12.5, fontWeight: 700,
                }}
              >
                <FileText size={13} /> Gerar contrato para a rede inteira
              </button>
            </div>

            {carregandoContratos ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: 12.5, padding: '8px 0' }}>
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                Carregando contratos...
              </div>
            ) : contratosRede.length === 0 ? (
              <p style={{ fontSize: 12.5, color: T.muted, fontStyle: 'italic' }}>Nenhum contrato de rede gerado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contratosRede.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, flexWrap: 'wrap',
                    background: T.mist, border: `1px solid ${T.line}`,
                    borderRadius: T.rInput, padding: '10px 14px',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <StatusPillContrato status={c.status} />
                        <span style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>
                          {c.gerado_em ? `Gerado em ${fmtDataHora(c.gerado_em)}` : `Criado em ${fmtDataHora(c.created_at)}`}
                        </span>
                      </div>
                      <p style={{ fontSize: 11.5, color: T.muted }}>
                        {(c.lojas_incluidas || []).length} {(c.lojas_incluidas || []).length === 1 ? 'loja' : 'lojas'} · R$ {Number(c.valor_mensal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                        {c.assinado_em ? ` · assinado em ${fmtDataHora(c.assinado_em)}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
                      {['gerado', 'aguardando_assinatura'].includes(c.status) && (
                        <button
                          type="button" onClick={() => handleCopiarLinkContrato(c)} disabled={copiandoHist === c.id}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 10px', borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: T.ink }}
                        >
                          {copiandoHist === c.id
                            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                            : copiadoHist === c.id
                              ? <Check size={11} color={T.statusAtivoTx} />
                              : <Copy size={11} />}
                          {copiadoHist === c.id ? 'Copiado' : 'Copiar link'}
                        </button>
                      )}
                      {c.tem_pdf && (
                        <button
                          type="button" onClick={() => handleBaixarContrato(c)} disabled={baixando === c.id}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 10px', borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: T.ink }}
                        >
                          {baixando === c.id
                            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Download size={11} />}
                          Baixar PDF
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {contratoModalAberto && (
        <ModalContratoRede
          rede={rede}
          lojasDaRede={lojasDaRede}
          onFechar={() => setContratoModalAberto(false)}
          onGerado={carregarContratosRede}
        />
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function Redes() {
  const [redes,      setRedes]      = useState([])
  const [lojas,      setLojas]      = useState([])
  const [fetching,   setFetching]   = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)

  const fetchAll = useCallback(async () => {
    setFetching(true); setFetchError('')
    const [redesRes, lojasRes] = await Promise.all([
      supabase.from('jt_redes').select('*').order('nome'),
      supabase.from('lf_config').select('loja_id, slug, nome, rede_id').order('nome'),
    ])
    if (redesRes.error) { setFetchError(redesRes.error.message); setFetching(false); return }
    if (lojasRes.error) { setFetchError(lojasRes.error.message); setFetching(false); return }
    setRedes(redesRes.data || [])
    setLojas(lojasRes.data || [])
    setFetching(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const totalVinculadas = lojas.filter(l => l.rede_id).length

  return (
    <div style={{ maxWidth: 860, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>Redes</h1>
          <p style={{ fontSize: 13.5, color: T.muted }}>
            Agrupamentos de lojas do mesmo dono ou franquia.
            {!fetching && redes.length > 0 && (
              <span> — {redes.length} {redes.length === 1 ? 'rede' : 'redes'}, {totalVinculadas} {totalVinculadas === 1 ? 'loja vinculada' : 'lojas vinculadas'}</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={fetchAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.mist, border: `1px solid ${T.line}`, borderRadius: T.rInput, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.muted }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.line }}
          >
            <RefreshCw size={13} /> Atualizar
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', borderRadius: T.rPill, background: T.purple, color: T.white, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(94,43,208,0.28)' }}
            onMouseEnter={e => { e.currentTarget.style.background = T.purpleDeep }}
            onMouseLeave={e => { e.currentTarget.style.background = T.purple }}
          >
            <Plus size={16} /> Nova Rede
          </button>
        </div>
      </div>

      {/* Content */}
      {fetching ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 14, padding: 24 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Carregando redes...
        </div>
      ) : fetchError ? (
        <div style={{ background: T.tintCoral, border: `1px solid ${T.coral}44`, borderRadius: T.rCard, padding: '20px 24px', display: 'flex', gap: 12 }}>
          <AlertCircle size={16} color={T.coralText} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.coralText, marginBottom: 4 }}>Erro ao carregar redes</p>
            <p style={{ fontSize: 12, color: T.coralText }}>{fetchError}</p>
          </div>
        </div>
      ) : redes.length === 0 ? (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: T.rCard, boxShadow: T.cardShadow, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: T.tintPurple, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Share2 size={24} color={T.purple} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Nenhuma rede criada</p>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>Crie uma rede para agrupar lojas do mesmo dono ou franquia.</p>
          <button onClick={() => setModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', borderRadius: T.rPill, background: T.purple, color: T.white, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: T.ui }}>
            <Plus size={15} /> Nova Rede
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {redes.map(rede => (
            <RedeCard
              key={rede.id}
              rede={rede}
              lojas={lojas}
              allLojas={lojas}
              onRefresh={fetchAll}
            />
          ))}
        </div>
      )}

      <NovaRedeModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={fetchAll} />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
