-- Migration: Fase 4 do modulo de contrato -- aceite eletronico
-- Execute no Supabase Dashboard > SQL Editor.
--
-- Pre-requisito: migration_contrato_fase3.sql ja aplicada (token_assinatura,
-- pdf_path, pdf_hash, gerado_em).
--
-- Escopo: colunas do aceite e o prazo do link publico. Nada de policy nova --
-- jt_contratos continua com RLS ligada e SEM policy, e toda leitura/escrita
-- passa pela Edge Function com service_role, inclusive a da rota publica.
--
-- Cada comando esta separado de proposito. Rode de cima para baixo.


-- ---------------------------------------------------------------------------
-- 1) jt_contratos -- registro do aceite
--
-- O aceite e 1:1 com o contrato (um signatario, sem testemunha nem avalista),
-- entao mora na propria linha em vez de tabela separada.
--
-- assinante_ip e assinante_user_agent sao lidos dos headers da function
-- (x-forwarded-for / user-agent). Nunca vem do corpo da requisicao: valor
-- auto-declarado pelo cliente nao teria valor probatorio nenhum.
--
-- assinatura_svg guarda o traco do canvas como path SVG, nao PNG base64.
-- Motivo: o traco e uma sequencia de pontos, e o path resultante fica na casa
-- de poucos KB contra dezenas de KB do PNG equivalente; escala sem perder
-- qualidade em qualquer tamanho de tela ou impressao; e, como a tela ja
-- precisa capturar os pontos para desenhar no canvas, montar o path nao custa
-- nada a mais.

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS assinado_em timestamptz;

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS assinante_ip text;

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS assinante_user_agent text;

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS assinatura_svg text;


-- ---------------------------------------------------------------------------
-- 2) Prazo do link publico
--
-- O token vale 7 dias a partir da geracao do contrato, e e de uso unico: ao
-- ser assinado o contrato sai de aguardando_assinatura, e a rota publica passa
-- a recusar o mesmo link. Nao existe tela de reenviar nem revogar -- gerar um
-- contrato novo cancela os anteriores e emite token novo, e e esse o caminho
-- quando um link vaza ou expira.

ALTER TABLE jt_contratos ADD COLUMN IF NOT EXISTS token_expira_em timestamptz;


-- Contratos gerados antes desta migration ficariam sem prazo. Recebem os
-- mesmos 7 dias contados da geracao -- os que ja passaram disso nascem
-- expirados, que e o comportamento correto para um link antigo.

UPDATE jt_contratos
   SET token_expira_em = gerado_em + interval '7 days'
 WHERE gerado_em IS NOT NULL
   AND token_expira_em IS NULL;


-- ---------------------------------------------------------------------------
-- 3) Sobre os status
--
-- O fluxo completo passa a ser:
--
--   rascunho -> aguardando_assinatura -> assinado
--                       |
--                       +-> cancelado (ao gerar um contrato novo para a loja)
--
-- 'gerado' continua aceito e aparece na tela, mas deixa de ser gravado: a
-- function passa direto para aguardando_assinatura assim que o PDF sobe, ja
-- que nesse instante o link publico ja e valido. Contratos antigos que ficaram
-- em 'gerado' seguem funcionando -- a rota publica aceita os dois estados.
--
-- Nenhum comando aqui: status e text sem CHECK, de proposito, para nao travar
-- a evolucao do fluxo em cima de dados ja existentes.


-- ---------------------------------------------------------------------------
-- Conferencia (rode depois, separadamente)

-- 1) Colunas novas -- devem vir 5 linhas:
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'jt_contratos'
--    AND column_name IN ('assinado_em','assinante_ip','assinante_user_agent',
--                        'assinatura_svg','token_expira_em');

-- 2) Contratos existentes ganharam prazo:
-- SELECT id, status, gerado_em, token_expira_em,
--        (token_expira_em < now()) AS ja_expirado
--   FROM jt_contratos ORDER BY created_at DESC;

-- 3) jt_contratos continua sem policy -- deve vir VAZIO:
-- SELECT policyname FROM pg_policies WHERE tablename = 'jt_contratos';
