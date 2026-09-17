-- ─────────────────────────────────────────────────────────────────────────────
-- Aviso fixo no recibo — "Não efetuamos trocas de peças no atacado e/ou
-- promoção" — só para as 4 lojas do grupo do Daniel.
--
-- APLICAR MANUALMENTE NO SQL EDITOR DO SUPABASE. Não é executado
-- automaticamente por este repositório nem por este commit — é o Thiago quem
-- roda, quando decidir ativar.
--
-- ─── ONDE O TEXTO FICA GUARDADO ──────────────────────────────────────────────
-- lf_config.features é jsonb e já guarda flags mistas (`"estoque": true`,
-- `"catalogo_b2b": "pro"`) — não é só booleano. A chave nova, `texto_aviso_recibo`,
-- segue a mesma convenção: string livre, sem coluna nova, sem migration de
-- schema. Ausente = sem aviso (o app lê com `config?.features?.texto_aviso_recibo`,
-- que é undefined quando a chave não existe). Reaproveitável para qualquer
-- aviso fixo futuro, em qualquer loja — não é um booleano amarrado a este
-- texto específico.
--
-- Antes de rodar, confirmado em produção (14/09/2026, via
-- `supabase db query --linked`): as 4 lojas abaixo são exatamente as do
-- rede_id 2ae9e926-d483-4fa8-966c-d120c4e7991c, e NENHUMA loja do sistema
-- (17 no total) tem essa chave hoje — ativação é opt-in, nunca ligada por
-- acidente em produção.
--
-- `||` faz merge raso no jsonb: só a chave nova é adicionada/sobrescrita,
-- todo o resto de features (estoque, catalogo_b2b, etc.) permanece intacto.

UPDATE lf_config
SET features = features || jsonb_build_object(
  'texto_aviso_recibo',
  'Não efetuamos trocas de peças no atacado e/ou promoção'
)
WHERE loja_id IN ('tropicaleatacado', 'atacadaodosvestidos', 'belinha1', 'belinha2');

-- ─────────────────────────────────────────────────────────────────────────────
-- Conferência — rodar depois do UPDATE acima:
--
--   SELECT loja_id, features->>'texto_aviso_recibo' AS aviso_recibo
--     FROM lf_config
--    WHERE loja_id IN ('tropicaleatacado', 'atacadaodosvestidos', 'belinha1', 'belinha2')
--    ORDER BY loja_id;
--
--   → as 4 linhas devem trazer o texto; qualquer outra loja continua NULL:
--
--   SELECT count(*) FROM lf_config WHERE features ? 'texto_aviso_recibo';
--   → deve ser exatamente 4
--
-- ─── DESATIVAR (se precisar reverter) ───────────────────────────────────────
-- `-` remove a chave do jsonb sem tocar em mais nada:
--
--   UPDATE lf_config
--   SET features = features - 'texto_aviso_recibo'
--   WHERE loja_id IN ('tropicaleatacado', 'atacadaodosvestidos', 'belinha1', 'belinha2');
-- ─────────────────────────────────────────────────────────────────────────────
