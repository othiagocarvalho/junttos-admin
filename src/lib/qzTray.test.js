import { describe, it, expect } from 'vitest'
import { URL_DOWNLOAD, mensagemDeErro, impressoraSalva, salvarImpressora } from './qzTray'

// O módulo só carrega o qz-tray dentro de import() dinâmico, então dá para
// testar a parte que decide o que a lojista lê sem subir agente nenhum.

describe('mensagemDeErro — o que a pessoa lê quando falha', () => {
  it('agente ausente ganha o link de download', () => {
    const r = mensagemDeErro(new Error('Unable to establish connection with QZ'))
    expect(r.mostrarDownload).toBe(true)
    expect(r.texto).toMatch(/QZ Tray não respondeu/)
  })

  it('socket recusado também é agente ausente', () => {
    expect(mensagemDeErro(new Error('WebSocket connection refused')).mostrarDownload).toBe(true)
    expect(mensagemDeErro('connection timed out').mostrarDownload).toBe(true)
  })

  it('site bloqueado NÃO oferece download — o programa já está instalado', () => {
    // Mandar reinstalar quem só precisa clicar em "permitir" é o pior
    // conselho possível nesse momento.
    const r = mensagemDeErro(new Error('Request denied by user'))
    expect(r.mostrarDownload).toBe(false)
    expect(r.texto).toMatch(/autorize este site/)
  })

  it('sem impressora escolhida pede a escolha, não o instalador', () => {
    const r = mensagemDeErro(new Error('sem-impressora'))
    expect(r.mostrarDownload).toBe(false)
    expect(r.texto).toMatch(/Escolha a impressora/)
  })

  it('nada para enviar tem texto próprio', () => {
    expect(mensagemDeErro(new Error('sem-documentos')).texto).toMatch(/Não há etiqueta/)
  })

  it('falha ao baixar o chunk fala de conexão, não de instalação', () => {
    const r = mensagemDeErro(new Error('Failed to fetch dynamically imported module'))
    expect(r.mostrarDownload).toBe(false)
    expect(r.texto).toMatch(/conexão/)
  })

  it('erro desconhecido não vira tela em branco', () => {
    const r = mensagemDeErro(new Error('coisa estranha'))
    expect(r.texto).toContain('coisa estranha')
    expect(r.mostrarDownload).toBe(false)
  })

  it('erro sem mensagem nenhuma ainda produz frase', () => {
    expect(mensagemDeErro(null).texto).toBe('Não foi possível imprimir.')
    expect(mensagemDeErro({}).texto).toBe('Não foi possível imprimir.')
  })

  it('o link é o oficial', () => {
    expect(URL_DOWNLOAD).toBe('https://qz.io/download/')
  })
})

describe('impressora lembrada', () => {
  const fake = () => {
    const m = new Map()
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, v),
      removeItem: k => m.delete(k),
    }
  }

  it('guarda e devolve o nome', () => {
    const s = fake()
    salvarImpressora(s, 'Elgin L42')
    expect(impressoraSalva(s)).toBe('Elgin L42')
  })

  it('sem nada guardado devolve string vazia, nunca null', () => {
    expect(impressoraSalva(fake())).toBe('')
  })

  it('salvar vazio limpa a escolha', () => {
    const s = fake()
    salvarImpressora(s, 'X')
    salvarImpressora(s, '')
    expect(impressoraSalva(s)).toBe('')
  })

  it('storage bloqueado (anônimo) não derruba a tela', () => {
    // Só perde a conveniência de lembrar; imprimir continua funcionando.
    const explode = {
      getItem() { throw new Error('bloqueado') },
      setItem() { throw new Error('bloqueado') },
      removeItem() { throw new Error('bloqueado') },
    }
    expect(impressoraSalva(explode)).toBe('')
    expect(() => salvarImpressora(explode, 'X')).not.toThrow()
  })

  it('storage ausente não quebra', () => {
    expect(impressoraSalva(undefined)).toBe('')
    expect(() => salvarImpressora(undefined, 'X')).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Caminho de sucesso, com um agente FALSO no lugar do qz-tray.
//
// ⚠️ Isto NÃO substitui o teste com o QZ Tray de verdade e uma impressora
// ligada — esse continua pendente (ver o relatório). O que estas asserções
// travam é o nosso lado do contrato: que o config sai com as medidas certas e
// que o print recebe os documentos no formato que a API 2.2.6 espera.
// ─────────────────────────────────────────────────────────────────────────────
import { vi } from 'vitest'

const espiao = { config: null, dados: null, conectou: 0, desconectou: 0 }
let ativo = false
let acharErro = null

vi.mock('qz-tray', () => ({
  default: {
    websocket: {
      isActive: () => ativo,
      connect: async () => { espiao.conectou++; ativo = true },
      disconnect: async () => { espiao.desconectou++; ativo = false },
    },
    printers: {
      find: async () => {
        if (acharErro) throw acharErro
        return ['HP DeskJet', 'Elgin L42 Pro Full', 'PDF']
      },
      getDefault: async () => 'Elgin L42 Pro Full',
    },
    configs: { create: (nome, opts) => ({ nome, opts }) },
    print: async (config, dados) => { espiao.config = config; espiao.dados = dados },
  },
}))

const { conectar, listarImpressoras, imprimir, desconectar: fechar } = await import('./qzTray')
const { documentosParaQz } = await import('../utils/etiquetasHtml')

const MEDIDAS = { larguraMm: 40, alturaMm: 30, papelMm: 121, colunas: 3, gapMm: 0.5 }

describe('agente falso — o contrato do nosso lado', () => {
  it('conectar só abre socket uma vez', async () => {
    espiao.conectou = 0
    await conectar()
    await conectar()
    expect(espiao.conectou).toBe(1)
  })

  it('a impressora padrão vem primeiro na lista', async () => {
    // Quem tem uma térmica só quer que ela já venha escolhida.
    expect(await listarImpressoras()).toEqual(['Elgin L42 Pro Full', 'HP DeskJet', 'PDF'])
  })

  it('imprimir manda o config com as medidas e as três travas', async () => {
    const docs = documentosParaQz(['<div class="etq-fileira">a</div>'], MEDIDAS)
    await imprimir({ impressora: 'Elgin L42 Pro Full', documentos: docs, medidas: MEDIDAS })

    expect(espiao.config.nome).toBe('Elgin L42 Pro Full')
    expect(espiao.config.opts.size).toEqual({ width: 121, height: 30 })
    expect(espiao.config.opts.units).toBe('mm')
    expect(espiao.config.opts.margins).toBe(0)
    expect(espiao.config.opts.scaleContent).toBe(false)
  })

  it('cada fileira vira uma entrada — uma entrada é uma página do rolo', async () => {
    const docs = documentosParaQz(['<i>f1</i>', '<i>f2</i>', '<i>f3</i>'], MEDIDAS)
    const n = await imprimir({ impressora: 'X', documentos: docs, medidas: MEDIDAS })
    expect(n).toBe(3)
    expect(espiao.dados).toHaveLength(3)
    expect(espiao.dados[1].data).toContain('<i>f2</i>')
    expect(espiao.dados.every(d => d.type === 'pixel' && d.format === 'html')).toBe(true)
  })

  it('sem impressora escolhida não manda nada para o agente', async () => {
    espiao.dados = null
    await expect(imprimir({ impressora: '', documentos: [{}], medidas: MEDIDAS }))
      .rejects.toThrow('sem-impressora')
    expect(espiao.dados).toBeNull()
  })

  it('lista vazia de etiquetas não vira trabalho de impressão', async () => {
    espiao.dados = null
    await expect(imprimir({ impressora: 'X', documentos: [], medidas: MEDIDAS }))
      .rejects.toThrow('sem-documentos')
    expect(espiao.dados).toBeNull()
  })

  it('falha ao listar impressoras vira a mensagem, não um estouro', async () => {
    acharErro = new Error('Unable to establish connection with QZ')
    await expect(listarImpressoras()).rejects.toThrow(/Unable to establish/)
    acharErro = null
  })

  it('desconectar fecha o socket e não estoura se já estiver fechado', async () => {
    await conectar()
    await fechar()
    expect(espiao.desconectou).toBeGreaterThan(0)
    await expect(fechar()).resolves.toBeUndefined()
  })
})
