// Selo de plano — só aparece quando a função exige plano ACIMA do da loja.
//
// Ver docs/DESIGN_SYSTEM.md. A regra em uma linha: selo é aviso de bloqueio,
// não etiqueta de catálogo.
//
//   loja Business  → nunca vê selo nenhum;
//   loja Pro       → vê BUSINESS quando a função exige Business;
//   loja Starter   → vê PRO e BUSINESS quando a função exige.
//
// Antes, o selo era escrito à mão em cada tela e aparecia SEMPRE — a loja
// Business via "Business" em cima de uma função que ela já tinha, o que só
// gerava dúvida ("isso está bloqueado?").

import { temAcesso, PLANOS } from '../../utils/planos'

const CORES = {
  pro:      { fundo: '#dbeafe', cor: '#1d4ed8' },
  business: { fundo: '#ede9fe', cor: '#6d28d9' },
}

export default function SeloPlano({ planoAtual, planoNecessario }) {
  // Sem plano necessário declarado não há o que sinalizar.
  if (!planoNecessario) return null
  // A loja JÁ tem acesso: nada a avisar.
  if (temAcesso(planoAtual, planoNecessario)) return null

  const cor = CORES[planoNecessario] || CORES.pro
  const label = PLANOS[planoNecessario]?.label || planoNecessario

  return (
    <span style={{
      background: cor.fundo, color: cor.cor, fontSize: 9, fontWeight: 700,
      borderRadius: 99, padding: '2px 7px', textTransform: 'uppercase',
      letterSpacing: '0.1em', flexShrink: 0,
    }}>{label}</span>
  )
}
