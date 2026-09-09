-- Referência: schema ATUAL de jt_redes, lido direto do banco
-- Não execute isto esperando mudar nada — é documentação, não uma feature nova.
--
-- Motivo deste arquivo: jt_redes nasceu direto no Supabase Dashboard no commit
-- f5896e6 (feat: adiciona base de Redes), sem passar por uma migration
-- versionada em supabase/ como todo o resto do schema do projeto. Isso deixava
-- o repositório sem registro de como a tabela é hoje — e a migration
-- migration_contrato_rede.sql, que depende de jt_redes.id para popular
-- jt_contratos.rede_id, precisa desse registro para quem for ler o código
-- depois sem abrir o Dashboard.
--
-- Como foi obtido: introspecção somente-leitura do banco de produção via
-- `supabase gen types typescript --linked` (CLI autenticado, projeto
-- "Junttos Projeto" / dbfxigylileupucnuhmb), não uma suposição a partir do
-- código React. Todo o CREATE TABLE abaixo usa IF NOT EXISTS — rodar isto não
-- altera a tabela existente em nada; é só o formato mais fácil de versionar
-- "documento o que já existe" no mesmo padrão que o resto de supabase/ usa.
--
-- O que NÃO foi possível confirmar por introspecção (sem Docker local para
-- `supabase db dump`, que exigiria pg_dump): o estado exato de RLS e de
-- policies em jt_redes. Pelo comportamento em produção — Redes.jsx e
-- CadastroCliente.jsx leem e escrevem em jt_redes DIRETO DO NAVEGADOR, sem
-- passar pela Edge Function — a tabela precisa estar acessível pela anon key,
-- então o cenário mais provável é RLS desligada (mesmo padrão de lf_config,
-- que também precisa ser legível por anon). Confirme rodando a query no fim
-- deste arquivo antes de assumir que está certo.


-- ---------------------------------------------------------------------------
-- 1) jt_redes — tabela hoje

CREATE TABLE IF NOT EXISTS jt_redes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  dono_nome  text,
  criado_em  timestamptz not null default now()
);

-- Sem RLS habilitada aqui de propósito — este arquivo documenta o estado
-- atual (provável RLS desligada, ver nota acima) e não muda comportamento.
-- Se a conferência no fim mostrar RLS ligada com policy, ajuste este comentário
-- e não rode ALTER nenhum a partir daqui sem entender o que a policy cobre.


-- ---------------------------------------------------------------------------
-- 2) lf_config.rede_id — já existe, nenhuma mudança

-- lf_config já tem a coluna rede_id (uuid, nullable, sem FK real — mesmo
-- padrão de todas as tabelas lf_*/jt_* do projeto). Confirmado pela mesma
-- introspecção. Nada a fazer aqui; comando abaixo é só para referência caso
-- precise recriar o ambiente do zero algum dia.

-- ALTER TABLE lf_config ADD COLUMN IF NOT EXISTS rede_id uuid;


-- ---------------------------------------------------------------------------
-- Conferência (rode isto, não o CREATE TABLE acima, se só quiser checar)

-- 1) Confirma as colunas de jt_redes batem com o que este arquivo documenta:
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'jt_redes'
--  ORDER BY ordinal_position;

-- 2) RLS ligada ou desligada:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'jt_redes';

-- 3) Policies existentes (deve vir vazio se a hipótese acima estiver certa):
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'jt_redes';
