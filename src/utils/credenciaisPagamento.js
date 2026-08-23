// Gravação da credencial do Mercado Pago.
//
// ─── POR QUE NÃO VAI EM lf_config ───────────────────────────────────────────
// lf_config não tem RLS e é lida pelo catálogo público com select('*') direto
// do navegador — conferido em 21/08/2026: a anon key devolve as 44 colunas de
// qualquer loja. Um access token do Mercado Pago ali seria entregue a todo
// visitante do catálogo, e com ele dá para criar cobranças e listar pagamentos
// da conta do lojista.
//
// O token mora em lf_credenciais_pagamento, que tem RLS e NENHUMA policy de
// SELECT: nem a lojista lê o token de volta. Quem enxerga é a service_role,
// dentro das Edge Functions. Ver supabase/migration_mercadopago_pix.sql.
//
// A gravação não é feita daqui: é a função SECURITY DEFINER
// public.salvar_credencial_mercadopago, em
// supabase/migration_rpc_salvar_credencial_mp.sql. O porquê está no bloco da
// função abaixo — em resumo, a ausência de policy de SELECT fecha os dois
// caminhos de UPDATE via PostgREST.
//
// Em lf_config fica apenas `mercadopago_ativo`, um booleano sem valor de
// segredo, que é o que o catálogo usa para decidir se oferece o QR dinâmico.

/**
 * Grava as credenciais do Mercado Pago da loja.
 *
 * ─── POR QUE É UMA FUNÇÃO NO BANCO, E NÃO UM UPDATE DAQUI ──────────────────
 * Porque os dois jeitos de mandar UPDATE pelo PostgREST estão fechados, e não
 * por acidente: os dois esbarram na MESMA decisão de segurança, que é esta
 * tabela não ter policy de SELECT nenhuma para o token nunca voltar ao
 * navegador.
 *
 *   com  .eq('loja_id', …)  → coluna citada no WHERE exige permissão de
 *                             SELECT, e isso faz o Postgres aplicar as
 *                             policies de SELECT. Não existe nenhuma, então a
 *                             linha some para o WHERE: 0 linhas afetadas,
 *                             resposta 204, nenhum erro. Silêncio total.
 *                             (medido no banco em 23/08/2026)
 *
 *   sem  .eq('loja_id', …)  → o PostgREST recusa a operação inteira:
 *                             400  21000  "UPDATE requires a WHERE clause".
 *                             (confirmado em produção em 23/08/2026)
 *
 * Historicamente isto já tinha mordido uma terceira vez, com outra cara: o
 * `.upsert(..., { onConflict: 'loja_id' })` original quebrava com "new row
 * violates row-level security policy", porque `INSERT ... ON CONFLICT DO
 * UPDATE` também precisa ENXERGAR a linha conflitante para resolver o
 * conflito. Mesma raiz, terceira manifestação.
 *
 * Não há lado bom para escolher — o caminho todo está fechado. Então a
 * gravação sai daqui e vira `public.salvar_credencial_mercadopago`, uma função
 * SECURITY DEFINER (ver supabase/migration_rpc_salvar_credencial_mp.sql):
 *
 *   • roda como dona da função, então enxerga a linha sem depender de policy
 *     de SELECT — e o ON CONFLICT volta a funcionar lá dentro;
 *   • não é PATCH, então a trava de WHERE do PostgREST não se aplica;
 *   • confere `auth.jwt() -> 'app_metadata' ->> 'loja_id'` contra o loja_id
 *     alvo ANTES de escrever, e aborta com 42501 (→ HTTP 403) se não bater.
 *     É a mesma comparação que a policy de UPDATE fazia; a proteção por loja
 *     não sumiu, mudou de lugar para onde o Postgres consegue aplicá-la;
 *   • retorna void. Nunca lê nem devolve token ou segredo do webhook — a
 *     tabela segue sem policy de SELECT e ilegível pelo navegador.
 *
 * ─── A FALHA SILENCIOSA QUE ISTO ENCERRA ───────────────────────────────────
 * Relato de 25/08/2026: a Tropicale preenchia o Access Token, salvava, via a
 * confirmação na tela — e `atualizado_em` no banco continuava igual. Nada era
 * gravado e ninguém era avisado, porque um UPDATE que não casa nenhuma linha é
 * 204 SEM ERRO no PostgREST.
 *
 * Com a função isso deixa de ser possível: ou ela lança exceção (e o erro
 * chega aqui), ou o `ON CONFLICT` gravou — não existe caminho do meio que
 * responda sucesso sem ter escrito. A checagem de `count` que existia aqui
 * saiu junto com o UPDATE; quem garante agora é o próprio banco.
 *
 * ─── CAMPO VAZIO MANTÉM O QUE ESTÁ GRAVADO ─────────────────────────────────
 * Relato da Tropicale de 23/08/2026: "não consigo salvar o Access Token e a
 * chave do webhook". A tela promete, no placeholder de cada campo, "Deixe
 * vazio para manter o atual" — e o código fazia o contrário, mandando NULL e
 * APAGANDO o valor gravado. Como a tela limpa os dois campos depois de cada
 * salvamento (o token não volta do banco, então não há o que reexibir):
 *
 *     1. cola o Access Token, salva      -> token gravado, segredo NULO
 *     2. cola a chave do webhook, salva  -> segredo gravado, TOKEN APAGADO
 *
 * nunca deixava os dois valores no banco ao mesmo tempo. Para a lojista isso
 * aparece como "não salva", e é recorrente por construção.
 *
 * Campo vazio agora vira `null` no parâmetro, e a função trata `null` como
 * "não mexe nesta coluna" (`coalesce(excluded.x, cred.x)`). Verificado contra
 * o banco em 23/08/2026, em transação abortada: gravando só o token, o segredo
 * do webhook ficou intacto.
 *
 * Consequência assumida, a mesma de antes: não existe "apagar limpando o
 * campo". Nunca foi um caminho oferecido pela tela — o placeholder diz o
 * oposto — e apagar uma credencial sem querer é bem pior do que precisar de um
 * botão explícito, que hoje não existe em lugar nenhum da UI.
 *
 * @returns {Promise<{error: Error|null}>}
 */
export async function salvarCredencialMercadoPago(client, lojaId, { token, webhookSecret }) {
  if (!lojaId) return { error: new Error('Loja não identificada.') }

  const tokenNovo   = token?.trim()         || ''
  const segredoNovo = webhookSecret?.trim() || ''

  // Nada digitado é nada a gravar. Sem isto, salvar a tela de Configurações
  // sem tocar nas chaves mandaria um write que só mexeria em `atualizado_em`
  // — e, no desenho antigo, apagaria as duas credenciais de uma vez.
  if (!tokenNovo && !segredoNovo) return { error: null }

  // ── Defesa 1: sessão ────────────────────────────────────────────────────
  // A função é `grant execute ... to authenticated`, e a checagem de loja lá
  // dentro lê o claim do JWT. Sem sessão o supabase-js manda a anon key (ver
  // src/lib/authRefresh.js), que não tem permissão de executar nem claim para
  // conferir. Avisar aqui é melhor do que mandar uma chamada já condenada.
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

  // `null`, não string vazia: é `null` que a função lê como "não mexe nesta
  // coluna". String vazia viraria null lá dentro também (ela faz
  // `nullif(btrim(...), '')`), mas mandar explícito deixa o contrato claro dos
  // dois lados.
  const { error } = await client.rpc('salvar_credencial_mercadopago', {
    p_loja_id:        lojaId,
    p_access_token:   tokenNovo   || null,
    p_webhook_secret: segredoNovo || null,
  })

  if (!error) return { error: null }

  // PGRST202 = o PostgREST não achou a função. Acontece se o deploy do código
  // subir antes de alguém rodar
  // supabase/migration_rpc_salvar_credencial_mp.sql, que é DDL e vai à mão.
  // Sem esta mensagem o sintoma seria "não salva" outra vez, agora por um
  // motivo novo — e já perdemos tempo demais com esse sintoma.
  if (error.code === 'PGRST202') {
    return {
      error: new Error(
        'A função de gravação ainda não existe no banco. '
        + 'É preciso rodar a migration supabase/migration_rpc_salvar_credencial_mp.sql '
        + 'no Supabase antes de salvar credenciais. Nada foi gravado.',
      ),
    }
  }

  // 42501 = a função recusou: o claim de loja da sessão não bate com a loja
  // que se tentou gravar. Na prática é sessão antiga, emitida antes de a loja
  // entrar no app_metadata do usuário.
  if (error.code === '42501') {
    return {
      error: new Error(
        'O banco recusou a gravação: a sessão atual não tem permissão para '
        + 'esta loja. Saia, entre de novo e repita. Nada foi gravado.',
      ),
    }
  }

  return { error }
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
