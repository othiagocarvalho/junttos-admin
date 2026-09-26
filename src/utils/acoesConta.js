// Ações sobre uma conta a pagar/receber já lançada — excluir e desfazer
// pagamento. Caminho ÚNICO para Financeiro.jsx (mobile) e
// FinanceiroDesktop.jsx: as telas só chamam isto e recarregam.
//
// Recebe o client do Supabase por parâmetro (testado com um fake em memória,
// ver acoesConta.test.js). Toda escrita filtra por loja_id e confere quantas
// linhas mudou: no PostgREST um DELETE/UPDATE barrado por RLS volta 204 SEM
// ERRO, e sem a contagem a tela diria "excluída" com a linha intacta.
//
// ─── CONTA RECORRENTE — as 3 opções ───────────────────────────────────────
//   · 'so_esta'        → status='cancelada' (NUNCA DELETE: sem a linha, o
//                         gerador de utils/recorrencia.js recriaria a data).
//   · 'esta_e_proximas'→ desativa a regra e apaga as parcelas NÃO PAGAS com
//                         vencimento >= o desta. As pagas ficam.
//   · 'toda'           → desativa a regra, apaga as parcelas NÃO PAGAS e
//                         apaga a regra. As pagas ficam de histórico — a FK
//                         (ON DELETE SET NULL) zera o recorrencia_id delas.
// Desativar ANTES de apagar: se a tela for aberta no meio (outro aparelho),
// o gerador não repõe parcelas de uma regra que está sendo encerrada.

import { STATUS_CANCELADA } from './financeiro'

export const TABELA = { pagar: 'lf_contas_pagar', receber: 'lf_contas_receber' }
const CAMPO_DATA_QUITACAO = { pagar: 'data_pagamento', receber: 'data_recebimento' }
const STATUS_QUITADA = { pagar: 'pago', receber: 'recebido' }

export const OPCOES_RECORRENTE = [
  { id: 'so_esta', titulo: 'Só esta parcela', descricao: 'As outras parcelas continuam. Esta some da lista e dos totais.' },
  { id: 'esta_e_proximas', titulo: 'Esta e as próximas', descricao: 'Encerra a recorrência. Parcelas não pagas a partir desta são apagadas; as anteriores ficam.' },
  { id: 'toda', titulo: 'Toda a recorrência', descricao: 'Apaga a recorrência e todas as parcelas não pagas. As já pagas ficam no histórico.' },
]

const erro = mensagem => ({ ok: false, erro: mensagem })
const OK = { ok: true, erro: null }

/** Conta de recorrência? (só contas a pagar têm recorrência hoje) */
export function ehRecorrente(conta) {
  return !!conta?.recorrencia_id
}

/** Exclusão direta de uma conta avulsa (sem recorrência). */
export async function excluirContaAvulsa(supabase, { tipo, conta, lojaId }) {
  if (ehRecorrente(conta)) return erro('Conta recorrente: escolha uma das opções de exclusão.')
  const { error, count } = await supabase.from(TABELA[tipo]).delete({ count: 'exact' })
    .eq('id', conta.id).eq('loja_id', lojaId)
  if (error) return erro(`Não foi possível excluir: ${error.message}`)
  if (count !== 1) return erro('O banco não excluiu a conta. Atualize a tela e tente de novo.')
  return OK
}

/** "Só esta parcela": marca cancelada (e limpa a data de pagamento, se houver). */
export async function cancelarParcela(supabase, { conta, lojaId }) {
  const { data, error } = await supabase.from(TABELA.pagar)
    .update({ status: STATUS_CANCELADA, data_pagamento: null })
    .eq('id', conta.id).eq('loja_id', lojaId).select('id')
  if (error) return erro(`Não foi possível cancelar a parcela: ${error.message}`)
  if (!data || data.length !== 1) return erro('O banco não alterou a parcela. Atualize a tela e tente de novo.')
  return OK
}

async function desativarRegra(supabase, recorrenciaId, lojaId) {
  const { data, error } = await supabase.from('lf_recorrencias').update({ ativa: false })
    .eq('id', recorrenciaId).eq('loja_id', lojaId).select('id')
  if (error) return erro(`Não foi possível encerrar a recorrência: ${error.message}`)
  // 0 linhas = a regra já não existe (ex.: apagada em outro aparelho) — segue:
  // ainda dá para limpar as parcelas soltas.
  return { ok: true, erro: null, existia: (data || []).length === 1 }
}

/** Ids das parcelas NÃO PAGAS de uma regra (opcionalmente a partir de uma data). */
async function parcelasNaoPagas(supabase, recorrenciaId, lojaId, aPartirDe = null) {
  const { data, error } = await supabase.from(TABELA.pagar)
    .select('id, status, data_vencimento')
    .eq('recorrencia_id', recorrenciaId).eq('loja_id', lojaId)
  if (error) return { erro: error.message }
  // Filtro em JS de propósito: um .neq('status','pago') do PostgREST deixaria
  // de fora status NULL (SQL: NULL <> 'pago' não é verdadeiro).
  const ids = (data || [])
    .filter(p => p.status !== 'pago')
    .filter(p => !aPartirDe || String(p.data_vencimento) >= aPartirDe)
    .map(p => p.id)
  return { ids }
}

async function apagarParcelas(supabase, ids, recorrenciaId, lojaId) {
  if (ids.length === 0) return OK
  const { error, count } = await supabase.from(TABELA.pagar).delete({ count: 'exact' })
    .in('id', ids).eq('recorrencia_id', recorrenciaId).eq('loja_id', lojaId)
  if (error) return erro(`Não foi possível apagar as parcelas: ${error.message}`)
  if (count !== ids.length) return erro(`O banco apagou ${count} de ${ids.length} parcelas. Atualize a tela e confira.`)
  return OK
}

/** "Esta e as próximas": encerra a regra e apaga as não pagas a partir desta. */
export async function encerrarRecorrenciaAPartirDe(supabase, { conta, lojaId }) {
  const rid = conta.recorrencia_id
  const d = await desativarRegra(supabase, rid, lojaId)
  if (!d.ok) return d
  const { ids, erro: e } = await parcelasNaoPagas(supabase, rid, lojaId, String(conta.data_vencimento))
  if (e) return erro(`Não foi possível ler as parcelas: ${e}`)
  return apagarParcelas(supabase, ids, rid, lojaId)
}

/** "Toda a recorrência": apaga a regra e as parcelas não pagas; as pagas ficam. */
export async function excluirRecorrenciaInteira(supabase, { conta, lojaId }) {
  const rid = conta.recorrencia_id
  const d = await desativarRegra(supabase, rid, lojaId)
  if (!d.ok) return d
  const { ids, erro: e } = await parcelasNaoPagas(supabase, rid, lojaId)
  if (e) return erro(`Não foi possível ler as parcelas: ${e}`)
  const r = await apagarParcelas(supabase, ids, rid, lojaId)
  if (!r.ok) return r
  if (!d.existia) return OK
  const { error, count } = await supabase.from('lf_recorrencias').delete({ count: 'exact' })
    .eq('id', rid).eq('loja_id', lojaId)
  if (error) return erro(`As parcelas foram apagadas, mas a recorrência não: ${error.message}`)
  if (count !== 1) return erro('As parcelas foram apagadas, mas o banco não excluiu a recorrência (ela ficou pausada).')
  return OK
}

/** Despacha a exclusão conforme o tipo da conta e a opção escolhida. */
export async function excluirConta(supabase, { tipo, conta, lojaId, opcao }) {
  if (!ehRecorrente(conta)) return excluirContaAvulsa(supabase, { tipo, conta, lojaId })
  if (opcao === 'so_esta') return cancelarParcela(supabase, { conta, lojaId })
  if (opcao === 'esta_e_proximas') return encerrarRecorrenciaAPartirDe(supabase, { conta, lojaId })
  if (opcao === 'toda') return excluirRecorrenciaInteira(supabase, { conta, lojaId })
  return erro('Escolha uma das opções de exclusão.')
}

/** Desfaz um pagamento/recebimento marcado por engano: volta para pendente. */
export async function desfazerQuitacao(supabase, { tipo, conta, lojaId }) {
  const { data, error } = await supabase.from(TABELA[tipo])
    .update({ status: 'pendente', [CAMPO_DATA_QUITACAO[tipo]]: null })
    .eq('id', conta.id).eq('loja_id', lojaId).eq('status', STATUS_QUITADA[tipo]).select('id')
  if (error) return erro(`Não foi possível desfazer: ${error.message}`)
  if (!data || data.length !== 1) return erro('O banco não alterou a conta. Atualize a tela e tente de novo.')
  return OK
}
