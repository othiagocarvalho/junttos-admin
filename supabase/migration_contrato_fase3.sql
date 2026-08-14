-- Migration: Fase 3 do modulo de contrato -- geracao do PDF
-- Execute no Supabase Dashboard > SQL Editor.
--
-- Pre-requisito: migration_contrato.sql (Fase 2) ja aplicada.
--
-- Escopo desta fase: colunas do arquivo gerado + bucket privado onde o PDF e
-- guardado. A assinatura em si (aceite, IP, user-agent) e da Fase 4 -- so o
-- token_assinatura ja nasce aqui, para nao ter que reprocessar contratos depois.
--
-- Cada ALTER TABLE abaixo esta separado de proposito, um por coluna. E mais
-- verboso que encadear com virgula, mas roda em qualquer editor e permite
-- executar linha a linha se algum comando falhar.


-- ---------------------------------------------------------------------------
-- 1) jt_contratos: resultado da geracao
--
-- pdf_hash e o SHA-256 do arquivo no momento em que foi gerado: e ele que
-- amarra "o que foi assinado" quando a Fase 4 registrar o aceite.
-- token_assinatura e opaco e serve para o link publico da Fase 4 -- assim a URL
-- do cliente nunca expoe loja_id nem o caminho do arquivo no bucket.

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS pdf_path text;

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS pdf_hash text;

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS gerado_em timestamptz;

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS token_assinatura uuid DEFAULT gen_random_uuid();


-- Contratos criados antes desta migration ficariam sem token.

UPDATE jt_contratos
   SET token_assinatura = gen_random_uuid()
 WHERE token_assinatura IS NULL;


-- O link da Fase 4 busca por token: precisa ser unico e indexado.

CREATE UNIQUE INDEX IF NOT EXISTS jt_contratos_token_assinatura_idx
    ON jt_contratos (token_assinatura);


-- ---------------------------------------------------------------------------
-- 2) Bucket privado "contratos"
--
-- Diferente de certificados-fiscais, este bucket NAO recebe policy nenhuma.
--
-- O motivo: o painel admin nao usa Supabase Auth (AuthContext valida contra a
-- lista de src/auth/users.js e guarda no localStorage), entao o navegador do
-- admin e sempre anon e nunca teria um JWT com loja_id para satisfazer uma
-- policy nos moldes do bucket fiscal. Quem escreve e quem le e so a Edge
-- Function gerar-contrato, que usa service_role e ignora RLS.
--
-- Sem policy = nenhum acesso anonimo ou autenticado direto ao arquivo. O admin
-- baixa por signed URL de curta duracao emitida pela propria function.

INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', false)
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Conferencia (rode depois, separadamente)

-- 1) Colunas novas -- devem vir 4 linhas:
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'jt_contratos'
--    AND column_name IN ('pdf_path','pdf_hash','gerado_em','token_assinatura');

-- 2) Bucket criado e privado -- public deve ser false:
-- SELECT id, public FROM storage.buckets WHERE id = 'contratos';

-- 3) Nenhuma policy no bucket -- o resultado deve vir VAZIO:
-- SELECT policyname FROM pg_policies
--  WHERE schemaname = 'storage' AND tablename = 'objects'
--    AND qual::text LIKE '%contratos%';
