import { describe, it, expect } from 'vitest'
import { criarControleLeitura, mensagemErroCamera, cameraDisponivel, JANELA_REPETICAO_MS } from './leituraCamera.js'

describe('criarControleLeitura — modo contínuo', () => {
  it('aceita a primeira leitura', () => {
    const c = criarControleLeitura()
    expect(c.tentar('482913605744', 0)).toBe(true)
  })

  it('recusa qualquer leitura enquanto a anterior está sendo processada', () => {
    const c = criarControleLeitura()
    c.tentar('111111111111', 0)
    expect(c.tentar('111111111111', 5000)).toBe(false)
    expect(c.tentar('222222222222', 5000)).toBe(false)
  })

  it('mesma peça logo depois de concluir é recusada (etiqueta parada na frente da câmera)', () => {
    const c = criarControleLeitura()
    c.tentar('111111111111', 0)
    c.concluir(100)
    expect(c.tentar('111111111111', 100 + JANELA_REPETICAO_MS - 1)).toBe(false)
  })

  it('mesma peça é aceita de novo depois da janela', () => {
    const c = criarControleLeitura()
    c.tentar('111111111111', 0)
    c.concluir(100)
    expect(c.tentar('111111111111', 100 + JANELA_REPETICAO_MS)).toBe(true)
  })

  it('a janela conta do FIM do processamento — servidor lento não deixa somar a peça duas vezes', () => {
    const c = criarControleLeitura()
    c.tentar('111111111111', 0)
    c.concluir(3000)   // servidor levou 3s, mais que a janela
    expect(c.tentar('111111111111', 3100)).toBe(false)
  })

  it('peça diferente entra assim que a anterior termina, sem esperar a janela', () => {
    const c = criarControleLeitura()
    c.tentar('111111111111', 0)
    c.concluir(100)
    expect(c.tentar('222222222222', 101)).toBe(true)
  })

  it('recusa código vazio', () => {
    expect(criarControleLeitura().tentar('', 0)).toBe(false)
  })

  it('janela configurável', () => {
    const c = criarControleLeitura({ janelaMs: 500 })
    c.tentar('1', 0)
    c.concluir(0)
    expect(c.tentar('1', 499)).toBe(false)
    expect(c.tentar('1', 500)).toBe(true)
  })
})

describe('mensagemErroCamera', () => {
  const titulo = name => mensagemErroCamera({ name }).titulo

  it('permissão negada (nomes atual e antigo)', () => {
    expect(titulo('NotAllowedError')).toBe('Permissão de câmera negada')
    expect(titulo('PermissionDeniedError')).toBe('Permissão de câmera negada')
  })

  it('aparelho sem câmera', () => {
    expect(titulo('NotFoundError')).toBe('Nenhuma câmera encontrada')
    expect(titulo('DevicesNotFoundError')).toBe('Nenhuma câmera encontrada')
  })

  it('câmera em uso por outro app', () => {
    expect(titulo('NotReadableError')).toBe('Câmera em uso')
    expect(titulo('TrackStartError')).toBe('Câmera em uso')
  })

  it('câmera traseira indisponível', () => {
    expect(titulo('OverconstrainedError')).toBe('Câmera traseira indisponível')
  })

  it('erro desconhecido ou sem nome ainda mostra mensagem (nunca tela preta)', () => {
    expect(titulo('QualquerCoisa')).toBe('Não foi possível abrir a câmera')
    expect(mensagemErroCamera(undefined).titulo).toBe('Não foi possível abrir a câmera')
    expect(mensagemErroCamera(new Error('x')).detalhe).toBeTruthy()
  })
})

describe('cameraDisponivel', () => {
  it('true quando getUserMedia existe', () => {
    expect(cameraDisponivel({ mediaDevices: { getUserMedia: () => {} } })).toBe(true)
  })
  it('false sem mediaDevices (HTTP fora de localhost, navegador antigo)', () => {
    expect(cameraDisponivel({})).toBe(false)
    expect(cameraDisponivel(undefined)).toBe(false)
  })
})
