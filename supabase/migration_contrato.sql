-- Migration: Fase 2 do módulo de contrato — dados contratuais da loja
-- Execute no Supabase Dashboard > SQL Editor.
--
-- Escopo desta fase: apenas o schema. Geração do PDF, bucket de storage,
-- edge function de assinatura eletrônica e a cobrança recorrente por
-- vencimento_dia ficam para fases seguintes. Nada aqui altera a lógica de
-- faturamento atual, que continua somando 30 dias fixos em jt_cobrancas.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) lf_config — dados do contratante
--
-- Todas nullable de propósito: a loja pode ser criada sem esses dados e ter o
-- cadastro completado depois, então nada aqui bloqueia o INSERT existente.
-- vencimento_dia é o dia recorrente do mês ("todo dia 10"), não uma data.

ALTER TABLE lf_config
  ADD COLUMN IF NOT EXISTS razao_social         text,
  ADD COLUMN IF NOT EXISTS cpf_cnpj             text,
  ADD COLUMN IF NOT EXISTS endereco             text,
  ADD COLUMN IF NOT EXISTS numero               text,
  ADD COLUMN IF NOT EXISTS complemento          text,
  ADD COLUMN IF NOT EXISTS bairro               text,
  ADD COLUMN IF NOT EXISTS cidade               text,
  ADD COLUMN IF NOT EXISTS estado               text,
  ADD COLUMN IF NOT EXISTS cep                  text,
  ADD COLUMN IF NOT EXISTS responsavel_nome     text,
  ADD COLUMN IF NOT EXISTS responsavel_email    text,
  ADD COLUMN IF NOT EXISTS responsavel_telefone text,
  ADD COLUMN IF NOT EXISTS contrato_inicio      date,
  ADD COLUMN IF NOT EXISTS vencimento_dia       integer
    CHECK (vencimento_dia IS NULL OR vencimento_dia BETWEEN 1 AND 31);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) jt_contratos — snapshot CONGELADO do contrato
--
-- Os campos abaixo são propositalmente uma CÓPIA dos de lf_config, não um
-- select vivo. No momento em que o contrato é gerado os valores são copiados
-- para cá; se a loja editar o cadastro depois, o contrato já assinado continua
-- refletindo o que foi de fato acordado.
--
-- loja_id é FK lógica para lf_config.loja_id — sem constraint FK real, porque
-- as tabelas lf_* do projeto não usam FK.
--
-- Esta fase NÃO grava nada aqui: a tabela só passa a ser escrita quando a
-- geração do contrato for implementada.

CREATE TABLE IF NOT EXISTS jt_contratos (
  id                   uuid primary key default gen_random_uuid(),
  loja_id              text not null,

  -- snapshot do contratante
  razao_social         text,
  cpf_cnpj             text,
  endereco             text,
  numero               text,
  complemento          text,
  bairro               text,
  cidade               text,
  estado               text,
  cep                  text,
  responsavel_nome     text,
  responsavel_email    text,
  responsavel_telefone text,
  contrato_inicio      date,
  vencimento_dia       integer,

  -- snapshot comercial
  valor_mensal         numeric,
  plano                text,
  segmento             text,   -- 'moda' | 'mercado'

  -- 'rascunho' hoje; evolui para 'aguardando_assinatura' / 'assinado' / 'cancelado'
  status               text default 'rascunho',
  created_at           timestamptz default now()
);

-- Busca por loja é o acesso natural desta tabela (listar contratos de uma loja).
CREATE INDEX IF NOT EXISTS jt_contratos_loja_id_idx ON jt_contratos (loja_id);

ALTER TABLE jt_contratos DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Conferência

-- 1) Colunas novas em lf_config:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_name = 'lf_config'
--    AND column_name IN ('razao_social','cpf_cnpj','endereco','numero','complemento',
--                        'bairro','cidade','estado','cep','responsavel_nome',
--                        'responsavel_email','responsavel_telefone',
--                        'contrato_inicio','vencimento_dia');

-- 2) Tabela criada e com RLS desligada:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'jt_contratos';

-- 3) O CHECK do vencimento_dia deve barrar 0 e 32:
-- INSERT INTO lf_config (loja_id, vencimento_dia) VALUES ('__teste__', 32);  -- deve falhar
