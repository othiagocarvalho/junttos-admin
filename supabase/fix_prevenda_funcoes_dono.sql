-- ============================================================================
-- fix_prevenda_funcoes_dono.sql — bipar_item_prevenda e restaurar_item_prevenda
-- passam a conferir se quem chama é dono da loja.
--
-- Execute no Supabase Dashboard > SQL Editor. NÃO é aplicada automaticamente.
-- APLICADA MANUALMENTE em produção pelo Thiago (informado em 28/09/2026).
-- Fica no repositório como documentação da definição atual.
--
-- ─── O PROBLEMA ─────────────────────────────────────────────────────────────
-- As duas funções são SECURITY DEFINER (rodam como dono, ignorando RLS) e têm
-- GRANT EXECUTE para `authenticated`, mas não conferem p_loja_id contra o
-- login. Qualquer usuário logado de QUALQUER loja podia baixar ou devolver
-- estoque de outra loja só passando outro p_loja_id. (Achado na investigação
-- da lentidão da Pré-venda da Tropicale, 28/09/2026.)
--
-- ─── A CORREÇÃO ─────────────────────────────────────────────────────────────
-- CREATE OR REPLACE das duas, com a MESMA assinatura de
-- supabase/fix_prevenda_schema.sql — inclusive p_origem_id uuid DEFAULT NULL
-- — e o MESMO corpo, copiado de lá sem nenhuma outra mudança. A única coisa
-- nova é um bloco no início do BEGIN:
--
--   p_loja_id tem de ser igual a auth.jwt() -> 'app_metadata' ->> 'loja_id'
--
-- Senão: RAISE EXCEPTION 'PREVENDA_LOJA_INVALIDA:{"loja_id": ...}' com
-- ERRCODE 42501 (insufficient_privilege). O app mostra a mensagem genérica
-- "Não foi possível bipar este item agora" (parseErroEstoquePrevenda só
-- reconhece ESTOQUE_INSUFICIENTE) e, nesse caso, NADA foi baixado — o
-- bloqueio vem antes do SELECT ... FOR UPDATE.
--
-- Mesma assinatura = CREATE OR REPLACE substitui a função existente em vez de
-- criar uma sobrecarga, e os GRANTs existentes continuam valendo. Os GRANTs
-- são repetidos abaixo mesmo assim (idempotentes), iguais aos de antes.
--
-- ─── AS EXCEÇÕES, E COMO CADA UMA FOI TRATADA ───────────────────────────────
-- 1. Loja demo 'sualoja': p_loja_id = 'sualoja' passa sempre, com qualquer
--    login (ou sem login nenhum no JWT). É a mesma exceção das policies
--    *_demo (ex.: lf_recorrencias_demo, lf_socio_relatorios_demo,
--    lf_estoque_pendencias_demo_select): o Painel Demo do admin abre a
--    'sualoja' com um usuário que NÃO tem loja_id no app_metadata. Só vale
--    para a própria 'sualoja' — não abre nenhuma outra loja.
-- 2. service_role (scripts em scripts/*.mjs com SUPABASE_SERVICE_KEY):
--    coalesce(auth.role(), '') = 'service_role' passa. O JWT da service key
--    não tem loja_id de loja nenhuma; é chave de servidor, nunca vai no
--    bundle do app. auth.role() lê a claim `role` do JWT da requisição.
-- 3. Gerentes (papel 'gerente', scripts/criarLoginsGerentesGrupoDaniel.mjs):
--    NÃO é exceção — o login de gerente já nasce com loja_id no
--    app_metadata, então passa pela regra normal.
--
-- Fica de fora de propósito: o SQL Editor do Dashboard. Ele roda sem JWT de
-- requisição (auth.role() e auth.jwt() nulos), então chamar estas funções à
-- mão por lá para uma loja que não seja a 'sualoja' passa a ser recusado.
-- Hoje ninguém faz isso; quem precisar faz via script com service_role.
--
-- ─── ORDEM DE DEPLOY ────────────────────────────────────────────────────────
-- Independe do front: o app sempre manda o p_loja_id da loja logada
-- (LOJA_ID de useLojaData), então para a lojista nada muda. Pode rodar antes
-- ou depois do deploy da correção de velocidade.
-- ============================================================================


-- ── 0. CONFERÊNCIA ANTES ────────────────────────────────────────────────────
-- Rode e GUARDE o resultado: é a definição que está no ar agora (o rollback
-- abaixo assume que ela é igual à de fix_prevenda_schema.sql — confira).
-- Esperado: duas linhas; nenhuma das duas contém 'PREVENDA_LOJA_INVALIDA'.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       p.prosecdef AS security_definer,
       position('PREVENDA_LOJA_INVALIDA' in pg_get_functiondef(p.oid)) > 0 AS ja_tem_checagem,
       pg_get_functiondef(p.oid) AS definicao
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('bipar_item_prevenda', 'restaurar_item_prevenda')
ORDER BY p.proname;


BEGIN;

-- ── 1. bipar_item_prevenda ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bipar_item_prevenda(
  p_loja_id    text,
  p_produto_id uuid,
  p_variacao   jsonb,
  p_origem_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_label      text;
  v_variacoes  jsonb;
  v_flat_qtd   int;
  v_idx        int;
  v_atual      int;
  v_ok         boolean;
BEGIN
  -- ── Dono da loja (fix_prevenda_funcoes_dono.sql) ─────────────────────────
  -- Mesma régua de lf_registrar_pendencia_estoque e das policies _own_loja/
  -- _demo. Vem ANTES de qualquer leitura/trava de lf_produtos.
  -- O coalesce(..., false) de fora NÃO é enfeite: sem JWT (ou com p_loja_id
  -- nulo) a comparação dá NULL, NOT NULL também é NULL, e IF NULL não entra
  -- no THEN — a chamada passaria sem checagem nenhuma.
  IF NOT coalesce(
       coalesce(auth.role(), '') = 'service_role'
    OR p_loja_id = 'sualoja'
    OR (auth.jwt() -> 'app_metadata' ->> 'loja_id') = p_loja_id
  , false) THEN
    RAISE EXCEPTION 'PREVENDA_LOJA_INVALIDA:%', jsonb_build_object('loja_id', p_loja_id)::text
      USING ERRCODE = '42501';
  END IF;

  v_label := NULLIF((
    SELECT value FROM jsonb_each_text(COALESCE(p_variacao, '{}'::jsonb))
    WHERE key NOT IN ('quantidade', 'custo', 'codigo')
    LIMIT 1
  ), '');

  PERFORM set_config('app.mov_origem',      'venda',                                true);
  PERFORM set_config('app.mov_origem_tipo', 'pre_venda',                            true);
  PERFORM set_config('app.mov_origem_id',   COALESCE(p_origem_id::text, ''),        true);
  PERFORM set_config('app.mov_motivo',      'Pré-venda — item bipado',              true);

  SELECT variacoes, quantidade INTO v_variacoes, v_flat_qtd
  FROM lf_produtos
  WHERE id = p_produto_id AND loja_id = p_loja_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUTO_INVALIDO:%',
      jsonb_build_object('produto_id', p_produto_id, 'motivo', 'produto_nao_encontrado')::text;
  END IF;

  IF v_variacoes IS NOT NULL AND jsonb_array_length(v_variacoes) > 0 THEN
    -- ── Produto COM variação: reaproveita decrementar_estoque_variacao ────
    SELECT decrementar_estoque_variacao(p_produto_id, v_label, 1) INTO v_ok;

    IF NOT v_ok THEN
      SELECT (ordinality - 1)::int INTO v_idx
      FROM jsonb_array_elements(v_variacoes) WITH ORDINALITY arr(elem, ordinality)
      WHERE (
        SELECT value FROM jsonb_each_text(elem)
        WHERE key NOT IN ('quantidade', 'custo', 'codigo')
        LIMIT 1
      ) = v_label
      LIMIT 1;

      v_atual := CASE WHEN v_idx IS NULL THEN 0
                      ELSE COALESCE((v_variacoes -> v_idx ->> 'quantidade')::int, 0) END;

      RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE:%', jsonb_build_object(
        'produto_id', p_produto_id, 'cor', v_label, 'disponivel', v_atual, 'pedido', 1
      )::text;
    END IF;
  ELSE
    -- ── Produto SEM variação: decrementa lf_produtos.quantidade direto ────
    v_flat_qtd := COALESCE(v_flat_qtd, 0);
    IF v_flat_qtd < 1 THEN
      RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE:%', jsonb_build_object(
        'produto_id', p_produto_id, 'cor', null, 'disponivel', v_flat_qtd, 'pedido', 1
      )::text;
    END IF;

    UPDATE lf_produtos SET quantidade = v_flat_qtd - 1
    WHERE id = p_produto_id AND loja_id = p_loja_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'produto_id', p_produto_id, 'variacao', v_label);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bipar_item_prevenda(text, uuid, jsonb, uuid)
  TO authenticated;


-- ── 2. restaurar_item_prevenda ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restaurar_item_prevenda(
  p_loja_id    text,
  p_produto_id uuid,
  p_variacao   jsonb,
  p_origem_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_label      text;
  v_variacoes  jsonb;
  v_flat_qtd   int;
  v_idx        int;
  v_atual      int;
BEGIN
  -- ── Dono da loja (fix_prevenda_funcoes_dono.sql) ─────────────────────────
  -- Mesma régua de lf_registrar_pendencia_estoque e das policies _own_loja/
  -- _demo. Vem ANTES de qualquer leitura/trava de lf_produtos.
  -- O coalesce(..., false) de fora NÃO é enfeite: sem JWT (ou com p_loja_id
  -- nulo) a comparação dá NULL, NOT NULL também é NULL, e IF NULL não entra
  -- no THEN — a chamada passaria sem checagem nenhuma.
  IF NOT coalesce(
       coalesce(auth.role(), '') = 'service_role'
    OR p_loja_id = 'sualoja'
    OR (auth.jwt() -> 'app_metadata' ->> 'loja_id') = p_loja_id
  , false) THEN
    RAISE EXCEPTION 'PREVENDA_LOJA_INVALIDA:%', jsonb_build_object('loja_id', p_loja_id)::text
      USING ERRCODE = '42501';
  END IF;

  v_label := NULLIF((
    SELECT value FROM jsonb_each_text(COALESCE(p_variacao, '{}'::jsonb))
    WHERE key NOT IN ('quantidade', 'custo', 'codigo')
    LIMIT 1
  ), '');

  PERFORM set_config('app.mov_origem',      'devolucao',                            true);
  PERFORM set_config('app.mov_origem_tipo', 'pre_venda',                            true);
  PERFORM set_config('app.mov_origem_id',   COALESCE(p_origem_id::text, ''),        true);
  PERFORM set_config('app.mov_motivo',      'Pré-venda cancelada — item devolvido', true);

  SELECT variacoes, quantidade INTO v_variacoes, v_flat_qtd
  FROM lf_produtos
  WHERE id = p_produto_id AND loja_id = p_loja_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'produto_nao_encontrado');
  END IF;

  IF v_variacoes IS NOT NULL AND jsonb_array_length(v_variacoes) > 0 AND v_label IS NOT NULL THEN
    SELECT (ordinality - 1)::int INTO v_idx
    FROM jsonb_array_elements(v_variacoes) WITH ORDINALITY arr(elem, ordinality)
    WHERE (
      SELECT value FROM jsonb_each_text(elem)
      WHERE key NOT IN ('quantidade', 'custo', 'codigo')
      LIMIT 1
    ) = v_label
    LIMIT 1;

    IF v_idx IS NULL THEN
      -- A variação sumiu do cadastro desde a bipagem (lojista editou/apagou
      -- a cor) — nada seguro para devolver a. Mesmo comportamento de
      -- restaurar_estoque_pedido_catalogo nesse caso: segue sem erro.
      RETURN jsonb_build_object('ok', true, 'restaurado', false, 'motivo', 'variacao_nao_encontrada');
    END IF;

    v_atual := COALESCE((v_variacoes -> v_idx ->> 'quantidade')::int, 0);
    UPDATE lf_produtos
    SET variacoes = jsonb_set(variacoes, ARRAY[v_idx::text, 'quantidade'], to_jsonb(v_atual + 1))
    WHERE id = p_produto_id;
  ELSE
    UPDATE lf_produtos SET quantidade = COALESCE(v_flat_qtd, 0) + 1
    WHERE id = p_produto_id AND loja_id = p_loja_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'restaurado', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.restaurar_item_prevenda(text, uuid, jsonb, uuid)
  TO authenticated;

COMMIT;


-- ── 3. CONFERÊNCIA DEPOIS ───────────────────────────────────────────────────
-- Esperado: as mesmas duas linhas, mesmos argumentos
-- (p_loja_id text, p_produto_id uuid, p_variacao jsonb, p_origem_id uuid),
-- security_definer = true e ja_tem_checagem = true nas duas. Se aparecer
-- uma TERCEIRA linha, virou sobrecarga (assinatura diferente) — pare e avise.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       p.prosecdef AS security_definer,
       position('PREVENDA_LOJA_INVALIDA' in pg_get_functiondef(p.oid)) > 0 AS ja_tem_checagem
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('bipar_item_prevenda', 'restaurar_item_prevenda')
ORDER BY p.proname;

-- Quem pode executar (esperado: authenticated nas duas, como antes):
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('bipar_item_prevenda', 'restaurar_item_prevenda')
ORDER BY routine_name, grantee;


-- ── 4. ROLLBACK (comentado) ─────────────────────────────────────────────────
-- Volta as duas funções exatamente para a versão de fix_prevenda_schema.sql,
-- sem a checagem de dono. Só use se a conferência ANTES mostrou essa mesma
-- definição; se mostrou outra, use a definição guardada no passo 0.
-- Para rodar: descomente do BEGIN ao COMMIT.
--
-- BEGIN;
--
-- CREATE OR REPLACE FUNCTION public.bipar_item_prevenda(
--   p_loja_id    text,
--   p_produto_id uuid,
--   p_variacao   jsonb,
--   p_origem_id  uuid DEFAULT NULL
-- )
-- RETURNS jsonb
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_label      text;
--   v_variacoes  jsonb;
--   v_flat_qtd   int;
--   v_idx        int;
--   v_atual      int;
--   v_ok         boolean;
-- BEGIN
--   v_label := NULLIF((
--     SELECT value FROM jsonb_each_text(COALESCE(p_variacao, '{}'::jsonb))
--     WHERE key NOT IN ('quantidade', 'custo', 'codigo')
--     LIMIT 1
--   ), '');
--
--   PERFORM set_config('app.mov_origem',      'venda',                                true);
--   PERFORM set_config('app.mov_origem_tipo', 'pre_venda',                            true);
--   PERFORM set_config('app.mov_origem_id',   COALESCE(p_origem_id::text, ''),        true);
--   PERFORM set_config('app.mov_motivo',      'Pré-venda — item bipado',              true);
--
--   SELECT variacoes, quantidade INTO v_variacoes, v_flat_qtd
--   FROM lf_produtos
--   WHERE id = p_produto_id AND loja_id = p_loja_id
--   FOR UPDATE;
--
--   IF NOT FOUND THEN
--     RAISE EXCEPTION 'PRODUTO_INVALIDO:%',
--       jsonb_build_object('produto_id', p_produto_id, 'motivo', 'produto_nao_encontrado')::text;
--   END IF;
--
--   IF v_variacoes IS NOT NULL AND jsonb_array_length(v_variacoes) > 0 THEN
--     -- ── Produto COM variação: reaproveita decrementar_estoque_variacao ────
--     SELECT decrementar_estoque_variacao(p_produto_id, v_label, 1) INTO v_ok;
--
--     IF NOT v_ok THEN
--       SELECT (ordinality - 1)::int INTO v_idx
--       FROM jsonb_array_elements(v_variacoes) WITH ORDINALITY arr(elem, ordinality)
--       WHERE (
--         SELECT value FROM jsonb_each_text(elem)
--         WHERE key NOT IN ('quantidade', 'custo', 'codigo')
--         LIMIT 1
--       ) = v_label
--       LIMIT 1;
--
--       v_atual := CASE WHEN v_idx IS NULL THEN 0
--                       ELSE COALESCE((v_variacoes -> v_idx ->> 'quantidade')::int, 0) END;
--
--       RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE:%', jsonb_build_object(
--         'produto_id', p_produto_id, 'cor', v_label, 'disponivel', v_atual, 'pedido', 1
--       )::text;
--     END IF;
--   ELSE
--     -- ── Produto SEM variação: decrementa lf_produtos.quantidade direto ────
--     v_flat_qtd := COALESCE(v_flat_qtd, 0);
--     IF v_flat_qtd < 1 THEN
--       RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE:%', jsonb_build_object(
--         'produto_id', p_produto_id, 'cor', null, 'disponivel', v_flat_qtd, 'pedido', 1
--       )::text;
--     END IF;
--
--     UPDATE lf_produtos SET quantidade = v_flat_qtd - 1
--     WHERE id = p_produto_id AND loja_id = p_loja_id;
--   END IF;
--
--   RETURN jsonb_build_object('ok', true, 'produto_id', p_produto_id, 'variacao', v_label);
-- END;
-- $function$;
--
-- GRANT EXECUTE ON FUNCTION public.bipar_item_prevenda(text, uuid, jsonb, uuid)
--   TO authenticated;
--
-- CREATE OR REPLACE FUNCTION public.restaurar_item_prevenda(
--   p_loja_id    text,
--   p_produto_id uuid,
--   p_variacao   jsonb,
--   p_origem_id  uuid DEFAULT NULL
-- )
-- RETURNS jsonb
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_label      text;
--   v_variacoes  jsonb;
--   v_flat_qtd   int;
--   v_idx        int;
--   v_atual      int;
-- BEGIN
--   v_label := NULLIF((
--     SELECT value FROM jsonb_each_text(COALESCE(p_variacao, '{}'::jsonb))
--     WHERE key NOT IN ('quantidade', 'custo', 'codigo')
--     LIMIT 1
--   ), '');
--
--   PERFORM set_config('app.mov_origem',      'devolucao',                            true);
--   PERFORM set_config('app.mov_origem_tipo', 'pre_venda',                            true);
--   PERFORM set_config('app.mov_origem_id',   COALESCE(p_origem_id::text, ''),        true);
--   PERFORM set_config('app.mov_motivo',      'Pré-venda cancelada — item devolvido', true);
--
--   SELECT variacoes, quantidade INTO v_variacoes, v_flat_qtd
--   FROM lf_produtos
--   WHERE id = p_produto_id AND loja_id = p_loja_id
--   FOR UPDATE;
--
--   IF NOT FOUND THEN
--     RETURN jsonb_build_object('ok', false, 'erro', 'produto_nao_encontrado');
--   END IF;
--
--   IF v_variacoes IS NOT NULL AND jsonb_array_length(v_variacoes) > 0 AND v_label IS NOT NULL THEN
--     SELECT (ordinality - 1)::int INTO v_idx
--     FROM jsonb_array_elements(v_variacoes) WITH ORDINALITY arr(elem, ordinality)
--     WHERE (
--       SELECT value FROM jsonb_each_text(elem)
--       WHERE key NOT IN ('quantidade', 'custo', 'codigo')
--       LIMIT 1
--     ) = v_label
--     LIMIT 1;
--
--     IF v_idx IS NULL THEN
--       -- A variação sumiu do cadastro desde a bipagem (lojista editou/apagou
--       -- a cor) — nada seguro para devolver a. Mesmo comportamento de
--       -- restaurar_estoque_pedido_catalogo nesse caso: segue sem erro.
--       RETURN jsonb_build_object('ok', true, 'restaurado', false, 'motivo', 'variacao_nao_encontrada');
--     END IF;
--
--     v_atual := COALESCE((v_variacoes -> v_idx ->> 'quantidade')::int, 0);
--     UPDATE lf_produtos
--     SET variacoes = jsonb_set(variacoes, ARRAY[v_idx::text, 'quantidade'], to_jsonb(v_atual + 1))
--     WHERE id = p_produto_id;
--   ELSE
--     UPDATE lf_produtos SET quantidade = COALESCE(v_flat_qtd, 0) + 1
--     WHERE id = p_produto_id AND loja_id = p_loja_id;
--   END IF;
--
--   RETURN jsonb_build_object('ok', true, 'restaurado', true);
-- END;
-- $function$;
--
-- GRANT EXECUTE ON FUNCTION public.restaurar_item_prevenda(text, uuid, jsonb, uuid)
--   TO authenticated;
--
-- COMMIT;
