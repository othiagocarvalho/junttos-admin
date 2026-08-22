-- ─────────────────────────────────────────────────────────────────────────────
-- lf_pedidos: quem está LOGADO também precisa conseguir fazer pedido pelo
-- catálogo público.
--
-- ⚠️ NÃO FOI EXECUTADO. É DDL de RLS em produção: rode manualmente no SQL
--    Editor, depois de ler a seção "ANTES DE RODAR" no fim do arquivo.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- O SINTOMA
--
--   Failed to load resource: 403  →  .../lf_pedidos?select=id
--   [catalogo] não foi possível registrar o pedido
--   [catalogo] Pix dinâmico indisponível, usando copia-e-cola: pedido não
--              registrado
--
-- O diagnóstico inicial foi "falta policy de INSERT para anon". Medido contra
-- o projeto em 23/08/2026 com a anon key, isso NÃO se confirmou: o INSERT
-- anônimo funciona. Estes dois foram gravados pela anon key, HTTP 201, com o
-- payload idêntico ao que CatalogoPublicoV2.registrarPedido monta:
--
--   loja demo 'sualoja'      → 201
--   'tropicaleatacado'       → 201
--
-- E havia 4 pedidos reais de clientes com menos de 6h de vida na tabela no
-- momento do diagnóstico. O caminho anônimo está de pé.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- A CAUSA REAL: o pedido não estava saindo como `anon`, e sim como
-- `authenticated`.
--
-- 1. O catálogo público NÃO tem client próprio. CatalogoPublicoV2.jsx:26 faz
--    `import { supabase } from '../../lib/supabase'` — o MESMO client do
--    painel, criado sem opções, portanto com persistSession ligado. Se o
--    navegador tiver sessão do Supabase para usejunttos.vercel.app (a lojista
--    conferindo o próprio catálogo, ou qualquer pessoa que tenha logado no
--    painel naquele navegador), toda requisição do catálogo vai com
--    `Authorization: Bearer <JWT do usuário>` e o PostgREST assume o papel
--    `authenticated`.
--
-- 2. migration_rls_pedidos.sql concedeu a `authenticated` apenas:
--
--        grant select, update on public.lf_pedidos to authenticated;
--
--    Sem INSERT. E as duas policies de INSERT que existem
--    ("pedidos_insert_publico", da migration original e depois substituída
--    por migration_pedidos_contato_obrigatorio.sql) são ambas `to anon`.
--    Policy só vale para o papel listado — nenhuma delas alcança
--    `authenticated`.
--
--    Resultado: usuário logado = zero privilégio de INSERT em lf_pedidos.
--
-- 3. O CÓDIGO HTTP fecha a prova. Todas as negativas medidas com a anon key
--    voltaram 401; a que o Daniel capturou é 403. O PostgREST devolve 401
--    para erro 42501 quando o papel é o anônimo e 403 quando há JWT de
--    usuário de verdade. O 403 do console só é possível vindo de uma sessão
--    autenticada.
--
-- Efeito prático: cliente comum (deslogado) consegue pedir; a lojista testando
-- o próprio catálogo, não. Como quem reporta bug de catálogo é justamente
-- quem está logado no painel, o sintoma parecia total.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- O QUE ESTA MIGRATION FAZ — E O QUE ELA NÃO FAZ
--
--   FAZ    concede INSERT a `authenticated` nas MESMAS colunas do anon, e
--          cria uma policy de INSERT para `authenticated` com a MESMA
--          condição do anon.
--
--   NÃO FAZ  não encosta em nenhuma policy existente. As de anon estão
--            corretas e em produção; recriá-las só criaria risco de
--            enfraquecê-las por engano.
--   NÃO FAZ  não abre UPDATE. "pedidos_update_own_loja" continua exatamente
--            como está: authenticated só altera pedido da própria loja. O
--            buraco de marcar pedido como pago pelo PostgREST, fechado em
--            migration_rls_pedidos.sql, continua fechado.
--   NÃO FAZ  não concede DELETE a ninguém.
--   NÃO FAZ  não amplia a leitura. Ver a nota sobre o `.select('id')` no fim.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── Privilégio de coluna ────────────────────────────────────────────────────
-- Lista IDÊNTICA à concedida ao anon em migration_rls_pedidos.sql. As
-- ausências são de propósito e continuam valendo:
--   • mp_payment_id      deixar o público gravar isso permitiria apontar um
--                        pedido falso para um pagamento real e confundir o
--                        mp-webhook, que localiza o pedido por esse campo;
--   • comprovante_url    campo de controle do fluxo de pagamento;
--   • created_at / id    ficam com o default do banco.
grant insert (loja_id, cliente_nome, cliente_whatsapp, produtos,
              valor_total, status, forma_pagamento, observacoes)
  on public.lf_pedidos to authenticated;

-- ── Policy de INSERT para quem está logado ──────────────────────────────────
-- Policy separada, e não um "to anon, authenticated" na existente, por dois
-- motivos: (1) não mexer no que está funcionando em produção; (2) se um dia
-- as regras precisarem divergir, elas já estão separadas.
--
-- A condição é cópia literal da policy de anon em vigor (a de
-- migration_pedidos_contato_obrigatorio.sql, confirmada viva por teste: nome
-- de 1 letra, WhatsApp de 9 dígitos e contato vazio foram todos recusados).
-- Se as duas divergirem, o catálogo passa a se comportar diferente para quem
-- está logado — elas precisam andar juntas.
drop policy if exists "pedidos_insert_publico_autenticado" on public.lf_pedidos;
create policy "pedidos_insert_publico_autenticado"
on public.lf_pedidos for insert
to authenticated
with check (
  -- Um pedido não nasce pago. 'pago' só entra pelo mp-webhook, que roda com
  -- service_role e ignora RLS.
  status in ('aguardando_contato', 'aguardando_pagamento')

  -- Loja precisa existir. Note que NÃO é "a loja do JWT": uma lojista logada
  -- comprando no catálogo de outra loja é caso legítimo, e amarrar ao próprio
  -- loja_id quebraria justamente isso.
  and exists (select 1 from public.lf_config c where c.loja_id = lf_pedidos.loja_id)

  and valor_total >= 0

  -- Contato de verdade, espelhando src/utils/catalogoV2.js (nomeValido e
  -- whatsappValido).
  and cliente_nome is not null
  and length(btrim(cliente_nome)) >= 2

  and cliente_whatsapp is not null
  -- 10 dígitos = fixo com DDD, 11 = celular com DDD. A máscara é irrelevante:
  -- tudo que não é dígito sai antes da contagem.
  and length(regexp_replace(cliente_whatsapp, '\D', '', 'g')) between 10 and 11
);

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- ANTES DE RODAR
--
-- 1. Confirme o estado atual das policies. O esperado é encontrar as três de
--    hoje (insert/select de anon e select/update de authenticated) e NENHUMA
--    de insert para authenticated:
--
--      select policyname, roles, cmd, qual, with_check
--        from pg_policies
--       where schemaname = 'public' and tablename = 'lf_pedidos'
--       order by cmd, policyname;
--
-- 2. Confirme os privilégios de coluna atuais:
--
--      select grantee, privilege_type, column_name
--        from information_schema.column_privileges
--       where table_schema = 'public' and table_name = 'lf_pedidos'
--         and grantee in ('anon', 'authenticated')
--       order by grantee, privilege_type, column_name;
--
--    O esperado ANTES: `authenticated` aparece com SELECT e UPDATE em todas
--    as colunas, e com nenhum INSERT.
--
-- 3. Se o passo 1 mostrar policies com nomes diferentes dos citados aqui
--    (por exemplo "lf_pedidos_anon_novo", de
--    supabase/migration_rls_catalogo_publico_parte2_pedidos.sql), PARE: quer
--    dizer que outra migration foi aplicada por fora e este diagnóstico
--    precisa ser refeito antes de acrescentar qualquer coisa. Aquele arquivo
--    em particular NÃO deve ser rodado: ele revoga o SELECT do anon, e o
--    checkout depende do `.insert(...).select('id')` para o Pix dinâmico.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DEPOIS DE RODAR
--
-- 1. O caminho anônimo não pode ter mudado. Continua tendo de dar 201:
--
--      curl -i -X POST "$URL/rest/v1/lf_pedidos?select=id" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--        -H "Content-Type: application/json" -H "Prefer: return=representation" \
--        -d '{"loja_id":"sualoja","cliente_nome":"Teste","cliente_whatsapp":"85999990000",
--             "produtos":[],"valor_total":1,"status":"aguardando_contato"}'
--
-- 2. E o caminho logado, que hoje dá 403, tem de passar a dar 201. Faça pelo
--    navegador: entre no painel, abra /tropicaleatacado/catalogo na MESMA
--    aba/perfil, monte um pedido e confirme. Antes desta migration o console
--    mostra o 403 em .../lf_pedidos?select=id; depois, o pedido aparece no
--    painel e o Pix dinâmico gera QR em vez de cair no copia-e-cola.
--
-- 3. O que NÃO pode passar a funcionar — teste de regressão de segurança.
--    Com uma sessão de lojista, um PATCH direto tem de continuar recusado:
--
--      -- pedido de OUTRA loja: recusado pela policy de update
--      curl -i -X PATCH "$URL/rest/v1/lf_pedidos?id=eq.<id-de-outra-loja>" \
--        -H "apikey: $ANON" -H "Authorization: Bearer <JWT-da-lojista>" \
--        -H "Content-Type: application/json" -d '{"status":"pago"}'
--      → esperado: 0 linhas afetadas / 403. NUNCA 204 com a linha alterada.
--
--    E o INSERT continua sem conseguir se declarar pago:
--
--      ... -d '{"loja_id":"tropicaleatacado","status":"pago", ...}'
--      → esperado: 42501, "new row violates row-level security policy".
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LIMITE CONHECIDO: o `.select('id')` pós-insert de quem está logado
--
-- registrarPedido faz `.insert(...).select('id')`. Num INSERT ... RETURNING o
-- Postgres exige que as policies de SELECT aceitem a linha devolvida — e para
-- `authenticated` a policy de leitura é "pedidos_select_own_loja"
-- (loja_id = claim do JWT). Medido em Postgres real (PGlite), com estas
-- migrations aplicadas:
--
--   logado + catálogo da PRÓPRIA loja  + returning id  → grava e devolve o id
--   logado + catálogo de OUTRA loja    + returning id  → 42501, NÃO grava
--   logado + catálogo de OUTRA loja    sem returning   → grava
--
-- Ou seja: o caso relatado (lojista conferindo o próprio catálogo) fica 100%
-- resolvido, Pix dinâmico incluído. Já uma pessoa logada comprando no
-- catálogo de OUTRA loja continua falhando — exatamente como falha hoje, não
-- é regressão, mas também não é resolvido por esta migration.
--
-- A alternativa no banco seria dar a `authenticated` uma policy de SELECT
-- ampla como a do anon ("created_at > now() - interval '6 hours'"). Está
-- DESCARTADA de propósito: `authenticated` tem grant de SELECT em TODAS as
-- colunas, então essa policy deixaria qualquer pessoa logada ler
-- cliente_nome e cliente_whatsapp de todos os pedidos recentes de todas as
-- lojas. Trocar um caso de borda por vazamento de dado pessoal é péssimo
-- negócio.
--
-- Quem resolve o resto é o app, e foi feito junto com esta migration: o
-- catálogo público ganhou um client Supabase próprio, sem sessão
-- (src/lib/supabasePublico.js), então ele passa a falar como `anon` mesmo com
-- alguém logado no navegador. Com esse deploy no ar, nenhum caminho do
-- catálogo depende mais desta migration — ela continua valendo como rede de
-- segurança para quem estiver com o bundle antigo em cache.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LIMPEZA DAS LINHAS DE SONDAGEM
--
-- O diagnóstico gravou 3 pedidos de teste, todos com
-- cliente_nome = 'PROBE RLS CLAUDE'. Não deu para apagá-los pela anon key
-- (anon não tem DELETE, e isso é proposital). Rode se quiser removê-los:
--
--   select id, loja_id, status, created_at from public.lf_pedidos
--    where cliente_nome = 'PROBE RLS CLAUDE';
--
--   -- esperado: 3 linhas
--   --   9ce29c07-c1c7-4dc4-9288-7ebcef50dc49  tropicaleatacado
--   --   726a4520-0240-4d84-b3c0-9ba480e60afe  sualoja (demo)
--   --   aa3226f1-82d4-4d0a-bd2b-cd7da1afe128  sualoja (demo)
--
--   delete from public.lf_pedidos where cliente_nome = 'PROBE RLS CLAUDE';
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
--
--   drop policy if exists "pedidos_insert_publico_autenticado" on public.lf_pedidos;
--   revoke insert on public.lf_pedidos from authenticated;
--
-- Voltar para o estado atual devolve o 403 para quem está logado, e nada mais.
-- ═══════════════════════════════════════════════════════════════════════════
