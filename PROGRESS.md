# PROGRESS — Redesign visual "Studio" (Junttos Admin)

Execução autônoma, sem supervisão. Este arquivo é atualizado a cada etapa.

## ⚠️ BLOQUEIO CRÍTICO — leia primeiro

**Não foi possível dar `git push` para o repositório remoto nesta sessão.**

- `git push -u origin claude/wizardly-fermi-96skty` retorna `403` no proxy git local, mesmo após 4 tentativas com backoff (2s/4s/8s/16s).
- Tentei o caminho alternativo via GitHub MCP (`create_branch` / `push_files`): também retorna `403 Resource not accessible by integration` — ou seja, o GitHub App desta sessão não tem permissão de escrita (nem para criar a branch, nem para dar push) no repo `othiagocarvalho/junttos-admin`, apenas leitura (`get_me`, `list_branches` funcionam normalmente).
- Leitura (`git ls-remote`, `git fetch`) funciona sem problemas — o bloqueio é especificamente de escrita.
- **Todo o trabalho abaixo está commitado apenas localmente**, no branch `claude/wizardly-fermi-96skty`, dentro deste container. Se o container for reciclado antes de alguém copiar/pushar esses commits manualmente (ou reautorizar a sessão e eu conseguir dar push), o trabalho será perdido.
- Enviei uma notificação push avisando sobre isso assim que identifiquei o bloqueio.
- **Ação recomendada:** conceder permissão de escrita ao app/integração do Claude Code neste repositório (GitHub → Settings → Claude in Slack/Admin) e então pedir para eu tentar o push novamente — os commits locais continuam intactos e prontos.
- Vou continuar tentando `git push` periodicamente entre as áreas, sem bloquear o resto do trabalho.

## Commits locais até agora

1. `estilo: fundamentos do redesign Studio (fontes, tokens, componentes base)` — fontes (Plus Jakarta Sans / Space Mono) trocadas globalmente, CSS vars neutras, `src/components/studio/*` criado.
2. `docs: adiciona PROGRESS.md...`
3. `estilo: Shell (sidebar desktop + tab bar mobile) e Início` — sidebar fixa 250px com item ativo roxo cheio; tab bar mobile com 5 itens (Início/Catálogo/FAB/Estoque/Mais) e menu "Mais"; Início mobile/desktop com HeroCard/StatGrid/EmptyState.
4. `estilo: Nova Venda (mobile + desktop)` — substitui gradiente fixo "metallic/rose-gold" por var(--primary)/theme.primary nos CTAs.
5. `estilo: Estoque` — HeroCard roxo/escuro para custo total/venda total, StatusPill para alerta de estoque baixo, EmptyState (vazio + sem resultado de busca).

A partir daqui, várias telas independentes foram delegadas a subagentes em paralelo (arquivos sem sobreposição), cada uma revisada e commitada por mim depois de conferir build/lint.

## Mapa do app (para contexto)

- App da loja (alvo do redesign) = `src/pages/LojaFeminina/*` (mobile, renderizado via `LojaFeminina/index.jsx`) + `src/pages/cliente/*Desktop.jsx` (desktop, renderizado via `ClientDashboardDesktop.jsx`).
- Fora de escopo (não tocado): app interno de staff (`src/pages/Dashboard.jsx`, `Consultants.jsx`, `Visits.jsx`, `Finance.jsx`, `Reports.jsx`, `Settings.jsx`, `ArquiteturaPage.jsx`, `Sidebar.jsx`/`Layout.jsx` do topo, `src/components/junttos/*`, `src/theme/tokens.js`) — é uma ferramenta interna da Junttos para gerenciar consultoras/lojas, não o "Junttos Admin" (dashboard da lojista) descrito na tarefa.
- Tema por loja é dinâmico (`useLojaTheme.js` grava `--primary`/`--rose`/`--rose-deep` via CSS var conforme `config.cor_primaria` de cada loja, com presets em `LojaConfig.jsx`: Junttos roxo/coral, Rosê, Verde, Azul, Borgonha). Isso é uma feature de dados, não foi alterada — os componentes novos consomem essas CSS vars em vez de cor fixa, para não quebrar o multi-tenant.

## Status por área

- [x] Fundamentos (fontes, tokens, componentes `studio/*`) — commit 1.
- [x] Shell (Sidebar desktop + BottomTabBar/Header mobile) — commit 3.
- [x] Início — commit 3.
- [x] Nova Venda — commit 4.
- [x] Estoque — commit 5.
- [x] Relatórios (mobile + desktop) — gráfico "Faturamento por dia" novo.
- [x] Catálogo online / Pedidos — StatusPill, chips de filtro, EmptyState.
- [x] Financeiro (mobile + desktop) — abas underline, HeroCard Saldo/DRE.
- [x] Fechamento de Caixa — HeroCard Total de Vendas/Saldo final.
- [x] Clientes — cards com avatar, telefone/valores mono, EmptyState.
- [x] Metas — barra roxo->coral, EmptyState.
- [x] Crediário — StatGrid + StatusPill.
- [x] Configurações — Toggle nas funcionalidades, mantém color pickers reais.
- [x] Contas a Pagar — HeroCard + StatGrid + StatusPill.
- [ ] Stretch (CatalogoB2BAdmin/Desktop, ProdutosB2BPro, PedidosConsolidados, EstoquePage desktop, WelcomeOnboarding, ImportarPlanilha)
- [ ] Verificação final (build + lint + revisão)

**Todas as 12 telas principais listadas na tarefa estão concluídas.** A partir
daqui, indo para as telas "stretch" (variante Business/B2B do catálogo,
onboarding, importação de planilha) — fora da lista original de telas mas
parte do mesmo produto, então também recebem o tratamento Studio se der
tempo. Cada commit passou por `npm run build` + `npx eslint` comparado ao
baseline (nenhum problema novo introduzido; alguns pré-existentes até
foram corrigidos incidentalmente).

(seções serão preenchidas conforme cada área for concluída)
