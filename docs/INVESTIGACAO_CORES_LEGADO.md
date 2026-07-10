# Investigação — Cores Legado: Bia Store, Loja Estrada, Du Charme

**Branch:** staging | **Data:** 2026-07-04 | **Somente leitura — nenhum commit feito**

---

## 1. Como as cores funcionam hoje (arquitetura)

### Fluxo geral
1. `lf_config.cor_primaria` e `lf_config.cor_secundaria` são lidos do Supabase por `useLojaData`.
2. `useLojaTheme(config)` grava esses valores em CSS vars globais:
   - `--primary = cor_primaria`
   - `--rose = cor_primaria`
   - `--rose-deep = cor_secundaria || cor_primaria`
3. O componente `LojaFeminina/index.jsx` monta um objeto `theme`:
   ```js
   const primary = data.config?.cor_primaria || '#B47A6B'  // fallback = Loja Estrada
   const isDark   = primary === '#D4A017'                  // flag Bia Store
   const theme = { primary, accent, isDark }
   ```
4. `themeVars` é injetado como `style` no root div — sobrescreve CSS vars para Bia Store.
5. `theme` é passado por prop para todos os sub-componentes.

### Falback Loja Estrada
Não há condicional `lojaId === 'estrada'` explícita. As cores `#B47A6B` / `#D9A99B`
são simplesmente o **valor default** quando `cor_primaria` / `cor_secundaria` são nulos.
A Loja Estrada não tem nenhum tratamento especial além de ser o lojaId padrão (`= 'estrada'`).

### Detecção Bia Store (isDark)
Bia Store é detectada **exclusivamente** pela cor: `primary === '#D4A017'`.
Não há verificação de `lojaId`. Se qualquer outra loja usar essa cor dourada, seria
tratada como dark theme — risco latente, mas não afeta o escopo atual.

### Detecção Du Charme (features.atacado)
Du Charme é detectada por `features?.atacado === true` (flag na coluna `lf_config.features`).
Não há verificação de `lojaId`. É uma feature flag genérica (qualquer loja com atacado = true
teria o mesmo comportamento).

---

## 2. Tabela de ocorrências

### 2A — Bia Store (`#D4A017` / `isDark`)

| Arquivo | Linha(s) | O que faz | Afeta dados/cálculos? |
|---|---|---|---|
| `LojaFeminina/index.jsx` | 365 | `const isDark = primary === '#D4A017'` — flag central que ativa tudo abaixo | Não (só leitura de cor) |
| `LojaFeminina/index.jsx` | 373–382 | `themeVars` override: injeta `--bg:#0A0A0A`, `--surface:#0F0E0C`, `--line:rgba(212,160,23,0.18)`, `--ink:#D4A017`, `--ink-soft/#muted:#A07830`, `--rose-deep:#F0C040`, `--rose:#D4A017` no root div | Não (puro CSS) |
| `LojaFeminina/index.jsx` | 74–75 | Hero da tela Início: `background: isDark ? '#0F0E0C' : gradient`, `borderTop: isDark ? '2px solid #D4A017'` | Não (visual) |
| `LojaFeminina/index.jsx` | 81, 88, 92, 98 | Cores de texto e barra de meta no Hero dark | Não (visual) |
| `LojaFeminina/index.jsx` | 164, 167, 170 | Top produtos: chips dourados vs roxo/rose | Não (visual) |
| `LojaFeminina/index.jsx` | 229 | `const isDarkTheme = primary === '#D4A017'` em `AppHeader` | Não |
| `LojaFeminina/index.jsx` | 256–258 | `isDarkTheme` → exibe `/logos/biastore-black.svg` no header mobile em vez do logo padrão | Não (visual — só escolha de logo) |
| `LojaFeminina/NovaVenda.jsx` | 5 | `const GOLD = 'linear-gradient(135deg, #C8900A ... #D4A017 ...)'` | Não |
| `LojaFeminina/NovaVenda.jsx` | 41, 144–679 (múltiplas) | `isDark = !!theme.isDark`: todas as cores dos botões, fundos de seleção de produto, gradient do botão "Finalizar", cores de variações, step buttons. ~30 linhas com `isDark ?` | Não (visual) |
| `LojaFeminina/CatalogoB2BAdminDesktop.jsx` | 510–527 | `isDark = theme.isDark \|\| primary === '#D4A017'`; `contentVars` override das mesmas CSS vars que o index; fundo do painel | Não (visual) |
| `cliente/ClientDashboardDesktop.jsx` | 266, 287–316 | `isDark = theme.primary === '#D4A017'`; Hero desktop dark, `borderTop:#D4A017`, barra de meta | Not (visual) |
| `cliente/ClientDashboardDesktop.jsx` | 614, 812–977 (múltiplas) | `isDark` na tela Nova Venda desktop: botão finalizar gradient dourado, chips de produto, dropdown de variações, painel lateral. ~25 linhas | Não (visual) |
| `cliente/ClientDashboardDesktop.jsx` | 1020–1032 | `contentVars` override idêntico ao index.jsx: injeta CSS vars dark no painel de conteúdo | Não (puro CSS) |
| `pages/cliente/Login.jsx` | 64, 66–67 | `isBiaStore = lojaSlug === 'biastore'` → exibe `/logos/biastore-gold.svg` em vez do logo padrão na tela de login | Não (visual — escolha de logo) |
| `pages/cliente/Login.jsx` | 81 | `onError={isBiaStore ? undefined : () => setImgErr(true)}` — desativa fallback de logo para biastore | Não (visual) |
| `pages/cliente/EstoquePage.jsx` | 44–45 | `isDark = primary === '#D4A017'`; `btnColor = isDark ? '#0A0A0A' : '#fff'` — cor de texto do botão add | Não (visual) |
| `pages/cliente/RelatoriosDesktop.jsx` | 364, 375 | `colorScheme: theme?.isDark ? 'dark' : 'light'` nos `<input type="date">` (troca o picker nativo para dark mode) | Não (visual — picker do browser) |
| `LojaFeminina/Relatorios.jsx` | 369 | `colorScheme: theme?.isDark ? 'dark' : 'light'` idêntico ao acima | Não (visual) |

### 2B — Loja Estrada (Rose Gold)

| Arquivo | Linha(s) | O que faz | Afeta dados/cálculos? |
|---|---|---|---|
| `LojaFeminina/index.jsx` | 364 | `const primary = data.config?.cor_primaria \|\| '#B47A6B'` — fallback, não é condicional | Não |
| `LojaFeminina/index.jsx` | 368–369 | `accent: '...' \|\| '#D9A99B'`, `nome: '...' \|\| 'Loja Estrada'` — fallbacks | Não |
| `LojaFeminina/index.jsx` | 233 | `corPrimaria: primary \|\| '#B47A6B'` — usado na geração do logo SVG fallback | Não (visual) |
| `LojaFeminina/index.jsx` | 357, `useLojaData.js` 14 | `lojaId = 'estrada'` como valor default de prop — determina qual loja é carregada do Supabase | **Comportamental** (qual loja é carregada), mas é só o default; qualquer URL com slug correto sobrescreve |
| `components/ClientHeader.jsx` | 4 | `primary: '#C9956C'` como fallback padrão do componente (preset "Rosê" do catálogo B2B) | Não (visual fallback) |
| `pages/cliente/Login.jsx` | 9, 92 | `estrada: 'Loja Estrada'` no mapa de nomes; `lojaSlug = pathname \|\| 'estrada'` como default | Não (label de nome, visual) |

> **Conclusão Loja Estrada:** Não há nenhuma condicional de cor do tipo `if lojaId === 'estrada'`.
> As ocorrências são **valores default** usados quando `cor_primaria` é nulo no Supabase.
> Se a Loja Estrada tiver `cor_primaria` configurado no Supabase, esses fallbacks nunca são atingidos.

### 2C — Du Charme Lingerie (`#B85C38` / `features.atacado`)

| Arquivo | Linha(s) | O que faz | Afeta dados/cálculos? |
|---|---|---|---|
| `LojaFeminina/ContasPagar.jsx` | 10, 61 | `const TERRACOTA = '#B85C38'`; fundo do card hero de contas a pagar | Não (visual) |
| `LojaFeminina/Relatorios.jsx` | 463–498 | `features?.atacado &&` mostra seção "PIX por conta" (Santander vs BB); `#B85C38` no valor e barra de progresso | **Comportamental:** exibe seção de dados real de PIX separado — mas é guarded por `features.atacado`, não por cor |
| `LojaFeminina/EstoqueMobile.jsx` | 101, 173–175, 271, 484, 506, 709 | `features?.atacado` controla: campo referência/fornecedor no produto, pagamento ao fornecedor, seção adicional no card. Badge `#FDEEE8/#B85C38` no card | Misto: os campos **são dados reais** (referência, fornecedor, custo), mas a cor é só visual |
| `LojaFeminina/Fechamento.jsx` | 61, 85–86, 178 | `features?.atacado` controla cálculo do total (pix_santander + pix_bb) e split do formulário | **Comportamental:** altera cálculo real de fechamento — NÃO é cor |
| `LojaFeminina/NovaVenda.jsx` | 45, 119, 128, 134, 211 | `features?.atacado` define forma padrão ('PIX Santander'), salva `pix_santander`/`pix_bb` separados, opções de pgto | **Comportamental:** altera dados gravados no Supabase — NÃO é cor |
| `LojaFeminina/index.jsx` | 508, 514, 609 | `features?.atacado` exibe link de botão de acesso B2B e contas a pagar; `#B85C38` na cor do botão | Misto: exibe funcionalidade real (contas_pagar, botão B2B); cor é visual |
| `LojaFeminina/Historico.jsx` | 198 | `features?.atacado &&` exibe nome_loja, cidade_estado, forma_envio no histórico | **Comportamental:** exibe dados reais adicionais — NÃO é cor |
| `cliente/ClientDashboardDesktop.jsx` | 164, 177, 179, 617, 649, 672, 681, 686, 726, 1066 | `features?.atacado` controla: menu Contas a Pagar na sidebar (com `#B85C38` quando ativo), forma de pagamento default, colunas pix_santander/pix_bb no cadastro de venda, painéis visíveis | Misto: a maioria é comportamental (dados/lógica); a cor `#B85C38` na sidebar é só visual |

---

## 3. Isolamento: `features.atacado` e outras flags de negócio

### Confirmação: `features.atacado` é **exclusivamente lógica de negócio**, não cor

O flag `features?.atacado` controla:
- Cálculo de fechamento de caixa (soma pix_santander + pix_bb separados)
- Dados gravados em Nova Venda (colunas pix_santander, pix_bb)
- Exibição de campos no estoque (referência, fornecedor, custo)
- Exibição de seções no histórico (nome_loja, cidade_estado)
- Visibilidade do módulo Contas a Pagar
- Acesso ao catálogo B2B

**→ NÃO deve ser tocado no redesign visual. Está completamente isolado das condicionais de cor.**

A única sobreposição é estética: `#B85C38` (terracota) aparece dentro de alguns blocos
`features?.atacado &&` (sidebar active state, badge de estoque, seção de relatórios).
Esses são visuais dentro de blocos lógicos — a lógica continua, só a cor muda.

### Outras flags verificadas

| Flag | Quem usa | Tipo |
|---|---|---|
| `features.legado` | `isLegado()` → oculta Catálogo, Financeiro, Crediário no menu | Comportamental (ocultar módulos) |
| `features.crm` | `BottomTabBar` e `CDS NAV` (locked prop) | Comportamental (lock/unlock do módulo CRM) |
| `features.catalogo_b2b` | `LojaFeminina/index.jsx`, `ClientDashboardDesktop.jsx` | Comportamental (exibe shell B2B) |

Nenhuma dessas flags tem relação com cor — **são 100% lógica/visibilidade de módulo**.

---

## 4. Valores de cor_primaria / cor_secundaria por loja

### Valores confirmados no código (fallbacks hardcoded = valores reais em produção)

| Loja | lojaId | cor_primaria | cor_secundaria | Observação |
|---|---|---|---|---|
| **Loja Estrada** | `estrada` | `#B47A6B` (rose gold) | `#D9A99B` (rose gold claro) | Valores default no código — provavelmente os reais |
| **Bia Store** | `biastore` | `#D4A017` (dourado) | desconhecido (não está hardcoded) | A cor dourada é a chave da detecção `isDark` |
| **Du Charme Lingerie** | `ducharmelingerie` | `#B85C38` (terracota)? | desconhecido | O terracota é usado como cor fixa `TERRACOTA` em ContasPagar, mas **não é lido de `cor_primaria`** — pode ser que a Du Charme tenha `cor_primaria` diferente e o terracota seja um "acento" fixo só para Contas a Pagar |

> ⚠️ **Ambiguidade Du Charme:** `TERRACOTA = '#B85C38'` em `ContasPagar.jsx` é hardcoded,
> não lido de `cor_primaria`. Isso sugere que a cor terracota foi projetada para ser a cor
> permanente de "Contas a Pagar" (módulo exclusivo Du Charme), independente de qual seja
> a `cor_primaria` real da loja no Supabase. Precisa verificar o valor real de
> `lf_config.cor_primaria` para `ducharmelingerie` no Supabase para confirmar.

> ℹ️ **Acesso Supabase:** Esta sessão não tem acesso direto ao banco para fazer
> `SELECT cor_primaria, cor_secundaria FROM lf_config WHERE slug IN ('biastore','lojaestrada','ducharmelingerie')`.
> Os valores acima foram inferidos exclusivamente do código.

---

## 5. Resumo executivo: o que muda e o que não muda no redesign

### O que pode ser alterado com segurança (puro visual):
- O flag `isDark` e todos os seus 30+ usos de cor podem ser substituídos por um sistema de CSS vars dark
- `#D4A017` hardcoded pode virar `var(--primary)` + `var(--ink)` com modo dark
- `#B85C38` (TERRACOTA) pode virar `var(--accent)` ou um token nomeado
- `#B47A6B` / `#D9A99B` como defaults podem ficar ou virar defaults do token `--primary`
- Logo selection para Bia Store (`/logos/biastore-gold.svg`, `/logos/biastore-black.svg`) pode ser mantido ou refatorado

### O que NÃO deve ser tocado (lógica de negócio):
- `features?.atacado` — todos os usos (calcula dados, altera schema, exibe módulos)
- `features?.legado` / `isLegado()` — controla visibilidade de módulos
- `features?.crm` — lock/unlock CRM
- `features?.catalogo_b2b` — ativa shell B2B
- `lojaId` como parâmetro de query no Supabase (`.eq('loja_id', lojaId)`) — dados reais
- Cálculo `pix_santander + pix_bb` em Fechamento e NovaVenda — lógica financeira real

### Arquivos com maior densidade de mudanças necessárias:
1. `src/pages/LojaFeminina/index.jsx` — themeVars dark, hero Início, top produtos, AppHeader logo
2. `src/pages/cliente/ClientDashboardDesktop.jsx` — contentVars dark, hero, NovaVenda desktop
3. `src/pages/LojaFeminina/NovaVenda.jsx` — ~30 linhas isDark (botões, seleção, variações)
4. `src/pages/LojaFeminina/ContasPagar.jsx` — TERRACOTA hardcoded
5. `src/pages/LojaFeminina/CatalogoB2BAdminDesktop.jsx` — contentVars dark

### Arquivos com mudanças menores (1–3 linhas):
- `src/pages/LojaFeminina/Relatorios.jsx` — colorScheme + #B85C38 nos gráficos atacado
- `src/pages/LojaFeminina/EstoqueMobile.jsx` — badge #B85C38
- `src/pages/LojaFeminina/index.jsx` (sidebar nav) — `#B85C38` na cor ativa de Contas a Pagar
- `src/pages/cliente/Login.jsx` — logo biastore (2 linhas, visual only)
- `src/pages/cliente/RelatoriosDesktop.jsx` — colorScheme (1 linha)
