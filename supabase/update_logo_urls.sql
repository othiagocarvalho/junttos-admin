-- Atualiza logo_url para as lojas existentes
-- Execute no Supabase Dashboard → SQL Editor

UPDATE lf_config SET logo_url = '/logos/estrada.svg'  WHERE loja_id = 'estrada';
UPDATE lf_config SET logo_url = '/logos/biastore.svg' WHERE loja_id = 'biastore';
