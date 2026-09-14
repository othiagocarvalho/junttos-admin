-- ─────────────────────────────────────────────────────────────────────────────
-- Código de barras manual (por variação) — atualização da decisão registrada
-- em supabase/migrations/20260822_codigo_barras_etiquetas.sql
--
-- APLICAR MANUALMENTE NO SQL EDITOR DO SUPABASE. Não é executado
-- automaticamente por este repositório (mesma convenção das demais
-- migrations *_estoque_mov.sql / *_catalogo_novo.sql etc.).
--
-- ─── CONTEXTO DO PEDIDO ──────────────────────────────────────────────────────
-- Duas lojas do mesmo dono (Atacadão dos Vestidos e Tropicale Atacado) vendem
-- o mesmo produto físico, do mesmo fornecedor. Pedido de negócio: quando for
-- o mesmo produto, o código de barras deve ser IGUAL nas duas lojas — hoje
-- isso é impossível de propósito, porque src/utils/codigoBarras.js inclui
-- loja_id no hash exatamente para NUNCA colidir entre lojas. A solução foi
-- permitir digitar o código à mão como override opcional; vazio continua
-- gerando o automático de sempre.
--
-- ─── POR QUE ISTO CONTRADIZ O ARQUIVO DE 22/08 (E POR QUE ESTÁ OK) ──────────
-- Aquele arquivo descartou "campo `codigo` dentro de cada item de
-- `variacoes`" com a justificativa "Não sobrevive" — dois caminhos
-- reescrevem o array inteiro e descartariam a chave:
--
--   1. lf_set_variacoes (supabase/migration_estoque_mov.sql):
--          UPDATE lf_produtos SET variacoes = p_variacoes
--   2. ProdutosB2BPro.jsx, buildVariacoes():
--          .map(t => ({ tamanho: ..., quantidade: ... }))
--
-- O ponto 1 nunca foi o problema de verdade: é um UPDATE direto do jsonb que
-- o CLIENT manda — ele grava o que o client construiu, chave por chave, sem
-- reconstruir nada. Quem apagava a chave era só o ponto 2, no client.
--
-- Este trabalho corrigiu o ponto 2: buildVariacoes() e variacaoesToGrade() em
-- ProdutosB2BPro.jsx, e o handleSave()/handleAddProduto() de EstoqueMobile.jsx,
-- agora preservam e devolvem a chave `codigo` explicitamente. Com isso, a
-- objeção original deixa de valer — o código sobrevive porque o client para
-- de apagá-lo, não porque o banco passou a fazer algo diferente.
--
-- A tabela separada que aquele arquivo esboçava como "caminho alternativo"
-- (lf_produto_codigos) foi considerada de novo aqui e descartada: ela evita o
-- risco de rewrite do lado da ESCRITA, mas troca isso por um novo risco do
-- lado da LEITURA — teria que ser mesclada em memória em cada variação antes
-- de chegar em qualquer tela (etiqueta, PDV, catálogo), e todo o mesmo
-- conjunto de lugares que hoje descobre o rótulo da variação por "a primeira
-- chave que não é quantidade/custo" precisaria ignorar `codigo` de qualquer
-- jeito — é o MESMO ajuste que este código já fez, só que a tabela separada
-- ainda pede migration nova, política de RLS nova e transformaria toda a
-- leitura de código de barras (hoje síncrona, em memória) em algo dependente
-- de uma segunda consulta. Sem ganho líquido dado que o risco de escrita já
-- foi fechado.
--
-- ─── O QUE ISTO CORRIGE DE FATO ──────────────────────────────────────────────
-- Duas funções Postgres usam a regra "primeira chave que não é
-- quantidade/custo" para achar o rótulo da variação. As duas precisam excluir
-- 'codigo' também — são a ÚNICA mudança de schema que este trabalho precisa;
-- as outras ~9 correções equivalentes (JS) já foram aplicadas no repositório.
--
--   1) lf_var_label — usada pelo trigger de lf_estoque_mov para popular
--      variacao_label. Sem o ajuste, o trigger gravaria o NÚMERO DO CÓDIGO
--      como se fosse o rótulo ("Rosa", "M") no histórico de movimentação —
--      jsonb_object_keys() não garante ordem de inserção, então não dá para
--      confiar em 'codigo' vir depois do rótulo. Bug de EXIBIÇÃO.
--
--   2) decrementar_estoque_variacao — usada pelo checkout do catálogo
--      público (via lf_pedido_baixa_estoque). CONFIRMADO abaixo que tem o
--      MESMO problema, e aqui é mais grave: é bug FUNCIONAL, não só de
--      exibição — ver seção 2 logo adiante.

-- ── 1) lf_var_label ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION lf_var_label(v jsonb)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r text;
BEGIN
  IF v IS NULL OR jsonb_typeof(v) <> 'object' THEN
    RETURN NULL;
  END IF;
  SELECT v ->> k INTO r
    FROM jsonb_object_keys(v) AS k
   WHERE k NOT IN ('quantidade', 'custo', 'codigo')
   LIMIT 1;
  RETURN r;
END $$;

-- Conferência (1):
--
--   -- cadastro com código manual
--   INSERT INTO lf_produtos (loja_id, nome, variacoes)
--   VALUES ('sualoja', 'ZZ Teste Codigo Manual',
--           '[{"cor":"Preto","quantidade":5,"codigo":"7891234560012"}]');
--
--   SELECT tipo, variacao_label, delta, qtd_nova
--     FROM lf_estoque_mov
--    WHERE produto_id = (SELECT id FROM lf_produtos WHERE nome = 'ZZ Teste Codigo Manual')
--    ORDER BY created_at;
--     → variacao_label deve ser 'Preto', NUNCA '7891234560012'
--
--   -- limpeza
--   DELETE FROM lf_produtos WHERE nome = 'ZZ Teste Codigo Manual';


-- ── 2) decrementar_estoque_variacao — CONFIRMADO NO BANCO DE PRODUÇÃO ────────
--
-- Rodado em 14/09/2026 via `supabase db query --linked`, contra o projeto
-- "Junttos Projeto" (dbfxigylileupucnuhmb), a mesma query de conferência que
-- ficava neste arquivo:
--
--   SELECT p.oid::regprocedure, pg_get_functiondef(p.oid)
--     FROM pg_proc p WHERE p.proname = 'decrementar_estoque_variacao';
--
-- O código-fonte REAL devolvido pelo banco (não suposição — é o que está rodando
-- hoje, sem DDL correspondente neste repositório até este arquivo):
--
--   CREATE OR REPLACE FUNCTION public.decrementar_estoque_variacao(p_produto_id uuid, p_label text, p_qtd integer)
--    RETURNS boolean
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public', 'pg_temp'
--   AS $function$
--   DECLARE
--     v_variacoes jsonb;
--     v_idx       int;
--     v_atual     int;
--   BEGIN
--     SELECT variacoes INTO v_variacoes
--     FROM lf_produtos
--     WHERE id = p_produto_id
--     FOR UPDATE;
--
--     IF v_variacoes IS NULL THEN
--       RETURN false;
--     END IF;
--
--     SELECT (ordinality - 1)::int INTO v_idx
--     FROM jsonb_array_elements(v_variacoes) WITH ORDINALITY arr(elem, ordinality)
--     WHERE (
--       SELECT value
--       FROM jsonb_each_text(elem)
--       WHERE key NOT IN ('quantidade', 'custo')      -- ← MESMO PADRÃO, 'codigo' NÃO excluído
--       LIMIT 1
--     ) = p_label
--     LIMIT 1;
--
--     IF v_idx IS NULL THEN
--       RETURN false;
--     END IF;
--
--     v_atual := COALESCE((v_variacoes -> v_idx ->> 'quantidade')::int, 0);
--
--     IF v_atual < p_qtd THEN
--       RETURN false;
--     END IF;
--
--     UPDATE lf_produtos
--     SET variacoes = jsonb_set(
--       variacoes,
--       ARRAY[v_idx::text, 'quantidade'],
--       to_jsonb(v_atual - p_qtd)
--     )
--     WHERE id = p_produto_id;
--
--     RETURN true;
--   END;
--   $function$
--
-- CONFIRMADO: usa exatamente o mesmo padrão vulnerável — "primeira chave que
-- não é quantidade/custo" — só que aqui o valor lido é comparado contra
-- p_label, o rótulo que o CLIENT manda (ex.: 'Rosa'), para achar o ÍNDICE da
-- variação a decrementar.
--
-- Diferente de lf_var_label (bug de EXIBIÇÃO), aqui o efeito é FUNCIONAL: se
-- 'codigo' for a chave devolvida pela subquery em vez do rótulo real, o valor
-- comparado nunca bate com p_label = 'Rosa' (ele seria o número do código de
-- barras) → v_idx fica NULL → a função devolve `false` → o checkout do
-- catálogo público (CatalogoPublico.jsx / CatalogoPublicoV2.jsx) NÃO decrementa
-- o estoque daquela variação. Dependendo de como lf_pedido_baixa_estoque e o
-- client tratam esse `false` hoje, isso trava o pedido silenciosamente ou o
-- deixa passar sem baixar estoque — em qualquer um dos dois casos, é quebra de
-- verdade, não só de exibição, para qualquer produto com código manual
-- vendido pelo catálogo público.
--
-- Busca por função irmã (ex.: uma "incrementar_estoque_variacao" para
-- restaurar em cancelamento) também rodada no banco — não existe nenhuma outra
-- função em public usando jsonb_each_text; decrementar_estoque_variacao é a
-- única com este padrão.
--
-- CORREÇÃO — idêntica ao original, só acrescentando 'codigo' ao NOT IN.
-- SECURITY DEFINER e SET search_path preservados EXATAMENTE como estão hoje
-- (não alterar — mexer nisso é abrir superfície de search_path hijack).

CREATE OR REPLACE FUNCTION public.decrementar_estoque_variacao(p_produto_id uuid, p_label text, p_qtd integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_variacoes jsonb;
  v_idx       int;
  v_atual     int;
BEGIN
  SELECT variacoes INTO v_variacoes
  FROM lf_produtos
  WHERE id = p_produto_id
  FOR UPDATE;

  IF v_variacoes IS NULL THEN
    RETURN false;
  END IF;

  SELECT (ordinality - 1)::int INTO v_idx
  FROM jsonb_array_elements(v_variacoes) WITH ORDINALITY arr(elem, ordinality)
  WHERE (
    SELECT value
    FROM jsonb_each_text(elem)
    WHERE key NOT IN ('quantidade', 'custo', 'codigo')
    LIMIT 1
  ) = p_label
  LIMIT 1;

  IF v_idx IS NULL THEN
    RETURN false;
  END IF;

  v_atual := COALESCE((v_variacoes -> v_idx ->> 'quantidade')::int, 0);

  IF v_atual < p_qtd THEN
    RETURN false;
  END IF;

  UPDATE lf_produtos
  SET variacoes = jsonb_set(
    variacoes,
    ARRAY[v_idx::text, 'quantidade'],
    to_jsonb(v_atual - p_qtd)
  )
  WHERE id = p_produto_id;

  RETURN true;
END;
$function$;

-- Conferência (2) — simula exatamente o checkout do catálogo público:
--
--   INSERT INTO lf_produtos (loja_id, nome, variacoes)
--   VALUES ('sualoja', 'ZZ Teste Decremento Manual',
--           '[{"cor":"Rosa","quantidade":5,"codigo":"7891234560012"}]');
--
--   SELECT decrementar_estoque_variacao(
--     (SELECT id FROM lf_produtos WHERE nome = 'ZZ Teste Decremento Manual'),
--     'Rosa', 2);
--     → ANTES da correção: false (não acha a variação — comparava 'codigo' com 'Rosa')
--     → DEPOIS da correção: true
--
--   SELECT variacoes FROM lf_produtos WHERE nome = 'ZZ Teste Decremento Manual';
--     → quantidade deve ter ido de 5 para 3
--
--   -- limpeza
--   DELETE FROM lf_produtos WHERE nome = 'ZZ Teste Decremento Manual';
-- ─────────────────────────────────────────────────────────────────────────────
