import { useState, useEffect } from 'react'
import { Settings, Save, Palette, ToggleRight, Lock, Bell, Receipt, Paperclip, Image as ImageIcon, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadLogo, validarArquivoLogo, urlComVersao, LOGO_ACCEPT } from '../../utils/uploadLogo'
import { useClientAuth } from '../../context/ClientAuthContext'
import Card from '../../components/studio/Card'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import Toggle from '../../components/studio/Toggle'

const PRESETS = [
  { label: 'Junttos',   primary: '#5E2BD0', accent: '#FF6F5E' },
  { label: 'Rosê',      primary: '#C9956C', accent: '#E8C4A8' },
  { label: 'Verde',     primary: '#16a34a', accent: '#4ade80' },
  { label: 'Azul',      primary: '#2563eb', accent: '#38bdf8' },
  { label: 'Borgonha',  primary: '#9D174D', accent: '#FB7185' },
]

const FEATURE_LABELS = {
  vendas:           'Nova Venda',
  historico:        'Histórico',
  metas:            'Metas',
  fechamento_caixa: 'Fechamento de Caixa',
  relatorios:       'Relatórios / Faturamento',
  clientes:         'Clientes',
  estoque:          'Estoque',
}

export default function LojaConfig({ config, features, saveConfig, theme, hideFeatureToggles = false }) {
  const { user } = useClientAuth()

  const [nome,   setNome]   = useState(config?.nome            || '')
  const [primary, setPrimary] = useState(config?.cor_primaria  || '#5E2BD0')
  const [accent,  setAccent]  = useState(config?.cor_secundaria || '#FF6F5E')
  const [feats,  setFeats]  = useState({ ...features })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const [pwdForm,   setPwdForm]   = useState({ current: '', novo: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg,    setPwdMsg]    = useState(null)

  // ── Logo da loja ──────────────────────────────────────────────────────
  // logoLocal existe só para o preview responder na hora. Depois que o
  // saveConfig volta, config.logo_url já traz o mesmo valor.
  const [logoLocal,     setLogoLocal]     = useState(null)
  const [logoEnviando,  setLogoEnviando]  = useState(false)
  const [logoMsg,       setLogoMsg]       = useState(null)

  // ── Fiscal (addon NFC-e) ──────────────────────────────────────────────
  const [inscricaoEstadual, setInscricaoEstadual] = useState(config?.inscricao_estadual || '')
  const [regimeTributario,  setRegimeTributario]  = useState(config?.regime_tributario  || '')
  const [cnae,               setCnae]              = useState(config?.cnae              || '')
  const [certValidade,       setCertValidade]      = useState(config?.certificado_a1_validade || '')
  const [certFile,           setCertFile]          = useState(null)
  const [certUploading,      setCertUploading]     = useState(false)
  const [certMsg,            setCertMsg]           = useState(null)

  useEffect(() => {
    if (config) {
      setNome(config.nome            || '')
      setPrimary(config.cor_primaria  || '#5E2BD0')
      setAccent(config.cor_secundaria || '#FF6F5E')
      setFeats({ ...features })
      setInscricaoEstadual(config.inscricao_estadual || '')
      setRegimeTributario(config.regime_tributario   || '')
      setCnae(config.cnae                             || '')
      setCertValidade(config.certificado_a1_validade || '')
      setLogoLocal(null)   // config.logo_url passa a mandar de novo
    }
  }, [config])

  function toggleFeat(key) {
    setFeats(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    setSaving(true)
    await saveConfig({
      nome: nome || 'Loja Feminina',
      cor_primaria:   primary,
      cor_secundaria: accent,
      features: feats,
      inscricao_estadual: inscricaoEstadual.trim() || null,
      regime_tributario:  regimeTributario || null,
      cnae:                cnae.trim() || null,
      certificado_a1_validade: certValidade || null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Sobe assim que o arquivo é escolhido, sem esperar o "Salvar
  // configurações": o botão salva campos de texto, e deixar o logo pendurado
  // nele faria o lojista escolher a imagem, ver o preview e perder tudo ao
  // sair da tela sem salvar.
  async function handleSelecionarLogo(e) {
    const file = e.target.files?.[0] || null
    // Zera o input para que reescolher o MESMO arquivo dispare onChange de novo.
    e.target.value = ''
    if (!file) return

    setLogoMsg(null)

    const erro = validarArquivoLogo(file)
    if (erro) { setLogoMsg({ type: 'error', text: erro }); return }

    const lojaId = config?.loja_id
    if (!lojaId) { setLogoMsg({ type: 'error', text: 'Loja não identificada. Recarregue a página.' }); return }

    setLogoEnviando(true)
    let url
    try {
      url = urlComVersao(await uploadLogo(supabase, lojaId, file))
    } catch (err) {
      setLogoEnviando(false)
      setLogoMsg({ type: 'error', text: 'Erro ao enviar o logo: ' + err.message })
      return
    }

    // A URL gravada leva o ?v= de propósito — o path no bucket é fixo, então
    // sem ele o header e o catálogo continuariam exibindo a imagem em cache.
    const saveErr = await saveConfig({ logo_url: url })
    setLogoEnviando(false)
    if (saveErr) {
      setLogoMsg({ type: 'error', text: 'Logo enviado, mas houve erro ao salvar: ' + saveErr.message })
      return
    }
    setLogoLocal(url)
    setLogoMsg({ type: 'success', text: 'Logo atualizado!' })
    setTimeout(() => setLogoMsg(null), 4000)
  }

  // Upload é uma chamada separada (Storage), então tem ação própria em vez
  // de esperar o "Salvar configurações" — o texto some fixado, o arquivo não.
  async function handleUploadCertificado() {
    if (!certFile) return
    setCertUploading(true)
    setCertMsg(null)
    const lojaId = config?.loja_id
    const path = `${lojaId}/${Date.now()}_${certFile.name}`
    const { error: uploadErr } = await supabase.storage
      .from('certificados-fiscais')
      .upload(path, certFile, { upsert: false })
    if (uploadErr) {
      setCertUploading(false)
      setCertMsg({ type: 'error', text: 'Erro ao enviar certificado: ' + uploadErr.message })
      return
    }
    const saveErr = await saveConfig({ certificado_a1_path: path })
    setCertUploading(false)
    if (saveErr) {
      setCertMsg({ type: 'error', text: 'Certificado enviado, mas houve erro ao salvar: ' + saveErr.message })
      return
    }
    setCertFile(null)
    setCertMsg({ type: 'success', text: 'Certificado enviado com sucesso!' })
    setTimeout(() => setCertMsg(null), 4000)
  }

  async function handleChangePwd() {
    const { current, novo, confirm } = pwdForm
    if (novo !== confirm) {
      setPwdMsg({ type: 'error', text: 'A nova senha e a confirmação não coincidem.' })
      return
    }
    if (novo.length < 6) {
      setPwdMsg({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' })
      return
    }
    setPwdSaving(true)
    setPwdMsg(null)
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user?.email,
      password: current,
    })
    if (authErr) {
      setPwdSaving(false)
      setPwdMsg({ type: 'error', text: 'Senha atual incorreta.' })
      return
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: novo })
    if (updateErr) {
      setPwdSaving(false)
      setPwdMsg({ type: 'error', text: 'Erro ao atualizar senha. Tente novamente.' })
      return
    }
    await saveConfig({ senha: novo })
    setPwdSaving(false)
    setPwdMsg({ type: 'success', text: 'Senha alterada com sucesso!' })
    setPwdForm({ current: '', novo: '', confirm: '' })
    setTimeout(() => setPwdMsg(null), 4000)
  }

  const logoAtual = logoLocal || config?.logo_url || null

  const sectionTitle = {
    fontSize: 14, fontWeight: 700, color: 'var(--ink)',
    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  }

  return (
    <div style={{ background: 'var(--bg)', padding: '0 16px 32px', minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Identidade */}
      <Card>
        <p style={sectionTitle}>
          <Settings size={16} style={{ color: theme.primary }} />
          Identidade da Loja
        </p>
        <Label>Nome da Loja</Label>
        <Input
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Ex: Estrada Moda Feminina"
        />

        <div style={{ height: 1, background: 'var(--line)', margin: '20px 0' }} />

        {/* Logo da loja — sem trava de plano: é ajuste de identidade, não
            funcionalidade de segmento. Vale para Starter, Pro, Business e
            para as lojas legadas. */}
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          <ImageIcon size={15} style={{ color: theme.primary }} />
          Logo da Loja
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Aparece no topo do app e no seu catálogo. JPG, PNG ou WEBP, até 2 MB.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{
            width: 72, height: 72, flexShrink: 0, borderRadius: 'var(--r-input)',
            border: '1px solid var(--line)', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {logoAtual ? (
              <img
                src={logoAtual}
                alt="Logo da loja"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <ImageIcon size={22} style={{ color: 'var(--muted)' }} />
            )}
          </div>

          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            minHeight: 44, padding: '0 16px', borderRadius: 'var(--r-input)',
            border: '1.5px dashed var(--line)', background: 'var(--surface)',
            cursor: logoEnviando ? 'wait' : 'pointer',
            opacity: logoEnviando ? 0.6 : 1,
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
            color: 'var(--ink)',
          }}>
            <Upload size={15} />
            {logoEnviando ? 'Enviando...' : logoAtual ? 'Trocar logo' : 'Escolher logo'}
            <input
              type="file"
              accept={LOGO_ACCEPT}
              onChange={handleSelecionarLogo}
              disabled={logoEnviando}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {logoMsg && (
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            fontSize: 13, fontWeight: 500, fontFamily: 'Plus Jakarta Sans, sans-serif',
            ...(logoMsg.type === 'success'
              ? { background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', color: '#16a34a' }
              : { background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }),
          }}>
            {logoMsg.text}
          </div>
        )}
      </Card>

      {/* Funcionalidades — hideFeatureToggles: as 7 chaves de FEATURE_LABELS
          não têm nenhum efeito no Mercado hoje (nenhuma tela do módulo lê
          essas flags), então o Mercado esconde essa seção pra não confundir
          o lojista com toggles que não fazem nada. Lógica da Moda intacta —
          só a leitura da prop muda aqui. */}
      {!hideFeatureToggles && (
        <Card>
          <p style={{ ...sectionTitle, marginBottom: 4 }}>
            <ToggleRight size={16} style={{ color: theme.primary }} />
            Funcionalidades Habilitadas
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Controle quais abas e módulos ficam visíveis para esta loja.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(FEATURE_LABELS).map(([key, label]) => {
              const on = feats[key] ?? false
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 'var(--r-input)',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    {label}
                  </span>
                  <Toggle on={on} onClick={() => toggleFeat(key)} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Dados Fiscais — addon NFC-e, ainda sem provedor integrado. Só
          aparece quando o addon está ativo (features.nfce_ativo), que hoje
          começa desligado em todas as lojas. */}
      {features?.nfce_ativo && (
        <Card>
          <p style={sectionTitle}>
            <Receipt size={16} style={{ color: theme.primary }} />
            Dados Fiscais
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Necessário para emitir NFC-e.
          </p>

          <div style={{ marginBottom: 14 }}>
            <Label>Inscrição Estadual</Label>
            <Input
              value={inscricaoEstadual}
              onChange={e => setInscricaoEstadual(e.target.value)}
              placeholder="Ex: 123.456.789.112"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <Label>Regime Tributário</Label>
            <select
              value={regimeTributario}
              onChange={e => setRegimeTributario(e.target.value)}
              style={{
                width: '100%', height: 44, boxSizing: 'border-box',
                background: 'var(--bg)', border: '1.5px solid var(--line)',
                borderRadius: 'var(--r-input)', padding: '0 14px',
                fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)',
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">Selecione...</option>
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <Label>CNAE</Label>
            <Input
              value={cnae}
              onChange={e => setCnae(e.target.value)}
              placeholder="Ex: 4711-3/02"
            />
          </div>

          <div style={{ height: 1, background: 'var(--line)', margin: '4px 0 20px' }} />

          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Certificado Digital A1
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 44, borderRadius: 'var(--r-input)', border: '1.5px dashed var(--line)',
              padding: '0 14px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 13, color: 'var(--muted)',
            }}>
              <Paperclip size={15} />
              {certFile ? certFile.name : 'Selecionar arquivo .pfx ou .p12'}
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={e => setCertFile(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <Button
            variant="secondary"
            onClick={handleUploadCertificado}
            disabled={!certFile || certUploading}
            style={{ marginBottom: 16 }}
          >
            {certUploading ? 'Enviando...' : 'Enviar certificado'}
          </Button>

          {certMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 16,
              fontSize: 13, fontWeight: 500, fontFamily: 'Plus Jakarta Sans, sans-serif',
              ...(certMsg.type === 'success'
                ? { background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', color: '#16a34a' }
                : { background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }),
            }}>
              {certMsg.text}
            </div>
          )}

          <div>
            <Label>Validade do Certificado</Label>
            <Input
              type="date"
              value={certValidade || ''}
              onChange={e => setCertValidade(e.target.value)}
            />
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16, fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.5 }}>
            A senha do certificado não é pedida aqui — será solicitada só na hora de emitir, quando integrarmos o provedor de NFC-e.
          </p>
        </Card>
      )}

      {/* Notificações */}
      <Card>
        <p style={sectionTitle}>
          <Bell size={16} style={{ color: theme.primary }} />
          Notificações no Celular
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderRadius: 'var(--r-input)',
          border: '1px solid var(--line)', background: 'var(--bg)',
        }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Notificações push
            </span>
            <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', marginTop: 2 }}>
              Em breve, via app
            </p>
          </div>
          <Toggle on={false} onClick={() => {}} disabled />
        </div>
      </Card>

      {/* Tema */}
      <Card>
        <p style={sectionTitle}>
          <Palette size={16} style={{ color: theme.primary }} />
          Tema de Cores
        </p>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <div
              key={p.label}
              role="button"
              tabIndex={0}
              onClick={() => { setPrimary(p.primary); setAccent(p.accent) }}
              onKeyDown={e => e.key === 'Enter' && (setPrimary(p.primary), setAccent(p.accent))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                fontSize: 12, fontWeight: 500, fontFamily: 'Plus Jakarta Sans, sans-serif',
                userSelect: 'none',
                ...(primary === p.primary
                  ? { border: `1px solid ${p.primary}`, background: `${p.primary}15`, color: p.primary }
                  : { border: '1px solid var(--line)', color: 'var(--muted)', background: 'transparent' }),
              }}
            >
              <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.primary }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.accent }} />
              </div>
              {p.label}
            </div>
          ))}
        </div>

        {/* Color pickers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <Label>Cor primária</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
                style={{ width: 40, height: 40, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', cursor: 'pointer', padding: 2, background: 'var(--surface)', flexShrink: 0 }} />
              <Input mono value={primary} onChange={e => setPrimary(e.target.value)}
                style={{ flex: 1 }} />
            </div>
          </div>
          <div>
            <Label>Cor de destaque</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                style={{ width: 40, height: 40, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', cursor: 'pointer', padding: 2, background: 'var(--surface)', flexShrink: 0 }} />
              <Input mono value={accent} onChange={e => setAccent(e.target.value)}
                style={{ flex: 1 }} />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div style={{ borderRadius: 'var(--r-input)', padding: 12, border: '1px solid var(--line)', background: 'var(--bg)' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Preview</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ height: 32, flex: 1, borderRadius: 'var(--r-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: primary, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Primária
            </div>
            <div style={{ height: 32, flex: 1, borderRadius: 'var(--r-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: accent, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Destaque
            </div>
          </div>
        </div>
      </Card>

      {/* Salvar */}
      <Button
        variant="primary"
        fullWidth
        icon={Save}
        onClick={handleSave}
        disabled={saving}
        style={saved ? { background: '#16a34a', boxShadow: 'none' } : undefined}
      >
        {saved ? 'Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
      </Button>

      {/* Alterar Senha */}
      <Card>
        <p style={sectionTitle}>
          <Lock size={16} style={{ color: theme.primary }} />
          Alterar Senha
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label>Senha atual</Label>
            <Input
              type="password" value={pwdForm.current} autoComplete="current-password"
              onChange={e => setPwdForm({ ...pwdForm, current: e.target.value })}
              placeholder="••••••••"
            />
          </div>
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password" value={pwdForm.novo} autoComplete="new-password"
              onChange={e => setPwdForm({ ...pwdForm, novo: e.target.value })}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              type="password" value={pwdForm.confirm} autoComplete="new-password"
              onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          {pwdMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              fontSize: 13, fontWeight: 500, fontFamily: 'Plus Jakarta Sans, sans-serif',
              ...(pwdMsg.type === 'success'
                ? { background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', color: '#16a34a' }
                : { background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }),
            }}>
              {pwdMsg.text}
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleChangePwd}
            disabled={pwdSaving || !pwdForm.current || !pwdForm.novo || !pwdForm.confirm}
          >
            {pwdSaving ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
