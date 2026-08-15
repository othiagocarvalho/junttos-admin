// Registro de alterações em jt_cobrancas.
//
// O autor vem do admin logado, que hoje é a lista de src/auth/users.js salva
// em localStorage pelo AuthContext. É um registro operacional — serve para
// responder "quem mudou essa data?" no dia a dia — e não uma trilha de
// auditoria com valor probatório: o localStorage é editável pelo próprio
// navegador. Quando o login migrar para o Supabase Auth, troca-se a origem do
// autor aqui e a tabela continua igual.

import { supabase } from './supabase'

export const ACAO = {
  CRIADA:             'criada',
  VENCIMENTO:         'vencimento',
  VALOR:              'valor',
  OBSERVACOES:        'observacoes',
  PAGO:               'pago',
  PAGAMENTO_DESFEITO: 'pagamento_desfeito',
  DESCONTO:           'desconto',
}

/** Admin logado, no formato gravado por AuthContext. */
export function autorAtual() {
  try {
    const cru = localStorage.getItem('junttos_admin_user')
    if (!cru) return { nome: null, email: null }
    const u = JSON.parse(cru)
    return { nome: u?.name ?? null, email: u?.email ?? null }
  } catch {
    return { nome: null, email: null }
  }
}

/**
 * Grava as entradas do histórico. Nunca lança: o histórico é registro, não
 * pré-requisito — se ele falhar, a alteração da cobrança em si (que já foi
 * gravada) não pode ser desfeita por causa disso. Devolve o erro para quem
 * quiser exibir.
 */
export async function registrarHistorico(entradas, autor = autorAtual()) {
  const linhas = (Array.isArray(entradas) ? entradas : [entradas]).filter(Boolean)
  if (linhas.length === 0) return { error: null }

  const payload = linhas.map(e => ({
    cobranca_id:    e.cobranca_id,
    loja_id:        e.loja_id,
    acao:           e.acao,
    campo:          e.campo ?? null,
    valor_anterior: e.valor_anterior === null || e.valor_anterior === undefined ? null : String(e.valor_anterior),
    valor_novo:     e.valor_novo === null || e.valor_novo === undefined ? null : String(e.valor_novo),
    autor_nome:     autor?.nome ?? null,
    autor_email:    autor?.email ?? null,
  }))

  try {
    const { error } = await supabase.from('jt_cobrancas_historico').insert(payload)
    return { error: error ? error.message : null }
  } catch (e) {
    return { error: String(e?.message || e) }
  }
}
