-- Migration: contrato de rede — cobre múltiplas lojas de uma rede num único
-- contrato, contratante único, um link de assinatura só.
-- Execute no Supabase Dashboard > SQL Editor, DEPOIS de
-- migration_jt_redes_referencia.sql (que documenta jt_redes, usado aqui como
-- referência lógica de rede_id).
--
-- Pré-requisito: migration_assinatura.sql (Fase 4) já aplicada — este arquivo
-- assume que jt_contratos já tem token_assinatura, token_expira_em,
-- assinado_em etc.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DECISÃO DE DESENHO — por que jt_contratantes NÃO ganhou um rede_id
--
-- O desenho original pedia "jt_contratantes ganha um rede_id opcional,
-- nullable, contratante vinculado a rede_id OU loja_id". Não dá para fazer
-- isso do jeito mais direto: loja_id é PRIMARY KEY NOT NULL de
-- jt_contratantes hoje (ver migration_contratante.sql) — não existe "PK
-- opcional", e mudar a forma da chave primária de uma tabela em produção com
-- dados reais (todo contratante de loja já cadastrado) é o tipo de mudança
-- estrutural que este arquivo foi instruído a evitar.
--
-- Caminho mais seguro escolhido: uma tabela IRMÃ, jt_contratantes_redes,
-- keyed por rede_id em vez de loja_id, mesmo formato de colunas, mesma
-- política de RLS (ligada, sem policy, só a Edge Function com service_role
-- acessa). jt_contratantes original fica 100% intocada — zero risco para
-- qualquer contratante de loja já cadastrado, Tropicale inclusive. "Um
-- contratante é OU de uma rede OU de uma loja, nunca os dois" passa a ser
-- verdade por construção: são tabelas diferentes, não uma coluna nullable
-- competindo com a mesma chave.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Cada comando está separado de propósito. Rode de cima para baixo.


-- ---------------------------------------------------------------------------
-- 1) jt_contratantes_redes — contratante de um contrato de rede
--
-- Mesmas 13 colunas de jt_contratantes, mesmo CHECK de vencimento_dia,
-- só que a chave é rede_id (FK lógica para jt_redes.id, sem constraint real
-- — mesmo padrão do projeto inteiro) em vez de loja_id.

CREATE TABLE IF NOT EXISTS jt_contratantes_redes (
  rede_id              uuid primary key,

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
  vencimento_dia       integer
    CHECK (vencimento_dia IS NULL OR vencimento_dia BETWEEN 1 AND 31),

  updated_at           timestamptz default now()
);

ALTER TABLE jt_contratantes_redes ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy, de propósito — mesmo motivo de jt_contratantes: com RLS
-- ligada e sem policy, anon e authenticated não leem nem escrevem nada.
-- service_role (só a Edge Function gerar-contrato usa) ignora RLS.


-- ---------------------------------------------------------------------------
-- 2) jt_contratos — colunas novas para contrato de rede
--
-- loja_id perde o NOT NULL: é uma alteração segura porque nenhuma linha
-- existente tem loja_id nulo (todo contrato até hoje é individual), então o
-- DROP NOT NULL não falha e não muda nenhuma linha — só passa a permitir que
-- um contrato NOVO, de rede, grave loja_id = null.
--
-- rede_id e lojas_incluidas nascem nulos em toda linha existente: contrato
-- individual antigo continua sem os dois, exatamente como está hoje.
--
-- lojas_incluidas é jsonb, não um array de texto — guarda o SNAPSHOT de cada
-- loja no momento da geração (loja_id, nome, segmento, plano, valor_mensal),
-- mesmo espírito de "congelado" do resto da linha: se a loja mudar de nome ou
-- trocar de plano depois, o contrato já gerado/assinado continua mostrando o
-- que foi de fato combinado. Formato de cada item do array:
--   {"loja_id": "...", "nome": "...", "segmento": "moda", "plano": "business", "valor_mensal": 259.90}

ALTER TABLE jt_contratos ALTER COLUMN loja_id DROP NOT NULL;

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS rede_id uuid;

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS lojas_incluidas jsonb;

-- Trava mínima: todo contrato tem que ser de UMA loja OU de UMA rede — nunca
-- as duas colunas nulas ao mesmo tempo (o que seria um contrato órfão, sem
-- ninguém para cobrar). Não força mutuamente exclusivo (não barra loja_id E
-- rede_id preenchidos juntos) de propósito: essa regra é decisão de negócio
-- que já está garantida pelo código da Edge Function (o fluxo por loja_id
-- nunca grava rede_id, e vice-versa) — um CHECK rígido demais aqui só
-- travaria uma evolução futura sem necessidade, mesmo padrão de "status text
-- sem CHECK" já usado no resto da tabela.
ALTER TABLE jt_contratos ADD CONSTRAINT jt_contratos_loja_ou_rede
  CHECK (loja_id IS NOT NULL OR rede_id IS NOT NULL);

-- Busca por rede é o acesso natural desta coluna (listar contratos de uma
-- rede), mesmo padrão do índice que já existe em loja_id.
CREATE INDEX IF NOT EXISTS jt_contratos_rede_id_idx ON jt_contratos (rede_id);


-- ---------------------------------------------------------------------------
-- Conferência (rode depois, separadamente)

-- 1) jt_contratantes_redes criada, com RLS ligada e sem policy:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'jt_contratantes_redes';
-- SELECT policyname FROM pg_policies WHERE tablename = 'jt_contratantes_redes'; -- deve vir VAZIO

-- 2) Colunas novas em jt_contratos:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_name = 'jt_contratos'
--    AND column_name IN ('loja_id', 'rede_id', 'lojas_incluidas');
-- loja_id deve aparecer com is_nullable = 'YES' agora.

-- 3) Nenhum contrato existente foi afetado — todas as linhas atuais devem
--    continuar com loja_id preenchido e rede_id/lojas_incluidas nulos:
-- SELECT count(*) FILTER (WHERE loja_id IS NULL) AS sem_loja_id,
--        count(*) FILTER (WHERE rede_id IS NOT NULL) AS com_rede_id,
--        count(*) AS total
--   FROM jt_contratos;
-- Antes de qualquer contrato de rede ser gerado, sem_loja_id e com_rede_id
-- devem vir 0.

-- 4) O CHECK novo bloqueia linha órfã (sem loja_id nem rede_id) — deve falhar:
-- INSERT INTO jt_contratos (id) VALUES (gen_random_uuid());
