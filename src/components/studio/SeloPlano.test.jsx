import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SeloPlano from './SeloPlano'
import SecaoTitulo from './SecaoTitulo'
import { Label } from './Input'
import { Target } from 'lucide-react'

const html = el => renderToStaticMarkup(el)

// A regra em uma linha: selo é aviso de BLOQUEIO, não etiqueta de catálogo.
// Antes ele era escrito à mão em cada tela e aparecia sempre — a loja Business
// via "Business" em cima de uma função que ela já tinha.
describe('SeloPlano — só avisa quando está bloqueado', () => {
  it('loja Business não vê selo nenhum', () => {
    expect(html(<SeloPlano planoAtual="business" planoNecessario="pro" />)).toBe('')
    expect(html(<SeloPlano planoAtual="business" planoNecessario="business" />)).toBe('')
    expect(html(<SeloPlano planoAtual="business" planoNecessario="starter" />)).toBe('')
  })

  it('loja Pro vê só o de Business', () => {
    expect(html(<SeloPlano planoAtual="pro" planoNecessario="business" />)).toContain('Business')
    expect(html(<SeloPlano planoAtual="pro" planoNecessario="pro" />)).toBe('')
    expect(html(<SeloPlano planoAtual="pro" planoNecessario="starter" />)).toBe('')
  })

  it('loja Starter vê Pro e Business', () => {
    expect(html(<SeloPlano planoAtual="starter" planoNecessario="pro" />)).toContain('Pro')
    expect(html(<SeloPlano planoAtual="starter" planoNecessario="business" />)).toContain('Business')
    expect(html(<SeloPlano planoAtual="starter" planoNecessario="starter" />)).toBe('')
  })

  it('sem plano necessário declarado, não inventa selo', () => {
    expect(html(<SeloPlano planoAtual="starter" />)).toBe('')
    expect(html(<SeloPlano planoAtual="starter" planoNecessario={null} />)).toBe('')
  })

  it('plano desconhecido cai no piso e não esconde bloqueio real', () => {
    // temAcesso trata plano ausente como nível 1 (Starter). Melhor mostrar o
    // selo a mais do que esconder um bloqueio que existe.
    expect(html(<SeloPlano planoAtual={undefined} planoNecessario="business" />)).toContain('Business')
  })
})

describe('SecaoTitulo — o padrão novo de título', () => {
  it('título em negrito e SEM caixa alta', () => {
    const s = html(<SecaoTitulo Icon={Target} titulo="Meta mensal" theme={{ primary: '#5E2BD0' }} />)
    expect(s).toContain('Meta mensal')
    expect(s).toContain('font-weight:700')
    expect(s).not.toContain('text-transform:uppercase')
  })

  it('o círculo do ícone é tingido com a cor do tema', () => {
    const s = html(<SecaoTitulo Icon={Target} titulo="X" theme={{ primary: '#FF0000' }} />)
    expect(s).toContain('color-mix(in srgb, #FF0000 12%, transparent)')
  })

  it('sem theme, cai na variável de tema da loja', () => {
    // useLojaTheme.js preenche --primary com cor_primaria de lf_config.
    expect(html(<SecaoTitulo Icon={Target} titulo="X" />)).toContain('var(--primary)')
  })

  it('descrição é opcional e vai abaixo do título', () => {
    const com = html(<SecaoTitulo Icon={Target} titulo="Cliente" descricao="Identificação opcional" />)
    expect(com).toContain('Identificação opcional')
    expect(com.indexOf('Cliente')).toBeLessThan(com.indexOf('Identificação opcional'))
    expect(html(<SecaoTitulo Icon={Target} titulo="Cliente" />)).not.toContain('Identificação')
  })

  it('aceita badge no cabeçalho', () => {
    const s = html(
      <SecaoTitulo Icon={Target} titulo="Corrida"
        badge={<SeloPlano planoAtual="starter" planoNecessario="business" />} />,
    )
    expect(s).toContain('Business')
  })

  it('funciona sem ícone — não quebra quem ainda não escolheu um', () => {
    expect(() => html(<SecaoTitulo titulo="Sem ícone" />)).not.toThrow()
  })
})

describe('Label — o padrão novo de rótulo', () => {
  const s = html(<Label>Telefone</Label>)

  it('tem a bolinha na cor do tema, marcada como decoração', () => {
    expect(s).toContain('aria-hidden="true"')
    expect(s).toContain('background:var(--primary)')
  })

  it('texto na cor do tema, peso médio, SEM caixa alta', () => {
    expect(s).toContain('color:var(--primary)')
    expect(s).toContain('font-weight:600')
    expect(s).not.toContain('text-transform:uppercase')
    expect(s).not.toContain('letter-spacing')
  })

  it('continua sendo um <label> de verdade', () => {
    expect(s.startsWith('<label')).toBe(true)
    expect(s).toContain('Telefone')
  })
})
