// Título de seção — padrão oficial da Junttos.
//
// Ver docs/DESIGN_SYSTEM.md. Resumo: ícone dentro de um círculo tintado na cor
// do tema da loja, título em negrito ao lado, descrição opcional embaixo.
//
// SUBSTITUI o padrão antigo, que era um <p> pequeno, cinza e em CAIXA ALTA:
//
//   fontSize: 10, fontWeight: 700, color: 'var(--muted)',
//   textTransform: 'uppercase', letterSpacing: '0.14em'
//
// Aquele texto competia com o conteúdo em vez de organizá-lo, e em tela de
// celular caixa alta com letter-spacing fica difícil de ler de relance.
//
// ─── SOBRE O ÍCONE ──────────────────────────────────────────────────────────
// O padrão pede "ícone Tabler". O projeto inteiro usa `lucide-react` — mesma
// família de traço, e já é a dependência de todas as telas. Instalar uma
// segunda biblioteca de ícones para o mesmo trabalho custaria bundle e criaria
// duas convenções para a próxima pessoa escolher. Fica lucide, e quem vier
// depois não precisa decidir nada.
//
// ─── CORES ──────────────────────────────────────────────────────────────────
// `theme.primary` quando o componente recebe theme; senão var(--primary), que
// useLojaTheme.js já preenche com cor_primaria da loja. As duas rotas dão a
// cor da loja — a prop existe porque metade das telas já passa `theme`.

export default function SecaoTitulo({
  Icon, titulo, descricao, theme, badge = null, compacto = false, style,
}) {
  const primary = theme?.primary || 'var(--primary)'
  return (
    <div style={{
      display: 'flex', alignItems: descricao ? 'flex-start' : 'center',
      gap: compacto ? 10 : 12, marginBottom: compacto ? 12 : 14, ...style,
    }}>
      {Icon && (
        <span style={{
          width: compacto ? 30 : 34, height: compacto ? 30 : 34, borderRadius: 10,
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          // Mesmo tingimento do cabeçalho de Gaveta: 12% da cor do tema sobre o
          // fundo. Mantém contraste em tema claro e escuro sem calcular nada.
          background: `color-mix(in srgb, ${primary} 12%, transparent)`,
          marginTop: descricao ? 1 : 0,
        }}>
          <Icon size={compacto ? 15 : 17} color={primary} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap',
          fontFamily: 'var(--font-ui)', fontSize: compacto ? 14 : 15,
          // Negrito e SEM uppercase: é a mudança que separa este padrão do
          // antigo.
          fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25,
        }}>
          {titulo}
          {badge}
        </span>
        {descricao && (
          // Mesmo subtítulo do cabeçalho de gaveta — 12px, muted, logo abaixo.
          <span style={{
            display: 'block', fontFamily: 'var(--font-ui)', fontSize: 12,
            color: 'var(--muted)', marginTop: 2, lineHeight: 1.45,
          }}>{descricao}</span>
        )}
      </span>
    </div>
  )
}
