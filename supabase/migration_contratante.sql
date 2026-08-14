-- Migration: move os dados do contratante de lf_config para jt_contratantes
-- Execute no Supabase Dashboard > SQL Editor.
--
-- Motivo: lf_config precisa continuar legivel por anon -- o App.jsx resolve
-- slug -> loja antes de qualquer login, e o catalogo publico faz select('*')
-- nela. Nao da para ligar RLS ali sem derrubar o app. So que desde a Fase 2 a
-- tabela passou a guardar CPF/CNPJ, endereco, e-mail e telefone do
-- responsavel, e esses campos vao junto em todo select('*') -- inclusive no do
-- catalogo, que qualquer visitante abre.
--
-- Em vez de proteger lf_config, os campos sensiveis saem dela. jt_contratantes
-- nasce com RLS ligada e SEM policy: so a Edge Function gerar-contrato, que usa
-- service_role, escreve e le. Mesmo padrao de jt_contratos.
--
-- Cada comando esta separado de proposito. Rode de cima para baixo.


-- ---------------------------------------------------------------------------
-- 1) jt_contratantes
--
-- Uma linha por loja: e o cadastro atual, nao o snapshot. O congelado continua
-- sendo jt_contratos, escrito no momento em que o contrato e gerado.
-- loja_id e a chave primaria -- FK logica para lf_config.loja_id, sem
-- constraint real, porque as tabelas lf_* do projeto nao usam FK.

CREATE TABLE IF NOT EXISTS jt_contratantes (
  loja_id              text primary key,

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

ALTER TABLE jt_contratantes ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy, de proposito. Sem policy e com RLS ligada, anon e
-- authenticated nao leem nem escrevem nada. service_role ignora RLS.


-- ---------------------------------------------------------------------------
-- 2) Migra o que ja existe em lf_config
--
-- Copia so as lojas que tem algum campo preenchido. Idempotente: rodar duas
-- vezes nao duplica nem sobrescreve o que ja foi migrado.

INSERT INTO jt_contratantes (
  loja_id, razao_social, cpf_cnpj, endereco, numero, complemento, bairro,
  cidade, estado, cep, responsavel_nome, responsavel_email,
  responsavel_telefone, contrato_inicio, vencimento_dia
)
SELECT
  loja_id, razao_social, cpf_cnpj, endereco, numero, complemento, bairro,
  cidade, estado, cep, responsavel_nome, responsavel_email,
  responsavel_telefone, contrato_inicio, vencimento_dia
  FROM lf_config
 WHERE coalesce(razao_social, cpf_cnpj, endereco, numero, complemento, bairro,
                cidade, estado, cep, responsavel_nome, responsavel_email,
                responsavel_telefone) IS NOT NULL
    OR contrato_inicio IS NOT NULL
    OR vencimento_dia  IS NOT NULL
ON CONFLICT (loja_id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 3) Limpeza das colunas antigas -- NAO rode agora
--
-- Deixado comentado de proposito. Confira antes que a migracao acima trouxe
-- tudo e que o app esta funcionando com a tabela nova:
--
--   SELECT count(*) FROM jt_contratantes;
--   SELECT loja_id, razao_social FROM jt_contratantes ORDER BY loja_id;
--
-- So depois disso rode o bloco abaixo. Ele e IRREVERSIVEL: apaga os dados de
-- contratante que ainda estao em lf_config. Enquanto essas colunas existirem,
-- os valores seguem visiveis para qualquer um com a anon key -- e por isso a
-- limpeza importa, mesmo que hoje quase todas estejam nulas.
--
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS razao_social;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS cpf_cnpj;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS endereco;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS numero;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS complemento;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS bairro;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS cidade;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS estado;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS cep;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS responsavel_nome;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS responsavel_email;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS responsavel_telefone;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS contrato_inicio;
-- ALTER TABLE lf_config DROP COLUMN IF EXISTS vencimento_dia;


-- ---------------------------------------------------------------------------
-- Conferencia

-- 1) Tabela criada com RLS ligada -- relrowsecurity deve ser true:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'jt_contratantes';

-- 2) Nenhuma policy -- o resultado deve vir VAZIO:
-- SELECT policyname FROM pg_policies WHERE tablename = 'jt_contratantes';

-- 3) Dados migrados:
-- SELECT loja_id, razao_social, cpf_cnpj FROM jt_contratantes ORDER BY loja_id;

-- 4) Invisivel para anon -- rode no terminal, deve vir 0:
--    curl "$SUPABASE_URL/rest/v1/jt_contratantes?select=loja_id" \
--      -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--      -H "Prefer: count=exact" -I | grep -i content-range
