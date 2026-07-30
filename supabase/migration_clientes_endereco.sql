-- Migration: CPF/CNPJ + endereço em lf_clientes
-- Execute no Supabase Dashboard > SQL Editor ANTES de rodar
-- scripts/import-audaz.mjs --apply
--
-- Motivo: o import do histórico Linx/Microvix da loja 'audazwear' traz CPF/CNPJ
-- e endereço completo dos 1.192 clientes. lf_clientes hoje só tem nome,
-- telefone, email, data_nascimento e observacoes — sem estas colunas esses
-- dados seriam descartados no import.
--
-- Todas as colunas são text e nullable: nenhum cliente já existente é afetado,
-- e nenhuma tela atual quebra (o app ignora colunas que não conhece).

ALTER TABLE lf_clientes
  ADD COLUMN IF NOT EXISTS cpf_cnpj    text,
  ADD COLUMN IF NOT EXISTS endereco    text,
  ADD COLUMN IF NOT EXISTS numero      text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro      text,
  ADD COLUMN IF NOT EXISTS estado      text,
  ADD COLUMN IF NOT EXISTS cidade      text,
  ADD COLUMN IF NOT EXISTS cep         text;

-- Busca por documento dentro da loja (CPF/CNPJ não é único: o Linx traz
-- repetidos e "ISENTO", então índice comum, nunca UNIQUE).
CREATE INDEX IF NOT EXISTS lf_clientes_loja_cpf
  ON lf_clientes (loja_id, cpf_cnpj);

-- ─────────────────────────────────────────────────────────────────────────────
-- Feature flag: features.cadastro_completo_cliente
--
-- Mesmo padrão do features.catalogo_b2b. Controla se os campos de CPF/CNPJ e
-- endereço aparecem na tela de cliente — Pro e Business sim, Starter não.
-- O Starter segue funcionando igual, só sem esses campos na tela; o dado que já
-- existir no banco continua salvo e não é sobrescrito (o formulário do Starter
-- não envia essas colunas no update).

-- Liga para todas as lojas Pro e Business.
UPDATE lf_config
   SET features   = features || '{"cadastro_completo_cliente": true}'::jsonb,
       updated_at = now()
 WHERE plano IN ('pro', 'business')
   AND COALESCE((features->>'cadastro_completo_cliente')::boolean, false) IS DISTINCT FROM true;

-- Deixa explícito o off no Starter (evita undefined na tela).
UPDATE lf_config
   SET features   = features || '{"cadastro_completo_cliente": false}'::jsonb,
       updated_at = now()
 WHERE plano NOT IN ('pro', 'business')
   AND features->'cadastro_completo_cliente' IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Conferência

-- 1) As 8 colunas novas devem aparecer:
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name = 'lf_clientes'
--    AND column_name IN ('cpf_cnpj','endereco','numero','complemento',
--                        'bairro','cidade','estado','cep')
--  ORDER BY column_name;

-- 2) A flag por loja (audazwear é business → deve vir true):
-- SELECT loja_id, plano, features->'cadastro_completo_cliente' AS cadastro_completo
--   FROM lf_config
--  ORDER BY plano, loja_id;
