-- ============================================================================
-- Migration: lf_estoque_mov — histórico de movimentação de estoque
-- Execute no Supabase Dashboard > SQL Editor. NÃO é aplicada automaticamente.
--
-- MOTIVO
-- Até aqui lf_produtos.variacoes guardava só o SALDO ATUAL, sobrescrito no
-- lugar por venda, troca, exclusão de venda, ajuste manual, importação e
-- balanço. Nada registrava COMO o saldo chegou naquele número.
--
-- Esta migration cria uma tabela append-only e um TRIGGER em lf_produtos que
-- compara OLD.variacoes com NEW.variacoes e emite uma linha por variação que
-- mudou. O trigger é a rede de segurança: pega todos os caminhos, inclusive
-- edição manual pelo Supabase Studio e qualquer código novo que apareça
-- depois. O client não precisa lembrar de registrar nada.
--
-- O "porquê" da movimentação (venda? ajuste? balanço?) o trigger não tem como
-- saber sozinho. Ele lê o contexto de GUCs `app.mov_*` setadas na MESMA
-- transação, e cai em 'ajuste' (UPDATE) ou 'cadastro' (INSERT) quando ninguém
-- informou nada.
--
-- ATENÇÃO — por que existem RPCs aqui em vez de o client chamar set_config
-- direto: cada request do PostgREST roda na própria transação, em uma conexão
-- qualquer do pool. Um set_config(..., true) enviado em um request NÃO alcança
-- o UPDATE do request seguinte. Por isso o contexto e a escrita precisam
-- acontecer dentro da mesma função — é o que lf_set_variacoes e
-- lf_inserir_produtos fazem.
--
-- SEM BACKFILL: o histórico vale a partir do momento em que esta migration
-- entrar em produção. Nada do passado é reconstruído.
-- ============================================================================


-- ── 1. Tabela ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lf_estoque_mov (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id        text        NOT NULL,
  produto_id     uuid        NOT NULL REFERENCES lf_produtos(id) ON DELETE CASCADE,
  variacao_label text,
  tipo           text        NOT NULL,
  delta          integer     NOT NULL,
  qtd_anterior   integer     NOT NULL DEFAULT 0,
  qtd_nova       integer     NOT NULL DEFAULT 0,
  origem_tipo    text,       -- 'venda' | 'pedido' | 'balanco' | 'manual' | ...
  origem_id      uuid,       -- lf_vendas.id, lf_pedidos.id, bal_sessoes.id...
  motivo         text,
  usuario        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lf_estoque_mov_tipo_check CHECK (
    tipo IN ('entrada','ajuste','venda','devolucao','balanco','cadastro','importacao')
  )
);

-- ON DELETE CASCADE é proposital: EstoqueMobile.jsx:178 apaga o produto de
-- verdade (não é soft delete). Sem o CASCADE, a FK passaria a barrar essa
-- exclusão assim que o produto tivesse movimentação — quebraria uma
-- funcionalidade que já existe. O custo é que o extrato morre junto com o
-- produto; como a tela de movimentação é sempre por produto, ele já ficaria
-- inalcançável de qualquer forma.

-- A tela sempre consulta por loja + produto, do mais recente para o mais antigo.
CREATE INDEX IF NOT EXISTS lf_estoque_mov_loja_produto_data
  ON lf_estoque_mov (loja_id, produto_id, created_at DESC);

-- RLS LIGADA COM POLICY PERMISSIVA — não troque por DISABLE.
--
-- O isolamento por loja continua sendo feito no código, filtrando por loja_id,
-- igual a todas as outras lf_*. A policy abaixo não muda a exposição real dos
-- dados; ela existe para a tabela sobreviver a alguém religar a RLS.
--
-- POR QUE NÃO 'DISABLE': a primeira versão desta migration usava DISABLE e a
-- RLS apareceu ligada de novo logo depois (mesmo padrão que já tinha atingido
-- merc_fiado e merc_precos_faixas — ver migration_merc_fiado_rls.sql). Tabela
-- pública sem RLS é sinalizada pelo Security Advisor do Supabase, que oferece
-- ligar em um clique. Ligada e SEM policy, tudo é bloqueado.
--
-- E aqui isso é pior do que nas telas anteriores: o INSERT bloqueado acontece
-- DENTRO do trigger em lf_produtos, que roda como anon (SECURITY INVOKER). O
-- 42501 sobe e derruba o próprio INSERT/UPDATE de lf_produtos junto — cadastro
-- de produto e baixa de estoque param de funcionar, não só o histórico.
--
-- Com RLS já ligada e com policy, não há o que o Advisor "consertar".
ALTER TABLE lf_estoque_mov ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lf_estoque_mov_anon_all ON lf_estoque_mov;
CREATE POLICY lf_estoque_mov_anon_all ON lf_estoque_mov
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);


-- ── 2. Helpers de leitura das variações ─────────────────────────────────────
-- variacoes é um array de objetos tipo {"cor": "Preto", "quantidade": 3} — mas
-- a chave do rótulo varia (cor, tamanho, modelo...). A regra usada no JS
-- (utils/balanco.js:getVarLabel) é: a primeira chave que não seja
-- 'quantidade' nem 'custo'. Como o dado vem do próprio jsonb, a ordem das
-- chaves é a mesma nos dois lados.

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
   WHERE k NOT IN ('quantidade', 'custo')
   LIMIT 1;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION lf_var_qtd(v jsonb)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF v IS NULL OR jsonb_typeof(v) <> 'object' THEN
    RETURN 0;
  END IF;
  RETURN COALESCE((v ->> 'quantidade')::numeric, 0)::integer;
EXCEPTION WHEN others THEN
  -- quantidade veio como texto não numérico: trata como 0 em vez de derrubar
  -- a venda inteira.
  RETURN 0;
END $$;


-- ── 3. Trigger ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION lf_estoque_mov_registrar()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_tipo         text;
  v_default_tipo text;
  v_origem_tipo  text;
  v_origem_id    uuid;
  v_motivo       text;
  v_usuario      text;
  v_elem         jsonb;
  v_label        text;
  v_old_map      jsonb := '{}'::jsonb;
  v_new_map      jsonb := '{}'::jsonb;
  v_old_qtd      integer;
  v_new_qtd      integer;
BEGIN
  -- Nada mudou: sai cedo, sem escrever nada.
  IF TG_OP = 'UPDATE' AND OLD.variacoes IS NOT DISTINCT FROM NEW.variacoes THEN
    RETURN NULL;
  END IF;

  v_default_tipo := CASE WHEN TG_OP = 'INSERT' THEN 'cadastro' ELSE 'ajuste' END;
  v_tipo         := COALESCE(NULLIF(current_setting('app.mov_origem', true), ''), v_default_tipo);
  v_origem_tipo  := NULLIF(current_setting('app.mov_origem_tipo', true), '');
  v_motivo       := NULLIF(current_setting('app.mov_motivo',      true), '');
  v_usuario      := NULLIF(current_setting('app.mov_usuario',     true), '');

  BEGIN
    v_origem_id := NULLIF(current_setting('app.mov_origem_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_origem_id := NULL;
  END;

  -- Contexto inválido não pode derrubar a operação nem furar o CHECK.
  IF v_tipo NOT IN ('entrada','ajuste','venda','devolucao','balanco','cadastro','importacao') THEN
    v_tipo := v_default_tipo;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(OLD.variacoes, '[]'::jsonb))
    LOOP
      v_label   := COALESCE(lf_var_label(v_elem), '');
      v_old_map := jsonb_set(
        v_old_map, ARRAY[v_label],
        to_jsonb(COALESCE((v_old_map ->> v_label)::integer, 0) + lf_var_qtd(v_elem)),
        true);
    END LOOP;
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.variacoes, '[]'::jsonb))
  LOOP
    v_label   := COALESCE(lf_var_label(v_elem), '');
    v_new_map := jsonb_set(
      v_new_map, ARRAY[v_label],
      to_jsonb(COALESCE((v_new_map ->> v_label)::integer, 0) + lf_var_qtd(v_elem)),
      true);
  END LOOP;

  FOR v_label IN
    SELECT k FROM jsonb_object_keys(v_old_map) AS k
    UNION
    SELECT k FROM jsonb_object_keys(v_new_map) AS k
  LOOP
    v_old_qtd := COALESCE((v_old_map ->> v_label)::integer, 0);
    v_new_qtd := COALESCE((v_new_map ->> v_label)::integer, 0);
    CONTINUE WHEN v_old_qtd = v_new_qtd;

    INSERT INTO lf_estoque_mov (
      loja_id, produto_id, variacao_label, tipo,
      delta, qtd_anterior, qtd_nova,
      origem_tipo, origem_id, motivo, usuario
    ) VALUES (
      NEW.loja_id, NEW.id, NULLIF(v_label, ''), v_tipo,
      v_new_qtd - v_old_qtd, v_old_qtd, v_new_qtd,
      v_origem_tipo, v_origem_id, v_motivo, v_usuario
    );
  END LOOP;

  RETURN NULL;
END $$;

-- `UPDATE OF variacoes` evita disparar em edição de preço, nome, foto etc.
-- No INSERT o trigger vale para a linha inteira (o OF só se aplica ao UPDATE).
DROP TRIGGER IF EXISTS trg_lf_estoque_mov ON lf_produtos;
CREATE TRIGGER trg_lf_estoque_mov
  AFTER INSERT OR UPDATE OF variacoes ON lf_produtos
  FOR EACH ROW EXECUTE FUNCTION lf_estoque_mov_registrar();


-- ── 4. RPCs que carregam o contexto ─────────────────────────────────────────
-- SECURITY INVOKER (padrão) de propósito: lf_produtos está com RLS desligada,
-- então a chave anon já podia dar UPDATE direto. Estas funções não ampliam
-- permissão nenhuma — só embalam o contexto junto da escrita.

-- Substitui o UPDATE de variacoes feito pelo client.
-- p_loja_id NULL = não filtra por loja (o Balanço atualiza só por id).
CREATE OR REPLACE FUNCTION lf_set_variacoes(
  p_produto_id  uuid,
  p_variacoes   jsonb,
  p_loja_id     text DEFAULT NULL,
  p_tipo        text DEFAULT 'ajuste',
  p_origem_tipo text DEFAULT NULL,
  p_origem_id   uuid DEFAULT NULL,
  p_motivo      text DEFAULT NULL,
  p_usuario     text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE v_n integer;
BEGIN
  PERFORM set_config('app.mov_origem',      COALESCE(NULLIF(p_tipo, ''), 'ajuste'), true);
  PERFORM set_config('app.mov_origem_tipo', COALESCE(p_origem_tipo, ''),            true);
  PERFORM set_config('app.mov_origem_id',   COALESCE(p_origem_id::text, ''),        true);
  PERFORM set_config('app.mov_motivo',      COALESCE(p_motivo, ''),                 true);
  PERFORM set_config('app.mov_usuario',     COALESCE(p_usuario, ''),                true);

  UPDATE lf_produtos
     SET variacoes = p_variacoes
   WHERE id = p_produto_id
     AND (p_loja_id IS NULL OR loja_id = p_loja_id);

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- Substitui o INSERT de produtos feito pelo client (cadastro e importação).
-- p_rows é um array de objetos com o MESMO conjunto de chaves. Só as chaves
-- que existem de fato como coluna em lf_produtos entram no INSERT — as demais
-- colunas ficam com o DEFAULT da tabela. Assim uma coluna nova amanhã não
-- precisa ser adicionada aqui.
CREATE OR REPLACE FUNCTION lf_inserir_produtos(
  p_rows    jsonb,
  p_tipo    text DEFAULT 'cadastro',
  p_usuario text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_cols text;
  v_n    integer;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.mov_origem',      COALESCE(NULLIF(p_tipo, ''), 'cadastro'), true);
  PERFORM set_config('app.mov_origem_tipo', 'manual',                                 true);
  PERFORM set_config('app.mov_origem_id',   '',                                       true);
  PERFORM set_config('app.mov_motivo',      '',                                       true);
  PERFORM set_config('app.mov_usuario',     COALESCE(p_usuario, ''),                  true);

  SELECT string_agg(quote_ident(c.column_name), ', ')
    INTO v_cols
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name   = 'lf_produtos'
     AND c.column_name IN (SELECT jsonb_object_keys(p_rows -> 0));

  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'lf_inserir_produtos: payload sem nenhuma coluna válida de lf_produtos';
  END IF;

  EXECUTE format(
    'INSERT INTO lf_produtos (%s) SELECT %s FROM jsonb_populate_recordset(NULL::lf_produtos, $1)',
    v_cols, v_cols
  ) USING p_rows;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- Baixa de estoque do catálogo público.
--
-- PRÉ-REQUISITO: a função decrementar_estoque_variacao(uuid, text, integer)
-- já existe no banco (criada manualmente, sem DDL no repo) e é chamada por
-- CatalogoPublico.jsx desde o checkout com carrinho. Confira a assinatura
-- antes de rodar esta parte:
--
--   SELECT p.oid::regprocedure
--     FROM pg_proc p WHERE p.proname = 'decrementar_estoque_variacao';
--
-- Este wrapper NÃO reimplementa a baixa: ele só põe o contexto e delega, para
-- que o SELECT FOR UPDATE + UPDATE atômico continue sendo a única fonte da
-- verdade do decremento.
CREATE OR REPLACE FUNCTION lf_pedido_baixa_estoque(
  p_produto_id uuid,
  p_label      text,
  p_qtd        integer,
  p_pedido_id  uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE v_ok boolean;
BEGIN
  PERFORM set_config('app.mov_origem',      'venda',                                true);
  PERFORM set_config('app.mov_origem_tipo', 'pedido',                               true);
  PERFORM set_config('app.mov_origem_id',   COALESCE(p_pedido_id::text, ''),         true);
  PERFORM set_config('app.mov_motivo',      'Pedido do catálogo público',            true);
  PERFORM set_config('app.mov_usuario',     '',                                      true);

  SELECT decrementar_estoque_variacao(p_produto_id, p_label, p_qtd) INTO v_ok;
  RETURN v_ok;
END $$;

GRANT EXECUTE ON FUNCTION lf_set_variacoes(uuid, jsonb, text, text, text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION lf_inserir_produtos(jsonb, text, text)                            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION lf_pedido_baixa_estoque(uuid, text, integer, uuid)                TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- Conferência
--
-- 1) RLS ligada E com policy (as duas coisas — uma sem a outra bloqueia tudo):
--   SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
--     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE c.relname = 'lf_estoque_mov';
--     → relrowsecurity = true, relforcerowsecurity = false
--
--   SELECT policyname, cmd, roles FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'lf_estoque_mov';
--     → lf_estoque_mov_anon_all | ALL | {anon,authenticated}
--
-- 1b) O teste que decide. O SELECT vazio não prova nada (foi a lição do
--     merc_fiado): só o INSERT prova. lf_produtos está sem RLS, então o insert
--     do produto passa de qualquer jeito — se estourar 42501 foi o trigger
--     gravando em lf_estoque_mov, que é justamente o que quebra o app.
--     O ROLLBACK desfaz tudo.
--
--   BEGIN;
--   SET LOCAL ROLE anon;
--   INSERT INTO lf_produtos (loja_id, nome, variacoes)
--   VALUES ('sualoja', 'ZZ Teste RLS', '[{"cor":"Preto","quantidade":1}]');
--   SELECT tipo, delta, qtd_nova FROM lf_estoque_mov
--    WHERE produto_id = (SELECT id FROM lf_produtos WHERE nome = 'ZZ Teste RLS');
--   ROLLBACK;
--     → uma linha: cadastro | +1 | 1
--
-- 2) Trigger no lugar:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'lf_produtos'::regclass AND NOT tgisinternal;
--     → deve listar trg_lf_estoque_mov
--
-- 3) Teste ponta a ponta em uma loja de testes (troque 'sualoja'):
--
--   -- cadastro (o INSERT sozinho já deve gerar linha 'cadastro')
--   INSERT INTO lf_produtos (loja_id, nome, variacoes)
--   VALUES ('sualoja', 'ZZ Teste Mov', '[{"cor":"Preto","quantidade":10}]');
--
--   -- venda (contexto informado)
--   SELECT lf_set_variacoes(
--     (SELECT id FROM lf_produtos WHERE nome = 'ZZ Teste Mov'),
--     '[{"cor":"Preto","quantidade":8}]'::jsonb,
--     'sualoja', 'venda', 'venda', NULL, 'teste', 'qa');
--
--   -- ajuste manual (sem contexto: cai no fallback)
--   UPDATE lf_produtos SET variacoes = '[{"cor":"Preto","quantidade":9}]'
--    WHERE nome = 'ZZ Teste Mov';
--
--   SELECT tipo, variacao_label, delta, qtd_anterior, qtd_nova, origem_tipo, motivo
--     FROM lf_estoque_mov
--    WHERE produto_id = (SELECT id FROM lf_produtos WHERE nome = 'ZZ Teste Mov')
--    ORDER BY created_at;
--     → cadastro +10 (0→10) | venda -2 (10→8) | ajuste +1 (8→9)
--
--   -- limpeza (o CASCADE leva as movimentações junto)
--   DELETE FROM lf_produtos WHERE nome = 'ZZ Teste Mov';
-- ─────────────────────────────────────────────────────────────────────────────
