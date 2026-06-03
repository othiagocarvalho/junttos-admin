import { useState, useEffect } from 'react'
import { Settings, Save, Palette, ToggleLeft, ToggleRight } from 'lucide-react'

const PRESETS = [
  { label: 'Junttos', primary: '#5E2BD0', accent: '#FF6F5E' },
  { label: 'Rosê', primary: '#C9956C', accent: '#E8C4A8' },
  { label: 'Verde', primary: '#16a34a', accent: '#4ade80' },
  { label: 'Azul', primary: '#2563eb', accent: '#38bdf8' },
  { label: 'Borgonha', primary: '#9D174D', accent: '#FB7185' },
]

const FEATURE_LABELS = {
  vendas: 'Nova Venda',
  historico: 'Histórico',
  metas: 'Metas',
  fechamento_caixa: 'Fechamento de Caixa',
  relatorios: 'Relatórios / Faturamento',
  clientes: 'Clientes',
  estoque: 'Estoque',
}

export default function LojaConfig({ config, features, saveConfig, theme }) {
  const [nome, setNome] = useState(config?.nome || '')
  const [primary, setPrimary] = useState(config?.cor_primaria || '#5E2BD0')
  const [accent, setAccent] = useState(config?.cor_secundaria || '#FF6F5E')
  const [feats, setFeats] = useState({ ...features })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (config) {
      setNome(config.nome || '')
      setPrimary(config.cor_primaria || '#5E2BD0')
      setAccent(config.cor_secundaria || '#FF6F5E')
      setFeats({ ...features })
    }
  }, [config])

  function toggleFeat(key) {
    setFeats(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    setSaving(true)
    await saveConfig({
      nome: nome || 'Loja Feminina',
      cor_primaria: primary,
      cor_secundaria: accent,
      features: feats,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
        <p className="text-sm font-semibold text-[#16101F] mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" style={{ color: theme.primary }} />
          Identidade da Loja
        </p>
        <div>
          <label className="text-xs font-semibold text-[#7B7390] uppercase tracking-wider mb-1.5 block">Nome da Loja</label>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Estrada Moda Feminina"
            className={inp}
          />
        </div>
      </div>

      {/* Feature flags */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
        <p className="text-sm font-semibold text-[#16101F] mb-1 flex items-center gap-2">
          <ToggleRight className="w-4 h-4" style={{ color: theme.primary }} />
          Funcionalidades Habilitadas
        </p>
        <p className="text-xs text-[#7B7390] mb-4">
          Controle quais abas e módulos ficam visíveis para esta loja.
        </p>
        <div className="space-y-2">
          {Object.entries(FEATURE_LABELS).map(([key, label]) => {
            const on = feats[key] ?? false
            return (
              <button
                key={key}
                onClick={() => toggleFeat(key)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition"
                style={{
                  borderColor: on ? theme.primary + '40' : '#E6E0F0',
                  background: on ? theme.primary + '08' : '#FAFAFA',
                }}
              >
                <span className="text-sm font-medium text-[#16101F]">{label}</span>
                {on
                  ? <ToggleRight className="w-5 h-5" style={{ color: theme.primary }} />
                  : <ToggleLeft className="w-5 h-5 text-[#C4BAD4]" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Theme */}
      <div className="bg-white border border-[#E6E0F0] rounded-2xl p-5">
        <p className="text-sm font-semibold text-[#16101F] mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4" style={{ color: theme.primary }} />
          Tema de Cores
        </p>

        {/* Presets */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setPrimary(p.primary); setAccent(p.accent) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition"
              style={
                primary === p.primary
                  ? { borderColor: p.primary, background: p.primary + '15', color: p.primary }
                  : { borderColor: '#E6E0F0', color: '#7B7390' }
              }
            >
              <div className="flex gap-0.5">
                <div className="w-3 h-3 rounded-full" style={{ background: p.primary }} />
                <div className="w-3 h-3 rounded-full" style={{ background: p.accent }} />
              </div>
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-[#7B7390] mb-1.5 block">Cor primária</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className="w-10 h-10 rounded-lg border border-[#E6E0F0] cursor-pointer p-0.5"
              />
              <input
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className={inp + ' font-mono'}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#7B7390] mb-1.5 block">Cor de destaque</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accent}
                onChange={e => setAccent(e.target.value)}
                className="w-10 h-10 rounded-lg border border-[#E6E0F0] cursor-pointer p-0.5"
              />
              <input
                value={accent}
                onChange={e => setAccent(e.target.value)}
                className={inp + ' font-mono'}
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl p-3 border border-[#E6E0F0] mb-4">
          <p className="text-xs text-[#7B7390] mb-2">Preview</p>
          <div className="flex gap-2">
            <div
              className="h-8 flex-1 rounded-lg flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: primary }}
            >
              Primária
            </div>
            <div
              className="h-8 flex-1 rounded-lg flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: accent }}
            >
              Destaque
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition"
        style={{ background: saved ? '#16a34a' : theme.primary }}
      >
        <Save className="w-4 h-4" />
        {saved ? 'Configurações salvas!' : saving ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </div>
  )
}

const inp =
  'w-full bg-[#F6F3FA] border border-[#E6E0F0] rounded-xl px-3.5 py-2.5 text-sm text-[#16101F] placeholder-[#7B7390] focus:outline-none focus:border-[#5E2BD0] focus:ring-1 focus:ring-[#5E2BD0]/15 transition'
