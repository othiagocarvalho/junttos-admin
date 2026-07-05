-- Adiciona colunas de conferência de caixa à tabela lf_caixas
-- Necessário para registrar suprimento, valor físico contado e divergência

ALTER TABLE lf_caixas
  ADD COLUMN IF NOT EXISTS suprimento    numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_contado numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS diferenca     numeric DEFAULT NULL;

COMMENT ON COLUMN lf_caixas.suprimento    IS 'Dinheiro adicionado ao caixa durante o dia (fora das vendas)';
COMMENT ON COLUMN lf_caixas.valor_contado IS 'Valor físico contado no caixa no momento do fechamento';
COMMENT ON COLUMN lf_caixas.diferenca     IS 'Diferença entre valor contado e esperado (contado - esperado). Positivo = sobra, negativo = falta.';
