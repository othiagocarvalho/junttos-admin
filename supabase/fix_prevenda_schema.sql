-- ============================================================================
-- fix_prevenda_schema.sql — base de dados da Pré-venda (etapa 1 de 2).
-- Execute no Supabase Dashboard > SQL Editor. NÃO é aplicada automaticamente.
-- NÃO FOI EXECUTADA — este arquivo só foi gerado. Aguardando revisão do
-- Thiago antes de rodar em produção.
--
-- ─── O QUE ESTA ETAPA FAZ E O QUE NÃO FAZ ──────────────────────────────────
-- Só a base: colunas novas em lf_vendas e as duas RPCs atômicas de bipagem/
-- restauro por item. NENHUMA tela nova de Pré-venda é criada nesta etapa —
-- isso é a etapa 2. O que garante que esta etapa sozinha já é segura de
-- rodar em produção sem quebrar nada é a parte 2 do trabalho desta correção,
-- em useLojaData.js e em todo lugar que soma lf_vendas para indicador
-- financeiro (ver relatório da tarefa) — sem esse filtro, expor `status`
-- aqui já seria arriscado mesmo com zero UI nova, porque um `status`
-- '"aguardando_pagamento"' futuro contaria como faturamento em qualquer
-- lugar que não filtra.
--
-- ─── DEFAULT 'completa' / DEFAULT true: por quê ────────────────────────────
-- Toda linha que já existe em lf_vendas hoje representa uma venda que já
-- aconteceu de verdade — decrementou estoque, foi paga, está fechada. As
-- duas colunas usam DEFAULT casado com esse fato: `status DEFAULT 'completa'`
-- e `estoque_baixado DEFAULT true`. Isso cobre dois casos de uma vez:
--   1. TODA LINHA EXISTENTE — ADD COLUMN com DEFAULT preenche o histórico
--      inteiro com o valor default, automaticamente, sem UPDATE nenhum.
--   2. QUALQUER INSERT NOVO que não passe `status`/`estoque_baixado`
--      explicitamente (ou seja, addVenda() como está hoje, Nova Venda,
--      Troca — nada disso muda nesta etapa) continua caindo em
--      'completa'/true, idêntico ao comportamento de antes desta migration.
-- Só a etapa 2 (a tela de Pré-venda) vai gravar 'aguardando_pagamento' /
-- false de propósito, no momento de criar a pré-venda.
--
-- Mesmo padrão já usado em lf_pedidos.estoque_baixado
-- (fix_estoque_catalogo_publico.sql) — resolveu o mesmo problema lá.
-- ============================================================================


-- ── 1. Colunas novas em lf_vendas ───────────────────────────────────────────
ALTER TABLE lf_vendas ADD COLUMN IF NOT EXISTS status text DEFAULT 'completa';
ALTER TABLE lf_vendas ADD COLUMN IF NOT EXISTS estoque_baixado boolean DEFAULT true;


-- ── 2. bipar_item_prevenda — decrementa 1 unidade, atômico, por produto_id ──
--
-- Chamada uma vez por bipe (a UI da etapa 2 chama isto a cada item lido no
-- scanner — não em lote, porque a vendedora vê o resultado peça por peça, e
-- porque bipar errado e cancelar aquele item específico precisa ser simples).
--
-- Reaproveita decrementar_estoque_variacao para o caso de produto COM
-- variação — mesmo padrão que criar_pedido_catalogo já usa: SELECT ... FOR
-- UPDATE trava a linha do produto inteiro, decrementar_estoque_variacao faz
-- o decremento de verdade, e se ela rejeitar (retorna false), o índice da
-- variação é relido (da MESMA leitura já travada) só para montar a mensagem
-- de erro com "quanto está disponível" — ela mesma não devolve esse número.
--
-- Produto SEM variação (variacoes vazio) decrementa lf_produtos.quantidade
-- direto, porque decrementar_estoque_variacao nunca cobriu esse caso (ver o
-- comentário equivalente em criar_pedido_catalogo).
--
-- p_variacao é jsonb no formato de UM item de lf_produtos.variacoes, sem a
-- chave quantidade — ex. {"cor": "AZUL"} ou {"tamanho": "M"} — nunca uma
-- string solta, para não fixar "cor" como a única chave de rótulo possível
-- (o sistema já tem produto rotulado por tamanho, sem chave cor — ver
-- CAMISA FANBOY em normalizarProduto, utils/catalogoV2.test.js). O rótulo é
-- extraído com a MESMA regra de sempre: a primeira chave que não é
-- quantidade/custo/codigo. Produto sem variação nenhuma manda
-- p_variacao = '{}'::jsonb ou NULL.
--
-- p_origem_id é OPCIONAL (não fazia parte da assinatura pedida) — pensado
-- para a etapa 2 poder amarrar a movimentação de estoque (lf_estoque_mov) ao
-- id da venda em status 'aguardando_pagamento' assim que ela existir. Como
-- esta etapa não cria a tela, nem sempre há um id de venda no momento da
-- bipagem (pode ser a primeira peça, antes do INSERT em lf_vendas
-- acontecer); por isso é opcional, default NULL, e a chamada de 3
-- argumentos pedida continua funcionando sem mudança.
--
-- ─── CONTEXTO DE MOVIMENTAÇÃO (lf_estoque_mov) ─────────────────────────────
-- tipo='venda' — não existe 'pre_venda' na CHECK constraint de lf_estoque_mov
-- (migration_estoque_mov.sql: 'entrada','ajuste','venda','devolucao',
-- 'balanco','cadastro','importacao') e esta etapa não mexe nessa constraint,
-- por não ter sido pedido e por ser uma migration à parte, já aplicada. Uma
-- bipagem de pré-venda É uma baixa por venda, semanticamente — o `motivo`
-- abaixo é o que diferencia no extrato de movimentação.
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

-- Só quem está logado (vendedora/lojista) chama isto — ao contrário do
-- catálogo público, a Pré-venda é uma feature interna, atrás de login. Sem
-- grant a anon, de propósito.
GRANT EXECUTE ON FUNCTION public.bipar_item_prevenda(text, uuid, jsonb, uuid)
  TO authenticated;


-- ── 3. restaurar_item_prevenda — devolve 1 unidade, mesmo padrão de ────────
--       restaurar_estoque_pedido_catalogo, mas por item (não por pedido
--       inteiro) — cancelar uma pré-venda na etapa 2 chama isto uma vez por
--       item que havia sido bipado.
--
-- ─── SEM GUARDA DE IDEMPOTÊNCIA PRÓPRIA — LIMITE DE ESCOPO DESTA ETAPA ─────
-- restaurar_estoque_pedido_catalogo confere `estoque_baixado` ANTES de
-- restaurar, porque opera sobre um pedido inteiro (um id só, chamado uma
-- vez). Esta função opera por ITEM — não existe aqui um "pedido" com um
-- booleano próprio para checar antes de cada chamada. A responsabilidade de
-- não chamar restaurar_item_prevenda duas vezes para a mesma peça bipada é
-- de quem chama (a tela da etapa 2, que sabe quais itens já foram
-- restaurados no carrinho local) — não desta função. Documentado aqui para
-- não ser esquecido na etapa 2.
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
