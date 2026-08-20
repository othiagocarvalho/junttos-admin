-- =========================================================
-- migration_fk_auth_ondelete.sql
-- FKs para auth.users(id) sem ON DELETE — desbloqueia a exclusão
-- de usuário pelo Supabase Auth Dashboard.
--
-- PROBLEMA
--   lf_usuarios.auth_user_id e jt_consultants.auth_user_id referenciam
--   auth.users(id) sem cláusula ON DELETE. O default do PostgreSQL é
--   NO ACTION: qualquer DELETE em auth.users que tenha linha filha
--   aqui é recusado com "update or delete on table users violates
--   foreign key constraint". O Dashboard do Supabase Auth não mostra
--   qual tabela travou — já aconteceu na prática e foi preciso rodar
--   UPDATE/DELETE manual antes de conseguir excluir o usuário.
--
-- SOLUÇÃO
--   ON DELETE SET NULL — a linha de negócio sobrevive e apenas perde o
--   vínculo com o login. Preserva histórico (vendas, visitas, comissão
--   continuam apontando para a linha).
--
--   ⚠ SET NULL só é válido em coluna que aceita NULL. Se a coluna for
--   NOT NULL, o SET NULL falharia no momento do DELETE (trocaria um erro
--   de FK por um erro de NOT NULL, sem resolver nada). Por isso o bloco
--   abaixo INTROSPECTA is_nullable e escolhe sozinho:
--       coluna NULLABLE  → ON DELETE SET NULL  (desvincula, preserva)
--       coluna NOT NULL  → ON DELETE CASCADE   (remove a linha junto)
--   O relatório NOTICE no fim diz qual foi aplicada em cada tabela.
--
-- ORDEM DE EXECUÇÃO
--   ① Rodar a seção 1 (diagnóstico) e ler a saída.
--   ② Se houver órfãos, tratá-los (seção 1.2) — senão o ADD CONSTRAINT
--     falha por violação em linha pré-existente.
--   ③ Rodar a seção 2 (migration).
--   ④ Rodar a seção 3 (verificação) e conferir o confdeltype.
--
-- ⑤ NÃO executar enquanto não for aprovado pelo Thiago.
-- =========================================================


-- ─── 1. DIAGNÓSTICO (rodar antes, só leitura) ────────────────────────────────

-- 1.1 Estado atual das duas FKs.
--     confdeltype: 'a' = NO ACTION (o problema) · 'n' = SET NULL
--                  'c' = CASCADE   · 'r' = RESTRICT
SELECT
  c.conname                                   AS constraint_name,
  c.conrelid::regclass                        AS tabela,
  a.attname                                   AS coluna,
  a.attnotnull                                AS eh_not_null,
  c.confdeltype                               AS on_delete_atual,
  CASE c.confdeltype
    WHEN 'a' THEN 'NO ACTION — bloqueia exclusão (corrigir)'
    WHEN 'n' THEN 'SET NULL — ok'
    WHEN 'c' THEN 'CASCADE — ok'
    WHEN 'r' THEN 'RESTRICT — bloqueia exclusão (corrigir)'
    ELSE 'outro'
  END                                         AS leitura
FROM pg_constraint c
JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass
  AND c.conrelid IN ('public.lf_usuarios'::regclass, 'public.jt_consultants'::regclass)
ORDER BY tabela;

-- 1.2 Órfãos: linhas apontando para um auth.users que já não existe.
--     Se retornar > 0, o ADD CONSTRAINT da seção 2 falha. Trate antes
--     (o UPDATE comentado desvincula; use DELETE só se tiver certeza).
SELECT 'lf_usuarios' AS tabela, count(*) AS orfaos
FROM lf_usuarios u
WHERE u.auth_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.auth_user_id)
UNION ALL
SELECT 'jt_consultants', count(*)
FROM jt_consultants k
WHERE k.auth_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = k.auth_user_id);

-- Tratamento de órfãos (descomente só se a query acima acusar linhas):
-- UPDATE lf_usuarios    SET auth_user_id = NULL
--   WHERE auth_user_id IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth_user_id);
-- UPDATE jt_consultants SET auth_user_id = NULL
--   WHERE auth_user_id IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth_user_id);


-- ─── 2. MIGRATION ────────────────────────────────────────────────────────────

DO $$
DECLARE
  alvo        record;
  fk_nome     text;
  eh_not_null boolean;
  acao        text;
BEGIN
  FOR alvo IN
    SELECT * FROM (VALUES
      ('public', 'lf_usuarios',    'auth_user_id'),
      ('public', 'jt_consultants', 'auth_user_id')
    ) AS t(schema_nome, tabela, coluna)
  LOOP
    -- A tabela pode não existir em um ambiente de staging incompleto.
    IF to_regclass(format('%I.%I', alvo.schema_nome, alvo.tabela)) IS NULL THEN
      RAISE NOTICE '[pulado] %.% não existe neste banco.', alvo.schema_nome, alvo.tabela;
      CONTINUE;
    END IF;

    -- NOT NULL decide SET NULL vs CASCADE.
    SELECT a.attnotnull INTO eh_not_null
    FROM pg_attribute a
    WHERE a.attrelid = format('%I.%I', alvo.schema_nome, alvo.tabela)::regclass
      AND a.attname  = alvo.coluna
      AND a.attnum > 0 AND NOT a.attisdropped;

    IF eh_not_null IS NULL THEN
      RAISE NOTICE '[pulado] coluna %.%.% não existe.', alvo.schema_nome, alvo.tabela, alvo.coluna;
      CONTINUE;
    END IF;

    -- eh_not_null guarda attnotnull: true = NOT NULL.
    acao := CASE WHEN eh_not_null THEN 'CASCADE' ELSE 'SET NULL' END;

    -- Derruba QUALQUER FK dessa coluna para auth.users (o nome é gerado
    -- pelo PostgreSQL e varia — não dá para hardcodar).
    FOR fk_nome IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype   = 'f'
        AND c.conrelid  = format('%I.%I', alvo.schema_nome, alvo.tabela)::regclass
        AND c.confrelid = 'auth.users'::regclass
        AND a.attname   = alvo.coluna
    LOOP
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                     alvo.schema_nome, alvo.tabela, fk_nome);
      RAISE NOTICE '[drop] %.% — constraint % removida.',
                   alvo.schema_nome, alvo.tabela, fk_nome;
    END LOOP;

    -- Recria com o ON DELETE correto. Nome fixo e previsível daqui em diante.
    fk_nome := format('%s_%s_fkey', alvo.tabela, alvo.coluna);
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I)
         REFERENCES auth.users(id) ON DELETE %s',
      alvo.schema_nome, alvo.tabela, fk_nome, alvo.coluna, acao
    );

    RAISE NOTICE '[ok] %.%.% → ON DELETE % (coluna % NULL).',
                 alvo.schema_nome, alvo.tabela, alvo.coluna, acao,
                 CASE WHEN eh_not_null THEN 'NÃO aceita' ELSE 'aceita' END;
  END LOOP;
END $$;


-- ─── 3. VERIFICAÇÃO (rodar depois) ───────────────────────────────────────────

-- Esperado: confdeltype = 'n' (SET NULL) ou 'c' (CASCADE). Nunca 'a'.
SELECT
  c.conname            AS constraint_name,
  c.conrelid::regclass AS tabela,
  a.attname            AS coluna,
  c.confdeltype        AS on_delete,
  CASE c.confdeltype
    WHEN 'n' THEN 'SET NULL — desvincula e preserva a linha'
    WHEN 'c' THEN 'CASCADE — remove a linha junto com o login'
    ELSE '⚠ ainda bloqueia a exclusão'
  END                  AS leitura
FROM pg_constraint c
JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass
  AND c.conrelid IN ('public.lf_usuarios'::regclass, 'public.jt_consultants'::regclass)
ORDER BY tabela;
