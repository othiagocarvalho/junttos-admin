# CONTEXT.md — junttos-admin

> Fonte única de verdade para o projeto. Atualizar neste mesmo commit toda vez que uma implementação alterar arquitetura, tabelas, rotas, planos ou regras de acesso.

---

## 1. Visão geral

SPA React que serve dois apps em uma única implantação Vercel:

| App | URL | Acesso |
|-----|-----|--------|
| **AdminApp** | `junttos-admin.vercel.app/` | Equipe Junttos (login interno) |
| **LojaClientApp** | `junttos-admin.vercel.app/<slug>/` | Loja específica (login da lojista) |

`src/App.jsx` decide qual app servir: lê o primeiro segmento da URL, consulta `lf_config` pelo par `loja_id = <seg> OR slug = <seg>`. Se encontrar, monta `LojaClientApp`; caso contrário, monta `AdminApp`.

---

## 2. Stack

| Lib | Versão |
|-----|--------|
| React | 19.2.6 |
| React DOM | 19.2.6 |
| React Router DOM | 7.15.1 |
| @supabase/supabase-js | 2.107.0 |
| Recharts | 3.8.1 |
| Lucide React | 1.16.0 |
| Tailwind CSS | 4.3.0 |
| XLSX | 0.18.5 |
| Vite | 8.0.12 |

Fontes carregadas no `index.html`: Manrope, DM Sans, Quicksand, Playfair Display, JetBrains Mono, Plus Jakarta Sans, Space Mono.

---

## 3. Infra e deploy

- **Hospedagem:** Vercel (projeto `junttos`, org `junttos-projetos`)
- **Banco:** Supabase (PostgreSQL + Auth + Edge Functions)
- **SPA rewrite:** `vercel.json` redireciona tudo para `/` — React Router cuida das rotas
- **Deploy:**
  ```sh
  git push origin staging
  git checkout master && git merge staging && git push origin master
  npx vercel --prod --yes
  git checkout staging
  ```

---

## 4. Autenticação

### AdminApp (equipe Junttos)
- `src/context/AuthContext.jsx` + `src/components/PrivateRoute.jsx`
- Login padrão Supabase Auth

### LojaClientApp (lojistas)
- `src/context/ClientAuthContext.jsx`
- `ClientAuthProvider` — expõe `session`, `user`, `login()`, `logout()`
- `ClientPrivateRoute` — verifica `session.user.app_metadata.loja_id` contra `lojaId` da rota. Se divergir, executa `signOut()` e redireciona para `/`. Lê do JWT — sem query ao banco, sem RLS.
- `app_metadata.loja_id` é setado via Supabase Admin API (no edge function `create-user` e no cadastro manual de lojas).

> **Regra crítica (CB2B-6):** nunca usar `lf_usuarios` SELECT no client-side para verificar loja_id. RLS da tabela bloqueia. Sempre usar `app_metadata`.

---

## 5. Rotas

### AdminApp (`src/App.jsx → AdminApp`)
| Rota | Componente |
|------|-----------|
| `/` | `Login` |
| `/admin/login` | `Login` |
| `/login` | `LoginCliente` |
| `/dashboard` | `Dashboard` |
| `/consultants` | `Consultants` |
| `/visits` | `Visits` |
| `/finance` | `Finance` |
| `/reports` | `Reports` |
| `/settings` | `Settings` |
| `/arquitetura` | `ArquiteturaPage` |
| `/loja-feminina` | `LojaFeminina` |
| `/clientes` | `CadastroCliente` |
| `/cobrancas` | `Cobrancas` |

### LojaClientApp (`src/App.jsx → LojaClientApp`)
| Rota | Componente |
|------|-----------|
| `/<slug>/` | `ClientLogin` |
| `/<slug>/dashboard` | `LojaFeminina` (via `ClientPrivateRoute`) |
| `/<slug>/catalogo` | `CatalogoPublico` (público, sem auth) |

---

## 6. Sistema de planos

**Arquivo:** `src/utils/planos.js`

```js
PLANOS = { starter: { nivel: 1 }, pro: { nivel: 2 }, business: { nivel: 3 } }

temAcesso(planoAtual, planoMinimo) → boolean   // nivel atual >= nivel mínimo
isLegado(features) → boolean                   // features.legado === true
```

**Mapa de acesso (`ACESSO`):**

| Funcionalidade | Plano mínimo |
|----------------|-------------|
| venda | starter |
| estoque | starter |
| historico | starter |
| fechamento | starter |
| relatorios | starter |
| clientes | starter |
| meta | pro |
| relatorios_avancados | pro |
| catalogo | business |
| financeiro | business |
| notificacoes | business |

**Lojas legadas:** `isLegado(features) === true` significa acesso ao dashboard sem controle de plano. Legadas NUNCA veem Financeiro nem Catálogo B2B, mesmo que no futuro tenham plano business — o gate usa `!legado` explicitamente em `index.jsx` (linhas 489–494) e `ClientDashboardDesktop.jsx`.

---

## 7. Lojas em produção

| loja_id | Slug / URL | Plano | catalogo_b2b | Legado | Notas |
|---------|-----------|-------|-------------|--------|-------|
| `sualoja` | `/sualoja/` | business | pro | false | Loja de testes. Tem Financeiro e Catálogo B2B Pro. |
| `biastore` | `/biastore/` | (verificar) | (verificar) | true | Legada. Não vê Financeiro. |
| `estrada` | `/lojaestrada/` | (verificar) | (verificar) | true | URL usa slug `lojaestrada`, loja_id é `estrada`. Legada. |
| `ducharmelingerie` | `/ducharme/` | (verificar) | (verificar) | true | Legada. Tem feature `atacado: true` — acesso a ContasPagar exclusivo. |

**Credenciais de teste (NÃO alterar):**

| Loja | Email | Senha |
|------|-------|-------|
| Sua Loja | sualoja@junttos.com.br | sualoja@2026 |
| Bia Store | biastore@junttos.com.br | bia@junttos2026 |
| Loja Estrada | estrada@junttos.com.br | estrada@2026 |
| Du Charme | ducharme@junttos.com.br | ducharme@2026 |

---

## 8. Banco de dados (Supabase)

Todas as tabelas `lf_*` são do módulo Loja Feminina. Tabelas `jt_*` são do AdminApp interno.

### `lf_config` — Configuração e feature flags da loja
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | text UNIQUE | identificador único da loja |
| slug | text | URL alternativa (opcional) |
| nome | text | nome de exibição |
| cor_primaria | text | hex default `#5E2BD0` |
| cor_secundaria | text | |
| logo_url | text | URL pública do logo |
| features | jsonb | feature flags (ver §9) |
| plano | text | `starter` \| `pro` \| `business` |
| chave_pix | text | chave Pix para catálogo público |
| whatsapp_loja | text | número WhatsApp |
| pedido_minimo_tipo | text | `nenhum` \| `valor` \| `quantidade` |
| pedido_minimo_valor | numeric | |
| pedido_minimo_qtd | numeric | |
| comissao_percentual | numeric | % comissão automática |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `lf_vendas` — Vendas realizadas
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | text | |
| cliente_nome | text | |
| cliente_tel | text | |
| valor | numeric | |
| forma_pgto | text/jsonb | pode ser string ou array JSON de `{forma, valor}` |
| obs | text | |
| produtos | jsonb | array `[{nome, variacao, quantidade, valor}]` |
| vendedora | text | |
| data | timestamptz | data/hora da venda |
| created_at | timestamptz | |

### `lf_caixas` — Fechamentos de caixa
| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| loja_id | text |
| data | date |
| dinheiro | numeric |
| pix | numeric |
| debito | numeric |
| credito | numeric |
| saldo_ini | numeric |
| sangria | numeric |
| despesas | numeric |
| obs | text |
| total | numeric |
| created_at | timestamptz |

### `lf_metas` — Metas mensais
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | text | |
| mes | text | formato `YYYY-MM` |
| valor | numeric | |
| UNIQUE | (loja_id, mes) | |

### `lf_produtos` — Catálogo de produtos
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | text | |
| nome | text | |
| ativo | boolean | soft delete |
| preco_custo | numeric | |
| preco_venda | numeric | |
| variacoes | jsonb | array `[{cor/tamanho: label, quantidade, custo?}]` |
| fornecedor | text | |
| referencia | text | |
| valor_lote | numeric | valor do lote para atacado |
| data_vencimento | date | vencimento do lote |
| status_pgto | text | status do pagamento ao fornecedor |
| video_url | text | URL do vídeo do produto (B2B Pro — CB2B-5) |
| categoria | text | categoria do produto |
| created_at | timestamptz | |

### `lf_clientes` — Clientes finais
| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| loja_id | text |
| nome | text |
| telefone | text |
| email | text |
| data_nascimento | date |
| observacoes | text |
| created_at | timestamptz |

### `lf_crediario` — Vendas a prazo
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | text | |
| cliente_nome | text | |
| cliente_telefone | text | |
| valor_total | numeric | |
| parcelas | integer | total de parcelas |
| valor_parcela | numeric | calculado: valor_total / parcelas |
| data_compra | date | |
| parcelas_pagas | integer | contador de parcelas já pagas |
| status | text | `aberto` \| `quitado` |
| observacoes | text | |
| created_at | timestamptz | |

> Parcelas do crediário aparecem em Contas a Receber como entradas **virtuais** geradas por `mesclarContasReceber()` — não há escrita em `lf_contas_receber`.

### `lf_contas_pagar` — Contas a pagar
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | text | |
| descricao | text | |
| categoria | text | aluguel, fornecedor, salario, imposto, energia, agua, internet, marketing, outros |
| valor | numeric | |
| data_vencimento | date | |
| status | text | `pendente` \| `pago` |
| data_pagamento | date | preenchido ao marcar como pago |
| observacoes | text | |
| created_at | timestamptz | |

### `lf_contas_receber` — Contas a receber (entradas manuais)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | text | |
| descricao | text | |
| categoria | text | |
| valor | numeric | |
| data_vencimento | date | |
| status | text | `pendente` \| `recebido` |
| data_recebimento | date | |
| cliente_nome | text | |
| origem | text | `outro` \| `crediario` \| `venda_prazo` |
| observacoes | text | |
| created_at | timestamptz | |

### `lf_pedidos` — Pedidos do catálogo público
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | text | |
| status | text | `aguardando_pagamento` \| `pago` \| `enviado` \| `cancelado` |
| (demais colunas) | — | verificar — tabela criada via migração não documentada em SQL |
| created_at | timestamptz | |

### `lf_usuarios` — Colaboradoras da loja (multi-usuário B2B Pro)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | text | |
| auth_user_id | uuid | referência ao Supabase Auth |
| email | text | |
| nome | text | |
| ativo | boolean | soft revoke (NÃO deleta do Auth) |
| criado_em | timestamptz | |

> RLS ativado nesta tabela sem SELECT policy para usuários autenticados. Não fazer SELECT do client-side — usar `app_metadata.loja_id`.

---

## 9. Feature flags (`lf_config.features` jsonb)

| Flag | Tipo | Descrição |
|------|------|-----------|
| vendas | boolean | habilita módulo de vendas |
| historico | boolean | histórico de vendas |
| metas | boolean | metas mensais |
| fechamento_caixa | boolean | fechamento de caixa |
| relatorios | boolean | relatórios |
| clientes | boolean | CRM de clientes finais |
| estoque | boolean | controle de estoque |
| catalogo_b2b | `'simples'` \| `'pro'` \| false | catálogo B2B ativo e nível |
| legado | boolean | bypass total de controle de planos (Bia Store, Loja Estrada, Du Charme) |
| atacado | boolean | habilita ContasPagar exclusivo (Du Charme) |
| crm | boolean | CRM avançado (não implementado ainda) |

---

## 10. Arquitetura de views — LojaFeminina (`src/pages/LojaFeminina/index.jsx`)

O componente principal faz três early returns antes de renderizar o dashboard completo:

1. **Loading** — spinner enquanto `useLojaData` carrega
2. **Erro de DB** — tela de erro se `data.dbError`
3. **CatalogoB2B** — se `features.catalogo_b2b === 'simples' || 'pro'` → retorna `CatalogoB2BAdmin` (mobile) ou `CatalogoB2BAdminDesktop` (desktop via `useViewMode`)

Se nenhum early return disparar, renderiza o dashboard completo com bottom tabs (mobile) ou sidebar (desktop via `ClientDashboardDesktop`).

### Bottom tabs (mobile, dashboard completo)
```
Início | Estoque | [+FAB] | Relatórios | Fechamento
```

### Panel map (mobile, dashboard completo)
| Panel id | Componente | Plano mínimo |
|----------|-----------|-------------|
| inicio | `WelcomeOnboarding` ou `Inicio` | — |
| estoque | `EstoqueMobile` | — |
| venda | `NovaVenda` | — |
| relatorios | `Relatorios` | — |
| crediario | `Crediario` | pro |
| meta | `Meta` | pro |
| clientes | `Clientes` | starter |
| catalogo | `PedidosCatalogo` | business |
| financeiro | `Financeiro` | business |
| conta | `Fechamento` + links para config/contas_pagar/clientes/meta/crediario/financeiro/catalogo | — |
| contas_pagar | `ContasPagar` | feature `atacado` (Du Charme exclusivo) |
| config | `LojaConfig` | — |

### Nav desktop (sidebar, dashboard completo) — `ClientDashboardDesktop.jsx`
Items da sidebar (`PLANO_NAV_ITEMS`): clientes (starter), meta (pro), crediario (pro), catalogo (business), financeiro (business).  
Legados: `catalogo`, `financeiro`, `crediario` são ocultados se `legado === true`.

---

## 11. CatalogoB2BAdmin — Interface B2B

Lojas com `features.catalogo_b2b` ativo recebem uma interface diferente do dashboard padrão.

### Mobile: `CatalogoB2BAdmin.jsx`
Tabs condicionais:

| Tab | Condição |
|-----|----------|
| Produtos | sempre |
| Pedidos | sempre |
| Usuários | `nivel === 'pro'` |
| Financeiro | `temAcesso(plano, 'business')` |
| Config | sempre |

Para `nivel === 'simples'`: Produtos usa `EstoqueMobile`  
Para `nivel === 'pro'`: Produtos usa `ProdutosB2BPro`, Pedidos tem sub-view Lista/Consolidado (usa `PedidosConsolidados`)

### Desktop: `CatalogoB2BAdminDesktop.jsx`
Sidebar com os mesmos itens.  
`isBusiness` prop controla visibilidade de Financeiro no `B2BSidebar`.

---

## 12. Módulo Financeiro

### Mobile: `src/pages/LojaFeminina/Financeiro.jsx`
4 abas:
1. **A Pagar** (`ContasPagarTab`) — CRUD de `lf_contas_pagar`
2. **A Receber** (`ContasReceberTab`) — CRUD de `lf_contas_receber` + parcelas virtuais do crediário via `mesclarContasReceber()`
3. **Fluxo de Caixa** — gráfico mensal com `calcularFluxoCaixa()`
4. **DRE** — demonstrativo com `calcularDRE()`

Props: `{ lojaId, vendas, theme }`  
Busca `lf_contas_pagar` e `lf_contas_receber` internamente.  
Busca `lf_crediario` internamente para mesclar com A Receber.

### Desktop: `src/pages/cliente/FinanceiroDesktop.jsx`
Mesma estrutura de 4 abas. Usa Recharts (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `Cell`) para gráficos.  
Props: `{ data, theme }` onde `data` vem de `useLojaData`.

### Utilitários: `src/utils/financeiro.js`
| Função | Descrição |
|--------|-----------|
| `calcularStatusReal(item, campoPagamento)` | `pago/recebido/atrasado/pendente` baseado em data_vencimento |
| `mesclarContasReceber(contasManual, crediarios)` | gera parcelas virtuais do crediário, não escreve no banco |
| `agruparPorCategoria(contas)` | agrupa por `categoria`, ordena por total desc |
| `calcularFluxoCaixa(vendas, contasPagar, contasReceber, inicio, fim)` | retorna array de dias com entradas, saídas, saldo, saldoAcumulado |
| `calcularDRE(vendas, contasPagar, inicio, fim)` | retorna `{ receitaBruta, despesasPorCategoria, totalDespesas, resultadoLiquido, margemPercentual }` |
| `mesAtualRange()` | retorna `{ inicio, fim, label }` do mês atual |
| `navegarMes(inicio, delta)` | navega ±N meses |

---

## 13. Hook de dados: `useLojaData` (`src/pages/LojaFeminina/useLojaData.js`)

Carrega todos os dados de uma loja em paralelo. Retorna estado + mutações.

**Tabelas consultadas no mount:** `lf_vendas`, `lf_caixas`, `lf_metas`, `lf_produtos`, `lf_config`, `lf_clientes`, `lf_crediario`, `lf_pedidos`

**Mutações disponíveis:**

| Função | Ação |
|--------|------|
| `addVenda(venda)` | insere venda, desconta variações do estoque, auto-sincroniza lf_clientes |
| `deleteVenda(id)` | deleta venda, restaura variações ao estoque |
| `updateVenda(id, updates)` | atualiza venda |
| `fecharCaixa(caixa)` | insere fechamento |
| `salvarMeta(mes, valor)` | upsert de meta |
| `addProduto(nome, extras)` | insere produto |
| `updateProduto(id, updates)` | atualiza produto |
| `removeProduto(nome)` | soft delete (`ativo = false`) |
| `updateVariacoes(id, variacoes)` | atualiza variações de um produto |
| `importarProdutos(lista)` | import em batch |
| `saveConfig(updates)` | upsert em lf_config |
| `addCliente(dados)` | insere cliente |
| `updateCliente(id, dados)` | atualiza cliente |
| `deleteCliente(id)` | deleta cliente |
| `addCrediario(dados)` | insere crediário, calcula valor_parcela |
| `pagarParcela(id)` | incrementa parcelas_pagas, atualiza status |
| `saveComissaoPercentual(pct)` | salva comissão em lf_config |
| `updatePedido(id, updates)` | atualiza status do pedido B2B |

---

## 14. Edge Function: `create-user`

**Path:** `supabase/functions/create-user/index.ts`  
**Acesso:** chamada via `supabase.functions.invoke('create-user', { body })` do cliente (B2B Pro → multi-usuário)

**Input:** `{ email, password, loja_id, nome }`  
**Ação:**
1. Cria usuário no Supabase Auth via Admin API (`email_confirm: true`)
2. Insere linha em `lf_usuarios` com `auth_user_id`, `loja_id`, `email`, `nome`, `ativo: true`

**Nota:** `app_metadata.loja_id` NÃO é setado neste edge function — é setado em outro contexto (verificar). O `ClientPrivateRoute` depende desse campo estar preenchido.

---

## 15. Contextos e hooks globais

| Arquivo | Descrição |
|---------|-----------|
| `src/context/AuthContext.jsx` | Autenticação do AdminApp (equipe Junttos) |
| `src/context/ClientAuthContext.jsx` | Auth da loja. `ClientPrivateRoute` lê `app_metadata.loja_id` |
| `src/context/DataContext.jsx` | Dados globais do AdminApp interno |
| `src/hooks/useLojaTheme.js` | Aplica `--primary` e `--rose` como CSS vars do `lf_config` |
| `src/hooks/useViewMode.js` | Persiste `mobile`/`desktop` em `localStorage` (key: `junttos_viewMode`) |

---

## 16. Componentes compartilhados

| Componente | Descrição |
|-----------|-----------|
| `src/components/UpgradeWall.jsx` | Tela de bloqueio para funcionalidade além do plano |
| `src/components/PrivateRoute.jsx` | Guard de rota para AdminApp |
| `src/components/Layout.jsx` | Layout com sidebar do AdminApp |
| `src/components/Modal.jsx` | Modal genérico |

---

## 17. Catálogo público: `src/pages/catalogo/CatalogoPublico.jsx`

Página pública (sem auth) acessível em `/<slug>/catalogo`.  
Carregado por clientes B2B para fazer pedidos.  
Lê `lf_config` para cor, logo, pedido mínimo, chave Pix.  
Cria pedidos em `lf_pedidos`.  
Pedido mínimo: configurado em `lf_config.pedido_minimo_tipo/valor/qtd`.

---

## 18. Regras de acesso — resumo

| Funcionalidade | Regra |
|----------------|-------|
| Financeiro | `!legado && temAcesso(plano, 'business')` |
| Catálogo B2B | `!legado && features.catalogo_b2b !== false` |
| Crediário | `!legado && temAcesso(plano, 'pro')` |
| Contas a Pagar (Du Charme) | `features.atacado === true` |
| Multi-usuário B2B | `features.catalogo_b2b === 'pro'` |
| Metas | `legado || temAcesso(plano, 'pro')` |
| Clientes | `legado || temAcesso(plano, 'starter')` |

**Regra inviolável:** lojas com `features.legado === true` (Bia Store, Loja Estrada, Du Charme) NUNCA veem Financeiro ou Catálogo B2B, mesmo que sejam promovidas para plano business. O gate é `!legado` explícito, não apenas controle de plano.

---

## 19. Arquivo ContasPagar exclusivo

`src/pages/LojaFeminina/ContasPagar.jsx` — implementação exclusiva do atacado da Du Charme.  
- Cor hardcoded: Terracota `#B85C38`  
- Habilitado por: `features.atacado === true`  
- **NÃO reutilizar e NÃO sobrescrever** — é específico do modelo de negócio da Du Charme.

---

## 20. Mudanças não commitadas (estado em 2026-07-03)

Os seguintes arquivos têm alterações no working tree que **ainda não foram commitadas**:

| Arquivo | Natureza da mudança |
|---------|-------------------|
| `index.html` | Adiciona fontes Plus Jakarta Sans + Space Mono |
| `src/pages/LojaFeminina/CatalogoB2BAdmin.jsx` | Versão refatorada sem aba Financeiro (diverge do HEAD commitado que TEM Financeiro) |
| `src/pages/LojaFeminina/CatalogoB2BAdminDesktop.jsx` | Versão refatorada |
| `src/pages/LojaFeminina/PedidosCatalogo.jsx` | Expandido de 151 para 395 linhas — novo código de interface de pedidos |
| `src/pages/LojaFeminina/PedidosConsolidados.jsx` | Refatorado |
| `src/pages/LojaFeminina/ProdutosB2BPro.jsx` | Refatorado |

> **Atenção:** O HEAD commitado (`30592ab`) tem a aba Financeiro em `CatalogoB2BAdmin`. O working tree atual NÃO tem. Antes de commitar as mudanças acima, reintegrar o Financeiro.

---

## 21. Histórico de etapas implementadas

| Commit | Etapa | Descrição |
|--------|-------|-----------|
| `30592ab` | — | Financeiro no CatalogoB2BAdmin para lojas Business |
| `124bfea` | CB2B-6 fix | Verificar loja_id via app_metadata (evita RLS) |
| `e59ad65` | CB2B-6 | Multi-usuário Catálogo B2B Pro + validação de vínculo no login |
| `ad8b57d` | CB2B-5 | Vídeo do produto no Catálogo B2B Pro |
| `aba6ac0` | CB2B-4 | Pedidos consolidados por produto+tamanho |
| `82695ba` | CB2B-3 | Pedido mínimo configurável |
| `61330c9` | CB2B-2 | Grade de tamanho |
| `5e0319c` | CB2B-1 / 5a | Admin reduzido Catálogo B2B nível Simples |
| `35eb409` | Etapa 5 Business | Módulo financeiro completo |
| `f8ce062` | — | Integração automática de crediário em Contas a Receber |
| `3e457ea` | Etapa 4 Business | Catálogo online público com carrinho, checkout e Pix |
| `d7446e3` | Pro | Comissão automática, curva ABC, crediário |
| `767b5a2` | Starter | Tela de clientes finais |
| `91c78da` | — | Controle de planos starter/pro/business (UpgradeWall) |
| `38da4b8` | — | Flag legado |

---

## 22. Regras para futuras implementações

1. **Atualizar este arquivo** no mesmo commit de qualquer implementação que altere: tabelas, rotas, planos, flags, componentes novos, comportamento de autenticação.
2. **Nunca usar `lf_usuarios` SELECT no client-side** — RLS bloqueia. Sempre `app_metadata`.
3. **Gate legado é explícito** — nunca usar `legado ||` para habilitar funcionalidades novas. O bypass de legado é só para o que existia antes da flag ser introduzida.
4. **ContasPagar.jsx é exclusivo da Du Charme** — não reutilizar, não sobrescrever.
5. **Não deletar usuário do Supabase Auth** ao revogar acesso — apenas `ativo: false` em `lf_usuarios`.
6. **Ler o arquivo completo antes de editar** — nunca assumir o estado; se incerto, marcar como `verificar`.
7. **Deploy sempre via:** `push staging → merge master → vercel --prod → checkout staging`.
