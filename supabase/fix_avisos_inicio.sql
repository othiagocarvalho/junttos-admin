-- Avisos da tela Início — dispensa (o X) dos tipos novos de aviso.
--
-- AvisosInicio.jsx (que substituiu AlertaBanner + BannerMeta) deixa a
-- lojista dispensar cada aviso. Os 3 tipos que ganharam dispensa agora
-- guardam o estado nesta coluna jsonb, uma chave por tipo:
--
--   meta_batida  'YYYY-MM'                  → some até o mês virar
--   conta        ['pagar:ID', 'receber:ID'] → contas dispensadas; uma conta
--                                              nova na janela faz o aviso voltar
--   estoque      { "ids": [...], "em": 'YYYY-MM-DD' }
--                                            → volta depois de 7 dias OU se a
--                                              lista de produtos com estoque
--                                              baixo/esgotado mudar
--
-- As 3 colunas que já existiam CONTINUAM como estão, sem migração de dado:
--   meta_lembrete_dispensado_em  (aviso "Ainda sem meta este mês")
--   socio_visto_periodo          (aviso "Seu Sócio Digital está pronto")
--   socio_intro_visto            (aviso "Conheça seu Sócio Digital")
--
-- Coluna ausente = nada dispensado (o front trata undefined como {}).
-- A regra fica em src/utils/avisosInicio.js (montarAvisos, testada).
--
-- Idempotente. Rodar manualmente no SQL Editor do Supabase.

ALTER TABLE lf_config ADD COLUMN IF NOT EXISTS avisos_dispensados jsonb DEFAULT '{}';

COMMENT ON COLUMN lf_config.avisos_dispensados IS
  'Dispensa dos avisos do Início: meta_batida (YYYY-MM), conta (lista pagar:ID/receber:ID), estoque ({ids, em}). Ver src/utils/avisosInicio.js.';
