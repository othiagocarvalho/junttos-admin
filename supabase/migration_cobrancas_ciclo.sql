-- Migration: ciclo de cobrança da assinatura Junttos
-- Execute no Supabase Dashboard > SQL Editor, bloco a bloco, conferindo entre eles.
--
-- ORDEM IMPORTA: rode esta migration ANTES de publicar o código novo. O
-- cadastro de loja passa a gravar tipo, valor_cheio, vencimento_dia e desconto
-- — sem as colunas, o INSERT falha e nenhuma loja consegue ser criada.
--
-- Escopo: colunas de tipo e desconto, tabela de histórico, e o backfill das
-- lojas que já existem. A escrita continua saindo do navegador com a anon key,
-- como hoje — mover para edge function foi adiado de propósito, para andar
-- junto com a migração do login do admin para o Supabase Auth.
--
-- Contexto do que existe hoje (levantado em 15/08/2026): jt_cobrancas tem 5
-- linhas, uma por loja, todas 'pendente' e nenhuma jamais marcada como paga.
-- A tabela nunca foi versionada neste repo — foi criada direto no dashboard —
-- por isso tudo aqui é IF NOT EXISTS, rodando em cima do que estiver lá.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) jt_cobrancas — tipo, desconto registrado e trava contra duplicata

-- 'mensalidade' como DEFAULT cobre as 5 linhas existentes (todas são
-- mensalidade) e mantém qualquer INSERT antigo funcionando.
ALTER TABLE jt_cobrancas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'mensalidade',
  -- valor_cheio guarda o preço de tabela quando houve desconto. NULL = sem
  -- desconto. Sem isso não dá para responder "quanto essa loja deixa de pagar",
  -- e a geração do mês seguinte aplicaria desconto sobre valor já descontado.
  ADD COLUMN IF NOT EXISTS valor_cheio numeric,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- CHECK separado do ADD COLUMN para ser reexecutável sem erro.
ALTER TABLE jt_cobrancas DROP CONSTRAINT IF EXISTS jt_cobrancas_tipo_chk;
ALTER TABLE jt_cobrancas ADD CONSTRAINT jt_cobrancas_tipo_chk
  CHECK (tipo IN ('implantacao', 'mensalidade'));

-- Redundante depois do DEFAULT, mas mantém a migration reexecutável caso a
-- coluna já existisse nula.
UPDATE jt_cobrancas SET tipo = 'mensalidade' WHERE tipo IS NULL;

-- A trava mais importante deste bloco. A geração automática roda no navegador
-- a cada load da tela de Cobranças e do Dashboard: duas abas abertas ao mesmo
-- tempo tentariam criar a mesma cobrança. Este índice é o que impede cobrar o
-- cliente duas vezes — o código trata o erro 23505 como "outra aba ganhou" e
-- segue adiante.
CREATE UNIQUE INDEX IF NOT EXISTS jt_cobrancas_loja_venc_tipo_uidx
  ON jt_cobrancas (loja_id, vencimento, tipo);

-- O relatório por período filtra por data_pagamento.
CREATE INDEX IF NOT EXISTS jt_cobrancas_pagamento_idx
  ON jt_cobrancas (data_pagamento) WHERE data_pagamento IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) lf_config — vencimento_dia acessível ao navegador e desconto por loja

-- vencimento_dia hoje só existe em jt_contratantes, que tem RLS sem policy e é
-- invisível para o navegador. NÃO é dado pessoal — é um número de 1 a 28 — então
-- pode viver aqui, ao contrário de CPF e endereço, que ficam onde estão.
-- jt_contratantes continua sendo a fonte do contrato; lf_config passa a ser a
-- do faturamento.
ALTER TABLE lf_config
  ADD COLUMN IF NOT EXISTS vencimento_dia integer,

  -- Desconto permanente da loja, aplicado a toda mensalidade gerada daqui em
  -- diante. Nunca retroage em cobrança já criada.
  ADD COLUMN IF NOT EXISTS desconto_tipo text,
  ADD COLUMN IF NOT EXISTS desconto_valor numeric,
  ADD COLUMN IF NOT EXISTS desconto_motivo text,

  -- Marco zero da cobrança automática. Sem isso, uma loja de seis meses atrás
  -- com vencimento_dia preenchido geraria seis cobranças retroativas de uma vez
  -- no primeiro load da tela. Loja sem este campo fica fora da geração.
  ADD COLUMN IF NOT EXISTS cobranca_automatica_desde date;

-- Limite 28, não 31: dia 29/30/31 não existe em todo mês e a regra de "cai para
-- o último dia" é decisão de negócio, não de código. O gerador já sabe encurtar
-- se o limite for afrouxado depois.
ALTER TABLE lf_config DROP CONSTRAINT IF EXISTS lf_config_vencimento_dia_chk;
ALTER TABLE lf_config ADD CONSTRAINT lf_config_vencimento_dia_chk
  CHECK (vencimento_dia IS NULL OR vencimento_dia BETWEEN 1 AND 28);

ALTER TABLE lf_config DROP CONSTRAINT IF EXISTS lf_config_desconto_tipo_chk;
ALTER TABLE lf_config ADD CONSTRAINT lf_config_desconto_tipo_chk
  CHECK (desconto_tipo IS NULL OR desconto_tipo IN ('percentual', 'fixo'));

ALTER TABLE lf_config DROP CONSTRAINT IF EXISTS lf_config_desconto_valor_chk;
ALTER TABLE lf_config ADD CONSTRAINT lf_config_desconto_valor_chk
  CHECK (desconto_valor IS NULL OR desconto_valor >= 0);

-- Os dois campos andam juntos: ou ambos preenchidos, ou nenhum. Meio desconto
-- preenchido seria um desconto que não desconta.
ALTER TABLE lf_config DROP CONSTRAINT IF EXISTS lf_config_desconto_par_chk;
ALTER TABLE lf_config ADD CONSTRAINT lf_config_desconto_par_chk
  CHECK ((desconto_tipo IS NULL) = (desconto_valor IS NULL));


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) jt_cobrancas_historico — quem mexeu no quê

CREATE TABLE IF NOT EXISTS jt_cobrancas_historico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nulo quando a ação é da LOJA e não de uma cobrança específica — é o caso
  -- de aplicar ou remover o desconto permanente da assinatura.
  cobranca_id     uuid,

  -- Sem FK para jt_cobrancas: se a cobrança for apagada, o registro de que ela
  -- existiu e foi alterada precisa sobreviver. Mesma convenção das tabelas
  -- lf_*, que também não usam FK real.
  loja_id         text NOT NULL,

  -- 'criada' | 'vencimento' | 'valor' | 'observacoes' | 'pago'
  -- | 'pagamento_desfeito' | 'desconto'
  acao            text NOT NULL,
  campo           text,

  -- text e não numeric: a mesma coluna guarda data, valor e status.
  valor_anterior  text,
  valor_novo      text,

  -- Vem do localStorage do admin logado (AuthContext + src/auth/users.js).
  -- Registro operacional, não prova: o navegador pode mentir. Vira auth.uid()
  -- quando o login migrar para o Supabase Auth, sem mudar esta tabela.
  autor_nome      text,
  autor_email     text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jt_cobrancas_historico_cobranca_idx
  ON jt_cobrancas_historico (cobranca_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jt_cobrancas_historico_loja_idx
  ON jt_cobrancas_historico (loja_id, created_at DESC);

-- RLS desligada para espelhar jt_cobrancas, que hoje é lida e escrita pelo
-- navegador com a anon key. Postura herdada, não escolhida aqui — será
-- revisitada junto com a migração do login para o Supabase Auth.
ALTER TABLE jt_cobrancas_historico DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Backfill das lojas existentes — REVISE LINHA A LINHA ANTES DE RODAR
--
-- Só entra na geração automática a loja que for status 'ativo' E tiver
-- vencimento_dia E cobranca_automatica_desde. As três condições juntas.

-- audazwear — decisão do Thiago: dia 1, e a cobrança recorrente só começa a
-- valer em 01/09/2026. A loja ainda está migrando dados de outro sistema e não
-- operou de fato na Junttos. Até setembro ela fica fora da geração.
-- (O contrato assinado dizia dia 14 e a cobrança existente vence dia 29 —
--  ambos ficam para trás; o combinado agora é dia 1.)
UPDATE lf_config
   SET vencimento_dia = 1,
       cobranca_automatica_desde = DATE '2026-09-01'
 WHERE loja_id = 'audazwear';

-- hmboutique — dia 14, igual ao contrato assinado. Entra no ciclo a partir de
-- hoje. A cobrança legada dela vence 13/09; a checagem por competência impede
-- que setembro seja cobrado duas vezes.
UPDATE lf_config
   SET vencimento_dia = 14,
       cobranca_automatica_desde = CURRENT_DATE
 WHERE loja_id = 'hmboutique';

-- biastore — sem cadastro de contratante, então o dia vem da cobrança que já
-- existe (vence dia 12), que é a data que o cliente já conhece.
UPDATE lf_config
   SET vencimento_dia = 12,
       cobranca_automatica_desde = CURRENT_DATE
 WHERE loja_id = 'biastore';

-- teixeiramultimarcas (cortesia) e encantodemulher (trial sem condição de
-- pagar) — status 'Trial', portanto JÁ ficam fora do ciclo pelo filtro de
-- status. Guardo o dia como informação, mas deixo cobranca_automatica_desde
-- NULO de propósito: se um dia alguém mudar o status para ativo, elas não
-- podem começar a ser cobradas retroativamente sem uma decisão explícita.
UPDATE lf_config SET vencimento_dia = 19
 WHERE loja_id IN ('teixeiramultimarcas', 'encantodemulher');

-- encantodemulher — decisão do Thiago: apagar a cobrança pendente antiga.
-- A cliente não vai pagar e não faz sentido manter a pendência inflando o
-- painel. ID exato conferido em 15/08/2026: R$ 99,90, vencendo 19/08/2026,
-- status pendente, nunca teve pagamento.
DELETE FROM jt_cobrancas
 WHERE id = 'e9629d70-1223-408c-8a43-4cb1c4cd47eb';

-- As demais lojas (mercadodemo, sualoja, catalogob2bdemo, estrada) ficam com
-- vencimento_dia NULO de propósito — é o que mantém loja demo e loja sem
-- assinatura fora do faturamento.
--
-- Conferido ao vivo em 15/08/2026: lf_config tem 9 linhas. ducharmelingerie
-- foi excluída em outra sessão e não está mais aqui; teste2, teste3 e
-- testesssss também já saíram. Nenhum comando deste bloco dependia delas.


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Conferência

-- 5.1) Existe trigger em jt_cobrancas forçando data_pagamento?
--      Esperado: 0 linhas. Se aparecer algo, a data retroativa da tela não vai
--      funcionar e o trigger precisa sair antes.
-- SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
--  WHERE tgrelid = 'jt_cobrancas'::regclass AND NOT tgisinternal;

-- 5.2) Existe DEFAULT na coluna? Esperado: column_default nulo em data_pagamento.
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'jt_cobrancas' ORDER BY ordinal_position;

-- 5.3) Existe cron rodando que a anon key não enxerga?
--      Esperado: erro "schema cron does not exist", ou 0 linhas.
-- SELECT * FROM cron.job;

-- 5.4) Quem entra no ciclo automático depois do backfill.
--      Esperado: hmboutique e biastore com desde = hoje; audazwear com
--      desde = 2026-09-01; todas as outras sem desde.
-- SELECT loja_id, status, vencimento_dia, cobranca_automatica_desde,
--        desconto_tipo, desconto_valor
--   FROM lf_config ORDER BY cobranca_automatica_desde NULLS LAST, loja_id;

-- 5.5) Nenhuma cobrança ficou sem tipo. Esperado: 4 linhas, todas mensalidade
--      (eram 5; a de encantodemulher foi apagada no bloco 4).
-- SELECT tipo, count(*), sum(valor) FROM jt_cobrancas GROUP BY tipo;

-- 5.6) A trava de duplicata está de pé. Esperado: o índice único listado.
-- SELECT indexname FROM pg_indexes WHERE tablename = 'jt_cobrancas';
