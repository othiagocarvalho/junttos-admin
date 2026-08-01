-- Migration: liberar acesso da aplicação à merc_precos_faixas
-- Execute no Supabase Dashboard > SQL Editor
--
-- PROBLEMA — o mesmo já visto em merc_fiado
-- A tabela foi criada com RLS habilitado e sem policy. Como o app roda com a
-- chave anon, ele não consegue gravar nada:
--
--   INSERT com anon → 42501: new row violates row-level security policy
--                     for table "merc_precos_faixas"
--
-- O SELECT com anon devolve [] em silêncio, sem erro — por isso uma leitura
-- vazia não serve como teste. A tabela está vazia e bloqueada ao mesmo tempo,
-- e os dois casos são indistinguíveis pelo SELECT. O teste que decide é o
-- INSERT, que é como este diagnóstico foi feito.
--
-- Alinha com as tabelas lf_* (supabase/loja_feminina.sql:80-84) e com a
-- merc_fiado (supabase/migration_merc_fiado_rls.sql).

ALTER TABLE merc_precos_faixas DISABLE ROW LEVEL SECURITY;

-- Busca de faixa por produto: sempre filtra por loja e produto, e a faixa
-- aplicável é a maior qtd_minima <= quantidade vendida.
CREATE INDEX IF NOT EXISTS merc_precos_faixas_loja_produto
  ON merc_precos_faixas (loja_id, produto_id, qtd_minima DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- Conferência
--
-- 1) deve devolver rowsecurity = false:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'merc_precos_faixas';
--
-- 2) repetir o INSERT com a chave anon deve passar do 42501 (pode falhar por
--    FK, o que já indica que a policy não é mais o bloqueio).
