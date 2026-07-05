# PROGRESS — Automação de cadastro de loja + Módulo de Fornecedores

Execução autônoma. Este arquivo é atualizado a cada etapa concluída.

> Nota: este arquivo substitui o PROGRESS.md anterior (sobre o redesign visual
> "Studio"), cujo conteúdo estava obsolete — os commits daquela sessão já estão
> mesclados nesta branch (ver `git log`, commits `estilo: ...`/`Merge staging: ...`
> anteriores a este). Se precisar do histórico daquele trabalho, ele está no
> `git log` normal, não precisa ficar documentado aqui.

## ⚠️ Bloqueio de push (ainda ativo nesta sessão)

`git push` retorna `403` nesta sessão (mesmo diagnóstico de sessões anteriores:
a integração do Claude Code tem permissão só de leitura neste repositório).
Combinado com o usuário: prosseguir com a implementação e commitar tudo
**localmente**, sem tentar contornar o bloqueio. O usuário fará o push
manualmente depois que a permissão de escrita for concedida à integração.

**Todos os commits abaixo estão prontos localmente na branch
`claude/stoic-hopper-s1nvqm`, à espera de push.**

---

## FASE 1 — Automação de cadastro de loja nova

### Decisão de arquitetura (desvio da instrução literal, documentado)

A tarefa original pedia para aplicar o formulário em `src/pages/LojaFeminina/`
(mobile) + `src/pages/cliente/ClientDashboardDesktop.jsx` (desktop) — mas
"cadastro de nova loja" é uma função de **administração da equipe Junttos**
(Super Admin), não algo que uma loja já cadastrada deveria ver dentro do
próprio painel. Colocar esse formulário dentro do `LojaClientApp` não faz
sentido arquitetural (uma lojista logada não deveria poder criar outras
lojas) e quebraria a separação AdminApp/LojaClientApp documentada em
`CONTEXT.md` §1.

**Investigação encontrou que o formulário já existe**, em
`src/pages/admin/CadastroCliente.jsx` (rota `/clientes`, modal
`NovoClienteModal`) — já faz upload de logo, extração de cores, upsert em
`lf_config`, criação de usuário via edge function `create-user`, e primeira
cobrança em `jt_cobrancas`. Ou seja, o problema não era "não existe
automação", e sim que essa automação tinha lacunas de segurança/dados e não
era restrita a Super Admin. Optei por **corrigir e reforçar essa tela
existente** em vez de duplicar um formulário novo dentro do app da loja.

"Mobile + desktop" nesta fase = responsividade da própria tela do AdminApp
(que já é um único componente compartilhado, sem split mobile/desktop como
o `LojaFeminina`/`cliente` tem) — não dois arquivos separados.

### O que foi feito

- [x] **Restrição a Super Admin**: nova rota-guard `src/components/SuperAdminRoute.jsx`,
      aplicada em `/clientes` (`src/App.jsx`). Usuários com `role !== 'Super Admin'`
      são redirecionados para `/dashboard`. Item "Clientes" também escondido da
      sidebar (`src/components/Sidebar.jsx`) para não-Super-Admin.
- [x] **Validação de formato de slug**: regex `^[a-z0-9]{3,32}$` antes de salvar
      (`CadastroCliente.jsx`), com mensagem de erro clara.
- [x] **Validação de unicidade de slug (bug crítico corrigido)**: antes do
      `upsert`, a tela agora consulta `lf_config` por `loja_id`/`slug` iguais ao
      valor digitado. Se já existir outra loja com esse slug, bloqueia o
      salvamento com erro nomeando a loja em conflito. **Antes desta correção,
      digitar um slug já usado sobrescrevia silenciosamente a config de outra
      loja em produção** (o `upsert` com `onConflict: 'loja_id'` não tinha
      nenhuma checagem prévia).
- [x] **Defaults de `features` mais seguros**: incluído `catalogo_b2b: false` e
      `legado: false` explicitamente no payload de criação. Sem isso, uma loja
      nova ficava com essas chaves `undefined`, e a regra de acesso ao Catálogo
      B2B (`CONTEXT.md` §18: `features.catalogo_b2b !== false`) trata
      `undefined !== false` como `true` — ou seja, **lojas novas ganhavam
      acesso ao Catálogo B2B sem essa feature ter sido ativada intencionalmente**.
- [x] **Bug corrigido na edge function `create-user`**
      (`supabase/functions/create-user/index.ts`): o usuário criado nunca
      recebia `app_metadata.loja_id` — e é exatamente esse campo que
      `ClientPrivateRoute` (client-side) usa para autorizar o acesso ao
      dashboard da loja (`CONTEXT.md` §4, que já sinalizava isso como pendência
      "verificar"). Sem essa correção, uma loja recém-criada por este fluxo
      ficava com a URL pública acessível, mas o **login da lojista não
      funcionava**. Corrigido passando `app_metadata: { loja_id }` direto no
      `auth.admin.createUser`.
      **Atenção**: esta é uma Supabase Edge Function — o arquivo foi corrigido
      no repo, mas precisa ser reimplantado manualmente
      (`supabase functions deploy create-user`) para valer em produção; não há
      credenciais Supabase nesta sessão para fazer esse deploy.
- [x] Confirmado que os campos já cobertos pelo form existente atendem ao
      pedido: nome, slug, cor_primaria/cor_secundaria (com extração automática
      da logo), plano inicial (starter/pro/business com valores), status,
      toggles de features (atacado, CRM), e-mail/senha de acesso da lojista.
      Confirmação pós-criação já existe (link `https://junttos-admin.vercel.app/<slug>/`
      com botão copiar/abrir).

### Pendências conhecidas (fora do escopo desta sessão, documentadas para o próximo passo)

- Deploy manual da edge function `create-user` corrigida.
- Inconsistência de casing pré-existente (`Dashboard.jsx` filtra
  `status === 'ativo'` minúsculo, mas `CadastroCliente.jsx` grava
  `'Trial'/'Ativo'/'Inativo'` capitalizado) — **não foi tocada** por ser lógica
  de negócio já existente e fora do pedido explícito da tarefa.
- `sualoja`/`ducharmelingerie` não têm SQL de criação versionado no repo —
  foram inseridas manualmente no passado; fora do escopo desta automação.

### Build/lint

- `npm run build`: 0 erros.
- `npx eslint` nos arquivos alterados: mesmos 3 erros pré-existentes de baseline
  (confirmado via `git stash` + lint antes/depois — nenhum erro novo introduzido).

---

## FASE 2 — Módulo de Fornecedores

Status: **investigação concluída, implementação ainda não iniciada nesta
sessão** (ver seção abaixo assim que a implementação começar).

### Investigação

- Não existe hoje tabela de fornecedores nem tabela de "compra"/"entrada de
  estoque". `lf_produtos.fornecedor` é campo de texto livre, preenchido só
  quando `features.atacado === true` (hoje exclusivo da Du Charme).
- `lf_produtos.valor_lote`/`data_vencimento`/`status_pgto` representam, hoje,
  um único "lote atual" por produto (sobrescrito a cada edição) — sem
  histórico. `ContasPagar.jsx` (exclusivo Du Charme, **não mexer**) lê esses
  campos direto do produto.
- Estoque (`src/pages/LojaFeminina/EstoqueMobile.jsx`) é compartilhado
  literalmente entre mobile e desktop (`ClientDashboardDesktop.jsx` importa o
  mesmo componente) — o módulo de Fornecedores deve seguir o mesmo padrão de
  componente único compartilhado.
- Navegação: mobile via `MAIS_ITEMS` em `src/pages/LojaFeminina/index.jsx`;
  desktop via `PLANO_NAV_ITEMS` em `ClientDashboardDesktop.jsx`. Fornecedores
  será adicionado com `planoMinimo: null` (feature operacional, não de plano),
  disponível para todas as lojas.

(Continua na próxima etapa desta sessão, se houver orçamento; caso contrário,
a implementação começará do zero na próxima sessão a partir deste ponto.)
