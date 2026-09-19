-- ============================================================================
-- fix_estoque_catalogo_publico.sql — checkout do catálogo público passa a
-- validar e decrementar estoque de forma atômica, para TODAS as lojas.
-- Execute no Supabase Dashboard > SQL Editor. NÃO é aplicada automaticamente.
-- NÃO FOI EXECUTADA — este arquivo só foi gerado. Aguardando confirmação do
-- diagnóstico com o Thiago antes de rodar em produção.
--
-- ─── O BUG QUE ISTO CORRIGE ──────────────────────────────────────────────
-- Investigação anterior (mesma sessão) confirmou: CatalogoPublicoV2.jsx — o
-- componente que atende TODAS as lojas com catálogo publicado desde
-- 20/08/2026, não só o grupo Daniel — registra pedido com um INSERT direto
-- em lf_pedidos. Nenhum estoque é checado, nenhum é decrementado. O seletor
-- de quantidade da tela também não tinha teto algum. Resultado: cliente
-- pedia qualquer quantidade, de qualquer produto, sempre aceito.
--
-- A função decrementar_estoque_variacao (criada manualmente no banco, sem
-- DDL neste repo, para o fix de código de barras manual) já faz o certo —
-- SELECT ... FOR UPDATE, rejeita se a quantidade pedida for maior que a
-- disponível — mas só é chamada pelo CatalogoPublico.jsx ANTIGO, que está
-- sem rota. Este arquivo não recria essa lógica: a função abaixo CHAMA
-- decrementar_estoque_variacao para o caso de produto com variação, e só
-- escreve lógica nova para o caso que ela nunca cobriu (produto sem
-- variação, cujo saldo mora em lf_produtos.quantidade, não em variacoes).
--
-- ─── ORDEM DE EXECUÇÃO ──────────────────────────────────────────────────
-- As duas partes abaixo (ALTER TABLE e CREATE FUNCTION) podem rodar juntas,
-- de cima para baixo, num só comando no SQL Editor. Idempotente: pode rodar
-- de novo sem quebrar nada (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================


-- ── 1. Coluna que diferencia pedido novo (baixou estoque de verdade) de ────
--       pedido antigo (nunca baixou, porque foi criado antes desta correção)
--
-- CRÍTICO: sem esta distinção, cancelar ou excluir um pedido criado ANTES
-- deste deploy (via o INSERT direto antigo) devolveria ao estoque peças que
-- nunca saíram de lá — inflando o estoque silenciosamente. useLojaData.js
-- (cancelarPedido/excluirPedido) e o webhook do Mercado Pago passam a só
-- devolver quando esta coluna é true.
ALTER TABLE lf_pedidos ADD COLUMN IF NOT EXISTS estoque_baixado boolean DEFAULT false;

-- Pedidos que já existem hoje nunca baixaram estoque de verdade (INSERT
-- direto, sem RPC nenhuma) — o DEFAULT false acima já cobre isso para toda
-- linha existente automaticamente (ADD COLUMN com DEFAULT preenche as linhas
-- atuais com o default), então não precisa de UPDATE nenhum aqui.


-- ── 2. RPC que cria o pedido de forma atômica ───────────────────────────────
--
-- Recebe todos os itens do carrinho DE UMA VEZ (não item por item — dois
-- itens do mesmo pedido reservando estoque em chamadas separadas reabriria a
-- janela de corrida que esta função existe para fechar). Dentro de UMA
-- transação:
--
--   1. Para cada item, tranca a linha do produto (FOR UPDATE) e confere se
--      a quantidade pedida cabe na disponível.
--   2. Primeiro item que não couber: RAISE EXCEPTION — e não RETURN com um
--      campo de erro. É a diferença entre "desfaz tudo" e "talvez desfaça":
--      um RETURN normal dentro da função NÃO reverte os UPDATEs que já rodaram
--      nas iterações anteriores do loop (eles fariam parte do mesmo commit da
--      chamada). RAISE EXCEPTION aborta a transação inteira — PostgREST
--      devolve erro, e nenhum item decrementa, nem os que couberam antes do
--      que faltou.
--   3. Todos os itens cabendo: decrementa todos e insere o pedido com
--      estoque_baixado = true, tudo no mesmo commit.
--
-- A mensagem da exceção carrega um JSON com prefixo fixo
-- ('ESTOQUE_INSUFICIENTE:{...}') — é assim que o frontend
-- (utils/catalogoV2.js:parseErroEstoque) sabe qual produto/variação faltou e
-- quanto está disponível, para mostrar isso à cliente em vez de um erro
-- genérico.
--
-- ─── PRODUTO COM VARIAÇÃO vs SEM VARIAÇÃO ──────────────────────────────────
-- decrementar_estoque_variacao só sabe mexer em lf_produtos.variacoes — ela
-- SEMPRE devolve false para produto sem variação (variacoes vazio: o loop
-- interno dela nunca acha um índice, v_idx fica NULL). Por isso esta função
-- não chama decrementar_estoque_variacao cegamente: quando o produto tem
-- variacoes, delega para ela (reaproveitando o lock e a checagem que já
-- existem, testados); quando não tem, decrementa lf_produtos.quantidade
-- direto, com o mesmo padrão de lock (FOR UPDATE) e mesma regra de rejeição.
--
-- ─── CONTEXTO DE MOVIMENTAÇÃO (lf_estoque_mov) ─────────────────────────────
-- Mesma técnica de lf_pedido_baixa_estoque: set_config('app.mov_*', ..., true)
-- ANTES do UPDATE, dentro da MESMA função — um set_config de uma chamada
-- HTTP não alcança o UPDATE de outra (cada request do PostgREST é uma
-- conexão/transação própria). O trigger trg_lf_estoque_mov só dispara em
-- UPDATE/INSERT de lf_produtos.variacoes — a baixa de produto SEM variação
-- (lf_produtos.quantidade) não gera linha no histórico de movimentação. É
-- uma limitação PRÉ-EXISTENTE do trigger (decrementar_estoque_variacao e o
-- fluxo de Nova Venda têm exatamente a mesma lacuna para produto sem
-- variação); esta correção não estende o trigger — fora do escopo do fix
-- urgente de hoje, fica documentado para um follow-up.
--
-- p_itens é `jsonb` (um array), não `jsonb[]` (array nativo do Postgres) —
-- decisão tomada aqui, não pedida assim originalmente: jsonb[] exige
-- casts/sintaxe de array específicos na hora de chamar via PostgREST/
-- supabase-js e é fonte comum de atrito; um jsonb guardando um array é o
-- mesmo padrão que lf_pedidos.produtos já usa (`jsonb DEFAULT '[]'::jsonb`),
-- então o frontend manda `p_itens: [...]` como um array JS normal, sem
-- serialização especial.
CREATE OR REPLACE FUNCTION public.criar_pedido_catalogo(
  p_loja_id       text,
  p_dados_cliente jsonb,    -- { cliente_nome, cliente_whatsapp } — igual ao
                            -- que dadosClienteParaPedido() já produz.
  p_itens         jsonb,    -- array de { produto_id, nome, cor, tamanho, qtd, preco }
  p_valor_total   numeric,
  p_status        text DEFAULT 'aguardando_pagamento'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pedido_id    uuid := gen_random_uuid();
  v_item         jsonb;
  v_produto_id   uuid;
  v_qtd          int;
  v_cor          text;
  v_nome         text;
  v_variacoes    jsonb;
  v_flat_qtd     int;
  v_idx          int;
  v_atual        int;
  v_ok           boolean;
  v_produtos_out jsonb := '[]'::jsonb;
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'CARRINHO_VAZIO:%', jsonb_build_object('motivo', 'sem itens')::text;
  END IF;

  -- Contexto de movimentação (lf_estoque_mov) — uma vez só, vale para todos
  -- os UPDATEs que rodarem dentro desta chamada.
  PERFORM set_config('app.mov_origem',      'venda',                         true);
  PERFORM set_config('app.mov_origem_tipo', 'pedido',                        true);
  PERFORM set_config('app.mov_origem_id',   v_pedido_id::text,               true);
  PERFORM set_config('app.mov_motivo',      'Pedido do catálogo público',    true);
  PERFORM set_config('app.mov_usuario',     '',                              true);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := NULLIF(v_item->>'produto_id', '')::uuid;
    v_qtd        := COALESCE((v_item->>'qtd')::int, 0);
    v_cor        := NULLIF(v_item->>'cor', '');
    v_nome       := COALESCE(v_item->>'nome', '');

    IF v_qtd <= 0 THEN CONTINUE; END IF;

    IF v_produto_id IS NULL THEN
      RAISE EXCEPTION 'PRODUTO_INVALIDO:%',
        jsonb_build_object('nome', v_nome, 'motivo', 'produto_id ausente')::text;
    END IF;

    -- Lock + leitura de ambas as formas de estoque numa passada só. A trava
    -- é da LINHA inteira do produto (variacoes E quantidade compartilham o
    -- mesmo lock), então dois itens do mesmo pedido tocando o mesmo produto
    -- não colidem entre si — só serializam com QUALQUER outra transação
    -- (inclusive outro cliente) mexendo no mesmo produto.
    SELECT variacoes, quantidade INTO v_variacoes, v_flat_qtd
    FROM lf_produtos
    WHERE id = v_produto_id AND loja_id = p_loja_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUTO_INVALIDO:%',
        jsonb_build_object('produto_id', v_produto_id, 'nome', v_nome, 'motivo', 'produto_nao_encontrado')::text;
    END IF;

    IF v_variacoes IS NOT NULL AND jsonb_array_length(v_variacoes) > 0 THEN
      -- ── Produto COM variação: reaproveita decrementar_estoque_variacao ──
      -- Ela já tranca (de novo — mesma linha, mesma transação, Postgres não
      -- deadlocka consigo mesmo) e decrementa atomicamente. Só precisamos de
      -- um jeito de saber QUANTO estava disponível quando ela rejeita, para
      -- montar a mensagem de erro — isso ela não devolve (só boolean), então
      -- é lido à parte, da MESMA leitura já trancada acima.
      SELECT decrementar_estoque_variacao(v_produto_id, v_cor, v_qtd) INTO v_ok;

      IF NOT v_ok THEN
        SELECT (ordinality - 1)::int INTO v_idx
        FROM jsonb_array_elements(v_variacoes) WITH ORDINALITY arr(elem, ordinality)
        WHERE (
          SELECT value FROM jsonb_each_text(elem)
          WHERE key NOT IN ('quantidade', 'custo', 'codigo')
          LIMIT 1
        ) = v_cor
        LIMIT 1;

        v_atual := CASE WHEN v_idx IS NULL THEN 0
                        ELSE COALESCE((v_variacoes -> v_idx ->> 'quantidade')::int, 0) END;

        RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE:%', jsonb_build_object(
          'produto_id', v_produto_id, 'nome', v_nome, 'cor', v_cor,
          'disponivel', v_atual, 'pedido', v_qtd
        )::text;
      END IF;
    ELSE
      -- ── Produto SEM variação: decrementar_estoque_variacao não cobre este
      -- caso (sempre devolve false para variacoes vazio) — lógica própria,
      -- mesmo padrão de lock+checagem, contra lf_produtos.quantidade.
      v_flat_qtd := COALESCE(v_flat_qtd, 0);
      IF v_flat_qtd < v_qtd THEN
        RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE:%', jsonb_build_object(
          'produto_id', v_produto_id, 'nome', v_nome, 'cor', null,
          'disponivel', v_flat_qtd, 'pedido', v_qtd
        )::text;
      END IF;

      UPDATE lf_produtos SET quantidade = v_flat_qtd - v_qtd
      WHERE id = v_produto_id AND loja_id = p_loja_id;
    END IF;

    v_produtos_out := v_produtos_out || jsonb_build_object(
      'produto_id', v_produto_id,
      'nome',       v_nome,
      'cor',        v_cor,
      -- Formato de exibição idêntico ao que o frontend já gravava
      -- (registrarPedido, antes desta correção): "Cor / Tamanho", cor OU
      -- tamanho sozinhos, ou vazio — para PedidosCatalogo.jsx (lê p.nome,
      -- p.variacao, p.qtd) continuar funcionando sem mudança nenhuma.
      'variacao',   NULLIF(trim(both ' / ' from
                      concat_ws(' / ', v_cor, NULLIF(v_item->>'tamanho', ''))
                    ), ''),
      'qtd',        v_qtd,
      'preco',      COALESCE((v_item->>'preco')::numeric, 0)
    );
  END LOOP;

  IF jsonb_array_length(v_produtos_out) = 0 THEN
    RAISE EXCEPTION 'CARRINHO_VAZIO:%', jsonb_build_object('motivo', 'nenhum item com quantidade positiva')::text;
  END IF;

  INSERT INTO lf_pedidos (
    id, loja_id, cliente_nome, cliente_whatsapp, produtos, valor_total, status, estoque_baixado
  ) VALUES (
    v_pedido_id, p_loja_id,
    COALESCE(p_dados_cliente->>'cliente_nome', ''),
    COALESCE(p_dados_cliente->>'cliente_whatsapp', ''),
    v_produtos_out,
    COALESCE(p_valor_total, 0),
    COALESCE(NULLIF(p_status, ''), 'aguardando_pagamento'),
    true
  );

  RETURN jsonb_build_object('ok', true, 'pedido_id', v_pedido_id);
END;
$function$;

-- anon é quem chama isto de verdade (supabasePublico.js fala sem sessão de
-- propósito — ver o cabeçalho do arquivo). authenticated cobre a lojista
-- logada no mesmo navegador acessando o próprio link de catálogo. Mesma
-- lista de grantees que lf_pedido_baixa_estoque já tem hoje.
GRANT EXECUTE ON FUNCTION public.criar_pedido_catalogo(text, jsonb, jsonb, numeric, text)
  TO anon, authenticated;


-- ── 3. RPC de restauração para o webhook do Mercado Pago ───────────────────
--
-- mp-webhook (Edge Function, Deno) não consegue chamar aplicarEstoque()
-- (hook React, roda só no browser) — por isso esta função existe: é o
-- equivalente server-side, chamável via admin.rpc(...) com a service_role
-- key, para devolver ao estoque um pedido cujo Pix foi rejeitado/cancelado
-- pelo Mercado Pago.
--
-- Casa por produto_id + cor (o item já carrega os dois, gravados por
-- criar_pedido_catalogo acima) em vez do mecanismo antigo de
-- nome+variação (aplicarEstoque/normalizarItensEstoque, em
-- src/utils/estoqueMov.js) — mais robusto (não depende de dois produtos
-- nunca terem o mesmo nome) e cobre produto SEM variação, que o mecanismo
-- antigo sempre pulou ("itens sem variação não mexem em estoque", comentário
-- original de normalizarItensEstoque). Isso cria uma assimetria: cancelar
-- pedido pela tela (useLojaData.js) continua restaurando pelo mecanismo
-- antigo — que ainda tem essa lacuna para produto sem variação —, enquanto o
-- Pix rejeitado por aqui restaura corretamente. Documentado como
-- follow-up; não foi pedido nem é seguro tentar unificar os dois dentro
-- desta correção urgente.
--
-- Idempotente por design: confere estoque_baixado ANTES de mexer, e desliga
-- a flag depois de restaurar — uma segunda chamada (webhook duplicado, o MP
-- reenvia até receber 200) não devolve a peça duas vezes.
CREATE OR REPLACE FUNCTION public.restaurar_estoque_pedido_catalogo(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_loja_id     text;
  v_baixado     boolean;
  v_produtos    jsonb;
  v_item        jsonb;
  v_produto_id  uuid;
  v_qtd         int;
  v_cor         text;
  v_variacoes   jsonb;
  v_flat_qtd    int;
  v_idx         int;
  v_atual       int;
BEGIN
  SELECT loja_id, estoque_baixado, produtos INTO v_loja_id, v_baixado, v_produtos
  FROM lf_pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'pedido_nao_encontrado');
  END IF;

  IF v_baixado IS NOT TRUE THEN
    -- Pedido antigo (anterior a esta correção) ou já restaurado antes:
    -- nunca baixou de verdade, ou já foi devolvido — não mexe em nada.
    RETURN jsonb_build_object('ok', true, 'restaurado', false, 'motivo', 'estoque_nao_baixado');
  END IF;

  PERFORM set_config('app.mov_origem',      'devolucao',                          true);
  PERFORM set_config('app.mov_origem_tipo', 'pedido',                             true);
  PERFORM set_config('app.mov_origem_id',   p_pedido_id::text,                    true);
  PERFORM set_config('app.mov_motivo',      'Pix não pago — estoque liberado',    true);

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_produtos, '[]'::jsonb))
  LOOP
    v_produto_id := NULLIF(v_item->>'produto_id', '')::uuid;
    v_qtd        := COALESCE((v_item->>'qtd')::int, 0);
    v_cor        := NULLIF(v_item->>'cor', '');
    IF v_produto_id IS NULL OR v_qtd <= 0 THEN CONTINUE; END IF;

    SELECT variacoes, quantidade INTO v_variacoes, v_flat_qtd
    FROM lf_produtos WHERE id = v_produto_id AND loja_id = v_loja_id FOR UPDATE;

    IF NOT FOUND THEN CONTINUE; END IF; -- produto sumiu do catálogo: nada para devolver

    IF v_variacoes IS NOT NULL AND jsonb_array_length(v_variacoes) > 0 AND v_cor IS NOT NULL THEN
      SELECT (ordinality - 1)::int INTO v_idx
      FROM jsonb_array_elements(v_variacoes) WITH ORDINALITY arr(elem, ordinality)
      WHERE (
        SELECT value FROM jsonb_each_text(elem)
        WHERE key NOT IN ('quantidade', 'custo', 'codigo')
        LIMIT 1
      ) = v_cor
      LIMIT 1;

      IF v_idx IS NOT NULL THEN
        v_atual := COALESCE((v_variacoes -> v_idx ->> 'quantidade')::int, 0);
        UPDATE lf_produtos
        SET variacoes = jsonb_set(variacoes, ARRAY[v_idx::text, 'quantidade'], to_jsonb(v_atual + v_qtd))
        WHERE id = v_produto_id;
      END IF;
      -- v_idx NULL = a variação sumiu do cadastro desde a compra (lojista
      -- editou/apagou a cor). Nada seguro para devolver a; segue sem erro.
    ELSE
      UPDATE lf_produtos SET quantidade = COALESCE(v_flat_qtd, 0) + v_qtd
      WHERE id = v_produto_id AND loja_id = v_loja_id;
    END IF;
  END LOOP;

  UPDATE lf_pedidos SET estoque_baixado = false WHERE id = p_pedido_id;

  RETURN jsonb_build_object('ok', true, 'restaurado', true);
END;
$function$;

-- Só o webhook chama isto, com a service_role key — sem grant a
-- anon/authenticated de propósito (não é uma ação que a cliente ou a lojista
-- deveriam poder disparar direto).
GRANT EXECUTE ON FUNCTION public.restaurar_estoque_pedido_catalogo(uuid)
  TO service_role;
