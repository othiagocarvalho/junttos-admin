# PROGRESS — Redesign visual "Studio" (Junttos Admin)

Execução autônoma, sem supervisão. Este arquivo é atualizado a cada etapa.

## ⚠️ BLOQUEIO CRÍTICO — leia primeiro

**Não foi possível dar `git push` para o repositório remoto nesta sessão, em nenhum momento.**

Diagnóstico (refeito e reconfirmado a pedido do usuário, ao final da sessão):

- `git push` (via `http://local_proxy@127.0.0.1:41729/git/...`, o proxy git desta sessão) retorna sempre `403`, tanto para a branch `claude/wizardly-fermi-96skty` quanto para uma branch nova `claude/redesign-studio-admin` (`git push -u origin HEAD:refs/heads/claude/redesign-studio-admin` → `403`).
- O caminho alternativo via GitHub MCP também falha: `create_branch`/`push_files` retornam `403 Resource not accessible by integration` — para `claude/wizardly-fermi-96skty` e também ao tentar criar `claude/redesign-studio-admin` a partir de `master`.
- Em contraste, toda operação de **leitura** funciona perfeitamente: `git fetch`, `git ls-remote`, `mcp__github__get_me`, `mcp__github__list_branches`.
- Essa combinação (leitura ok, escrita 403 "Resource not accessible by integration" tanto no proxy git quanto na API do GitHub, em branches diferentes) indica que **a integração/GitHub App usada por esta sessão tem permissão somente-leitura neste repositório** — não é um problema de rede, proxy, TLS ou nome de branch. Não há nada que eu possa configurar dentro da sessão para contornar isso (e as instruções desta sessão são explícitas: não tentar contornar bloqueios de política 403, e sim reportar).
- **Ação necessária (fora desta sessão):** conceder permissão de escrita (`contents: write`) à integração do Claude Code neste repositório GitHub (`othiagocarvalho/junttos-admin`) — ex.: GitHub → Settings → GitHub Apps → permissões da app, ou via admin da integração usada. Depois disso, me peça para tentar o push de novo: **todos os commits abaixo já estão prontos localmente**, nada precisa ser refeito.
- Enviei uma notificação push assim que identifiquei esse bloqueio, e voltei a tentar (sem sucesso) a cada poucos commits.

## Commits locais prontos para push (branch local `claude/wizardly-fermi-96skty`, 20 commits à frente de `origin/master`)

1. `estilo: fundamentos do redesign Studio (fontes, tokens, componentes base)`
2. `docs: adiciona PROGRESS.md com status do redesign e bloqueio de push`
3. `estilo: Shell (sidebar desktop + tab bar mobile) e Início`
4. `estilo: Nova Venda (mobile + desktop)`
5. `estilo: Estoque + PROGRESS.md`
6. `estilo: Catálogo online / Pedidos`
7. `estilo: Relatórios (mobile + desktop)`
8. `estilo: Financeiro (mobile + desktop)`
9. `docs: atualiza PROGRESS.md (Relatórios, Catálogo, Financeiro concluídos)`
10. `estilo: Metas`
11. `estilo: Fechamento de Caixa`
12. `estilo: Crediário`
13. `estilo: Clientes`
14. `docs: atualiza PROGRESS.md (Fechamento, Clientes, Metas, Crediário concluídos)`
15. `estilo: Configurações`
16. `estilo: Contas a Pagar`
17. `docs: atualiza PROGRESS.md (12 telas principais concluídas)`
18. `estilo: WelcomeOnboarding (stretch)`
19. `estilo: PedidosConsolidados (stretch)`
20. `estilo: ImportarPlanilha (stretch)`
21. `docs: atualiza PROGRESS.md (stretch parcial)`

## Mapa do app (para contexto)

- App da loja (alvo do redesign) = `src/pages/LojaFeminina/*` (mobile, renderizado via `LojaFeminina/index.jsx`) + `src/pages/cliente/*Desktop.jsx` (desktop, renderizado via `ClientDashboardDesktop.jsx`).
- Fora de escopo (não tocado): app interno de staff (`src/pages/Dashboard.jsx`, `Consultants.jsx`, `Visits.jsx`, `Finance.jsx`, `Reports.jsx`, `Settings.jsx`, `ArquiteturaPage.jsx`, `Sidebar.jsx`/`Layout.jsx` do topo, `src/components/junttos/*`, `src/theme/tokens.js`) — é uma ferramenta interna da Junttos para gerenciar consultoras/lojas, não o "Junttos Admin" (dashboard da lojista) descrito na tarefa.
- Tema por loja é dinâmico (`useLojaTheme.js` grava `--primary`/`--rose`/`--rose-deep` via CSS var conforme `config.cor_primaria` de cada loja, com presets em `LojaConfig.jsx`: Junttos roxo/coral, Rosê, Verde, Azul, Borgonha). Isso é uma feature de dados, não foi alterada — os componentes novos consomem essas CSS vars em vez de cor fixa, para não quebrar o multi-tenant.

## Status por área

**As 12 telas principais listadas na tarefa original estão 100% concluídas:**

- [x] Fundamentos (fontes, tokens, componentes `studio/*`)
- [x] Shell (Sidebar desktop 250px fixa + BottomTabBar/Header mobile)
- [x] Início (mobile + desktop)
- [x] Nova Venda (mobile + desktop)
- [x] Estoque
- [x] Relatórios (mobile + desktop) — gráfico "Faturamento por dia" novo
- [x] Catálogo online / Pedidos — StatusPill, chips de filtro, EmptyState
- [x] Financeiro (mobile + desktop) — abas underline, HeroCard Saldo/DRE
- [x] Fechamento de Caixa — HeroCard Total de Vendas/Saldo final
- [x] Clientes — cards com avatar, telefone/valores mono, EmptyState
- [x] Metas — barra roxo→coral, EmptyState
- [x] Crediário — StatGrid + StatusPill
- [x] Configurações — Toggle nas funcionalidades, mantém color pickers reais
- [x] Contas a Pagar — HeroCard + StatGrid + StatusPill

**Stretch (fora da lista original, mesmo produto, nível Business/B2B):**

- [x] WelcomeOnboarding
- [x] PedidosConsolidados
- [x] ImportarPlanilha
- [x] **CatalogoB2BAdmin.jsx** — CSS vars em cards, inputs, nav bar e header; header com bordas arredondadas inferiores + sombra; status vars em mensagens de feedback.
- [x] **CatalogoB2BAdminDesktop.jsx** — Sidebar migrada de cores hardcoded para CSS vars; section/inp/lbl locais com --r-card/--r-input/--font-ui; hover class usa var(--bg); save button e botões com border-radius de CSS var.
- [x] **ProdutosB2BPro.jsx** — Toast usa var(--ink); stat cards, product cards, search/novo, modais e botões com CSS vars; badge de vídeo usa --status-info-*; delete usa --status-bad-*.
- `src/pages/cliente/EstoquePage.jsx` verificado e **não é usado em lugar nenhum**
  no projeto (nenhum import) — código morto, propositalmente não estilizado.

- [x] Verificação final parcial: `npm run build` e `npx eslint` rodados após
  cada commit e comparados ao baseline (nenhum problema novo introduzido;
  vários avisos pré-existentes de `theme`/props não usadas foram corrigidos
  incidentalmente ao trocar cores fixas por `var(--primary)`).

## Pendências para uma próxima sessão

1. Revisão visual final em navegador (mobile 375px e desktop) de todas as telas
   estilizadas — todo o trabalho foi verificado via build/lint + leitura de código,
   não via screenshot interativo.
2. Merge para master quando aprovado.
