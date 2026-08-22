// Cadastro de vendedores e o valor que vai para lf_vendas.vendedora.
//
// ─── O PROBLEMA QUE ISTO RESOLVE ────────────────────────────────────────────
// A comissão automática (Relatorios.jsx) agrupa por igualdade EXATA de string:
//
//     const nome = v.vendedora || 'Sem vendedor(a)'
//     mapa[nome].total += Number(v.valor)
//
// Com o campo sendo texto livre, "Ana Lívia", "ana lívia" e "Ana  Lívia" viram
// três pessoas no fechamento do mês. O select resolve a digitação do dia a
// dia; estas funções resolvem o resto, normalizando o nome ANTES de gravar no
// cadastro, para que o valor guardado na venda seja sempre idêntico ao que o
// relatório soma.

/**
 * Opção fixa do topo do select.
 *
 * O VALOR é string vazia, não o texto "Sem vendedor" — e isso é essencial.
 * A venda grava `form.vendedora || null` (NovaVenda.jsx, ClientDashboardDesktop.jsx)
 * e a comissão soma sob o rótulo 'Sem vendedor(a)' quando o campo é vazio.
 * Gravar a string "Sem vendedor" criaria uma SEGUNDA linha no relatório,
 * separada da que já existe — o oposto do que a feature quer.
 */
export const SEM_VENDEDOR = { valor: '', rotulo: 'Sem vendedor' }

/**
 * Normaliza o nome para cadastro: apara as pontas e colapsa espaço interno.
 *
 * Não mexe em acento nem em caixa: "Letícia" tem de continuar "Letícia" na
 * etiqueta do recibo e na tela. O objetivo é só matar a variação invisível,
 * que é a que quebra o agrupamento sem ninguém enxergar o motivo.
 */
export function normalizarNomeVendedor(bruto) {
  return String(bruto ?? '').trim().replace(/\s+/g, ' ')
}

/** Chave de comparação para detectar duplicata — aí sim ignora caixa. */
export function chaveVendedor(nome) {
  return normalizarNomeVendedor(nome).toLowerCase()
}

/**
 * Valida antes de gravar. Devolve a mensagem de erro, ou null se estiver ok.
 *
 * `existentes` são os nomes já cadastrados na loja (ativos ou não): reativar
 * alguém é melhor do que criar um homônimo, que voltaria a partir a comissão
 * em duas linhas.
 */
export function validarNovoVendedor(bruto, existentes = []) {
  const nome = normalizarNomeVendedor(bruto)
  if (nome.length < 2) return 'Escreva o nome do vendedor.'
  if (nome.length > 60) return 'Nome muito longo (máximo 60 caracteres).'
  const chave = chaveVendedor(nome)
  if (existentes.some(n => chaveVendedor(n) === chave)) {
    return 'Já existe um vendedor com esse nome nesta loja.'
  }
  return null
}

/**
 * Monta as opções do select da Nova Venda.
 *
 * `atual` é o que já está gravado no rascunho/venda em edição. Se for um nome
 * que não está mais na lista — vendedor desativado depois da venda, ou nome
 * digitado à mão antes deste cadastro existir —, ele entra como opção extra
 * para a tela não trocar silenciosamente o valor por "Sem vendedor" ao abrir.
 */
export function opcoesVendedor(vendedores = [], atual = '') {
  const ativos = (vendedores || [])
    .filter(v => v?.ativo !== false && normalizarNomeVendedor(v?.nome))
    .map(v => normalizarNomeVendedor(v.nome))
    .sort((a, b) => a.localeCompare(b, 'pt'))

  const opcoes = [SEM_VENDEDOR, ...ativos.map(nome => ({ valor: nome, rotulo: nome }))]

  const atualLimpo = normalizarNomeVendedor(atual)
  if (atualLimpo && !ativos.some(n => n === atualLimpo)) {
    opcoes.push({ valor: atualLimpo, rotulo: `${atualLimpo} (inativo)`, inativo: true })
  }
  return opcoes
}

/**
 * Valor final para gravar em lf_vendas.vendedora.
 *
 * String vazia vira null, exatamente como o `form.vendedora || null` que os
 * dois fluxos de venda já fazem hoje.
 */
export function vendedorParaVenda(valorSelecionado) {
  return normalizarNomeVendedor(valorSelecionado) || null
}
