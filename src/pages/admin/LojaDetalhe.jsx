import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, FileText, Download, AlertCircle, Loader2, Check, ExternalLink,
  PenLine, Link2, X, Copy,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { T } from '../../theme/tokens'
import { PLANOS, valorPlano, fmtValorPlano, nomeModulo } from '../../utils/planos'

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

export default function LojaDetalhe() {
  const { slug } = useParams()
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

  const fetchTudo = useCallback(async () => {
    setFetching(true); setFetchError('')
    const { data: cfg, error: cfgErr } = await supabase
      .from('lf_config').select('*')
      .or(`loja_id.eq.${slug},slug.eq.${slug}`)
      .maybeSingle()
    if (cfgErr) { setFetchError(cfgErr.message); setFetching(false); return }
    if (!cfg)   { setLoja(null); setFetching(false); return }
    setLoja(cfg)

    const [listaRes, cobrancaRes, contratanteRes] = await Promise.all([
      supabase.functions.invoke('gerar-contrato', {
        body: { action: 'listar', loja_id: cfg.loja_id },
      }),
      // Só para exibir no cabeçalho. O valor que vai para o contrato é
      // recalculado na function, que é quem grava o snapshot.
      supabase.from('jt_cobrancas').select('valor')
        .eq('loja_id', cfg.loja_id).order('created_at', { ascending: false }).limit(1),
      // jt_contratantes é invisível para o navegador (RLS sem policy).
      supabase.functions.invoke('gerar-contrato', {
        body: { action: 'contratante-obter', loja_id: cfg.loja_id },
      }),
    ])
    const listaErro = listaRes.error?.message || listaRes.data?.error
    if (listaErro) setErro(`Erro ao carregar os contratos: ${listaErro}`)
    setContratos(listaRes.data?.contratos || [])

    const ctErro = contratanteRes.error?.message || contratanteRes.data?.error
    if (ctErro) setErro(`Erro ao carregar os dados do contratante: ${ctErro}`)
    setContratante(contratanteRes.data?.contratante || null)

    const doBanco = cobrancaRes.data?.[0]?.valor
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
      <Secao title="Dados do contratante">
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
            <Link to="/clientes" style={{ fontSize: 12.5, fontWeight: 700, color: T.purpleText, textDecoration: 'none' }}>
              Editar cadastro da loja →
            </Link>
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

      {assinatura && <ModalAssinatura dados={assinatura} onFechar={() => setAssinatura(null)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
