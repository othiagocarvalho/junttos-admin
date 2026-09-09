-- ============================================================================
-- Catálogo público novo (CatalogoPublicoV2) — campos e população inicial
--
-- Spec: docs/CATALOGO_SPEC.md
-- Branch: staging · gerado em 2026-08-20 · NÃO EXECUTADO ainda
--
-- Este arquivo é ADITIVO: só adiciona colunas com DEFAULT seguro e preenche
-- campos que hoje estão vazios. Nenhum DROP, nenhum ALTER de coluna existente,
-- nenhuma linha apagada. Rodar duas vezes é inofensivo (tudo é IF NOT EXISTS /
-- guardado por WHERE).
--
-- ─── Contexto de dados levantado no banco (2026-08-20) ─────────────────────
--   · 13 lojas em lf_config · 466 produtos em lf_produtos
--   · UMA única loja tem produtos publicados no catálogo público hoje:
--       tropicaleatacado — 37 produtos ativos com disponivel_catalogo_b2b = true,
--       todos com 1 foto. Os 37 aparecem: desde 20/08/2026
--       produtoVisivelNoCatalogo só exige foto, e os 13 que não têm variação
--       cadastrada entram como peça sem cor (célula única "Quantidade").
--   · Todas as outras 12 lojas têm 0 produtos com disponivel_catalogo_b2b.
--   · lf_produtos.categoria já existe, mas está NULL nos 37 do catálogo.
--   · variacoes[] usa a chave "cor" com nome de cor livre; NENHUM produto
--     publicado tem dimensão de tamanho. Daí tamanhos = ["Único"] para todos.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) lf_config — campos de loja que a spec exige e o banco não tem
--
-- Prefixo catalogo_ em tudo que é exclusivo do catálogo público, para não
-- disputar nome com as colunas do painel. A exceção é whatsapp_loja: esse
-- nome já é lido (e hoje sempre devolve undefined) por CatalogoPublico.jsx e
-- por EtapaConfirmado — criar a coluna com esse nome conserta a referência
-- morta em vez de criar uma segunda fonte de verdade para o mesmo dado.
--
-- Não entram aqui, porque JÁ EXISTEM e são reaproveitados:
--   nome, logo_url, pedido_minimo_tipo, pedido_minimo_valor, pedido_minimo_qtd
-- ─────────────────────────────────────────────────────────────────────────────

-- whatsapp_loja já foi criada à mão no Supabase em 20/08/2026 e preenchida
-- para a tropicaleatacado (5591980669061); o IF NOT EXISTS abaixo é no-op.
ALTER TABLE lf_config
  ADD COLUMN IF NOT EXISTS whatsapp_loja              text,
  ADD COLUMN IF NOT EXISTS catalogo_subtitulo         text    NOT NULL DEFAULT 'Catálogo online',
  ADD COLUMN IF NOT EXISTS catalogo_publico           text    NOT NULL DEFAULT 'feminino',
  ADD COLUMN IF NOT EXISTS catalogo_modo_venda        text    NOT NULL DEFAULT 'atacado',
  ADD COLUMN IF NOT EXISTS catalogo_checkout_online   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS catalogo_texto_envio       text    NOT NULL DEFAULT 'Enviamos para todo o Brasil.',
  ADD COLUMN IF NOT EXISTS catalogo_video_topo        jsonb   NOT NULL DEFAULT
    '{"ativo": false, "videoUrl": "", "imagemUrl": "", "etiqueta": "Coleção nova", "titulo": ""}'::jsonb,
  ADD COLUMN IF NOT EXISTS catalogo_apresentacao      jsonb   NOT NULL DEFAULT
    '{"etiqueta": "", "titulo": "", "descricao": ""}'::jsonb;

-- whatsapp_loja fica NULL de propósito: número errado manda o pedido do
-- cliente para o vazio. Enquanto for NULL o front esconde os botões verdes
-- (não mostra botão que não funciona) — ver CatalogoPublicoV2.jsx.

-- Domínio dos enums. Só valida o que entra daqui pra frente; como as colunas
-- nascem com DEFAULT válido, nenhuma linha existente viola a constraint.
ALTER TABLE lf_config DROP CONSTRAINT IF EXISTS lf_config_catalogo_publico_chk;
ALTER TABLE lf_config ADD  CONSTRAINT lf_config_catalogo_publico_chk
  CHECK (catalogo_publico IN ('feminino', 'masculino', 'unissex'));

ALTER TABLE lf_config DROP CONSTRAINT IF EXISTS lf_config_catalogo_modo_venda_chk;
ALTER TABLE lf_config ADD  CONSTRAINT lf_config_catalogo_modo_venda_chk
  CHECK (catalogo_modo_venda IN ('atacado', 'varejo'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) lf_produtos — campos de produto que a spec exige
--
-- Não entram aqui, porque JÁ EXISTEM:
--   id, nome, preco_venda (= `preco`), categoria, fotos, ativo,
--   variacoes (fonte de onde cores[] é derivado), disponivel_catalogo_b2b
--
-- tamanhos nasce com ["Único"]: é o default correto para 100% do catálogo
-- atual e mantém o produto novo coerente sem ninguém precisar preencher nada.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE lf_produtos
  ADD COLUMN IF NOT EXISTS selo     text  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cores    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tamanhos jsonb NOT NULL DEFAULT '["Único"]'::jsonb;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) RLS — confirmação
--
-- RLS no Postgres é por TABELA, não por coluna: coluna nova entra
-- automaticamente no mesmo regime da tabela. As duas tabelas já nascem com
-- RLS desligada em supabase/loja_feminina.sql (linhas 79-80); as linhas
-- abaixo são idempotentes e só garantem o estado — o catálogo é público e é
-- lido com a chave anon, então RLS ligada deixaria a vitrine vazia.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE lf_config   DISABLE ROW LEVEL SECURITY;
ALTER TABLE lf_produtos DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Funções auxiliares
--
-- São espelho fiel de src/utils/coresProduto.js e src/utils/categoriaProduto.js.
-- Existem para o front NÃO precisar de migração para funcionar: o componente
-- deriva a mesma coisa em memória quando a coluna está vazia. Se a lógica
-- mudar de um lado, mudar do outro (mesma convenção já usada por
-- VALORES_PLANO / contrato-pdf.ts).
-- ─────────────────────────────────────────────────────────────────────────────

-- "ROSA BEBÊ" → "rosa bebe". Sem depender da extensão unaccent (que não está
-- habilitada neste projeto): translate() cobre o alfabeto português.
CREATE OR REPLACE FUNCTION lf_normalizar_texto(p_txt text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(
    lower(translate(
      COALESCE(p_txt, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
    )),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

-- Nome livre de cor → hex. Vence a cor que aparece MAIS CEDO no texto; em
-- empate de posição, a frase mais longa (para "rosa pink" ganhar de "rosa").
-- Nome que não casa com nada devolve o cinza neutro #B7B2A6.
CREATE OR REPLACE FUNCTION lf_cor_para_hex(p_nome text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_alvo     text;
  v_melhor   text := NULL;
  v_pos_min  int  := NULL;
  v_len_max  int  := 0;
  v_pos      int;
  r          record;
BEGIN
  v_alvo := lf_normalizar_texto(p_nome);
  IF v_alvo = '' THEN RETURN '#B7B2A6'; END IF;
  -- Espaços nas pontas: casa palavra inteira, para "off" não achar "coffee".
  v_alvo := ' ' || v_alvo || ' ';

  FOR r IN SELECT * FROM (VALUES
    ('preto', '#1A1A1A'),
    ('preta', '#1A1A1A'),
    ('branco', '#FFFFFF'),
    ('branca', '#FFFFFF'),
    ('off white', '#F2EDE3'),
    ('off', '#F2EDE3'),
    ('creme', '#F0E6D2'),
    ('marfim', '#F5F0E1'),
    ('cinza', '#9AA0A6'),
    ('grafite', '#4A4F55'),
    ('prata', '#C0C0C0'),
    ('dourado', '#C9A227'),
    ('bege claro', '#E6D9C0'),
    ('bege escuro', '#C4AC85'),
    ('bege', '#D9C7A9'),
    ('nude', '#DFC3AC'),
    ('areia', '#DCCBA8'),
    ('caramelo', '#B5762F'),
    ('marrom cafe', '#4B3226'),
    ('marrom', '#6B4423'),
    ('cafe', '#4B3226'),
    ('chocolate', '#4B3226'),
    ('terracota', '#B85C38'),
    ('terra cota', '#B85C38'),
    ('vermelho', '#C62828'),
    ('vermelha', '#C62828'),
    ('vinho', '#6E1A2B'),
    ('bordo', '#6E1A2B'),
    ('marsala', '#7B2E3A'),
    ('marsalla', '#7B2E3A'),
    ('coral', '#F4613A'),
    ('salmao', '#F08A7A'),
    ('rosa pink', '#E8317B'),
    ('pink', '#E8317B'),
    ('rosa bebe', '#F7C8DA'),
    ('rosa baby', '#F7C8DA'),
    ('rosa bb', '#F7C8DA'),
    ('rosa', '#F49FC0'),
    ('rose', '#C98B8B'),
    ('laranja', '#F07622'),
    ('mostarda', '#D6A419'),
    ('amarelo', '#F2C230'),
    ('amarela', '#F2C230'),
    ('verde militar', '#4B5320'),
    ('verde musgo', '#5A6B3B'),
    ('verde oliva', '#6B7A3A'),
    ('oliva', '#6B7A3A'),
    ('verde', '#2E9E5B'),
    ('turquesa', '#1FBFB8'),
    ('azul marinho', '#1B2A5B'),
    ('azul royal', '#1F4FCC'),
    ('azul piscina', '#4FC3E8'),
    ('azul petroleo', '#12626B'),
    ('azul escuro', '#16336B'),
    ('azul bebe', '#A9D2F0'),
    ('azul bb', '#A9D2F0'),
    ('azul claro', '#8EC5F0'),
    ('azul', '#2563C9'),
    ('lilas', '#B79CE0'),
    ('lavanda', '#C3B1E1'),
    ('roxo', '#6B3FA0'),
    ('uva', '#5B2A63'),
    ('acai', '#4A2358')
  ) AS t(frase, hex)
  LOOP
    v_pos := position(' ' || r.frase || ' ' IN v_alvo);
    IF v_pos > 0 AND (
         v_pos_min IS NULL
         OR v_pos < v_pos_min
         OR (v_pos = v_pos_min AND length(r.frase) > v_len_max)
       ) THEN
      v_pos_min := v_pos;
      v_len_max := length(r.frase);
      v_melhor  := r.hex;
    END IF;
  END LOOP;

  RETURN COALESCE(v_melhor, '#B7B2A6');
END;
$$;

-- Categoria derivada do nome do produto — espelho de derivarCategoria().
-- "CJ. DE SAIA LONGA GRINGA VANESSA" → "Saias" (CJ. e DE são ignorados).
CREATE OR REPLACE FUNCTION lf_categoria_do_nome(p_nome text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_sem_prefixo text;
  v_palavras    text[];
  v_p           text;
  v_escolhida   text := NULL;
  v_limpo       text;
  v_base        text;
BEGIN
  -- Prefixo de marcação ("Demo - ", "PROMO: ") é etiqueta, não categoria.
  v_sem_prefixo := regexp_replace(COALESCE(p_nome, ''), '^\S{1,12}\s*[-–—|:]\s+', '');
  IF trim(v_sem_prefixo) = '' THEN v_sem_prefixo := COALESCE(p_nome, ''); END IF;

  v_palavras := regexp_split_to_array(trim(v_sem_prefixo), '\s+');
  IF v_palavras IS NULL OR array_length(v_palavras, 1) IS NULL OR v_palavras[1] = '' THEN
    RETURN NULL;
  END IF;

  -- Primeira palavra que sirva como categoria.
  FOREACH v_p IN ARRAY v_palavras LOOP
    v_limpo := lf_normalizar_texto(replace(replace(v_p, '.', ''), ',', ''));
    CONTINUE WHEN v_limpo = '';                       -- vazia
    CONTINUE WHEN v_limpo IN ('cj','cjt','conj','kit'); -- sigla de conjunto
    CONTINUE WHEN v_limpo ~ '^\d+$';                  -- número
    CONTINUE WHEN length(v_limpo) <= 3;               -- curta demais
    CONTINUE WHEN v_p LIKE '%.';                      -- abreviada ("REF.")
    v_escolhida := v_p;
    EXIT;
  END LOOP;

  -- Nenhuma serviu: usa a primeira mesmo — melhor categoria estranha do que
  -- produto sem categoria nenhuma.
  v_escolhida := replace(replace(COALESCE(v_escolhida, v_palavras[1]), '.', ''), ',', '');
  v_base := upper(left(v_escolhida, 1)) || lower(substr(v_escolhida, 2));

  -- Plural pt-BR: o ingênuo (+'s') gerava "Macacãos" e "Cordãos".
  RETURN CASE
    WHEN lower(v_base) ~ 's$'    THEN v_base
    WHEN lower(v_base) ~ 'ão$'   THEN left(v_base, length(v_base) - 2) || 'ões'
    WHEN lower(v_base) ~ 'm$'    THEN left(v_base, length(v_base) - 1) || 'ns'
    WHEN lower(v_base) ~ 'l$'    THEN left(v_base, length(v_base) - 1) || 'is'
    WHEN lower(v_base) ~ '[rz]$' THEN v_base || 'es'
    ELSE v_base || 's'
  END;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) População inicial
--
-- Todo UPDATE é guardado por WHERE que só pega linha ainda não preenchida.
-- Rodar de novo não sobrescreve nada que a lojista tenha ajustado depois.
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1 cores[] — derivado de variacoes[].cor, preservando o nome exatamente
-- como está cadastrado (é o nome que aparece no pedido do WhatsApp e que a
-- lojista reconhece na hora de separar a peça). Duplicata de nome é removida
-- pela forma normalizada, mantendo a primeira ocorrência e a ordem original.
UPDATE lf_produtos p
SET cores = COALESCE((
  SELECT jsonb_agg(jsonb_build_object('nome', v.nome, 'hex', lf_cor_para_hex(v.nome)) ORDER BY v.ord)
  FROM (
    SELECT DISTINCT ON (lf_normalizar_texto(COALESCE(e.elem->>'cor', e.elem->>'tamanho')))
           COALESCE(e.elem->>'cor', e.elem->>'tamanho') AS nome,
           e.ord
    FROM jsonb_array_elements(p.variacoes) WITH ORDINALITY AS e(elem, ord)
    WHERE COALESCE(e.elem->>'cor', e.elem->>'tamanho') IS NOT NULL
      AND COALESCE(e.elem->>'cor', e.elem->>'tamanho') <> ''
    ORDER BY lf_normalizar_texto(COALESCE(e.elem->>'cor', e.elem->>'tamanho')), e.ord
  ) v
), '[]'::jsonb)
WHERE jsonb_typeof(p.variacoes) = 'array'
  AND p.cores = '[]'::jsonb;

-- 5.2 tamanhos[] — ["Único"] em TODO produto.
--
-- Decisão deliberada, divergindo da seção 2.2 da spec ("herda a grade padrão
-- da loja"): nenhum produto publicado no catálogo tem dimensão de tamanho —
-- variacoes[] só carrega cor + quantidade. Herdar P/M/G/GG criaria tamanho
-- que a loja não tem e pedido que ela não consegue separar. Sem seletor de
-- tamanho, portanto, até existir cadastro de tamanho de verdade.
--
-- O ADD COLUMN acima já preenche as linhas existentes com o DEFAULT; este
-- UPDATE só cobre linha que tenha ficado com valor inválido.
UPDATE lf_produtos
SET tamanhos = '["Único"]'::jsonb
WHERE tamanhos IS NULL
   OR jsonb_typeof(tamanhos) <> 'array'
   OR jsonb_array_length(tamanhos) = 0;

-- 5.3 categoria — obrigatória na spec (alimenta os chips de filtro) e hoje
-- NULL nos 37 produtos do catálogo.
--
-- Escopo restrito de propósito aos produtos que estão de fato no catálogo
-- público: categoria também é exibida e editada no painel do lojista
-- (cliente/EstoquePage.jsx), então preencher os 429 produtos das outras 12
-- lojas mudaria a tela delas sem ninguém ter pedido.
--
-- O front não depende deste UPDATE: CatalogoPublicoV2 deriva a categoria em
-- memória quando a coluna está vazia. Este UPDATE existe para a lojista poder
-- ajustar o texto depois e o ajuste ficar salvo.
UPDATE lf_produtos
SET categoria = lf_categoria_do_nome(nome)
WHERE (categoria IS NULL OR trim(categoria) = '')
  AND ativo = true
  AND disponivel_catalogo_b2b = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Conferência — rodar depois e comparar com o esperado
-- ─────────────────────────────────────────────────────────────────────────────

-- 6.1 RLS deve estar desligada nas duas tabelas (esperado: rls_ativa = false).
--     Coluna nova herda o regime da tabela; não existe RLS por coluna.
SELECT relname AS tabela, relrowsecurity AS rls_ativa, relforcerowsecurity AS rls_forcada
FROM   pg_class
WHERE  relname IN ('lf_config', 'lf_produtos');

-- 6.2 Colunas novas presentes (esperado: 11 linhas).
SELECT table_name, column_name, data_type, column_default
FROM   information_schema.columns
WHERE  (table_name = 'lf_config'   AND column_name IN
         ('whatsapp_loja','catalogo_subtitulo','catalogo_publico','catalogo_modo_venda',
          'catalogo_checkout_online','catalogo_texto_envio','catalogo_video_topo','catalogo_apresentacao'))
   OR  (table_name = 'lf_produtos' AND column_name IN ('selo','cores','tamanhos'))
ORDER BY table_name, column_name;

-- 6.3 Produtos do catálogo: esperado 37 linhas, todas com tamanhos = ["Único"],
--     categoria preenchida, e cores[] com 0 ou 2-3 itens.
SELECT nome, categoria, tamanhos, jsonb_array_length(cores) AS n_cores, cores
FROM   lf_produtos
WHERE  ativo = true AND disponivel_catalogo_b2b = true
ORDER  BY nome;

-- 6.4 Nenhuma cor deveria cair no cinza de fallback nos produtos do catálogo
--     (esperado: 0 linhas). Se aparecer alguma, o nome não é cor — conferir
--     antes de culpar o mapeamento.
SELECT p.nome AS produto, c->>'nome' AS cor_sem_hex
FROM   lf_produtos p, jsonb_array_elements(p.cores) c
WHERE  p.ativo = true AND p.disponivel_catalogo_b2b = true
  AND  c->>'hex' = '#B7B2A6'
ORDER  BY 1;

-- 6.5 Distribuição das categorias derivadas.
--     Esperado (tropicaleatacado, 37 produtos):
--       Vestidos 15 · Conjuntos 9 · Longos 7 · Saias 3 · Macaquinhos 2 · Pantalonas 1
SELECT categoria, count(*) AS produtos
FROM   lf_produtos
WHERE  ativo = true AND disponivel_catalogo_b2b = true
GROUP  BY categoria
ORDER  BY produtos DESC, categoria;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Rollback
--
-- As colunas são aditivas: derrubá-las devolve o banco ao estado anterior sem
-- perder nada que existisse antes. A exceção é lf_produtos.categoria, que já
-- existia — o UPDATE 5.3 preencheu 37 linhas que estavam NULL. Para desfazer
-- só essa parte, rodar o UPDATE de baixo ANTES dos DROPs.
--
-- UPDATE lf_produtos SET categoria = NULL
-- WHERE ativo = true AND disponivel_catalogo_b2b = true;
--
-- ALTER TABLE lf_produtos DROP COLUMN IF EXISTS selo, DROP COLUMN IF EXISTS cores, DROP COLUMN IF EXISTS tamanhos;
-- ALTER TABLE lf_config
--   DROP COLUMN IF EXISTS whatsapp_loja,            DROP COLUMN IF EXISTS catalogo_subtitulo,
--   DROP COLUMN IF EXISTS catalogo_publico,         DROP COLUMN IF EXISTS catalogo_modo_venda,
--   DROP COLUMN IF EXISTS catalogo_checkout_online, DROP COLUMN IF EXISTS catalogo_texto_envio,
--   DROP COLUMN IF EXISTS catalogo_video_topo,      DROP COLUMN IF EXISTS catalogo_apresentacao;
-- DROP FUNCTION IF EXISTS lf_categoria_do_nome(text);
-- DROP FUNCTION IF EXISTS lf_cor_para_hex(text);
-- DROP FUNCTION IF EXISTS lf_normalizar_texto(text);
