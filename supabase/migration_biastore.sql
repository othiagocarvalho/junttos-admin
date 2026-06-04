-- Migration: Cadastro Usy Bia Store
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)

-- Garante colunas extras (idempotente — seguro rodar mesmo se já existirem)
ALTER TABLE lf_config
  ADD COLUMN IF NOT EXISTS slug       text,
  ADD COLUMN IF NOT EXISTS status     text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS plano      text DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS logo_url   text;

-- Upsert Usy Bia Store
INSERT INTO lf_config (loja_id, slug, nome, status, plano, cor_primaria, cor_secundaria, features)
VALUES (
  'biastore',
  'biastore',
  'Usy Bia Store',
  'ativo',
  'basico',
  '#1A1A1A',
  '#C9A84C',
  '{"vendas":true,"historico":true,"metas":true,"fechamento_caixa":true,"relatorios":true,"clientes":false,"estoque":false}'
)
ON CONFLICT (loja_id) DO UPDATE SET
  slug           = EXCLUDED.slug,
  nome           = EXCLUDED.nome,
  status         = EXCLUDED.status,
  plano          = EXCLUDED.plano,
  cor_primaria   = EXCLUDED.cor_primaria,
  cor_secundaria = EXCLUDED.cor_secundaria,
  updated_at     = now();

-- Produtos padrão para biastore (executar após o INSERT acima)
INSERT INTO lf_produtos (loja_id, nome)
SELECT 'biastore', nome FROM unnest(ARRAY[
  'Vestido','Cropped','Blusa','Saia','Short','Calça','Conjunto'
]) AS nome
WHERE NOT EXISTS (
  SELECT 1 FROM lf_produtos WHERE loja_id = 'biastore' LIMIT 1
);
