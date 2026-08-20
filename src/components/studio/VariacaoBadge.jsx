import { corParaHex } from '../../utils/coresProduto'

// Badge de variação (cor/tamanho) do Estoque e do Catálogo B2B.
//
// Antes cada variação virava uma pill de fundo colorido cheio ("AZUL: 10" em
// bloco lilás, amarelo ou vermelho). Com 5–10 variações por produto a lista
// virava um mosaico de cor e o olho não achava mais o nome do produto.
//
// Agora a cor entra só como bolinha — é o mesmo vocabulário que o catálogo
// público (CatalogoPublicoV2) já usa — e o texto fica neutro. O sinal de
// estoque baixo continua: quem carrega a cor de crítico/atenção é o número,
// não o fundo inteiro.

/**
 * Bolinha da cor da variação.
 *
 * Só aparece quando o nome casa com uma cor conhecida: em grade de tamanho
 * ("P", "M", "38") não existe cor para mostrar, e uma bolinha cinza genérica
 * seria ruído em vez de informação.
 */
export function BolinhaCor({ nome, size = 9, style }) {
  const { hex, exato } = corParaHex(nome)
  if (!exato) return null
  return (
    <span
      aria-hidden="true"
      title={nome}
      style={{
        width: size, height: size, borderRadius: '50%', background: hex,
        // Borda para branco/off-white não sumirem no fundo claro do card.
        border: '1px solid rgba(0,0,0,0.18)',
        flexShrink: 0, display: 'inline-block',
        ...style,
      }}
    />
  )
}

/**
 * @param {string} nome        Nome da variação, como a lojista cadastrou.
 * @param {number|string} [quantidade]  Omitido → mostra só o nome.
 * @param {string} [statusColor]        Cor do número quando o estoque está
 *                                      crítico/atenção. Sem isso, cinza.
 */
export default function VariacaoBadge({ nome, quantidade, statusColor, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, padding: '3px 8px',
      borderRadius: 'var(--r-chip)',
      background: 'var(--bg)', border: '1px solid var(--line)',
      color: 'var(--ink)', fontFamily: 'var(--font-ui)',
      whiteSpace: 'nowrap', lineHeight: 1.4,
      ...style,
    }}>
      <BolinhaCor nome={nome} />
      <span>{nome}</span>
      {quantidade != null && quantidade !== '' && (
        <span style={{ fontWeight: 700, color: statusColor || 'var(--muted)' }}>
          {quantidade}
        </span>
      )}
    </span>
  )
}
