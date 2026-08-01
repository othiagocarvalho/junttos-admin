-- Migration: liberar acesso da aplicação à merc_fiado
-- Execute no Supabase Dashboard > SQL Editor
--
-- PROBLEMA
-- merc_fiado foi criada com RLS habilitado e sem nenhuma policy. O app roda
-- com a chave anon, então hoje ele não lê nem grava nada nessa tabela:
--
--   SELECT com service_role → 7 lançamentos
--   SELECT com anon         → []
--   INSERT com anon         → 42501: new row violates row-level security
--                             policy for table "merc_fiado"
--
-- Resultado: a tela de Fiado abre vazia em produção e "Anotar novo fiado"
-- falharia, mesmo com os dados corretos gravados no banco.
--
-- OPÇÃO A — alinhar com o resto do schema (recomendada por consistência)
-- Todas as tabelas lf_* já rodam com RLS desabilitado (supabase/loja_feminina.sql
-- linhas 80-84). Esta opção deixa merc_fiado igual às demais.

ALTER TABLE merc_fiado DISABLE ROW LEVEL SECURITY;

-- Índice de leitura da tela: sempre filtra por loja e ordena por data.
CREATE INDEX IF NOT EXISTS merc_fiado_loja_data
  ON merc_fiado (loja_id, data DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- OPÇÃO B — manter RLS e abrir por policy
-- Só faz sentido junto com um plano para as tabelas lf_*: enquanto elas
-- estiverem sem RLS, proteger apenas merc_fiado não muda a exposição real dos
-- dados. Para usar esta opção, comente o ALTER acima e descomente abaixo.
--
-- ALTER TABLE merc_fiado ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY merc_fiado_anon_all ON merc_fiado
--   FOR ALL TO anon, authenticated
--   USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- Conferência: deve devolver rowsecurity = false (opção A) e listar os
-- lançamentos da loja.
--
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'merc_fiado';
-- SELECT cliente_nome, tipo, valor, data FROM merc_fiado
--  WHERE loja_id = 'mercadodemo' ORDER BY data;
