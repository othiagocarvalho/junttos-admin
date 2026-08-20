import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import StoreCard from './StoreCard'

// Renderização estática — sem DOM e sem testing-library (não há nenhum dos
// dois no projeto). Basta para o que precisa ser garantido aqui: que a porta
// de entrada da tela de contrato aparece no card, e que ela é OPCIONAL, para
// nenhuma listagem sem destino ganhar um botão que não leva a lugar nenhum.

const base = {
  nome: 'Bela Moda',
  slug: 'bela-moda',
  status: 'Ativo',
  link: 'https://junttos.test/bela-moda/',
}

describe('StoreCard — acesso ao detalhe da loja', () => {
  it('mostra "Detalhes e contrato" quando onOpen é fornecido', () => {
    const html = renderToStaticMarkup(<StoreCard {...base} onOpen={() => {}} />)
    expect(html).toContain('Detalhes e contrato')
    expect(html).toContain('Abrir detalhes de Bela Moda')
  })

  it('marca a área do topo como clicável e navegável por teclado', () => {
    const html = renderToStaticMarkup(<StoreCard {...base} onOpen={() => {}} />)
    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
  })

  it('sem onOpen não exibe nada de detalhe — listagens antigas seguem iguais', () => {
    const html = renderToStaticMarkup(<StoreCard {...base} />)
    expect(html).not.toContain('Detalhes e contrato')
    expect(html).not.toContain('role="button"')
    expect(html).not.toContain('tabindex="0"')
  })

  it('mantém o que já existia: link, nome e slug continuam no card', () => {
    const html = renderToStaticMarkup(<StoreCard {...base} onOpen={() => {}} />)
    expect(html).toContain('https://junttos.test/bela-moda/')
    expect(html).toContain('Bela Moda')
    expect(html).toContain('/bela-moda')
  })

  it('o botão de excluir segue independente do de detalhes', () => {
    const comAmbos = renderToStaticMarkup(<StoreCard {...base} onOpen={() => {}} onDelete={() => {}} />)
    expect(comAmbos).toContain('Excluir loja')
    expect(comAmbos).toContain('Detalhes e contrato')

    const soDetalhe = renderToStaticMarkup(<StoreCard {...base} onOpen={() => {}} />)
    expect(soDetalhe).not.toContain('Excluir loja')
  })
})
