import { useState } from 'react'
import { FileSpreadsheet, Plus, Package } from 'lucide-react'
import ImportarPlanilha from './ImportarPlanilha'
import Card from '../../components/studio/Card'
import Button from '../../components/studio/Button'

export default function WelcomeOnboarding({ theme, storeName, onCadastrarManualmente, importarProdutos }) {
  const [showImport, setShowImport] = useState(false)

  if (showImport) {
    return (
      <ImportarPlanilha
        theme={theme}
        importarProdutos={importarProdutos}
        onBack={() => setShowImport(false)}
      />
    )
  }

  return (
    <div style={{
      minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px',
    }}>
      <Card style={{ maxWidth: 380, width: '100%', textAlign: 'center' }} padding="40px 28px">
        {/* Ícone */}
        <div style={{
          width: 80, height: 80, borderRadius: 20, margin: '0 auto 24px',
          background: `color-mix(in srgb, ${theme.primary} 10%, white)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Package size={34} color={theme.primary} strokeWidth={1.8} />
        </div>

        {/* Título */}
        <h1 style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 26, fontWeight: 700, color: 'var(--ink)',
          margin: '0 0 10px', lineHeight: 1.25,
        }}>
          {storeName ? `Olá, ${storeName}!` : 'Olá, que bom te ver!'}
        </h1>
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14,
          color: 'var(--muted)', lineHeight: 1.65, margin: '0 0 32px',
        }}>
          Para começar a registrar vendas, cadastre os produtos do seu estoque.
        </p>

        {/* Botões */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <Button
            variant="primary"
            fullWidth
            icon={FileSpreadsheet}
            onClick={() => setShowImport(true)}
            style={{ height: 52, background: theme.primary, boxShadow: `0 4px 20px ${theme.primary}45` }}
          >
            Importar planilha Excel
          </Button>

          <Button
            variant="secondary"
            fullWidth
            icon={Plus}
            onClick={onCadastrarManualmente}
            style={{ height: 52, color: theme.primary, border: `1.5px solid ${theme.primary}35` }}
          >
            Cadastrar manualmente
          </Button>
        </div>

        {/* Dica */}
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11,
          color: 'var(--muted)', marginTop: 24, marginBottom: 0, lineHeight: 1.5,
        }}>
          Você pode importar uma planilha Excel com todos os seus produtos de uma vez, ou adicioná-los um por um.
        </p>
      </Card>
    </div>
  )
}
