import { Monitor } from 'lucide-react'
import Card from '../../components/studio/Card'

const OPCOES = [
  { mode: 'mobile',  label: '📱 Celular' },
  { mode: 'desktop', label: '💻 Computador' },
]

/**
 * Componente só do Mercado — não mexe em LojaConfig.jsx (compartilhado com
 * a Moda). Recebe viewMode/setViewMode já instanciados em LojaMercado/
 * index.jsx (não chama useViewMode() de novo aqui) pra clicar aqui
 * re-renderizar o mesmo wrapper que decide a largura, sem estado duplicado.
 */
export default function ModoVisualizacao({ viewMode, setViewMode, theme = {} }) {
  const primary = theme.primary || '#5E2BD0'

  return (
    <Card>
      <p style={{
        fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4,
        display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}>
        <Monitor size={16} style={{ color: primary }} />
        Modo de visualização
      </p>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        Força a versão celular mesmo num computador, ou volta ao normal.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {OPCOES.map(({ mode, label }) => {
          const active = viewMode === mode
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              style={{
                flex: 1, height: 44, borderRadius: 'var(--r-input)', cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: active ? 700 : 500,
                border: active ? `2px solid ${primary}` : '1.5px solid var(--line)',
                background: active ? `${primary}15` : 'var(--bg)',
                color: active ? primary : 'var(--muted)',
                transition: 'all .15s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
