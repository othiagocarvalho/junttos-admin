-- ============================================================================
-- Pendências de estoque — falhas de baixa/restauro que precisam de ajuste
-- manual. NÃO EXECUTADO. Rodar manualmente no SQL Editor do Supabase.
--
-- CONTEXTO
-- aplicarEstoque (useLojaData.js) buscava o produto por nome com
-- .maybeSingle() e fazia `continue` quando não achava exatamente 1: venda
-- gravada, estoque intacto, ninguém sabendo (Short Listrado / Tropicale: 26
-- vendas; 18 produtos da Audaz com duplicata inativa de mesmo nome).
-- Agora toda falha (produto duplicado, não encontrado, variação inexistente,
-- erro de busca/gravação) vira aviso na tela E uma linha aqui, que alimenta o
-- aviso "produtos com pendência de estoque" na tela Início.
--
-- ESCRITA
-- O app NÃO tem policy de escrita nesta tabela. Grava só pela RPC
-- lf_registrar_pendencia_estoque (SECURITY DEFINER), que confere a loja pelo
-- claim do JWT — o mesmo critério das policies own_loja das tabelas lf_*
-- (ver migration_rls_varredura_completa.sql). Exceção 'sualoja' (demo),
-- igual às demais tabelas, porque o painel demo roda sem loja_id no JWT.
--
-- LEITURA
-- Loja lê só as próprias pendências (own_loja) + exceção demo.
--
-- `resolvido` fica para a etapa de tela de resolução; por enquanto marca-se
-- à mão (UPDATE ... SET resolvido = true) depois de ajustar o estoque.
--
-- Idempotente: pode rodar de novo.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lf_estoque_pendencias (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id      text        NOT NULL,
  venda_id     uuid,       -- sem FK: a venda pode ter sido excluída (restauro de deleteVenda)
  produto_nome text,
  variacao     text,
  quantidade   numeric,
  motivo       text        NOT NULL,
  detalhe      jsonb,      -- produto_ids (duplicata), modo, origem_tipo, origem_id, erro
  resolvido    boolean     DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT lf_estoque_pendencias_motivo_check CHECK (motivo IN (
    'produto_duplicado', 'produto_nao_encontrado', 'variacao_nao_encontrada',
    'erro_busca', 'erro_gravacao'
  ))
);

CREATE INDEX IF NOT EXISTS lf_estoque_pendencias_abertas_idx
  ON lf_estoque_pendencias (loja_id, created_at DESC)
  WHERE resolvido IS NOT TRUE;

COMMENT ON TABLE lf_estoque_pendencias IS
  'Falhas de baixa/restauro de estoque para ajuste manual. Escrita só via lf_registrar_pendencia_estoque. Ver src/utils/baixaEstoque.js.';

-- ── RLS: leitura da própria loja; escrita nenhuma pelo app ──────────────
ALTER TABLE lf_estoque_pendencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lf_estoque_pendencias_own_loja_select ON lf_estoque_pendencias;
CREATE POLICY lf_estoque_pendencias_own_loja_select ON lf_estoque_pendencias
  FOR SELECT TO authenticated
  USING (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

DROP POLICY IF EXISTS lf_estoque_pendencias_demo_select ON lf_estoque_pendencias;
CREATE POLICY lf_estoque_pendencias_demo_select ON lf_estoque_pendencias
  FOR SELECT TO anon, authenticated
  USING (loja_id = 'sualoja');

-- ── RPC de registro ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lf_registrar_pendencia_estoque(
  p_loja_id      text,
  p_venda_id     uuid,
  p_produto_nome text,
  p_variacao     text,
  p_quantidade   numeric,
  p_motivo       text,
  p_detalhe      jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loja_jwt text := auth.jwt() -> 'app_metadata' ->> 'loja_id';
  v_id       uuid;
BEGIN
  -- Mesma régua das policies own_loja: só grava para a loja do login.
  -- service_role (scripts/admin) passa; 'sualoja' é a exceção demo.
  IF NOT (
       coalesce(auth.role(), '') = 'service_role'
    OR (v_loja_jwt IS NOT NULL AND v_loja_jwt = p_loja_id)
    OR p_loja_id = 'sualoja'
  ) THEN
    RAISE EXCEPTION 'PENDENCIA_LOJA_INVALIDA:%', jsonb_build_object('loja_id', p_loja_id)::text
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO lf_estoque_pendencias (
    loja_id, venda_id, produto_nome, variacao, quantidade, motivo, detalhe
  ) VALUES (
    p_loja_id, p_venda_id, left(p_produto_nome, 300), left(p_variacao, 200),
    p_quantidade, p_motivo, p_detalhe
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION lf_registrar_pendencia_estoque(text, uuid, text, text, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lf_registrar_pendencia_estoque(text, uuid, text, text, numeric, text, jsonb) TO anon, authenticated;

COMMIT;

-- ── Conferência (depois de rodar) ──────────────────────────────────────
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'lf_estoque_pendencias';  -- true
-- SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'lf_estoque_pendencias'::regclass;
--   -- só as duas de SELECT ('r'); nenhuma de INSERT/UPDATE/DELETE
