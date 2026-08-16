// Registro de alterações em jt_cobrancas.
//
// O autor vem do admin logado. A fonte é a sessão do Supabase Auth
// (supabaseAdmin, storageKey 'sb-admin-auth') — não mais o localStorage.
//
// Isto mudou junto com a Fase 3 do login: o AuthContext passou a APAGAR a
// chave 'junttos_admin_user' na entrada do app, porque era JSON não assinado e
// dava para forjar Super Admin pelo DevTools. Ler dali agora devolveria null em
// toda alteração, e o histórico nasceria sem autor sem ninguém perceber.
//
// Com a sessão do Supabase o registro passa a ter valor de verdade: o token é
// assinado e o navegador não consegue inventar quem é.

import { supabase } from './supabase'
import { supabaseAdmin } from './supabaseAdmin'
import { normalizarUsuarioSupabase } from '../utils/adminUsuario'

export const ACAO = {
  CRIADA:             'criada',
  VENCIMENTO:         'vencimento',
  VALOR:              'valor',
  OBSERVACOES:        'observacoes',
  PAGO:               'pago',
  PAGAMENTO_DESFEITO: 'pagamento_desfeito',
  DESCONTO:           'desconto',
}

const SEM_AUTOR = { nome: null, email: null }

/**
 * Converte o usuário do useAuth() no formato do histórico.
 *
 * Serve para as telas que já têm o usuário em contexto passarem direto, sem
 * pagar um getSession() a cada clique.
 */
export function autorDeUsuario(user) {
  if (!user) return SEM_AUTOR
  return { nome: user.name ?? null, email: user.email ?? null }
}

/**
 * Autor a partir da sessão do Supabase.
 *
 * É o caminho para quem não tem o usuário em contexto: o cadastro de loja
 * (useCreateLoja, também usado pelo portal do consultor, que roda fora do
 * AuthProvider) e a geração automática de cobranças.
 */
export async function autorAtual() {
  try {
    const { data } = await supabaseAdmin.auth.getSession()
    return autorDeUsuario(normalizarUsuarioSupabase(data?.session?.user))
  } catch {
    return SEM_AUTOR
  }
}

/**
 * Grava as entradas do histórico. Nunca lança: o histórico é registro, não
 * pré-requisito — se ele falhar, a alteração da cobrança em si (que já foi
 * gravada) não pode ser desfeita por causa disso. Devolve o erro para quem
 * quiser exibir.
 *
 * Sem autor explícito, resolve pela sessão.
 */
export async function registrarHistorico(entradas, autor = null) {
  const linhas = (Array.isArray(entradas) ? entradas : [entradas]).filter(Boolean)
  if (linhas.length === 0) return { error: null }

  const quem = autor ?? await autorAtual()

  const payload = linhas.map(e => ({
    cobranca_id:    e.cobranca_id,
    loja_id:        e.loja_id,
    acao:           e.acao,
    campo:          e.campo ?? null,
    valor_anterior: e.valor_anterior === null || e.valor_anterior === undefined ? null : String(e.valor_anterior),
    valor_novo:     e.valor_novo === null || e.valor_novo === undefined ? null : String(e.valor_novo),
    autor_nome:     quem?.nome ?? null,
    autor_email:    quem?.email ?? null,
  }))

  try {
    const { error } = await supabase.from('jt_cobrancas_historico').insert(payload)
    return { error: error ? error.message : null }
  } catch (e) {
    return { error: String(e?.message || e) }
  }
}
