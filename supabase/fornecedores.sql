-- Módulo de Fornecedores — cadastro, histórico de compras e prazo de pagamento.
-- Rodar manualmente no SQL Editor do Supabase (nenhuma migração é aplicada
-- automaticamente por este repo). Não executa nada destrutivo: apenas cria
-- tabelas novas e adiciona uma coluna opcional em lf_produtos.

CREATE TABLE IF NOT EXISTS lf_fornecedores (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id               text        NOT NULL,
  nome                  text        NOT NULL,
  contato               text,
  documento             text,       -- CNPJ ou CPF, opcional
  prazo_pagamento_dias  integer,    -- prazo padrão de pagamento, em dias
  observacoes           text,
  ativo                 boolean     NOT NULL DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lf_fornecedores_loja ON lf_fornecedores(loja_id);

-- Vínculo opcional produto → fornecedor. Mantém o campo de texto livre
-- lf_produtos.fornecedor já existente (não remover, não migrar dados
-- automaticamente) — produtos antigos continuam funcionando sem fornecedor_id.
ALTER TABLE lf_produtos
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES lf_fornecedores(id);

CREATE INDEX IF NOT EXISTS idx_lf_produtos_fornecedor ON lf_produtos(fornecedor_id);

-- Histórico de compras por fornecedor. Cada linha é uma compra/entrada de
-- estoque; produto_id é opcional (uma compra pode não estar ligada a um
-- produto específico já cadastrado).
CREATE TABLE IF NOT EXISTS lf_compras (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id         text        NOT NULL,
  fornecedor_id   uuid        NOT NULL REFERENCES lf_fornecedores(id),
  produto_id      uuid        REFERENCES lf_produtos(id),
  descricao       text,
  valor           numeric     NOT NULL DEFAULT 0,
  data_compra     date        NOT NULL DEFAULT current_date,
  data_vencimento date,
  status_pgto     text        NOT NULL DEFAULT 'pendente', -- 'pendente' | 'pago'
  data_pagamento  date,
  observacoes     text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lf_compras_loja ON lf_compras(loja_id);
CREATE INDEX IF NOT EXISTS idx_lf_compras_fornecedor ON lf_compras(fornecedor_id);
