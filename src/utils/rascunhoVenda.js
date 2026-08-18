// Rascunho da venda em andamento, guardado no localStorage.
//
// Motivo: a venda é montada em vários passos (cliente, produtos, pagamento) e
// qualquer recarga — F5, queda de conexão, o navegador do celular descartando a
// aba em segundo plano — jogava tudo fora com a cliente esperando no balcão.
//
// Fica por loja: o mesmo navegador pode abrir mais de uma loja, e um rascunho
// não pode vazar para outra.

const PREFIXO = 'junttos:rascunho-venda:'

// Rascunho de ontem não deve ressuscitar no meio de uma venda nova.
export const RASCUNHO_VALIDO_HORAS = 12

export function chaveRascunho(lojaId) {
  return `${PREFIXO}${lojaId || 'sem-loja'}`
}

/** Campos restaurados. O valor total não entra: é recalculado dos produtos. */
export function extrairRascunho(form, extras = {}) {
  return {
    nome:      form?.nome ?? '',
    tel:       form?.tel ?? '',
    vendedora: form?.vendedora ?? '',
    obs:       form?.obs ?? '',
    produtos:   Array.isArray(form?.produtos) ? form.produtos : [],
    pagamentos: Array.isArray(form?.pagamentos) ? form.pagamentos : [],
    ajusteTipo:  extras.ajusteTipo ?? 'desconto',
    ajusteModo:  extras.ajusteModo ?? 'valor',
    ajusteInput: extras.ajusteInput ?? '',
    isTroca:      !!extras.isTroca,
    produtoTroca: Array.isArray(extras.produtoTroca) ? extras.produtoTroca : [],
    trocaDesconto:  extras.trocaDesconto  ?? '',
    trocaAcrescimo: extras.trocaAcrescimo ?? '',
  }
}

/** Vazio não vira rascunho — senão o aviso de "rascunho restaurado" apareceria à toa. */
export function rascunhoTemConteudo(r) {
  if (!r) return false
  return (r.produtos?.length > 0)
    || (r.produtoTroca?.length > 0)
    || !!String(r.nome ?? '').trim()
    || !!String(r.tel ?? '').trim()
    || !!String(r.obs ?? '').trim()
}

export function salvarRascunho(lojaId, rascunho) {
  try {
    if (!rascunhoTemConteudo(rascunho)) { limparRascunho(lojaId); return }
    localStorage.setItem(chaveRascunho(lojaId), JSON.stringify({ ...rascunho, salvoEm: Date.now() }))
  } catch { /* modo privado / cota cheia: seguir sem rascunho é melhor que quebrar a venda */ }
}

export function lerRascunho(lojaId, agora = Date.now()) {
  try {
    const cru = localStorage.getItem(chaveRascunho(lojaId))
    if (!cru) return null
    const r = JSON.parse(cru)
    const idadeH = (agora - Number(r?.salvoEm ?? 0)) / 36e5
    if (!Number.isFinite(idadeH) || idadeH > RASCUNHO_VALIDO_HORAS) {
      limparRascunho(lojaId)
      return null
    }
    return rascunhoTemConteudo(r) ? r : null
  } catch { return null }
}

export function limparRascunho(lojaId) {
  try { localStorage.removeItem(chaveRascunho(lojaId)) } catch { /* idem */ }
}
