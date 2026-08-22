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
 * ─── A FALHA SILENCIOSA QUE ISTO CORRIGE ───────────────────────────────────
 * Relato de 25/08/2026: a Tropicale preenchia o Access Token, salvava, via a
 * confirmação verde na tela — e `atualizado_em` no banco continuava com o
 * mesmo timestamp. Nada era gravado, e ninguém era avisado.
 *
 * O motivo é uma característica do PostgREST que morde exatamente aqui: um
 * UPDATE que não casa NENHUMA linha é 204 SEM ERRO. Como esta tabela filtra
 * por RLS (`loja_id` tem de bater com o claim do JWT), basta a sessão estar
 * ruim para o UPDATE virar um no-op perfeitamente silencioso — e o
 * `error` que esta função devolvia vinha null.
 *
 * Combina com a outra pista do relato, o
 * "[auth] refresh ao voltar para a aba falhou": sessão instável no momento do
 * salvamento é justamente o que faz a linha sumir de dentro da policy.
 *
 * Duas defesas, nesta ordem:
 *   1. sem sessão, nem tenta — devolve erro explicando que precisa entrar de
 *      novo, em vez de mandar uma escrita que já se sabe condenada;
 *   2. o UPDATE pede `count: 'exact'`, e zero linha vira ERRO. O count vem do
 *      header Content-Range e não depende de policy de SELECT (que esta tabela
 *      não tem, de propósito).
 *
 * `count` null é tratado como DESCONHECIDO, não como falha: se um dia o
 * PostgREST não mandar o header, o comportamento volta a ser o de antes em vez
 * de recusar uma gravação que funcionou.
 *
 * @returns {Promise<{error: Error|null}>}
 */
export async function salvarCredencialMercadoPago(client, lojaId, { token, webhookSecret }) {
  if (!lojaId) return { error: new Error('Loja não identificada.') }

  // ── Defesa 1: sessão ────────────────────────────────────────────────────
  // As policies desta tabela são `to authenticated`. Sem sessão, o
  // supabase-js manda a anon key (ver src/lib/authRefresh.js) e a escrita não
  // tem como dar certo — o INSERT é recusado e o UPDATE não acha linha.
  const { data: sessao, error: erroSessao } = await client.auth.getSession()
  if (erroSessao) return { error: erroSessao }
  if (!sessao?.session?.access_token) {
    return {
      error: new Error(
        'Sua sessão expirou. Entre de novo e repita o salvamento — '
        + 'sem sessão válida o banco recusa a gravação da credencial.',
      ),
    }
  }

  const linha = {
    mercadopago_access_token: token?.trim() || null,
    mercadopago_webhook_secret: webhookSecret?.trim() || null,
    atualizado_em: new Date().toISOString(),
  }

  const { error: erroInsert } = await client
    .from('lf_credenciais_pagamento')
    .insert({ loja_id: lojaId, ...linha })

  if (!erroInsert) return { error: null }

  // 23505 = unique_violation: a loja já tem credencial gravada. É o caminho
  // NORMAL de toda gravação depois da primeira, e é ele que produz o 409 que
  // aparece no console — 409 aqui é esperado, não é o defeito. Qualquer outro
  // erro é real e sobe.
  if (erroInsert.code !== '23505') return { error: erroInsert }

  // ── Defesa 2: UPDATE que não pegou linha nenhuma ────────────────────────
  const { error: erroUpdate, count } = await client
    .from('lf_credenciais_pagamento')
    .update(linha, { count: 'exact' })
    .eq('loja_id', lojaId)

  if (erroUpdate) return { error: erroUpdate }

  if (count === 0) {
    return {
      error: new Error(
        'O banco não encontrou a credencial desta loja para atualizar. '
        + 'Normalmente é sessão expirada: saia, entre de novo e repita. '
        + 'Se continuar, avise o suporte — nada foi gravado.',
      ),
    }
  }

  return { error: null }
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

// ─────────────────────────────────────────────────────────────────────────────
// Validação do access token do Mercado Pago.
//
// Nasceu de um bug real: o QR Code Pix da Tropicale falhava com "Não foi
// possível gerar o QR Code agora", e o diagnóstico da Edge Function mostrou que
// o valor salvo tinha 14 caracteres e nenhum hífen — o Mercado Pago devolvia
// 403. Não era access token: access token de produção é
// `APP_USR-<8 díg>-<data>-<32 hex>-<9 díg>`, uns 70 caracteres com 4 hífens.
// Provavelmente foi colado o número da conta, ou metade de outra credencial.
//
// Barrar na hora de salvar evita que a loja descubra o erro só quando a
// primeira cliente tenta pagar.
// ─────────────────────────────────────────────────────────────────────────────

/** Erro bloqueante, ou null se o valor é aceitável. Vazio = manter o atual. */
export function validarAccessTokenMP(bruto) {
  const t = String(bruto ?? '').trim()
  if (!t) return null
  if (!t.includes('-') || t.length < 20) {
    return 'Isso não parece um access token do Mercado Pago. '
      + 'O de produção começa com "APP_USR-" e tem mais de 60 caracteres — '
      + 'não confunda com a Public Key nem com o número da conta.'
  }
  return null
}

/**
 * Aviso não bloqueante: credencial de teste é legítima em sandbox, mas em
 * produção o Mercado Pago recusa com 401/403 e o catálogo cai no copia-e-cola.
 */
export function pareceTokenDeTeste(bruto) {
  return String(bruto ?? '').trim().startsWith('TEST-')
}
