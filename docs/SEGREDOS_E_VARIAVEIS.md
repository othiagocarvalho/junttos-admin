# Segredos e variáveis de ambiente

> **A regra, em uma frase: o prefixo `VITE_` significa "publicado no ar".**
> Use `VITE_` só para valor que pode aparecer no navegador de qualquer
> visitante. Nunca para service key, senha ou token.
>
> Vale para este repositório inteiro — front-end, scripts e painel da Vercel.
> Se você está prestes a criar uma variável nova, comece por aqui.

---

## 1. Por que o prefixo decide tudo

No Vite, o navegador não lê variável de ambiente: **o valor é substituído no
código durante o build**. Cada `import.meta.env.VITE_ALGUMA_COISA` vira o texto
literal do valor dentro do arquivo `.js` que o site entrega. Não há
criptografia, não há proteção de rota, não há "só o admin vê". Qualquer pessoa
abre o site, salva o bundle e lê.

Variáveis **sem** o prefixo `VITE_` não entram no bundle. Elas existem só no
processo de build da Vercel e no seu terminal — que é exatamente onde uma chave
de servidor deve viver.

Consequência prática: o nome da variável não é detalhe de estilo. **O nome é o
controle de acesso.**

## 2. O que já aconteceu aqui

Uma auditoria encontrou três variáveis configuradas na Vercel (Production e
Preview) com o prefixo errado:

- `VITE_SUPABASE_SERVICE_KEY` — a chave que ignora RLS e dá acesso total ao banco
- `VITE_ADMIN_PASSWORD`
- `VITE_GESTOR_PASSWORD`

Os bundles publicados foram verificados e **estavam limpos**: nenhum arquivo em
`src/` lia essas variáveis, então o Vite não tinha motivo para injetá-las. O
risco era **dormente**, não consumado — mas a distância entre "não vazou" e
"vazou" era uma única linha de código. Bastaria alguém escrever
`import.meta.env.VITE_SUPABASE_SERVICE_KEY`, ou espalhar o objeto de ambiente
inteiro (`{ ...import.meta.env }`), para a chave sair publicada no próximo
deploy — sem erro, sem aviso, sem nada quebrando.

A correção tem duas metades. A do código está feita: os scripts de servidor
não leem mais o nome com prefixo (seção 4) e a trava da seção 5 impede a volta
do problema. A outra metade é manual e mora fora do repositório — renomear as
três variáveis no painel da Vercel (tirando o `VITE_`) e rotacionar a service
key no Supabase (seção 6). Enquanto essa metade não for feita, as variáveis
seguem lá com o nome de risco.

## 3. Tabela de decisão

| Valor | Prefixo | Por quê |
| --- | --- | --- |
| URL do Supabase | `VITE_SUPABASE_URL` ✅ | É pública — aparece em toda request do navegador |
| Chave anon / publishable | `VITE_SUPABASE_ANON_KEY` ✅ | Pública por desenho; quem protege o dado é a RLS |
| **Service key / `sb_secret_…`** | `SUPABASE_SERVICE_KEY` ⛔ sem `VITE_` | Ignora RLS. No navegador, entrega o banco inteiro |
| **Senha administrativa** | sem `VITE_` ⛔ | Senha não se compara no cliente. Autenticação é no Supabase Auth |
| Token de API de terceiro | sem `VITE_` ⛔ | Se o navegador precisa chamar, ponha uma função de servidor no meio |
| Flag de UI, nome de ambiente | `VITE_` ✅ | Não é segredo |

Na dúvida, o teste é único: **"posso colar esse valor num tweet?"** Se a
resposta é não, o nome não leva `VITE_`.

Um caso à parte: `VITE_ADMIN_EMAIL` e `VITE_GESTOR_EMAIL` continuam com
prefixo. E-mail não é credencial, e nenhum código os lê hoje — mas expor quem é
o administrador facilita ataque dirigido. Se um dia forem usados, prefira
resolver o papel pelo banco (`lf_config`), não por variável de build.

## 4. Como usar a chave de serviço nos scripts

Os scripts em `scripts/` rodam no seu terminal, nunca no navegador. Eles leem
`SUPABASE_SERVICE_KEY` — do ambiente, ou do `.env` na raiz como fallback:

```bash
SUPABASE_SERVICE_KEY=<chave> node scripts/import-audaz.mjs --apply
```

`scripts/import-audaz.mjs` e `scripts/importarFotosTropicale.js` tinham
fallback para o nome antigo com prefixo. Hoje eles leem só o nome novo e, se
encontrarem o antigo, **avisam em vez de usá-lo** — usar em silêncio manteria
vivo justamente o nome que precisa desaparecer.

O `.env` da raiz é ignorado pelo git (`.gitignore` cobre `.env*`) e é gerado
por `vercel env pull`. Depois de renomear as variáveis na Vercel, rode o pull
de novo para o `.env` local acompanhar.

## 5. A trava automática

`scripts/verificar-segredos-no-bundle.mjs` roda encadeado no `npm run build`
(`vite build && node scripts/verificar-segredos-no-bundle.mjs`), então **um
deploy com segredo exposto não completa**. Ela reprova, com código de saída 1:

1. **No bundle (`dist/`)** — uma chave `sb_secret_…`, ou um JWT do Supabase
   cujo payload declara `role: service_role`. A chave `anon` tem o mesmo
   formato e passa: a diferença está no payload, não na aparência.
2. **No código-fonte (`src/`)** — a mesma coisa colada em texto puro, ou um
   acesso ao ambiente do Vite **sem propriedade nomeada atrás**:
   `{ ...import.meta.env }`, `const env = import.meta.env`,
   `JSON.stringify(import.meta.env)`, `import.meta.env[chave]`. Todos fazem o
   Vite injetar o objeto inteiro de variáveis `VITE_` no bundle. Ler uma
   propriedade nomeada (`import.meta.env.VITE_SUPABASE_URL`) é seguro e passa.

A regra 2 é a que importa mais: ela pega o risco **antes** de virar chave
publicada.

```bash
npm run verificar:segredos                 # bundle + fonte (exige dist/)
npm run verificar:segredos -- --sem-bundle # só o código-fonte, sem build
```

A lógica de detecção vive em `src/utils/segredosBundle.js`, em funções puras,
e está coberta por `src/utils/segredosBundle.test.js` — que inclui teste de
mutação: aponta a trava para pastas-isca com cada padrão de risco e confirma
que ela realmente reprova. Uma trava que nunca falhou não é uma trava.

### Quando a trava reprovar

1. **Não apague e siga.** Se um segredo real chegou a ser publicado, remover do
   código não desfaz o download de quem já visitou o site. **Rotacione a chave**
   (seção 6) antes de qualquer outra coisa.
2. Corrija a causa: renomeie a variável tirando o `VITE_`, ou troque o acesso
   ao ambiente inteiro por leitura de propriedade nomeada.
3. Rode `npm run build` de novo e confirme o verde.

Não desligue a trava para destravar um deploy. Se ela estiver acusando algo
que você tem certeza que é seguro, o lugar de tratar a exceção é
`src/utils/segredosBundle.js`, com comentário explicando o porquê.

## 6. Rotacionar a service key do Supabase

Faça isto sempre que uma chave for exposta — e também quando ela só *pode* ter
sido, que é o caso quando ela passou tempo demais com um nome de risco.

1. Painel do Supabase → **Project Settings → API Keys**.
2. Gere a nova chave de serviço (`Generate new key` / `Roll`). Copie o valor —
   ele só aparece inteiro uma vez.
3. Atualize onde a chave é consumida, **antes** de revogar a antiga:
   - Vercel → variável `SUPABASE_SERVICE_KEY` (Production e Preview);
   - seu `.env` local (ou `vercel env pull` depois de atualizar lá);
   - qualquer automação ou CI que use a chave.
4. Revogue a chave antiga no painel.
5. Confirme que os scripts de servidor ainda autenticam — um dry-run já basta:
   `node scripts/import-audaz.mjs` (sem `--apply`, não grava nada).

Rotacionar invalida a chave antiga na hora. Se algum lugar esquecido ainda a
usava, ele para de funcionar — o que é o comportamento correto, e é melhor
descobrir agora do que deixar uma chave viva circulando.

## 7. Checklist para variável nova

- [ ] O valor pode ser público? Se não, o nome **não** leva `VITE_`.
- [ ] Se leva `VITE_`, o código lê propriedade nomeada, nunca o objeto inteiro.
- [ ] Está no `.gitignore` (`.env*` já cobre) e fora de qualquer commit.
- [ ] Configurada nos ambientes certos da Vercel (Production, Preview, Development).
- [ ] `npm run build` passa — a trava confirma que nada vazou.
