// Revela o bloco de variações que acabou de abrir.
//
// ── O problema que isto resolve ─────────────────────────────────────────────
// Abrir um produto insere ~120px de conteúdo ABAIXO da linha clicada. Quem
// decide onde esse bloco cai é o container que rola — a lista no desktop, a
// página no mobile — e nenhum dos dois se mexe sozinho: o bloco nasce fora da
// janela visível e a lojista vê a variação cortada na borda, sem conseguir
// clicar. Foi exatamente o relato da HM Boutique.
//
// ── Por que scrollIntoView({ block: 'nearest' }) ────────────────────────────
// É a rolagem MÍNIMA que traz o elemento inteiro para dentro, e o navegador a
// aplica em TODOS os ancestrais que rolam, não só no mais próximo — no desktop
// isso significa a lista e, se ainda faltar, a própria página. 'nearest' não
// mexe em nada quando o bloco já está visível, então abrir um produto no meio
// da lista não dá o pulo desnecessário que 'center'/'start' dariam.
//
// ── Por que margemInferior ──────────────────────────────────────────────────
// No mobile a BarraResumoMobile é `position: fixed`. Para o navegador aquela
// faixa é área visível como qualquer outra, então ele considera o trabalho
// feito com o bloco embaixo dela. scroll-margin-bottom é justamente como se
// declara "reserve mais este tanto" — o scrollIntoView respeita, e o bloco
// para acima da barra.
export function revelarBloco(el, { margemInferior = 0 } = {}) {
  if (!el || typeof el.scrollIntoView !== 'function') return
  if (margemInferior) el.style.scrollMarginBottom = `${margemInferior}px`
  // Um frame de folga: o efeito roda depois do paint, mas a seta do chevron
  // tem transition e o bloco pode ainda estar assentando o layout.
  const agendar = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : fn => setTimeout(fn, 16)
  agendar(() => {
    try {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    } catch {
      // Safari antigo não aceita o objeto de opções.
      el.scrollIntoView(false)
    }
  })
}
