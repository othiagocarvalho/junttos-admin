import { useState } from 'react'
import { FileSpreadsheet, Plus, Package } from 'lucide-react'
import ImportarPlanilha from './ImportarPlanilha'

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
      paddingTop: 40, display: 'flex', flexDirection: 'column',
      alignItems: 'center', textAlign: 'center',
      maxWidth: 360, margin: '0 auto',
    }}>
      {/* Ícone */}
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: `linear-gradient(135deg, ${theme.primary}22, ${theme.primary}10)`,
        border: `2px solid ${theme.primary}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
      }}>
        <Package size={38} color={theme.primary} />
      </div>

      {/* Título */}
      <h1 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 30, fontWeight: 700, color: 'var(--ink)',
        marginBottom: 12, lineHeight: 1.2,
      }}>
        Olá, que bom te ver!
      </h1>
      <p style={{
        fontFamily: 'Manrope, sans-serif', fontSize: 14,
        color: 'var(--muted)', lineHeight: 1.65, marginBottom: 40,
      }}>
        Para começar a registrar vendas, cadastre os produtos do seu estoque.
      </p>

      {/* Botões */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <button
          onClick={() => setShowImport(true)}
          style={{
            width: '100%', height: 54, borderRadius: 16,
            background: theme.primary, border: 'none',
            color: '#fff', cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: `0 4px 20px ${theme.primary}45`,
            transition: 'box-shadow .15s',
          }}
        >
          <FileSpreadsheet size={18} />
          Importar planilha Excel
        </button>

        <button
          onClick={onCadastrarManualmente}
          style={{
            width: '100%', height: 54, borderRadius: 16,
            background: 'var(--surface)',
            border: `1.5px solid ${theme.primary}35`,
            color: theme.primary, cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif', fontWeight: 600, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <Plus size={18} />
          Cadastrar manualmente
        </button>
      </div>

      {/* Dica */}
      <p style={{
        fontFamily: 'Manrope, sans-serif', fontSize: 11,
        color: 'var(--muted)', marginTop: 28, lineHeight: 1.5,
      }}>
        Você pode importar uma planilha Excel com todos os seus produtos de uma vez, ou adicioná-los um por um.
      </p>
    </div>
  )
}
