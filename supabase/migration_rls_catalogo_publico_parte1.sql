-- Aplicado manualmente em produção em data não confirmada entre 18-28/08/2026.
-- Commitado retroativamente em 18/09/2026 após investigação de segurança — ver
-- tag evidencia-stash-rls-18-08-2026.
--
-- Migration: catálogo público — PARTE 1 de 2
-- Fecha lf_produtos e lf_estoque_mov sem derrubar o checkout.
-- Execute no Supabase Dashboard > SQL Editor. NÃO é rodada pelo app.
--
-- ESCOPO DESTA PARTE
--   1. As 3 funções do caminho de baixa de estoque → SECURITY DEFINER
--   2. lf_produtos    → vitrine pública lê; só a loja dona escreve
--   3. lf_estoque_mov → só a loja dona lê; ninguém escreve direto
--
-- Fecha 661 das 663 linhas expostas medidas em 18/08/2026
-- (lf_produtos 430 + lf_estoque_mov 231).
--
-- lf_pedidos FICA DE FORA, de propósito — decisão do Thiago em 18/08/2026.
-- Está em migration_rls_catalogo_publico_parte2_pedidos.sql, que depende de
-- um ajuste no front antes de poder rodar. Nenhuma linha deste arquivo toca
-- em lf_pedidos: o checkout continua exatamente como está hoje.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUE AS FUNÇÕES VÊM ANTES DAS POLICIES
--
-- O checkout roda ANÔNIMO (CatalogoPublico.jsx:738). Ele:
--   1. INSERT em lf_pedidos                    ← intocado nesta parte
--   2. RPC lf_pedido_baixa_estoque → decrementar_estoque_variacao → UPDATE
--      em lf_produtos.variacoes
--   3. o UPDATE dispara trg_lf_estoque_mov → INSERT em lf_estoque_mov
--
-- Nenhuma dessas funções tem SECURITY DEFINER hoje: todas rodam com o
-- privilégio de quem chama, que ali é o anon. Apertar a policy sem converter
-- as funções quebra os passos 2 e 3 — e o passo 3 quebra PIOR: o comentário
-- em migration_estoque_mov.sql:75-80 já avisava que o 42501 do trigger
-- derruba o INSERT/UPDATE de lf_produtos junto, parando também o cadastro de
-- produto de TODAS as lojas, não só o catálogo.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1) FUNÇÕES → SECURITY DEFINER
--
-- `SET search_path` é obrigatório em toda função SECURITY DEFINER: sem ele,
-- quem chama pode criar um schema próprio no início do search_path e
-- sequestrar os nomes não qualificados de dentro da função, executando código
-- com o privilégio do dono (search_path hijacking, CVE-2018-1058). Fixamos em
-- public + pg_temp, com pg_temp por último.

-- 1a) Trigger que grava o histórico. É o mais crítico: roda dentro do
--     INSERT/UPDATE de lf_produtos, para qualquer chamador.
ALTER FUNCTION lf_estoque_mov_registrar()
  SECURITY DEFINER
  SET search_path = public, pg_temp;

-- 1b) Decremento atômico (SELECT FOR UPDATE + UPDATE). A DDL desta função NÃO
--     está no repositório — foi criada manualmente no banco. Por isso ALTER,
--     que preserva o corpo, e não CREATE OR REPLACE, que exigiria reescrevê-la
--     às cegas. Confirme a assinatura antes:
--       SELECT p.oid::regprocedure FROM pg_proc p
--        WHERE p.proname = 'decrementar_estoque_variacao';
ALTER FUNCTION decrementar_estoque_variacao(uuid, text, integer)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

-- 1c) Wrapper do checkout: põe o contexto app.mov_* que o trigger lê e delega.
ALTER FUNCTION lf_pedido_baixa_estoque(uuid, text, integer, uuid)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

-- 1d) Fecha a porta dos fundos.
--
-- Com 1b, decrementar_estoque_variacao passa a ignorar RLS. Se o anon puder
-- chamá-la direto, ele decrementa o estoque de QUALQUER produto de QUALQUER
-- loja informando o uuid — zerar o estoque de um concorrente viraria uma
-- chamada só. Hoje isso já é possível (a tabela está aberta), mas depois desta
-- migration seria o único buraco restante, então fecha junto.
--
-- O anon continua com o wrapper, que é o caminho que o checkout usa. O
-- fallback de CatalogoPublico.jsx:766 chama a função crua, mas só quando o
-- wrapper NÃO existe — e ele existe.
REVOKE EXECUTE ON FUNCTION decrementar_estoque_variacao(uuid, text, integer) FROM anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) lf_produtos — vitrine pública para ler, só a loja para escrever

ALTER TABLE lf_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lf_produtos_own_loja     ON lf_produtos;
DROP POLICY IF EXISTS lf_produtos_anon_leitura ON lf_produtos;

CREATE POLICY lf_produtos_own_loja
    ON lf_produtos FOR ALL
    TO authenticated
 USING      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
 WITH CHECK (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

-- O catálogo público precisa montar a vitrine sem login. Só leitura.
CREATE POLICY lf_produtos_anon_leitura
    ON lf_produtos FOR SELECT
    TO anon
 USING (true);

REVOKE INSERT, UPDATE, DELETE ON lf_produtos FROM anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) lf_estoque_mov — ninguém escreve direto; a loja lê o que é dela
--
-- A escrita passa a ser exclusividade do trigger, que virou SECURITY DEFINER
-- no passo 1a e por isso ignora estas policies.

ALTER TABLE lf_estoque_mov ENABLE ROW LEVEL SECURITY;

-- A policy permissiva atual (USING true para anon) é justamente o furo.
DROP POLICY IF EXISTS lf_estoque_mov_anon_all ON lf_estoque_mov;
DROP POLICY IF EXISTS lf_estoque_mov_own_loja ON lf_estoque_mov;

CREATE POLICY lf_estoque_mov_own_loja
    ON lf_estoque_mov FOR SELECT
    TO authenticated
 USING (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

REVOKE ALL ON lf_estoque_mov FROM anon;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONFERÊNCIA (rodar depois)

-- 1) As três funções com definer e search_path fixo:
-- SELECT p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p
--  WHERE p.proname IN ('lf_estoque_mov_registrar','decrementar_estoque_variacao',
--                      'lf_pedido_baixa_estoque');
--    → prosecdef = true e proconfig = {search_path=public,pg_temp} nas três

-- 2) Policies:
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
--  WHERE tablename IN ('lf_produtos','lf_estoque_mov')
--  ORDER BY tablename, policyname;

-- 3) Anon: lê a vitrine, não lê movimento, não escreve produto.
--    curl "$URL/rest/v1/lf_produtos?select=nome"    -H "apikey:$ANON"  → 430 linhas
--    curl "$URL/rest/v1/lf_estoque_mov?select=*"    -H "apikey:$ANON"  → []
--    curl -X PATCH "$URL/rest/v1/lf_produtos?id=eq.<uuid_de_outra_loja>" \
--         -H "apikey:$ANON" -d '{"preco_venda":1}'                     → 42501
--    curl -X POST "$URL/rest/v1/lf_estoque_mov" -H "apikey:$ANON" \
--         -d '{"loja_id":"x","tipo":"venda","delta":-99}'              → 42501

-- 4) Checkout ponta a ponta no catálogo de uma loja de teste: pedido criado
--    em lf_pedidos (inalterado nesta parte), estoque baixado em lf_produtos,
--    movimento 'venda' registrado em lf_estoque_mov.
--    Baseline medido em 18/08/2026, para comparar depois:
--      pedido gravado · Vestido Floral M 4 → 3 · mov tipo 'venda' delta -1

-- 5) Cadastro de produto pela loja logada (Moda e Mercado) continua gravando —
--    é o caminho que o trigger atravessa.

-- ROLLBACK, se quebrar:
-- ALTER TABLE lf_produtos DISABLE ROW LEVEL SECURITY;
-- ALTER FUNCTION lf_estoque_mov_registrar()                        SECURITY INVOKER;
-- ALTER FUNCTION decrementar_estoque_variacao(uuid,text,integer)   SECURITY INVOKER;
-- ALTER FUNCTION lf_pedido_baixa_estoque(uuid,text,integer,uuid)   SECURITY INVOKER;
-- GRANT EXECUTE ON FUNCTION decrementar_estoque_variacao(uuid,text,integer) TO anon;
-- DROP POLICY IF EXISTS lf_estoque_mov_own_loja ON lf_estoque_mov;
-- CREATE POLICY lf_estoque_mov_anon_all ON lf_estoque_mov
--   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
