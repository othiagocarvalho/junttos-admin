# Design System da Junttos

> **Este documento é a referência oficial para qualquer trabalho no sistema.**
> Vale para todas as telas, todos os módulos e todos os planos (Starter, Pro,
> Business) — o que já existe e o que for construído daqui em diante. Antes de
> escrever um título de seção ou um rótulo de campo novo, comece por aqui.
>
> Se um padrão precisar mudar, **mude neste documento e nos componentes
> compartilhados**, não na tela. Estilo escrito à mão dentro da tela é
> exatamente o que este arquivo existe para acabar.

---

## 1. Título de seção

**Ícone dentro de um círculo tintado na cor do tema da loja + título em negrito
ao lado.** Descrição opcional embaixo, no mesmo tom dos subtítulos de gaveta.

### Componente

`src/components/studio/SecaoTitulo.jsx`

```jsx
import { Users } from 'lucide-react'
import SecaoTitulo from '../../components/studio/SecaoTitulo'

<SecaoTitulo
  Icon={Users}
  titulo="Cliente"
  descricao="Quem está comprando"   // opcional
  theme={theme}                     // opcional: sem ele, usa var(--primary)
  compacto                          // opcional: versão menor, para dentro de card
/>
```

### Regras

| | |
|---|---|
| Ícone | `lucide-react`, escolhido pelo **contexto** da seção (`Users` para cliente, `Package` para produto, `Target` para meta…) |
| Círculo | 34px (30px no modo `compacto`), raio 10, fundo `color-mix(in srgb, {tema} 12%, transparent)` |
| Título | 15px (14px compacto), **peso 700**, cor `var(--ink)`, **sem uppercase** |
| Descrição | 12px, `var(--muted)`, logo abaixo do título |

### O que ele substitui

```jsx
// ❌ padrão antigo — não use mais
<p style={{
  fontSize: 10, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.14em',
}}>Meta por Vendedor(a)</p>
```

Aquele texto competia com o conteúdo em vez de organizá-lo, e no celular caixa
alta com letter-spacing é difícil de ler de relance.

### Sobre a biblioteca de ícones

O padrão foi descrito como "ícone Tabler". O projeto inteiro usa
**`lucide-react`** — mesma família de traço, já é dependência de todas as
telas. Instalar uma segunda biblioteca para o mesmo trabalho custaria bundle e
criaria duas convenções para a próxima pessoa escolher. **Use lucide.**

---

## 2. Rótulo de campo

**Bolinha na cor do tema à esquerda + texto em peso médio, na cor do tema,
pequeno e sem caixa alta.**

### Componente

`src/components/studio/Input.jsx` — exporta `Label`, que **já é usado por todo
o sistema**. Trocar este componente muda todos os formulários de uma vez; é de
propósito.

```jsx
import Input, { Label } from '../../components/studio/Input'

<div>
  <Label>Telefone</Label>
  <Input value={tel} onChange={e => setTel(e.target.value)} placeholder="(85) 99999-0000" />
</div>
```

### Regras

| | |
|---|---|
| Bolinha | 6px, redonda, `var(--primary)`, `aria-hidden` (é decoração) |
| Texto | 12.5px, **peso 600**, cor `var(--primary)`, **sem uppercase** |
| Espaço | `gap` 7px entre bolinha e texto, 7px abaixo do rótulo |

A cor sai de `var(--primary)`, que `src/hooks/useLojaTheme.js` preenche com
`cor_primaria` de `lf_config`. O rótulo acompanha o tema da loja sem receber
prop nenhuma.

### O que ele substitui

```jsx
// ❌ padrão antigo — não use mais
<label style={{
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
}}>TELEFONE</label>
```

**Nunca escreva o rótulo à mão.** Telas com `const lbl = {...}` no topo do
arquivo são resquício do padrão antigo e devem migrar para `<Label>`.

---

## 3. Selo de plano

**O selo é aviso de bloqueio, não etiqueta de catálogo.** Só aparece quando a
função exige plano **acima** do que a loja tem.

### Componente

`src/components/studio/SeloPlano.jsx`

```jsx
import SeloPlano from '../../components/studio/SeloPlano'

<SecaoTitulo
  Icon={Trophy}
  titulo="Corrida de Vendas"
  theme={theme}
  badge={<SeloPlano planoAtual={plano} planoNecessario="business" />}
/>
```

### Regras

| loja | vê selo de |
|---|---|
| Business | **nenhum** |
| Pro | Business |
| Starter | Pro e Business |

A decisão sai de `temAcesso(planoAtual, planoNecessario)` em
`src/utils/planos.js` — o mesmo helper que já governa o `UpgradeWall`. Não
crie critério novo.

---

## 4. Nomes de seção

Título de seção nomeia **o assunto**, não a natureza do dado. "Dados da
Cliente" tem uma palavra a mais que não informa nada: a seção fala da cliente.

| ❌ antes | ✅ agora |
|---|---|
| Dados da Cliente | Cliente |
| Dados do Produto | Produto |
| Definir Meta Mensal | Meta mensal |

Só simplifique quando o nome curto continuar dizendo o que a seção é. Se
encurtar cria ambiguidade com outra seção da mesma tela, mantenha o nome longo.

---

## 5. Onde o padrão já está aplicado

Componentes compartilhados (valem para o sistema inteiro no momento em que
mudam):

- `studio/Input.jsx` → `Label` — **todos** os formulários que usam `<Label>`
- `studio/SecaoTitulo.jsx` — títulos de seção
- `studio/SeloPlano.jsx` — selos condicionais
- `studio/Gaveta.jsx` — já seguia o padrão do círculo tintado; foi a origem dele

Telas convertidas estão listadas no commit que introduziu este documento.
Tela que ainda tenha `const lbl = {...}` ou `sectionLabelStyle` no topo do
arquivo **ainda não migrou** — migre quando encostar nela.
