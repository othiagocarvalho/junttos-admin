-- ─────────────────────────────────────────────────────────────────────────────
-- Policies de storage.objects para os buckets `produtos-fotos` e
-- `produtos-videos`.
--
-- NÃO FOI EXECUTADO. Rode manualmente no SQL Editor depois de conferir o
-- diagnóstico abaixo — este arquivo é DDL e ficou fora de qualquer execução
-- automática de propósito.
--
-- ─── CONTEXTO ───────────────────────────────────────────────────────────────
-- Sintoma: no painel da TropicaleAtacado, "Adicionar mais fotos" + "Salvar"
-- falha em POST /storage/v1/object/produtos-fotos/... com a mensagem
-- "new row violates row-level security policy".
--
-- ─── MEDIDO EM 23/08/2026, CONTRA O PROJETO ─────────────────────────────────
-- Corrigindo o que este arquivo dizia antes: o status HTTP é 400, não 403. O
-- 403 aparece DENTRO do corpo. Um upload com a anon key devolve:
--
--   HTTP 400
--   {"statusCode":"403","error":"Unauthorized",
--    "message":"new row violates row-level security policy","code":"AccessDenied"}
--
-- Isso importa para quem for conferir: o relato original trazia "401 e 400" do
-- console, e o 400 É esta recusa de RLS — não é um erro separado de formato ou
-- de tamanho de arquivo. O 401 é outra coisa (token recusado) e foi tratado no
-- app, em ProdutosB2BPro.jsx.
--
-- Também confirmado: os buckets EXISTEM e são públicos para leitura. Um GET em
-- /storage/v1/object/public/produtos-fotos/<inexistente> devolve
-- "Object not found" / NoSuchKey — e não "Bucket not found". Ou seja, falta a
-- policy de ESCRITA, não o bucket.
--
-- O lado do app foi auditado e está correto:
--   • bucket no código = 'produtos-fotos' (idêntico ao de produção — as fotos
--     já existentes estão em produtos-fotos/tropicaleatacado/NN.jpg);
--   • o client é o mesmo `src/lib/supabase.js` em que ClientAuthContext faz o
--     login da lojista (não é um client anônimo nem paralelo);
--   • o path é `tropicaleatacado/...`, e lf_config confirma
--     loja_id = slug = 'tropicaleatacado', igual ao app_metadata.loja_id do JWT.
--
-- As 37 fotos que já estão no bucket foram enviadas por
-- scripts/importarFotosTropicale.js, que usa a SERVICE KEY e portanto IGNORA
-- RLS. Ou seja: o caminho autenticado do navegador pode nunca ter funcionado
-- neste bucket.
--
-- ─── ANTES DE RODAR: confirme o que existe hoje ─────────────────────────────
-- Rode primeiro este SELECT. Se ele voltar VAZIO para 'produtos-fotos', a
-- causa do 403 é ausência de policy e o bloco abaixo resolve.
--
--   select p.polname,
--          p.polcmd,
--          p.polpermissive,
--          pg_get_expr(p.polqual,      p.polrelid) as using_expr,
--          pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
--     from pg_policy p
--    where p.polrelid = 'storage.objects'::regclass
--      and (pg_get_expr(p.polqual,      p.polrelid) ilike '%produtos-fotos%'
--        or pg_get_expr(p.polwithcheck, p.polrelid) ilike '%produtos-fotos%');
--
-- Confira em with_check_expr que a comparação é com
-- `auth.jwt() -> 'app_metadata' ->> 'loja_id'`. Uma policy que compare com
-- `auth.uid()`, com `user_metadata` ou com um bucket escrito diferente produz
-- exatamente o mesmo 403 e a mesma mensagem.
-- ─────────────────────────────────────────────────────────────────────────────

-- Buckets (públicos para leitura: o catálogo mostra as fotos sem login, e as
-- URLs gravadas em lf_produtos.fotos já são /object/public/...).
insert into storage.buckets (id, name, public)
values ('produtos-fotos', 'produtos-fotos', true),
       ('produtos-videos', 'produtos-videos', true)
on conflict (id) do nothing;

-- Mesmo desenho de supabase/migration_fiscal.sql: cada arquivo mora em
-- {bucket}/{loja_id}/..., e a primeira pasta precisa bater com o loja_id do
-- JWT. É o que impede uma loja de escrever na pasta de outra.
do $$
declare
  b text;
begin
  foreach b in array array['produtos-fotos', 'produtos-videos'] loop

    execute format($f$
      drop policy if exists %I on storage.objects
    $f$, b || '_insert_own_loja');

    execute format($f$
      create policy %I on storage.objects for insert to authenticated
      with check (
        bucket_id = %L
        and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'loja_id')
      )
    $f$, b || '_insert_own_loja', b);

    -- upload() é chamado com upsert:true; reenviar o mesmo path exige UPDATE.
    execute format($f$
      drop policy if exists %I on storage.objects
    $f$, b || '_update_own_loja');

    execute format($f$
      create policy %I on storage.objects for update to authenticated
      using (
        bucket_id = %L
        and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'loja_id')
      )
      with check (
        bucket_id = %L
        and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'loja_id')
      )
    $f$, b || '_update_own_loja', b, b);

    execute format($f$
      drop policy if exists %I on storage.objects
    $f$, b || '_delete_own_loja');

    execute format($f$
      create policy %I on storage.objects for delete to authenticated
      using (
        bucket_id = %L
        and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'loja_id')
      )
    $f$, b || '_delete_own_loja', b);

    -- Leitura pública: o catálogo B2B é aberto, sem login.
    execute format($f$
      drop policy if exists %I on storage.objects
    $f$, b || '_select_public');

    execute format($f$
      create policy %I on storage.objects for select to public
      using (bucket_id = %L)
    $f$, b || '_select_public', b);

  end loop;
end $$;
