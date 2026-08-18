import { AlertTriangle } from 'lucide-react'

/**
 * Aviso de catálogo de atacado sem piso de pedido.
 *
 * Aparece acima da configuração de Pedido Mínimo, no painel da lojista, quando
 * a loja está em nível 'pro' e o tipo é 'nenhum'. Não bloqueia nada — o
 * checkout segue permitindo a compra, exatamente como antes.
 *
 * Existe porque 'nenhum' é o DEFAULT da coluna: hoje o select mostra "Nenhum"
 * tanto para quem escolheu não ter mínimo quanto para quem nunca configurou, e
 * não havia sinal nenhum de qual dos dois é o caso.
 *
 * Compartilhado entre CatalogoB2BAdmin (mobile) e CatalogoB2BAdminDesktop para
 * o texto não divergir entre as duas telas. Quem decide se mostra é
 * precisaAvisarPedidoMinimo, em utils/modeloVenda.js.
 */
export default function AvisoPedidoMinimo({ compacto = false }) {
  return (
    <div
      role="status"
      style={{
        background: 'var(--status-warn-bg, #FBEFD6)',
        border: '1px solid var(--status-warn-dot, #E0A93B)',
        borderRadius: 'var(--r-card)',
        padding: compacto ? '12px 14px' : '14px 16px',
        marginBottom: compacto ? 12 : 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <AlertTriangle
        size={compacto ? 15 : 16}
        color="var(--status-warn-tx, #B7791F)"
        style={{ flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: compacto ? 12.5 : 13,
          fontWeight: 700,
          color: 'var(--status-warn-tx, #B7791F)',
          marginBottom: 3,
        }}>
          Seu catálogo está sem pedido mínimo definido
        </p>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: compacto ? 11.5 : 12,
          color: 'var(--status-warn-tx, #B7791F)',
          lineHeight: 1.5,
        }}>
          Qualquer cliente pode fechar um pedido de 1 peça só. Configure abaixo
          se isso não for intencional.
        </p>
      </div>
    </div>
  )
}
