// Gravação da credencial do Mercado Pago.
//
// ─── POR QUE NÃO VAI EM lf_config ───────────────────────────────────────────
// lf_config não tem RLS e é lida pelo catálogo público com select('*') direto
// do navegador — conferido em 21/08/2026: a anon key devolve as 44 colunas de
// qualquer loja. Um access token do Mercado Pago ali seria entregue a todo
// visitante do catálogo, e com ele dá para criar cobranças e listar pagamentos
// da conta do lojista.
//
// O token mora em lf_credenciais_pagamento, que tem RLS com policies de
// INSERT/UPDATE só para a própria loja e NENHUMA policy de SELECT: nem a
// lojista lê o token de volta. Quem enxerga é a service_role, dentro das Edge
// Functions. Ver supabase/migration_mercadopago_pix.sql.
//
// Em lf_config fica apenas `mercadopago_ativo`, um booleano sem valor de
// segredo, que é o que o catálogo usa para decidir se oferece o QR dinâmico.

/**
 * Grava (ou limpa) as credenciais do Mercado Pago da loja.
 *
 * ─── POR QUE NÃO É UM upsert ───────────────────────────────────────────────
 * A versão anterior usava `.upsert(..., { onConflict: 'loja_id' })` e quebrava
 * em produção com:
 *
 *   new row violates row-level security policy for table
 *   lf_credenciais_pagamento
 *
 * `upsert` vira `INSERT ... ON CONFLICT (loja_id) DO UPDATE`, e o Postgres
 * exige que a linha conflitante seja VISÍVEL por uma policy de SELECT para
 * conseguir resolver o conflito. Esta tabela não tem policy de SELECT
 * nenhuma — é justamente o desenho que impede o token de voltar para o
 * navegador (ver supabase/migration_mercadopago_pix.sql). As duas coisas são
 * incompatíveis: ou a lojista lê o token de volta, ou não dá para usar
 * upsert. Manter o token ilegível vale mais.
 *
 * Então: tenta INSERT; se a loja já tiver linha (23505, unique_violation),
 * faz UPDATE. Nenhum dos dois caminhos precisa de SELECT.
 *
 * Nenhum `.select()` encadeado, pelo mesmo motivo: pedir a linha de volta
 * bateria na ausência de policy de SELECT e faria a tela mostrar erro depois
 * de uma gravação bem-sucedida.
 *
 * @returns {Promise<{error: Error|null}>}
 */
export async function salvarCredencialMercadoPago(client, lojaId, { token, webhookSecret }) {
  if (!lojaId) return { error: new Error('Loja não identificada.') }

  const linha = {
    mercadopago_access_token: token?.trim() || null,
    mercadopago_webhook_secret: webhookSecret?.trim() || null,
    atualizado_em: new Date().toISOString(),
  }

  const { error: erroInsert } = await client
    .from('lf_credenciais_pagamento')
    .insert({ loja_id: lojaId, ...linha })

  if (!erroInsert) return { error: null }

  // 23505 = unique_violation: a loja já tem credencial gravada. Qualquer
  // outro erro é real e sobe.
  if (erroInsert.code !== '23505') return { error: erroInsert }

  const { error: erroUpdate } = await client
    .from('lf_credenciais_pagamento')
    .update(linha)
    .eq('loja_id', lojaId)

  return { error: erroUpdate ?? null }
}

/**
 * Decide se a flag pública pode ser ligada.
 *
 * Ligar `mercadopago_ativo` sem token faz o catálogo tentar o QR, falhar, e
 * cair no copia-e-cola — funciona, mas gasta um round-trip e um toast de erro
 * na cara da cliente a cada pedido.
 */
export function podeAtivarMercadoPago({ token, jaConfigurado }) {
  return !!(token?.trim() || jaConfigurado)
}
