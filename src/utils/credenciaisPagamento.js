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
 * SEM .select() encadeado, de propósito: o supabase-js só pede
 * `Prefer: return=representation` quando existe um .select(), e pedir a linha
 * de volta aqui bateria na ausência de policy de SELECT — o upsert gravaria e
 * mesmo assim devolveria erro de permissão, fazendo a tela mostrar falha
 * depois de um sucesso.
 *
 * @returns {Promise<{error: Error|null}>}
 */
export async function salvarCredencialMercadoPago(client, lojaId, { token, webhookSecret }) {
  if (!lojaId) return { error: new Error('Loja não identificada.') }

  const { error } = await client
    .from('lf_credenciais_pagamento')
    .upsert({
      loja_id: lojaId,
      mercadopago_access_token: token?.trim() || null,
      mercadopago_webhook_secret: webhookSecret?.trim() || null,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'loja_id' })

  return { error: error ?? null }
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
