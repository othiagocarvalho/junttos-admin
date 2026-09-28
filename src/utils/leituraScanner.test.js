import { describe, it, expect } from 'vitest'
import { lerComCampoLimpo } from './leituraScanner'

// Simula o <input> controlado do CampoScanner: `campo` é o valor exibido,
// digitar() é o leitor mandando caracteres, limpar() é o setValor('').
function criarCampo() {
  const c = { valor: '' }
  c.digitar = txt => { c.valor += txt }
  c.limpar = () => { c.valor = '' }
  return c
}

describe('lerComCampoLimpo (ordem do CampoScanner)', () => {
  it('dois bipes seguidos rápidos não se juntam no campo', async () => {
    const campo = criarCampo()
    const lidos = []
    let liberarPrimeiro
    // aoLer "em rede": o primeiro bipe só termina quando liberarmos.
    const aoLer = codigo => {
      lidos.push(codigo)
      return lidos.length === 1 ? new Promise(r => { liberarPrimeiro = () => r({ ok: true }) }) : { ok: true }
    }

    campo.digitar('111111111111')
    const primeiro = lerComCampoLimpo(campo.valor, { limpar: campo.limpar, aoLer })

    // O leitor já manda a próxima etiqueta enquanto a primeira processa.
    campo.digitar('222222222222')
    expect(campo.valor).toBe('222222222222')
    const segundo = lerComCampoLimpo(campo.valor, { limpar: campo.limpar, aoLer })

    liberarPrimeiro()
    await Promise.all([primeiro, segundo])
    expect(lidos).toEqual(['111111111111', '222222222222'])
    // E o fim do primeiro bipe não apaga nada que já tenha sido digitado depois.
    campo.digitar('333')
    expect(campo.valor).toBe('333')
  })

  it('código vazio não chama aoLer nem mexe no campo', async () => {
    let chamou = false
    let limpou = false
    const r = await lerComCampoLimpo('   ', { limpar: () => { limpou = true }, aoLer: () => { chamou = true } })
    expect(r).toBeNull()
    expect(chamou).toBe(false)
    expect(limpou).toBe(false)
  })

  it('aoLer síncrono (Nova Venda) continua funcionando e recebe o código aparado', async () => {
    const r = await lerComCampoLimpo(' 123 ', { limpar: () => {}, aoLer: c => ({ ok: true, texto: c }) })
    expect(r).toEqual({ ok: true, texto: '123' })
  })
})
