-- ============================================================
-- Migração: Campo Fornecedor em Nova Venda
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Tabela de fornecedores por loja (autocomplete persistente)
CREATE TABLE IF NOT EXISTS lf_fornecedores (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id    text        NOT NULL,
  nome       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (loja_id, nome)
);
ALTER TABLE lf_fornecedores DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS lf_fornecedores_loja ON lf_fornecedores (loja_id);

-- 2. Coluna fornecedor na tabela de vendas
ALTER TABLE lf_vendas ADD COLUMN IF NOT EXISTS fornecedor text;
