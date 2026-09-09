-- =========================================================
-- migration_lf_usuarios_nullable.sql
-- lf_usuarios.auth_user_id passa a aceitar NULL, e a FK para
-- auth.users(id) troca de ON DELETE CASCADE para ON DELETE SET NULL.
--
-- PROBLEMA
--   lf_usuarios.auth_user_id é NOT NULL. Por isso a migration anterior
--   (migration_fk_auth_ondelete.sql) — que escolhe a ação pela
--   nulabilidade da coluna — só pôde aplicar CASCADE nessa tabela:
--   SET NULL em coluna NOT NULL trocaria o erro de FK por um erro de
--   NOT NULL na hora do DELETE, sem resolver nada.
--
--   Consequência prática: excluir o login de uma colaboradora pelo
--   Supabase Auth Dashboard APAGA a linha inteira dela em lf_usuarios,
--   em silêncio e sem desfazer. Some o nome, o e-mail e a data de
--   cadastro — o registro de que aquela pessoa existiu na loja.
--
-- SOLUÇÃO
--   Mesmo comportamento já usado em jt_consultants: SET NULL. A linha
--   de negócio sobrevive e apenas perde o vínculo com o login.
--
--   A ordem importa: DROP NOT NULL PRIMEIRO, senão o ADD CONSTRAINT
--   com SET NULL seria aceito pelo PostgreSQL e só explodiria muito
--   depois, no primeiro DELETE de usuário — o pior momento possível.
--   Por isso a seção 2 aborta com exceção se a coluna ainda estiver
--   NOT NULL no instante de recriar a FK.
--
-- IMPACTO NO CÓDIGO — nenhum. Investigado antes de escrever esta
--   migration; os três pontos que leem a coluna já toleram NULL:
--     · CatalogoB2BAdmin(.jsx/Desktop.jsx): `u.auth_user_id === user?.id`
--       decide o selo "Você" vs o botão "Desativar". Com NULL a
--       comparação dá false e cai em "Desativar" — que é justamente o
--       desejável para uma linha que perdeu o login.
--     · create-user (rollback): `vinculos?.[0]?.auth_user_id ?? undefined`
--       já converte NULL em undefined e cai no fallback por e-mail.
--     · create-user (limpeza): apaga por (loja_id, email), não pela
--       coluna — linha com NULL continua sendo removida normalmente.
--
-- ORDEM DE EXECUÇÃO
--   ① Rodar a seção 1 (diagnóstico, só leitura) e ler a saída inteira.
--   ② Se 1.3 acusar órfãos, tratá-los — senão o ADD CONSTRAINT falha.
--   ③ Se 1.4 mostrar policy que compare auth_user_id, PARAR e revisar:
--     linha com NULL pode ficar invisível para a própria loja.
--   ④ Rodar a seção 2 (migration).
--   ⑤ Rodar a seção 3 (verificação) e conferir confdeltype = 'n'.
--
-- ⑥ NÃO executar enquanto não for aprovado pelo Thiago.
-- =========================================================


-- ─── 1. DIAGNÓSTICO (rodar antes, só leitura) ────────────────────────────────

-- 1.1 Estado atual da coluna e da FK.
--     Esperado ANTES: eh_not_null = true, on_delete_atual = 'c' (CASCADE).
SELECT
  c.conname                AS constraint_name,
  c.conrelid::regclass     AS tabela,
  a.attname                AS coluna,
  a.attnotnull             AS eh_not_null,
  c.confdeltype            AS on_delete_atual,
  CASE c.confdeltype
    WHEN 'a' THEN 'NO ACTION — bloqueia exclusão'
    WHEN 'n' THEN 'SET NULL — já é o alvo, nada a fazer'
    WHEN 'c' THEN 'CASCADE — apaga a linha junto (corrigir)'
    WHEN 'r' THEN 'RESTRICT — bloqueia exclusão'
    ELSE 'outro'
  END                      AS leitura
FROM pg_constraint c
JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype   = 'f'
  AND c.confrelid = 'auth.users'::regclass
  AND c.conrelid  = 'public.lf_usuarios'::regclass;

-- 1.2 Volume: quantas linhas existem e como estão distribuídas.
--     `sem_login` deve ser 0 hoje (a coluna é NOT NULL). Se vier > 0,
--     alguém já mexeu na coluna e este diagnóstico está desatualizado.
SELECT
  count(*)                                        AS total_linhas,
  count(*) FILTER (WHERE ativo IS TRUE)           AS ativas,
  count(*) FILTER (WHERE ativo IS NOT TRUE)       AS inativas,
  count(*) FILTER (WHERE auth_user_id IS NULL)    AS sem_login,
  count(DISTINCT loja_id)                         AS lojas_distintas
FROM lf_usuarios;

-- Detalhe por loja, para dimensionar quem seria afetado.
SELECT loja_id,
       count(*)                                   AS colaboradoras,
       count(*) FILTER (WHERE ativo IS TRUE)      AS ativas
FROM lf_usuarios
GROUP BY loja_id
ORDER BY colaboradoras DESC;

-- 1.3 Órfãos: apontam para um auth.users que já não existe.
--     Com CASCADE em vigor isto deveria ser 0. Se vier > 0, o
--     ADD CONSTRAINT da seção 2 falha por violação em linha existente.
SELECT count(*) AS orfaos
FROM lf_usuarios u
WHERE u.auth_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.auth_user_id);

-- Tratamento de órfãos (descomentar só se a query acima acusar linhas).
-- Precisa rodar DEPOIS do DROP NOT NULL da seção 2.1:
-- UPDATE lf_usuarios SET auth_user_id = NULL
--   WHERE auth_user_id IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth_user_id);

-- 1.4 ⚠ PONTO CEGO: policies de RLS desta tabela.
--     lf_usuarios não tem policy versionada no repositório (foi criada
--     direto pelo painel), então esta é a única forma de ver se alguma
--     regra compara auth_user_id. Se comparar, uma linha com NULL pode
--     sumir da listagem da própria loja — revisar ANTES de aplicar.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'lf_usuarios';

-- 1.5 Índices e constraints da coluna — um UNIQUE mudaria o raciocínio.
--     (No PostgreSQL um índice UNIQUE aceita múltiplos NULLs, então
--      mesmo com UNIQUE várias linhas desvinculadas convivem. Fica
--      listado para conferência, não como impedimento.)
SELECT i.relname AS indice, ix.indisunique AS eh_unique, pg_get_indexdef(ix.indexrelid) AS definicao
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY (ix.indkey)
WHERE ix.indrelid = 'public.lf_usuarios'::regclass
  AND a.attname = 'auth_user_id';


-- ─── 2. MIGRATION ────────────────────────────────────────────────────────────

BEGIN;

-- 2.1 A coluna passa a aceitar NULL. É o pré-requisito do SET NULL.
ALTER TABLE public.lf_usuarios
  ALTER COLUMN auth_user_id DROP NOT NULL;

-- 2.2 Troca a FK. Mesmo padrão de introspecção da migration anterior: o
--     nome da constraint é gerado pelo PostgreSQL e varia entre ambientes,
--     então descobre em vez de hardcodar.
DO $$
DECLARE
  fk_nome     text;
  eh_not_null boolean;
BEGIN
  IF to_regclass('public.lf_usuarios') IS NULL THEN
    RAISE EXCEPTION 'public.lf_usuarios não existe neste banco.';
  END IF;

  SELECT a.attnotnull INTO eh_not_null
  FROM pg_attribute a
  WHERE a.attrelid = 'public.lf_usuarios'::regclass
    AND a.attname  = 'auth_user_id'
    AND a.attnum > 0 AND NOT a.attisdropped;

  IF eh_not_null IS NULL THEN
    RAISE EXCEPTION 'coluna lf_usuarios.auth_user_id não existe.';
  END IF;

  -- Cinto de segurança: sem isto, um SET NULL sobre coluna NOT NULL
  -- passaria batido aqui e só falharia no primeiro DELETE de usuário.
  IF eh_not_null THEN
    RAISE EXCEPTION
      'lf_usuarios.auth_user_id ainda é NOT NULL — o DROP NOT NULL de 2.1 não teve efeito. Abortando.';
  END IF;

  FOR fk_nome IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype   = 'f'
      AND c.conrelid  = 'public.lf_usuarios'::regclass
      AND c.confrelid = 'auth.users'::regclass
      AND a.attname   = 'auth_user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.lf_usuarios DROP CONSTRAINT %I', fk_nome);
    RAISE NOTICE '[drop] constraint % removida.', fk_nome;
  END LOOP;

  -- Nome fixo e previsível daqui em diante, igual à migration anterior.
  EXECUTE 'ALTER TABLE public.lf_usuarios
             ADD CONSTRAINT lf_usuarios_auth_user_id_fkey
             FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL';

  RAISE NOTICE '[ok] lf_usuarios.auth_user_id → ON DELETE SET NULL (coluna aceita NULL).';
END $$;

COMMIT;


-- ─── 3. VERIFICAÇÃO (rodar depois) ───────────────────────────────────────────

-- Esperado: lf_usuarios com eh_not_null = false e on_delete = 'n'.
-- jt_consultants aparece junto só para confirmar que continua como estava.
SELECT
  c.conrelid::regclass  AS tabela,
  a.attname             AS coluna,
  a.attnotnull          AS eh_not_null,
  c.confdeltype         AS on_delete,
  CASE c.confdeltype
    WHEN 'n' THEN 'SET NULL — desvincula e preserva a linha'
    WHEN 'c' THEN 'CASCADE — ⚠ ainda apaga a linha junto'
    ELSE '⚠ revisar'
  END                   AS leitura
FROM pg_constraint c
JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype   = 'f'
  AND c.confrelid = 'auth.users'::regclass
  AND c.conrelid IN ('public.lf_usuarios'::regclass, 'public.jt_consultants'::regclass)
ORDER BY tabela;


-- ─── ROLLBACK ────────────────────────────────────────────────────────────────
-- Só é possível enquanto nenhuma linha tiver auth_user_id NULL. Depois que
-- um login for excluído, a linha desvinculada precisa ser tratada (revincular
-- ou apagar) antes de voltar o NOT NULL.
--
-- BEGIN;
--   ALTER TABLE public.lf_usuarios DROP CONSTRAINT lf_usuarios_auth_user_id_fkey;
--   ALTER TABLE public.lf_usuarios ALTER COLUMN auth_user_id SET NOT NULL;
--   ALTER TABLE public.lf_usuarios
--     ADD CONSTRAINT lf_usuarios_auth_user_id_fkey
--     FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- COMMIT;
