# Catálogo de Loja — Especificação completa para implementação

> Contexto: sistema SaaS multi-loja (white-label) para lojistas de roupa. Cada loja tem seu catálogo público em `/{slug-da-loja}/catalogo`. Este documento é a especificação FINAL e aprovada de UI/UX. Implemente exatamente como descrito. Onde houver dúvida, prefira a opção descrita aqui em vez de "melhorar".
>
> Público: lojas femininas E masculinas. **Layout é o mesmo para os dois.** O que muda vem do cadastro da loja (produtos, categorias, tamanhos, nome, vídeo/capa). Não existem dois layouts.
>
> Prioridade: **mobile-first**. A maioria dos clientes compra pelo celular. Tudo abaixo vale para mobile e desktop; as diferenças estão na seção "Responsividade".

---

## 1. Princípios não-negociáveis

1. **Qualquer pessoa consegue comprar**, inclusive quem nunca comprou online. Linguagem simples, nada de jargão ("SKU", "grade fechada", "variação").
2. **Nenhuma frase decorativa no botão do produto.** O card inteiro é clicável (padrão de e-commerce). Sem "Escolher cor e tamanho" escrito no card.
3. **Densidade alta no topo.** O espaço antes do primeiro produto é caro no celular. Nada do topo ocupa mais de uma linha.
4. **Alvos de toque:** mínimo 32px, ideal 44px+ nos botões principais.
5. **Sem gradientes coloridos, sem emoji.** Paleta neutra + uma cor de ação (verde WhatsApp).

---

## 2. O que é CONFIGURÁVEL

### 2.1 No cadastro da loja (painel do lojista)

| Campo | Tipo | Default | Efeito |
|---|---|---|---|
| `nome` | texto | — | Nome no cabeçalho + inicial no quadrado do logo |
| `subtitulo` | texto | "Catálogo online" | Linha pequena sob o nome |
| `logoUrl` | imagem | vazio | Se existir, substitui o quadrado com a inicial |
| `publico` | enum `feminino` \| `masculino` \| `unissex` | — | Define categorias e grade de tamanhos padrão. **Não muda o layout.** |
| `modoVenda` | enum `atacado` \| `varejo` | `atacado` | `atacado`: mostra faixa de pedido mínimo e sufixo "/ peça" nos preços. `varejo`: esconde ambos |
| `pedidoMinimo` | número (centavos) | 0 | Se `0`, a faixa preta não aparece |
| `whatsapp` | telefone E.164 | — | Destino dos botões verdes |
| `checkoutOnline` | boolean | false | Mostra/esconde "Pagar agora pelo site" |
| `textoEnvio` | texto | "Enviamos para todo o Brasil." | Bloco "Envio" no rodapé |
| `videoTopo.ativo` | boolean | false | Liga a faixa de vídeo/capa acima do cabeçalho |
| `videoTopo.videoUrl` | arquivo mp4/webm | vazio | Vídeo de fundo (autoplay, muted, loop, playsinline) |
| `videoTopo.imagemUrl` | imagem | vazio | Fallback / poster. Se não houver vídeo, usa a imagem com animação lenta de zoom |
| `videoTopo.etiqueta` | texto | "Coleção nova" | Linha maiúscula pequena sobre o vídeo |
| `videoTopo.titulo` | texto | nome da loja | Título serif grande sobre o vídeo |
| `apresentacao.etiqueta` | texto | vazio | Bloco de apresentação (opcional) |
| `apresentacao.titulo` | texto | vazio | idem |
| `apresentacao.descricao` | texto | vazio | idem |

**Regra da apresentação:** se `etiqueta`, `titulo` e `descricao` estiverem TODOS vazios, o bloco grande de apresentação **não é renderizado** e no lugar aparece apenas a linha fina dos 3 passos. Se qualquer um estiver preenchido, aparece o bloco grande (título serif + descrição + os 3 passos em coluna). Esse é o estado padrão e aprovado: **vazio**.

### 2.2 No cadastro do produto

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | string | sim | |
| `nome` | texto | sim | |
| `preco` | número (centavos) | sim | |
| `categoria` | string | sim | Alimenta os chips de filtro dinamicamente |
| `selo` | enum `""` \| `Novo` \| `Mais vendido` \| livre | não | Badge preta no canto superior esquerdo da foto |
| `fotos[]` | imagens | sim (≥1) | A 1ª é a capa do card. As demais viram miniaturas na galeria do modal |
| `cores[]` | `{nome, hex}` | não | Se vazio ou 1 item, o produto não tem escolha de cor |
| `tamanhos[]` | string[] | não | Se vazio ou `["Único"]`, o produto não tem escolha de tamanho |
| `ativo` | boolean | sim | Inativo não aparece no catálogo |

Se `tamanhos` não for informado, herda a grade padrão da loja (`feminino`: P M G GG · `masculino`: P M G GG XG).

### 2.3 Textos fixos configuráveis (i18n / painel)

Todos os textos abaixo devem ficar em arquivo de tradução, não hardcoded:
`"Buscar peça… ex: vestido"`, `"Pedido"`, `"Tudo"`, `"⇅ Ordenar"`, `"Menor preço"`, `"Maior preço"`, `"Nome A–Z"`, `"Escolha o produto"`, `"Confira o pedido"`, `"Pagamento"`, `"Pedido mínimo de {valor}."`, `"Faltam {valor} para atingir o pedido mínimo de {min}."`, `"Pedido mínimo atingido. Você já pode finalizar."`, `"Nada encontrado"`, `"Tente outra palavra ou toque em \"Tudo\"."`, `"Envio"`, `"Precisa de ajuda?"`, `"Fale direto com a loja no WhatsApp."`, `"Chamar no WhatsApp"`, `"Meu pedido"`, `"Seu pedido está vazio"`, `"Toque em uma peça e escolha cor e tamanho."`, `"Total"`, `"Enviar pedido no WhatsApp"`, `"Pagar agora pelo site"`, `"Toque para ampliar"`, `"Adicionar ao pedido"`, `"Você pode misturar cores e tamanhos livremente. Não há grade fechada."`.

---

## 3. Design tokens (valores exatos)

### Cores

--fundo: 
#FBF9F5 /* fundo da página /
--superficie: #FFFDF9 / cards, inputs /
--superficie-2: #F5F1E8 / rodapé, base de modal/drawer /
--superficie-3: #F2EDE3 / hover suave /
--foto-placeholder: #F4EFE6
--tinta: #191713 / texto principal, botões pretos /
--tinta-hover: #312C24
--texto-2: #443F35
--texto-3: #6E695C
--texto-4: #8B8577
--texto-5: #948D7C / legendas dentro do card */
--linha: 
#E8E2D6
--linha-card: 
#EBE5D9
--linha-input: 
#E1DACB
--linha-hover: 
#D6CCB6
--whatsapp: 
#0F7B45 (hover 
#0B6739)
--alerta-fundo: 
#FFF6E6 borda 
#F0DEB8 texto 
#6B4E14


### Tipografia

Corpo/UI: 'Instrument Sans' (400/500/600/700)
Display: 'Instrument Serif' (400) — usada APENAS em: preço no card,
preço no modal, total do carrinho, subtotal do modal,
título do vídeo, título da apresentação
Antialias: -webkit-font-smoothing: antialiased
text-wrap: pretty em todo título e parágrafo


### Raios e sombras

Card produto: 20px Foto do card: herda (overflow hidden)
Modal: 24px Botões: 13–14px Inputs: 14px
Chips/pílulas: 99px Células de tamanho: 12px
Drawer: box-shadow: -24px 0 60px rgba(25,23,19,.18)
FAB "+" na foto: box-shadow: 0 4px 14px rgba(25,23,19,.28)
Toast: box-shadow: 0 12px 34px rgba(25,23,19,.28)


### Animações
```css
@keyframes slideUp { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes fadeIn  { from{opacity:0} to{opacity:1} }
@keyframes kenburns{ 0%{transform:scale(1.05)} 100%{transform:scale(1.22) translate3d(-2%,-3%,0)} }
/* modal e drawer: slideUp .22s ease · overlays: fadeIn .18s ease
   capa do topo (quando é imagem, não vídeo): kenburns 18s ease-in-out infinite alternate */
```

---

## 4. Estrutura da página, de cima para baixo

### 4.1 Faixa de vídeo (opcional, ACIMA do cabeçalho)
- Só renderiza se `videoTopo.ativo`.
- `position:relative; height:clamp(210px,32vw,340px); overflow:hidden; background:#191713`
- Mídia em `position:absolute;inset:0;width:100%;height:100%;object-fit:cover`.
  - Vídeo: `<video autoplay muted loop playsinline preload="metadata" poster={imagemUrl}>`; respeitar `prefers-reduced-motion` (nesse caso, mostrar só o poster).
  - Sem vídeo: `<img>` com `animation:kenburns 18s ease-in-out infinite alternate`.
- Overlay: `linear-gradient(180deg, rgba(25,23,19,.34) 0%, rgba(25,23,19,.1) 40%, rgba(25,23,19,.8) 100%)`
- Conteúdo ancorado embaixo (`padding:22px 20px; max-width:1280px; margin:0 auto`):
  - etiqueta: `11.5px/600`, `letter-spacing:.16em`, uppercase, `rgba(251,249,245,.8)`
  - título: Instrument Serif, `clamp(28px,4.4vw,46px)`, `line-height:1.05`, `#FBF9F5`
- **Não é sticky.** Rola para fora normalmente.

### 4.2 Cabeçalho (sticky)
`position:sticky; top:0; z-index:40; background:rgba(251,249,245,.92); backdrop-filter:blur(14px); border-bottom:1px solid #E8E2D6`
Conteúdo: `max-width:1280px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; gap:18px; flex-wrap:wrap`

1. **Marca** (`flex:none`): quadrado 44×44, raio 12, fundo `#191713`, inicial do nome em 19px/700 branco (ou `logoUrl`). Ao lado: nome `17px/600` (com ellipsis) e subtítulo `12.5px #8B8577`.
2. **Busca** (`flex:1 1 190px; min-width:140px`, relativo): ícone `⌕` absoluto em `left:16px`, `17px #A39C8C`; input `height:50px`, borda `1px #E1DACB`, raio 14, fundo `#FFFDF9`, `padding:0 16px 0 42px`, `font-size:16px` (16px é obrigatório: evita zoom automático no iOS), `:focus` → `border-color:#191713`.
3. **Botão Pedido** (`flex:none`): `height:50px; padding:0 15px`, raio 14, fundo `#191713`, texto "Pedido" `14.5px/600` + contador em pílula clara (`min-width:24px;height:24px`, fundo `#FBF9F5`, texto `#191713` 13px/700). Hover `#312C24`. Abre o drawer.

> No celular esses 3 itens quebram naturalmente em 2 linhas (marca / busca+botão) por causa do `flex-wrap`. **Não force layout diferente.** Altura resultante ≈ 141px.

### 4.3 Linha dos 3 passos (quando não há apresentação)
Uma linha só, com rolagem horizontal se não couber:
`padding:14px 0 12px; display:flex; gap:16px; align-items:center; overflow-x:auto; scrollbar-width:none; white-space:nowrap`
Cada passo: círculo 19×19 preto com número (`11px/700` branco) + texto `13px #6E695C`. Entre eles, uma seta `→` em `#CFC6B4` 12px.
Textos: **"Escolha o produto" → "Confira o pedido" → "Pagamento"**.

### 4.4 Bloco de apresentação (quando há texto)
`padding:36px 0 26px; display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:26px; align-items:end`
- Coluna 1: etiqueta `12px/600 .14em uppercase #A0987F` → h1 Instrument Serif `52px/1.02` → parágrafo `16.5px/1.55 #6E695C`, `max-width:44ch`.
- Coluna 2: os 3 passos em coluna, círculos 30×30 pretos, textos `15px/1.45 #443F35` com a palavra-chave em `600`.

### 4.5 Faixa de pedido mínimo (só `atacado` e `pedidoMinimo > 0`)
`display:flex; align-items:center; gap:12px; background:#191713; border-radius:13px; padding:11px 14px; margin-bottom:14px`
- Texto: `13.5px/600 #FBF9F5`, uma linha, `min-width:0` para truncar com elegância.
- Barra: `flex:0 0 84px; height:6px; border-radius:99px; background:rgba(251,249,245,.24)`; preenchimento `#FBF9F5` com `width: min(100%, total/minimo*100)%`.
- Estados do texto:
  - carrinho vazio → `"Pedido mínimo de {min}."`
  - abaixo do mínimo → `"Faltam {falta} para atingir o pedido mínimo de {min}."`
  - atingido → `"Pedido mínimo atingido. Você já pode finalizar."`

### 4.6 Filtros (uma linha)
`display:flex; gap:10px; align-items:center; padding-bottom:16px`
- **Chips** em faixa rolável: `flex:1 1 auto; min-width:0; overflow-x:auto; scrollbar-width:none; gap:7px`. Cada chip: `height:34px; padding:0 14px; border-radius:99px; font-size:13.5px/500; white-space:nowrap; flex:none`.
  - inativo: fundo `#FFFDF9`, borda `1px #E1DACB`, texto `#443F35`
  - ativo: fundo `#191713`, borda `#191713`, texto `#FBF9F5`
  - Primeiro chip é sempre **"Tudo"**; os demais vêm das categorias distintas dos produtos ativos, na ordem de cadastro.
- **Ordenação**: `<select>` `flex:none; height:34px; max-width:126px`, raio 99px, borda `#E1DACB`, fundo `#FFFDF9`, `13.5px #443F35`. Opções: `⇅ Ordenar` (= destaque/ordem de cadastro), `Menor preço`, `Maior preço`, `Nome A–Z` (usar `localeCompare(..., 'pt')`).

### 4.7 Grade de produtos
```css
display: grid;
grid-template-columns: repeat(auto-fill, min(46%, 258px));
gap: clamp(12px, 1.4vw, 22px);
justify-content: center;
padding-bottom: 64px;
```
> Esse `min(46%,258px)` é o coração da responsividade: garante **exatamente 2 colunas no celular** (161px cada em tela de 390px) e cards travados em 258px no desktop, **sem media query e sem JavaScript**. Não substituir por breakpoints.

> **Trilha única, nunca `minmax()` com máximo fixo.** Duas versões anteriores erraram aqui e a segunda chegou a produção:
> | versão | regra | resultado |
> |---|---|---|
> | original | `minmax(min(48%, 258px), 1fr)` | 2 colunas ok, mas o card esticava até ~294px no desktop |
> | 20/08/2026 | `minmax(min(46%, 258px), 258px)` | card travado ok, mas **1 coluna em todo celular** |
> | atual | `min(46%, 258px)` | 2 colunas de 320px a ~600px, card travado em 258px |
>
> O motivo é o CSS Grid §7.2.3.1: para decidir quantas vezes repetir, o `auto-fill` usa a função de tamanho **máxima** da trilha quando ela é definida — não a mínima. Com máximo `258px` fixo o navegador pergunta "quantas colunas de 258px cabem?", e em 350px de conteúdo cabe uma só; o `min(46%, 258px)` do mínimo nunca era consultado. Com trilha única não existe essa divergência.
>
> Medido no Chrome (CDP, `Emulation.setDeviceMetricsOverride`) na página real da tropicaleatacado: 320→2 colunas de 128,8px · 375→2 de 154,1px · 390→2 de 161px · 430→2 de 179,4px · 768→2 de 258px · 1024→3 de 258px · 1280 e 1440→4 de 258px. Sem overflow horizontal em nenhuma.
>
> Valores de **layout** não se validam por aritmética: o modelo do `auto-fill` usado no teste da versão 20/08/2026 contava pelo mínimo, dava 2 colunas na conta e passava verde enquanto o device real mostrava 1. Qualquer recalibragem daqui precisa de medição em navegador.

**Card** (`<article>` inteiro clicável, `cursor:pointer`, abre o modal):
`background:#FFFDF9; border:1px solid #EBE5D9; border-radius:20px; overflow:hidden; display:flex; flex-direction:column`; hover → `border-color:#D6CCB6`.

- **Área da foto**: `position:relative; aspect-ratio:3/4; background:#F4EFE6; overflow:hidden`; `<img>` `width:100%;height:100%;object-fit:cover`.
  - Selo (se houver): topo-esquerda `12px`, fundo `#191713`, texto `11.5px/600 .08em uppercase #FBF9F5`, `padding:6px 10px`, raio 99px.
  - Badge "N no pedido" (se o produto já tem itens no carrinho): topo-direita `12px`, fundo `#FBF9F5`, borda `1px #E1DACB`, texto `12.5px/700 #191713`.
  - **FAB "+"**: canto inferior direito `10px`, círculo 40×40, fundo `#191713`, "+" 22px `#FBF9F5`. É indicativo visual — o clique é do card todo.
- **Corpo**: `padding:clamp(11px,1.3vw,16px); display:flex; flex-direction:column; gap:10px; flex:1`
  1. Nome `clamp(13.5px,1.5vw,15.5px)/600`, `line-height:1.3`.
  2. Legenda `12.5px #948D7C` — regra na seção 6.
  3. Preço: Instrument Serif `clamp(21px,2.3vw,27px)` + sufixo `13px #948D7C` (`"/ peça"` só em atacado).
  4. Bolinhas de cor (`margin-top:auto`): 20×20, raio 99px, `border:1px solid rgba(0,0,0,.14)`, `box-shadow:inset 0 0 0 2px #FFFDF9`, `title` = nome da cor.
- **Sem botão de texto no card.**

**Estado vazio** (busca/filtro sem resultado): `padding:80px 20px; text-align:center` → "Nada encontrado" `19px #443F35` + "Tente outra palavra ou toque em "Tudo"." `15px #8B8577`.

### 4.8 Rodapé
`border-top:1px solid #E8E2D6; background:#F5F1E8; margin-top:20px`
Conteúdo: `max-width:1280px; padding:28px 20px; display:flex; gap:18px; align-items:center; justify-content:space-between; flex-wrap:wrap`
1. **Envio** (`flex:1 1 200px`): título `16.5px/600` + texto `14.5px/1.5 #6E695C`.
2. **Precisa de ajuda?**: título `16.5px/600` + "Fale direto com a loja no WhatsApp."
3. **Botão "Chamar no WhatsApp"** (`flex:none`): `height:52px; padding:0 24px`, raio 14, fundo `#0F7B45`, texto `16px/600` branco. Abre `wa.me` sem pedido anexado.

Ordem obrigatória: Envio → Ajuda → Botão. **Não incluir** "Como pagar" nem horário de atendimento.

---

## 5. Modal do produto

Overlay: `position:fixed; inset:0; z-index:70; background:rgba(25,23,19,.5); display:flex; align-items:center; justify-content:center; padding:20px`.
Card: `background:#FBF9F5; border-radius:24px; width:min(1020px,100%); max-height:92vh; overflow:auto; display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))`
> Mesma técnica de responsividade: 2 colunas no desktop, empilhado no celular, sem media query.

**Coluna da foto** (`position:relative; overflow:hidden; min-height:340px; min-width:0`):
- Wrapper `position:absolute;inset:0;cursor:zoom-in`; `<img>` `position:absolute;inset:0;object-fit:cover;transition:transform .18s ease`.
- **Zoom:** clique alterna `scale(1)` ⇄ `scale(2.1)`. Com zoom ativo, `mousemove` atualiza `transform-origin` para o ponto do cursor (`%` do bounding rect); `mouseleave` desliga o zoom. No touch, o clique já dá o zoom central — opcionalmente suportar arrastar para pan.
- **Miniaturas** (se ≥2 fotos): `position:absolute; left:14px; bottom:14px; gap:8px`; cada uma 52×66, raio 9, `border:2px solid` (`#191713` na ativa, `rgba(255,255,255,.7)` nas outras).
- Dica: `position:absolute; right:14px; bottom:14px`, pílula `rgba(251,249,245,.92)`, `12.5px #443F35`, texto "Toque para ampliar".

**Coluna de escolha** (`display:flex; flex-direction:column; max-height:92vh`):
1. **Topo** (`padding:22px 24px 0`): categoria `12px/600 .12em uppercase #A0987F`; nome `24px/600`; preço Instrument Serif `32px` + sufixo `14px #948D7C` (`"/ peça no atacado"`); botão ✕ 42×42 à direita.
2. **Miolo** (`padding:20px 24px; overflow-y:auto; flex:1`):
   - Pergunta `14px/600` — texto dinâmico (seção 6).
   - **Uma caixa por cor** (`border:1px solid #EBE5D9; border-radius:16px; background:#FFFDF9; padding:14px`): cabeçalho com bolinha 22×22 + nome da cor `15px/600` + resumo à direita (`"{n} peças"` ou vazio) `13.5px #8B8577`.
   - Dentro: `display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr)); gap:10px`. Cada célula = um tamanho: rótulo `12.5px/600 .06em #6E695C`, e stepper `−` (32×32, borda `#E1DACB`, fundo `#FFFDF9`) / número `15.5px/700` / `+` (32×32, fundo `#191713`, texto claro).
     - célula com qtd > 0: fundo `#F2EDE3`, borda `#191713`.
     - se o produto não tem tamanhos, existe **uma única célula** com rótulo **"Quantidade"**.
   - Nota final `14px/1.55 #6E695C`: atacado → "Você pode misturar cores e tamanhos livremente. Não há grade fechada."; varejo → "Selecione a quantidade desejada de cada tamanho."
3. **Base fixa** (`border-top:1px solid #E8E2D6; padding:16px 24px 20px; background:#F5F1E8; display:flex; gap:14px; flex-wrap:wrap`):
   - Resumo `13px #8B8577` ("Escolha as quantidades" / "{n} peças selecionadas") + subtotal Instrument Serif `26px`.
   - Botão **"Adicionar ao pedido"** `flex:1 1 200px; height:54px`, fundo `#191713`, `16px/600`.

**Comportamento:** as quantidades do modal são um **rascunho**. Só entram no pedido ao confirmar. Ao confirmar: soma no carrinho (chave `produtoId|cor|tamanho`), fecha o modal, **abre o drawer** e mostra toast "{n} peças adicionadas ao pedido". Se nada foi escolhido: toast "Escolha ao menos uma peça" e o modal permanece aberto.

---

## 6. Copy dinâmica (regras exatas)

Sejam `temCor = cores.length > 1` e `temTam = tamanhos.length > 1 || tamanhos[0] !== "Único"`.

**Legenda do card** = `[parte1, parte2].join(" · ")`:
- parte1: `temCor` ? `"{n} cores"` : nome da única cor (ex.: "Preto")
- parte2: `temTam` ? tamanhos separados por espaço (ex.: "P M G GG") : `"Tamanho único"`

**Pergunta no modal:**
| temCor | temTam | Texto |
|---|---|---|
| ✓ | ✓ | "Quantas peças de cada cor e tamanho?" |
| ✓ | ✗ | "Quantas peças de cada cor?" |
| ✗ | ✓ | "Quantas peças de cada tamanho?" |
| ✗ | ✗ | "Quantas peças você quer?" |

**Rótulo da célula:** o tamanho, ou `"Quantidade"` quando não há tamanhos.

**Nunca** escrever "cor e tamanho" quando o produto só tem um dos dois.

---

## 7. Drawer "Meu pedido"

Overlay `rgba(25,23,19,.42)` z-index 60 (clique fecha). Painel `position:fixed; top:0; right:0; bottom:0; width:min(430px,100vw); background:#FBF9F5; z-index:61; display:flex; flex-direction:column`.

1. **Cabeçalho** (`padding:20px; border-bottom:1px solid #E8E2D6`): "Meu pedido" `18px/600` + resumo `13.5px #8B8577` ("Nenhuma peça ainda" ou "{n} peças · {m} variações"); botão ✕ 42×42.
2. **Lista** (`flex:1; overflow-y:auto; padding:16px 20px; gap:14px`): por linha — foto 66×88 raio 10; nome `14.5px/600`; variação `13.5px #8B8577` no formato **"{Cor} · Tamanho {T}"** (omitir a parte inexistente); stepper `−`/qtd/`+` (36×36) e total da linha `14.5px/600` à direita. Zerar remove a linha.
   - Vazio: "Seu pedido está vazio" + "Toque em uma peça e escolha cor e tamanho."
3. **Base** (`border-top; padding:18px 20px 22px; background:#F5F1E8`):
   - Se abaixo do mínimo: aviso `background:#FFF6E6; border:1px solid #F0DEB8; color:#6B4E14; 14px`, texto "Faltam {valor} para o pedido mínimo. Adicione mais peças para finalizar."
   - Linha "Total" `15px #6E695C` + valor Instrument Serif `32px`.
   - Botão **"Enviar pedido no WhatsApp"** `height:54px`, fundo `#0F7B45`.
   - Botão **"Pagar agora pelo site"** `height:54px`, fundo `#FFFDF9`, borda `1px #191713` (só se `checkoutOnline`).
   - Se abaixo do mínimo, os dois botões **não avançam**: mostram toast "Adicione mais peças para atingir o mínimo".

**Toast:** `position:fixed; left:50%; bottom:26px; transform:translateX(-50%); z-index:80; background:#191713; color:#FBF9F5; padding:14px 22px; border-radius:99px; 15px/500`; dura 2,4s; `animation:slideUp .2s ease`.

---

## 8. Integrações

### 8.1 WhatsApp
Abrir `https://wa.me/{telefoneE164}?text={mensagemUrlEncoded}` em nova aba.

Modelo da mensagem (uma linha por variação):

Olá! Quero fazer um pedido no catálogo da {nomeLoja}.

Vestido Curto Franzido Flor — Coral / M — 3x R$ 44,90 = R$ 134,70
Vestido Curto Franzido Flor — Rosa / G — 2x R$ 44,90 = R$ 89,80
Saia Longa Fenda Gringa — Vinho — 5x R$ 39,90 = R$ 199,50

Total: 10 peças — R$ 424,00
Pedido feito em: {url do catálogo}

- Omitir " / {tamanho}" quando não houver tamanho; omitir a cor quando houver apenas uma.
- Formatar moeda pt-BR (`R$ 1.234,56`).
- Registrar o pedido no backend ANTES de abrir o WhatsApp (status `aguardando_contato`) para o lojista ver no painel mesmo se o cliente não enviar a mensagem.

### 8.2 Checkout online
Mesmo carrinho → criar pedido (status `aguardando_pagamento`) → redirecionar para o provedor (Pix / cartão até 6x). Bloquear se abaixo do mínimo.

### 8.3 Persistência
Carrinho em `localStorage` com chave `catalogo:{lojaId}:carrinho` (TTL 7 dias), restaurado ao abrir. Nunca limpar chaves de outras lojas.

---

## 9. Estado da aplicação

```ts
type Chave = `${produtoId}|${cor}|${tamanho}`;   // cor/tamanho = "" quando não existem

state = {
  busca: string,             // filtro por nome OU categoria, case-insensitive, trim
  categoria: string,         // "Tudo" por padrão
  ordem: 'destaque'|'menor'|'maior'|'nome',
  carrinho: Record<Chave, number>,   // quantidades > 0
  drawerAberto: boolean,
  produtoAberto: string|null,
  rascunho: Record<`${cor}|${tamanho}`, number>,  // limpo ao abrir o modal
  fotoIndice: number,
  zoom: boolean,
  zoomOrigem: string,        // "50% 50%"
  toast: { texto: string, visivel: boolean }
}
```
Derivados: `totalPecas`, `totalValor`, `linhasDoCarrinho`, `faltaMinimo`, `progressoMinimo`, `qtdPorProduto`.

---

## 10. Responsividade

| Faixa | Comportamento |
|---|---|
| ≤ 430px (celular) | Cabeçalho em 2 linhas (≈141px). Grade **2 colunas** (128,8px em 320 · 161px em 390 · 179,4px em 430). Chips e 3 passos com rolagem horizontal. Modal empilhado (foto em cima, ≥340px de altura). Drawer ocupa 100vw. Faixa de vídeo ≈210px. Espaço total antes do 1º produto ≈ 300px com vídeo desligado. |
| 431–819px | Grade 2–3 colunas conforme largura. Modal ainda pode empilhar. |
| ≥ 820px | Cabeçalho em 1 linha. Grade 3–5 colunas (cards ≤258px). Modal em 2 colunas (máx. 1020px). Drawer 430px. |

Nada disso usa media query: `min(46%,258px)`, `clamp()` e `flex-wrap` resolvem. **Não introduza breakpoints** — o layout precisa funcionar dentro de iframes e webviews de qualquer largura.

---

## 11. Acessibilidade

- Input de busca com `font-size:16px` (evita zoom no iOS).
- Todo botão-ícone com `aria-label` ("Fechar", "Aumentar quantidade", "Ver foto 2").
- Modal e drawer: focar o primeiro elemento ao abrir, `Esc` fecha, foco preso dentro (focus trap), `aria-modal="true"`, `role="dialog"`, travar o scroll do body.
- Card clicável precisa ser acessível por teclado (`role="button"`, `tabIndex=0`, Enter/Espaço).
- Contraste: todo texto sobre `#FBF9F5` usa no mínimo `#6E695C`.
- `prefers-reduced-motion`: desligar kenburns, autoplay de vídeo e as animações de entrada.

---

## 12. Fotos dos produtos

- Card usa `aspect-ratio:3/4` + `object-fit:cover`. **Peça ao lojista fotos em retrato (3:4)** ou faça o corte no upload.
- Se a foto original for paisagem/composta (ex.: mockup com adulto + infantil na mesma imagem), o corte automático central corta pela metade e fica ruim. Regra: **na ingestão, gerar um recorte 3:4 focado na peça principal** e guardar como imagem do card; manter a original como 2ª foto da galeria.
- Servir `srcset` em 2 tamanhos (400w para card, 1200w para modal), `loading="lazy"` em tudo menos os 4 primeiros cards, `decoding="async"`.

---

## 13. Critérios de aceite

1. Em tela de 390×800, aparecem **2 produtos por linha** e o 1º card está visível sem rolar.
2. Cabeçalho sticky nunca passa de 2 linhas no celular.
3. Nenhum card exibe texto de botão; o card inteiro abre o modal e há um "+" no canto da foto.
4. Produto só com cor → "Quantas peças de cada cor?"; só com tamanho → "…de cada tamanho?"; legenda do card idem.
5. Faixa preta de pedido mínimo aparece só em atacado com mínimo > 0, em uma linha, com barra de progresso que reage ao carrinho.
6. Chips de categoria e ordenação ocupam **uma linha só**.
7. Modal: galeria com miniaturas e zoom funcionando; miniaturas sempre visíveis dentro do modal (nunca cortadas).
8. Drawer soma corretamente, remove ao zerar, bloqueia finalização abaixo do mínimo com aviso claro.
9. Mensagem do WhatsApp sai formatada com cor, tamanho, quantidade, subtotal e total.
10. Rodapé com Envio → Precisa de ajuda? → botão WhatsApp. Sem "Como pagar", sem horário.
11. Ligando/desligando o vídeo do topo, nada quebra; a apresentação em branco esconde o bloco grande e mostra os 3 passos em linha fina.
12. Trocando o público da loja de feminino para masculino, **só muda o conteúdo** (nome, categorias, tamanhos, produtos, capa) — nenhum estilo muda.

---

## 14. Fora de escopo (não implementar agora)

Login do cliente, favoritos, exibição de estoque, filtro por preço, cupom, frete calculado, avaliações, grade fechada (kit), multi-idioma além de pt-BR.
