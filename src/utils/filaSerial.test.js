import { describe, it, expect } from 'vitest'
import { criarFilaSerial } from './filaSerial'

const dormir = ms => new Promise(r => setTimeout(r, ms))

describe('criarFilaSerial', () => {
  it('processa em ordem de chegada, uma por vez, sem perder nenhuma', async () => {
    const fila = criarFilaSerial()
    const ordem = []
    let emVoo = 0
    let maxEmVoo = 0
    // Durações decrescentes: sem fila, a última terminaria primeiro.
    const promessas = [30, 20, 10, 5, 1].map((ms, i) => fila.enfileirar(async () => {
      emVoo++; maxEmVoo = Math.max(maxEmVoo, emVoo)
      await dormir(ms)
      ordem.push(i)
      emVoo--
      return i
    }))
    expect(fila.pendentes()).toBe(5)
    expect(await Promise.all(promessas)).toEqual([0, 1, 2, 3, 4])
    expect(ordem).toEqual([0, 1, 2, 3, 4])
    expect(maxEmVoo).toBe(1)
    expect(fila.pendentes()).toBe(0)
  })

  it('cada tarefa roda exatamente uma vez', async () => {
    const fila = criarFilaSerial()
    const contagem = [0, 0, 0]
    await Promise.all(contagem.map((_, i) => fila.enfileirar(() => { contagem[i]++ })))
    await fila.aguardarVazia()
    expect(contagem).toEqual([1, 1, 1])
  })

  it('tarefa que rejeita não trava a fila; o erro volta só para quem a enfileirou', async () => {
    const fila = criarFilaSerial()
    const falha = fila.enfileirar(async () => { throw new Error('rede') })
    const depois = fila.enfileirar(async () => 'ok')
    await expect(falha).rejects.toThrow('rede')
    await expect(depois).resolves.toBe('ok')
    expect(fila.pendentes()).toBe(0)
  })

  it('aguardarVazia espera também o que for enfileirado durante a espera', async () => {
    const fila = criarFilaSerial()
    const feitas = []
    fila.enfileirar(async () => {
      await dormir(5)
      feitas.push('a')
      // Chega um bipe novo enquanto alguém já está esperando a fila esvaziar.
      fila.enfileirar(async () => { await dormir(5); feitas.push('b') })
    })
    await fila.aguardarVazia()
    expect(feitas).toEqual(['a', 'b'])
  })

  it('avisa quem assina a cada mudança de pendentes', async () => {
    const fila = criarFilaSerial()
    const vistos = []
    fila.assinar(n => vistos.push(n))
    await Promise.all([fila.enfileirar(() => 1), fila.enfileirar(() => 2)])
    await fila.aguardarVazia()
    expect(vistos).toEqual([1, 2, 1, 0])
  })
})
