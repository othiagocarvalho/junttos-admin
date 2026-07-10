-- Migration: Colunas atacado em lf_vendas
-- Execute no SQL Editor do Supabase Dashboard
-- Resolve: INSERT 400 na Nova Venda para lojas com features.atacado = true

ALTER TABLE lf_vendas
  ADD COLUMN IF NOT EXISTS nome_loja     text,
  ADD COLUMN IF NOT EXISTS cidade_estado text,
  ADD COLUMN IF NOT EXISTS forma_envio   text;
