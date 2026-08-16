-- Migration: base do addon de NFC-e (Fase 1 — SEM integração com provedor)
-- Execute no Supabase Dashboard > SQL Editor.
--
-- Contexto: NFC-e é addon pago à parte dos planos (como o WhatsApp), ainda
-- sem provedor escolhido (Focus NFe vs Geranet NFe). Esta migration só
-- prepara o terreno: colunas fiscais em lf_produtos/lf_config, a feature
-- flag features.nfce_ativo (desligada em todas as lojas até o lojista
-- contratar o addon) e o bucket privado para o certificado digital A1.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) lf_produtos — NCM e CFOP por produto

ALTER TABLE lf_produtos
  ADD COLUMN IF NOT EXISTS ncm  text,
  ADD COLUMN IF NOT EXISTS cfop text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) lf_config — dados fiscais da loja
--
-- regime_tributario fica NULL até o lojista preencher (não assumir Simples
-- Nacional por padrão, mesmo sendo o caso da maioria das lojas hoje).
-- certificado_a1_path guarda só o caminho do arquivo no Storage — o .pfx/.p12
-- em si vai pro bucket privado (seção 4), nunca numa coluna de tabela.

ALTER TABLE lf_config
  ADD COLUMN IF NOT EXISTS inscricao_estadual     text,
  ADD COLUMN IF NOT EXISTS regime_tributario      text,
  ADD COLUMN IF NOT EXISTS cnae                   text,
  ADD COLUMN IF NOT EXISTS certificado_a1_path    text,
  ADD COLUMN IF NOT EXISTS certificado_a1_validade date;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Feature flag: features.nfce_ativo
--
-- Diferente de features.catalogo_b2b (que é por plano — ver
-- migration_clientes_endereco.sql), nfce_ativo é addon pago avulso: não tem
-- relação com o plano da loja. Começa false em todas as lojas e é ligado
-- individualmente pelo admin Junttos quando o lojista contrata o addon
-- (ainda sem tela de admin para isso — por enquanto, UPDATE manual).

UPDATE lf_config
   SET features   = features || '{"nfce_ativo": false}'::jsonb,
       updated_at = now()
 WHERE features->'nfce_ativo' IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Bucket privado "certificados-fiscais" — certificado digital A1
--
-- Certificado digital é dado sensível: o bucket precisa ser privado (public
-- = false) e sem policy de leitura anônima. Duas formas de criar, escolha
-- uma:
--
--   a) Dashboard > Storage > New bucket > nome "certificados-fiscais",
--      marcar "Public bucket" como DESLIGADO.
--
--   b) Ou rodar o insert abaixo aqui no SQL Editor:

insert into storage.buckets (id, name, public)
values ('certificados-fiscais', 'certificados-fiscais', false)
on conflict (id) do nothing;

-- Bucket privado sem nenhuma policy em storage.objects fica inacessível até
-- para o dono (só a service_role, que ignora RLS, enxergaria algo). Para o
-- lojista autenticado conseguir enviar/ler o próprio certificado — e nunca o
-- de outra loja — as policies abaixo restringem por pasta: cada arquivo deve
-- ser salvo em `certificados-fiscais/{loja_id}/arquivo.pfx`, e o loja_id da
-- pasta precisa bater com o app_metadata.loja_id do JWT (mesmo claim que
-- ClientPrivateRoute já usa em src/context/ClientAuthContext.jsx).

create policy "certificados_fiscais_select_own_loja"
on storage.objects for select
to authenticated
using (
  bucket_id = 'certificados-fiscais'
  and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'loja_id')
);

create policy "certificados_fiscais_insert_own_loja"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'certificados-fiscais'
  and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'loja_id')
);

create policy "certificados_fiscais_update_own_loja"
on storage.objects for update
to authenticated
using (
  bucket_id = 'certificados-fiscais'
  and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'loja_id')
);

create policy "certificados_fiscais_delete_own_loja"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'certificados-fiscais'
  and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'loja_id')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Conferência

-- 1) Colunas novas em lf_produtos e lf_config:
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'lf_produtos' AND column_name IN ('ncm','cfop');
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'lf_config'
--    AND column_name IN ('inscricao_estadual','regime_tributario','cnae',
--                        'certificado_a1_path','certificado_a1_validade');

-- 2) nfce_ativo deve vir false em todas as lojas:
-- SELECT loja_id, features->'nfce_ativo' AS nfce_ativo FROM lf_config ORDER BY loja_id;

-- 3) Bucket criado e privado:
-- SELECT id, public FROM storage.buckets WHERE id = 'certificados-fiscais';
