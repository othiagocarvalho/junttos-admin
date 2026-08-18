-- ============================================================================
-- Troca de plano pela tela + loja gratuita (cortesia)
--
-- NÃO É EXECUTADO PELO APP. Rodar manualmente no SQL Editor do Supabase.
--
-- Reexecutável: todo ADD COLUMN usa IF NOT EXISTS e os CHECKs são recriados.
--
-- ATENÇÃO À ORDEM: o código que usa estas colunas tolera a ausência delas
-- (campo undefined = comportamento de hoje), então dá para subir o deploy
-- antes. Mas a troca de plano e o toggle de gratuito só GRAVAM depois que
-- este arquivo rodar — antes disso o UPDATE falha com "column does not exist".
-- ============================================================================

-- 1) Colunas novas em lf_config -----------------------------------------------

ALTER TABLE lf_config
  -- Cortesia: a loja mantém plano e acesso, mas sai do dinheiro. O ciclo
  -- automático (jt_cobrancas) não gera nada para ela e o MRR a ignora.
  -- Independente de features.legado: legado controla ACESSO, gratuito
  -- controla COBRANÇA.
  ADD COLUMN IF NOT EXISTS gratuito boolean NOT NULL DEFAULT false;

ALTER TABLE lf_config
  -- Preço cheio da mensalidade desta loja, antes do desconto.
  --
  -- Nasce NULO em todas as lojas existentes, de propósito: enquanto for nulo,
  -- valorCheioMensalidade() continua deduzindo o preço da última mensalidade
  -- gerada, exatamente como faz hoje. Só a loja que passar pela troca de plano
  -- na tela ganha valor aqui — e a partir daí é este campo que manda.
  ADD COLUMN IF NOT EXISTS valor_mensal numeric;

ALTER TABLE lf_config DROP CONSTRAINT IF EXISTS lf_config_valor_mensal_chk;
ALTER TABLE lf_config ADD CONSTRAINT lf_config_valor_mensal_chk
  CHECK (valor_mensal IS NULL OR valor_mensal >= 0);

COMMENT ON COLUMN lf_config.gratuito IS
  'Loja de cortesia: fora da geração automática de cobrança e fora do MRR. Não afeta temAcesso().';
COMMENT ON COLUMN lf_config.valor_mensal IS
  'Preço cheio da mensalidade, antes do desconto. Nulo = deduzir da última mensalidade gerada.';

-- 2) Conferência (rodar depois do passo 1) ------------------------------------

-- SELECT loja_id, nome, status, plano, gratuito, valor_mensal,
--        desconto_tipo, desconto_valor, cobranca_automatica_desde
--   FROM lf_config
--  ORDER BY nome;

-- ============================================================================
-- 3) NbDistribuidora — marcar como gratuita
--
-- RODAR SEPARADO, depois de conferir o passo 1. Reversível: basta
-- UPDATE lf_config SET gratuito = false WHERE loja_id = 'nbdistribuidora';
--
-- Estado dela hoje (lido em 18/08/2026): status 'Trial',
-- cobranca_automatica_desde NULL, desconto percentual de 100%. Ou seja, já
-- estava de fato isenta — mas por três acidentes que qualquer edição futura
-- desfaz sem querer. Esta flag torna a cortesia explícita e durável.
--
-- NÃO apaga nem altera nenhuma cobrança já existente dela.
-- ============================================================================

-- UPDATE lf_config
--    SET gratuito = true
--  WHERE loja_id = 'nbdistribuidora';
