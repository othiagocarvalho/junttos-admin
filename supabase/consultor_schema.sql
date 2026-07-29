-- =========================================================
-- consultor_schema.sql — Área do Consultor Porta a Porta
--
-- REVISAR ANTES DE APLICAR:
--
-- ① RLS SELECT/INSERT — o AdminApp usa a anon key sem sessão
--   Supabase Auth. Para ele, auth.jwt()->'app_metadata'->>'consultant_id'
--   retorna NULL, então a condição "IS NULL" libera acesso total ao admin.
--   Consultores autenticados recebem o claim consultant_id no JWT e
--   ficam restritos às próprias visitas.
--
-- ② FK lf_config(loja_id) — requer que a coluna seja UNIQUE ou PK.
--   Se ainda não tiver constraint explícita, descomente o ALTER abaixo.
--
-- ③ Executar os blocos ALTER TABLE um de cada vez caso algum falhe.
--   O GENERATED ALWAYS AS ... STORED exige PostgreSQL 12+
--   (Supabase usa PG 15 — compatível).
--
-- ④ NÃO executar enquanto não for aprovado pelo Thiago.
-- =========================================================

-- Opcional: garantir unicidade de loja_id em lf_config (necessária para a FK)
-- ALTER TABLE lf_config ADD CONSTRAINT lf_config_loja_id_unique UNIQUE (loja_id);

-- ─── 1. Novos campos em jt_visits ────────────────────────────────────────────
ALTER TABLE jt_visits
  ADD COLUMN IF NOT EXISTS cliente_nome          text,
  ADD COLUMN IF NOT EXISTS telefone              text,
  ADD COLUMN IF NOT EXISTS bairro                text,
  ADD COLUMN IF NOT EXISTS hora_inicio           time,
  ADD COLUMN IF NOT EXISTS hora_fim              time,
  ADD COLUMN IF NOT EXISTS plano_fechado         text,
  ADD COLUMN IF NOT EXISTS forma_pagamento_impl  text,
  ADD COLUMN IF NOT EXISTS loja_id               text
    REFERENCES lf_config(loja_id) ON DELETE SET NULL;

-- Coluna gerada: espelha resultado = 'fechamento'.
-- Não pode ser definida em INSERT — PostgreSQL cuida disso automaticamente.
ALTER TABLE jt_visits
  ADD COLUMN IF NOT EXISTS fechou_negocio boolean
    GENERATED ALWAYS AS (resultado = 'fechamento') STORED;

-- ─── 2. Vincular consultor ao usuário Supabase Auth ──────────────────────────
ALTER TABLE jt_consultants
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

-- ─── 3. Vincular loja ao consultor que a cadastrou ───────────────────────────
ALTER TABLE lf_config
  ADD COLUMN IF NOT EXISTS cadastrado_por_consultor_id uuid
    REFERENCES jt_consultants(id);

-- ─── 4. RLS em jt_visits ─────────────────────────────────────────────────────
ALTER TABLE jt_visits ENABLE ROW LEVEL SECURITY;

-- SELECT: admin (sem claim) vê tudo; consultor vê só as próprias visitas.
CREATE POLICY "select_visitas" ON jt_visits
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'consultant_id' IS NULL)
    OR (consultor_id::text = (auth.jwt() -> 'app_metadata' ->> 'consultant_id'))
  );

-- INSERT: admin pode inserir livremente; consultor só na própria visita.
CREATE POLICY "insert_visitas" ON jt_visits
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'consultant_id' IS NULL)
    OR (consultor_id::text = (auth.jwt() -> 'app_metadata' ->> 'consultant_id'))
  );

-- UPDATE/DELETE (futuro): mesma lógica — admin irrestrito, consultor só o seu.
