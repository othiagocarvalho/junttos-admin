// Select de vendedor da Nova Venda.
//
// Substitui o campo de texto livre onde há cadastro (Pro+). Abaixo de Pro o
// chamador mantém o input antigo — ver a nota em NovaVenda.jsx.

import { useVendedores } from './useVendedores'
import { opcoesVendedor } from '../../utils/vendedores'

export default function SelectVendedor({ lojaId, valor, aoMudar, style }) {
  const { vendedores, erro } = useVendedores(lojaId, { apenasAtivos: true })
  const opcoes = opcoesVendedor(vendedores, valor)

  return (
    <select
      value={valor ?? ''}
      onChange={e => aoMudar(e.target.value)}
      aria-label="Vendedor(a)"
      style={{ ...style, cursor: 'pointer' }}
    >
      {opcoes.map(o => (
        <option key={o.valor || '__sem__'} value={o.valor}>{o.rotulo}</option>
      ))}
      {/* Tabela ausente ou fora do ar: o select fica com "Sem vendedor" e a
          venda segue. Nenhuma tela trava por causa disso. */}
      {erro && <option disabled>— cadastro indisponível —</option>}
    </select>
  )
}
