import { describe, it, expect, vi } from 'vitest'
import {
  acharCandidatos, ultimos8Digitos, nomeNormalizado, camposFaltando, textoCadastroIncompleto,
  salvarClienteNovo, usarClienteExistente, buscarCandidatosDuplicata,
} from './duplicataCliente'

const base = [
  { id: 'c1', nome: 'MARIA SILVA', telefone: '91988887777', data_nascimento: '1990-01-01' },
  { id: 'c2', nome: 'Débora', telefone: null, data_nascimento: null },
  { id: 'c3', nome: 'REYDSON SOUZA', telefone: '(91) 8278-7235', data_nascimento: null },
  { id: 'c4', nome: 'VITORIA ANDRADE ONLINE', telefone: '91996110319', data_nascimento: '2000-02-02' },
  { id: 'c5', nome: 'Renata', telefone: '00000000', data_nascimento: null },
  { id: 'c6', nome: 'SARA SANTOS', telefone: '91981329006', data_nascimento: '1995-05-05' },
]
const motivosDe = (novo, lista = base) => acharCandidatos(novo, lista).map(c => [c.cliente.id, c.motivos])

describe('acharCandidatos — critérios do aviso', () => {
  it('nome idêntico (trim + minúsculas) gera aviso', () => {
    expect(motivosDe({ nome: '  maria silva ', telefone: '' })).toEqual([['c1', ['mesmo_nome']]])
  })

  it('nome normalizado (acento, pontuação, espaço duplo) gera aviso como "nome parecido"', () => {
    expect(motivosDe({ nome: 'Debora' })).toEqual([['c2', ['nome_parecido']]])
    expect(motivosDe({ nome: 'VITORIA  ANDRADE/ONLINE' })).toEqual([['c4', ['nome_parecido']]])
  })

  it('telefone pelos últimos 8 dígitos gera aviso, mesmo com nome diferente', () => {
    // com nono dígito, DDD e +55 — o caso real do Reydson
    expect(motivosDe({ nome: 'Rey Souza', telefone: '+55 91 98278-7235' })).toEqual([['c3', ['mesmo_telefone']]])
  })

  it('nome e telefone batendo: um candidato só, com os dois motivos', () => {
    expect(motivosDe({ nome: 'Maria Silva', telefone: '(91) 98888-7777' })).toEqual([['c1', ['mesmo_nome', 'mesmo_telefone']]])
  })

  it('nome com 1–2 letras de diferença NÃO gera aviso (não é critério)', () => {
    expect(motivosDe({ nome: 'VARA SANTOS' })).toEqual([])
    expect(motivosDe({ nome: 'Maria Silvaa' })).toEqual([])
    expect(motivosDe({ nome: 'Marcely Lobo' }, [{ id: 'x', nome: 'Marceli Lobo', telefone: null }])).toEqual([])
  })

  it('telefone de preenchimento ("00000000") nunca casa', () => {
    expect(motivosDe({ nome: 'Outra Pessoa', telefone: '00000000' })).toEqual([])
    expect(ultimos8Digitos('99999999')).toBeNull()
  })

  it('nada parecido: nenhum candidato', () => {
    expect(motivosDe({ nome: 'Fulana Nova', telefone: '11 3333-4444' })).toEqual([])
  })

  it('ordena: mais motivos primeiro', () => {
    const lista = [
      { id: 'a', nome: 'Joana', telefone: '91900001111' },
      { id: 'b', nome: 'Outra', telefone: '91900001111' },
      { id: 'c', nome: 'joana', telefone: '91900001111' },
    ]
    const ids = acharCandidatos({ nome: 'Joana', telefone: '(91) 90000-1111' }, lista).map(c => c.cliente.id)
    expect(ids).toHaveLength(3)
    expect(ids.at(-1)).toBe('b') // só telefone → por último; os dois com nome+telefone vêm antes
  })
})

describe('ultimos8Digitos / nomeNormalizado', () => {
  it('com e sem nono dígito, DDD e +55 dão a mesma chave', () => {
    const k = '82787235'
    for (const t of ['(91) 8278-7235', '91998278-7235', '91 8278-7235', '9198278-7235', '+55 91 98278-7235', '8278 7235']) {
      expect(ultimos8Digitos(t)).toBe(k)
    }
  })
  it('menos de 8 dígitos: null (ou o número inteiro com aceitarCurto)', () => {
    expect(ultimos8Digitos('1234')).toBeNull()
    expect(ultimos8Digitos('1234', { aceitarCurto: true })).toBe('1234')
    expect(ultimos8Digitos('')).toBeNull()
  })
  it('nome normalizado tira acento, pontuação e espaço duplo', () => {
    expect(nomeNormalizado('  Geórgia   D\'Ávila-Souza ')).toBe('georgia d avila souza')
  })
})

describe('cadastro incompleto', () => {
  it('sinaliza falta de telefone e aniversário', () => {
    expect(textoCadastroIncompleto(camposFaltando({ telefone: null, data_nascimento: null })))
      .toBe('Cadastro incompleto — falta telefone e aniversário')
    expect(textoCadastroIncompleto(camposFaltando({ telefone: '91 9999-0000', data_nascimento: null })))
      .toBe('Cadastro incompleto — falta aniversário')
    expect(textoCadastroIncompleto(camposFaltando({ telefone: '  ', data_nascimento: '2000-01-01' })))
      .toBe('Cadastro incompleto — falta telefone')
  })
  it('cadastro completo não é sinalizado', () => {
    expect(textoCadastroIncompleto(camposFaltando({ telefone: '91 9999-0000', data_nascimento: '2000-01-01' }))).toBeNull()
  })
  it('cada candidato vem com o que falta', () => {
    const [c] = acharCandidatos({ nome: 'debora' }, base)
    expect(c.faltando).toEqual(['telefone', 'aniversário'])
  })
})

describe('salvarClienteNovo — fluxo do botão Salvar', () => {
  const form = { nome: 'Maria Silva', telefone: '' }

  it('com candidato: devolve o aviso e NÃO cria', async () => {
    const addCliente = vi.fn()
    const r = await salvarClienteNovo({ form, addCliente, buscarCandidatos: async f => acharCandidatos(f, base) })
    expect(r.acao).toBe('aviso')
    expect(r.candidatos.map(c => c.cliente.id)).toEqual(['c1'])
    expect(addCliente).not.toHaveBeenCalled()
  })

  it('"Não é a mesma pessoa — criar cliente nova" (forcar) cria normalmente, sem nem buscar', async () => {
    const addCliente = vi.fn(async f => ({ id: 'novo', ...f }))
    const buscarCandidatos = vi.fn()
    const r = await salvarClienteNovo({ form, addCliente, buscarCandidatos, forcar: true })
    expect(r).toEqual({ acao: 'criado', cliente: { id: 'novo', ...form } })
    expect(addCliente).toHaveBeenCalledWith(form)
    expect(buscarCandidatos).not.toHaveBeenCalled()
  })

  it('sem candidato: cria direto', async () => {
    const addCliente = vi.fn(async f => ({ id: 'n', ...f }))
    const r = await salvarClienteNovo({ form: { nome: 'Fulana Nova' }, addCliente, buscarCandidatos: async () => [] })
    expect(r.acao).toBe('criado')
    expect(addCliente).toHaveBeenCalledTimes(1)
  })

  it('busca falhou (rede): não bloqueia — cria como antes do aviso existir', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const addCliente = vi.fn(async f => ({ id: 'n', ...f }))
    const r = await salvarClienteNovo({ form, addCliente, buscarCandidatos: async () => { throw new Error('offline') } })
    expect(r.acao).toBe('criado')
    spy.mockRestore()
  })
})

describe('usarClienteExistente — "Usar este →"', () => {
  it('não cria nada: devolve o cadastro existente, completando só o que está vazio', () => {
    const addCliente = vi.fn()
    const existente = { id: 'c2', nome: 'Débora', telefone: null, data_nascimento: null, email: 'd@x.com' }
    const digitado = { nome: 'Debora', telefone: '91 98888-0000', data_nascimento: '1990-03-03', email: 'outro@x.com' }
    const { cliente, preenchidos } = usarClienteExistente(existente, digitado, ['telefone', 'data_nascimento', 'email'])
    expect(addCliente).not.toHaveBeenCalled()
    expect(cliente.id).toBe('c2')
    expect(cliente.nome).toBe('Débora')                 // nome do existente fica
    expect(cliente.telefone).toBe('91 98888-0000')      // vazio → completado
    expect(cliente.data_nascimento).toBe('1990-03-03')
    expect(cliente.email).toBe('d@x.com')               // preenchido → NUNCA trocado
    expect(preenchidos).toEqual(['telefone', 'data_nascimento'])
  })
})

describe('buscarCandidatosDuplicata — busca no banco, não na tela', () => {
  // Supabase falso: lf_clientes com 2500 linhas, respondendo por página como
  // o PostgREST (range) — a candidata está depois da linha 1000.
  function supabaseFake(linhas) {
    const chamadas = []
    return {
      chamadas,
      from: () => {
        const q = { filtros: {}, cols: '' }
        const api = {
          select: c => { q.cols = c; return api },
          eq: (k, v) => { q.filtros[k] = v; return api },
          order: () => api,
          in: (k, ids) => { q.in = ids; chamadas.push({ tipo: 'completos', ids }); return Promise.resolve({ data: linhas.filter(l => ids.includes(l.id) && l.loja_id === q.filtros.loja_id), error: null }) },
          range: (from, to) => { chamadas.push({ tipo: 'pagina', from, to }); return Promise.resolve({ data: linhas.filter(l => l.loja_id === q.filtros.loja_id).slice(from, to + 1), error: null }) },
        }
        return api
      },
    }
  }

  it('acha candidata além das 1000 primeiras e devolve a linha COMPLETA', async () => {
    const linhas = Array.from({ length: 2500 }, (_, i) => ({ id: `id${i}`, loja_id: 'tropicaleatacado', nome: `CLIENTE ${i}`, telefone: null, data_nascimento: null, email: null }))
    linhas[1800] = { ...linhas[1800], nome: 'MARCELY LOBO', telefone: '91982049449', email: 'm@x.com' }
    linhas.push({ id: 'outraLoja', loja_id: 'audazwear', nome: 'MARCELY LOBO', telefone: '91982049449' })
    const sb = supabaseFake(linhas)
    const r = await buscarCandidatosDuplicata(sb, 'tropicaleatacado', { nome: 'marcely lobo', telefone: '' })
    expect(r.map(c => c.cliente.id)).toEqual(['id1800'])
    expect(r[0].cliente.email).toBe('m@x.com')
    expect(sb.chamadas.filter(c => c.tipo === 'pagina')).toHaveLength(3)
  })
})
