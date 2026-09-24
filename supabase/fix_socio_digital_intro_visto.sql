-- Sócio Digital — aviso "Conheça seu Sócio Digital" no banner.
--
-- Marca se a lojista já abriu a tela do Sócio Digital (onde fica a
-- introdução em primeira pessoa). Enquanto for false/NULL — ou enquanto esta
-- coluna não existir — o banner mostra o aviso para lojas Pro/Business que
-- ainda não têm nenhum relatório em lf_socio_relatorios.
-- O front grava true ao abrir a tela (ver marcarSocioIntroVisto em
-- LojaFeminina/index.jsx e ClientDashboardDesktop.jsx).
--
-- Idempotente. Rodar manualmente no SQL Editor do Supabase.

ALTER TABLE lf_config ADD COLUMN IF NOT EXISTS socio_intro_visto boolean DEFAULT false;
