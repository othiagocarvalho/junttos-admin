import { describe, it, expect } from 'vitest'
import { criarTravaPorChave } from './travaPorChave'

const dormir = ms => new Promise(r => setTimeout(r, ms))

describe('criarTravaPorChave', () => {
  it('toque duplo na mesma chave executa uma vez só', async () => {
    const trava = criarTravaPorChave()
    let chamadas = 0
    const tarefa = async () => { chamadas++; await dormir(5); return 'feito' }
    // Os dois "cliques" na mesma volta do event loop, antes de qualquer re-render.
    const [a, b] = await Promise.all([trava.executar('p1|Rosa', tarefa), trava.executar('p1|Rosa', tarefa)])
    expect(chamadas).toBe(1)
    expect(a).toBe('feito')
    expect(b).toBeNull()
  })

  it('chaves diferentes (outra variação) não se bloqueiam', async () => {
    const trava = criarTravaPorChave()
    let chamadas = 0
    await Promise.all([
      trava.executar('p1|Rosa', async () => { chamadas++; await dormir(5) }),
      trava.executar('p1|Nude', async () => { chamadas++; await dormir(5) }),
    ])
    expect(chamadas).toBe(2)
  })

  it('libera a chave quando termina — inclusive se a tarefa falhar', async () => {
    const trava = criarTravaPorChave()
    await expect(trava.executar('k', async () => { throw new Error('x') })).rejects.toThrow('x')
    expect(trava.ocupada('k')).toBe(false)
    expect(await trava.executar('k', async () => 2)).toBe(2)
  })
})
