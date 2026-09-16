import { Package } from 'lucide-react'
import Card from '../../components/studio/Card'
import Button from '../../components/studio/Button'

// A tela antiga de importação por planilha larga foi removida — lia por
// posição fixa de coluna e corrompeu dados de loja real quando alimentada com
// o layout novo (Produto|Cor|Tamanho|Quantidade|Custo|Venda). A importação em
// lote agora só existe dentro do Estoque (botão "Importar Estoque" em
// EstoqueMobile.jsx), então o onboarding só precisa levar a lojista até lá —
// sem inventar uma segunda tela para a mesma tarefa.
export default function WelcomeOnboarding({ theme, storeName, onCadastrarManualmente }) {
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

        {/* Botão */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <Button
            variant="primary"
            fullWidth
            icon={Package}
            onClick={onCadastrarManualmente}
            style={{ height: 52, background: theme.primary, boxShadow: `0 4px 20px ${theme.primary}45` }}
          >
            Cadastrar produtos
          </Button>
        </div>

        {/* Dica */}
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11,
          color: 'var(--muted)', marginTop: 24, marginBottom: 0, lineHeight: 1.5,
        }}>
          Na tela de Estoque você pode importar uma planilha com todos os seus produtos de uma vez, ou cadastrá-los um por um.
        </p>
      </Card>
    </div>
  )
}
