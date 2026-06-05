-- Patch: identidade visual Metallic Gold para Bia Store
UPDATE lf_config
SET
  cor_primaria   = '#D4A017',
  cor_secundaria = '#F0C040',
  updated_at     = now()
WHERE loja_id = 'biastore';
