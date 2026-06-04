-- Migration: Client config fields + Loja Estrada record
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)

-- Add new columns to lf_config
ALTER TABLE lf_config
  ADD COLUMN IF NOT EXISTS slug       text,
  ADD COLUMN IF NOT EXISTS status     text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS plano      text DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS logo_url   text;

-- Upsert Loja Estrada
INSERT INTO lf_config (loja_id, slug, nome, status, plano, cor_primaria, cor_secundaria, features)
VALUES (
  'estrada',
  'lojaestrada',
  'Loja Estrada',
  'ativo',
  'basico',
  '#C9956C',
  '#E8C4A8',
  '{"vendas":true,"historico":true,"metas":true,"fechamento_caixa":true,"relatorios":true,"clientes":false,"estoque":false}'
)
ON CONFLICT (loja_id) DO UPDATE SET
  slug          = EXCLUDED.slug,
  nome          = EXCLUDED.nome,
  status        = EXCLUDED.status,
  plano         = EXCLUDED.plano,
  cor_primaria  = EXCLUDED.cor_primaria,
  cor_secundaria = EXCLUDED.cor_secundaria,
  updated_at    = now();
