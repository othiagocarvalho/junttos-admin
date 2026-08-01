import { paraDataLocal, diasEntre, somarDias } from './datas'

// ── Prazo do fiado (Junttos Mercado · T8/T9) ──────────────────
// Não existe prazo combinado por fiado: merc_fiado não tem campo de vencimento
// e o lojista não informa data ao anotar. Então o prazo é uma convenção da
// loja, igual para todo mundo: PRAZO_PADRAO_DIAS corridos contados do dia em
// que a pessoa passou a dever. É desse prazo que sai tanto o "Paga dia DD/MM"
// quanto o "N dias de atraso". Ajustar aqui muda as duas telas de uma vez.
export const PRAZO_PADRAO_DIAS = 30

// Saldos são somas de numeric; comparar com 0 direto sofreria com float.
const CENTAVO = 0.005
const arredonda = v => Math.round((Number(v) || 0) * 100) / 100

/** Chave de agrupamento: o vínculo com lf_clientes quando existe, senão o nome. */
export function chaveCliente(lancamento) {
  if (lancamento?.cliente_id) return `id:${lancamento.cliente_id}`
  const nome = String(lancamento?.cliente_nome || '').trim().toLowerCase()
  return `nome:${nome}`
}

/** Ordena por data e, no mesmo dia, pela ordem de criação. */
function porOrdemCronologica(a, b) {
  const da = paraDataLocal(a.data)?.getTime() ?? 0
  const db = paraDataLocal(b.data)?.getTime() ?? 0
  if (da !== db) return da - db
  return new Date(a.created_at || 0) - new Date(b.created_at || 0)
}

/**
 * Estado da conta de um cliente a partir dos lançamentos dele.
 *
 * O saldo é derivado percorrendo os lançamentos em ordem: 'compra' soma,
 * 'pagamento' abate. Nesse mesmo passo descobrimos desde quando a pessoa está
 * devendo — é o lançamento que levou o saldo de zerado para positivo e que não
 * foi quitado depois. Se em algum momento o saldo zera, a contagem recomeça:
 * quem quitou e comprou de novo não carrega atraso antigo.
 *
 * @returns {{saldo, devendo, inicioDivida, vencimento, diasAtraso, atrasado, lancamentos}}
 */
export function analisarConta(lancamentos = [], hoje = new Date()) {
  const ordenados = [...lancamentos].sort(porOrdemCronologica)

  let saldo = 0
  let inicioDivida = null
  for (const l of ordenados) {
    const antes = saldo
    saldo += l.tipo === 'pagamento' ? -(Number(l.valor) || 0) : (Number(l.valor) || 0)
    if (antes <= CENTAVO && saldo > CENTAVO) inicioDivida = l.data
    if (saldo <= CENTAVO) inicioDivida = null
  }

  saldo = arredonda(saldo)
  const devendo = saldo > CENTAVO

  if (!devendo) {
    return { saldo, devendo: false, inicioDivida: null, vencimento: null, diasAtraso: 0, atrasado: false, lancamentos: ordenados }
  }

  const vencimento = somarDias(inicioDivida, PRAZO_PADRAO_DIAS)
  const diasAtraso = Math.max(0, diasEntre(vencimento, hoje) ?? 0)

  return {
    saldo,
    devendo: true,
    inicioDivida,
    vencimento,
    diasAtraso,
    atrasado: diasAtraso > 0,
    lancamentos: ordenados,
  }
}

/**
 * Agrupa todos os lançamentos da loja por cliente e devolve a lista já
 * analisada, com os devedores mais atrasados primeiro.
 */
export function agruparPorCliente(lancamentos = [], hoje = new Date()) {
  const porChave = new Map()
  for (const l of lancamentos || []) {
    const chave = chaveCliente(l)
    if (!porChave.has(chave)) {
      porChave.set(chave, { chave, cliente_id: l.cliente_id || null, cliente_nome: l.cliente_nome, lancamentos: [] })
    }
    const grupo = porChave.get(chave)
    grupo.lancamentos.push(l)
    // o nome mais recente vence, caso tenha sido corrigido em algum lançamento
    if (l.cliente_nome) grupo.cliente_nome = l.cliente_nome
    if (l.cliente_id) grupo.cliente_id = l.cliente_id
  }

  return [...porChave.values()]
    .map(g => ({ ...g, ...analisarConta(g.lancamentos, hoje) }))
    .sort((a, b) => (b.diasAtraso - a.diasAtraso) || (b.saldo - a.saldo))
}

/** Totais do cabeçalho: quanto há a receber e quanto disso está atrasado. */
export function totaisFiado(contas = []) {
  let aReceber = 0
  let atrasado = 0
  for (const c of contas) {
    if (!c.devendo) continue
    aReceber += c.saldo
    if (c.atrasado) atrasado += c.saldo
  }
  return { aReceber: arredonda(aReceber), atrasado: arredonda(atrasado) }
}

/** Texto da linha de apoio do item da lista. */
export function textoApoio(conta) {
  if (!conta.devendo) return 'Em dia'
  if (conta.atrasado) return `${conta.diasAtraso} dia${conta.diasAtraso === 1 ? '' : 's'} de atraso`
  return null // a tela monta "Paga dia DD/MM" a partir de conta.vencimento
}

/** Descrição do lançamento no extrato, em linguagem natural. */
export function descricaoLancamento(lancamento) {
  const d = String(lancamento?.descricao || '').trim()
  if (d) return d
  return lancamento?.tipo === 'pagamento' ? 'Pagou' : 'Levou fiado'
}
