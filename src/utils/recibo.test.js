import { describe, it, expect } from 'vitest'
import { parsePgtosRecibo, numeracaoRecibo, formatarReciboTexto } from './recibo'

// ── parsePgtosRecibo ───────────────────────────────────────────

describe('parsePgtosRecibo', () => {
  it('parses JSON array forma_pgto', () => {
    const v = { forma_pgto: JSON.stringify([{ forma: 'Pix', valor: 100 }, { forma: 'Dinheiro', valor: 50 }]), valor: 150 }
    expect(parsePgtosRecibo(v)).toEqual([{ forma: 'Pix', valor: 100 }, { forma: 'Dinheiro', valor: 50 }])
  })

  it('falls back to legacy string forma_pgto', () => {
    const v = { forma_pgto: 'Pix', valor: 80 }
    expect(parsePgtosRecibo(v)).toEqual([{ forma: 'Pix', valor: 80 }])
  })

  it('returns empty array when forma_pgto is null', () => {
    expect(parsePgtosRecibo({ forma_pgto: null, valor: 0 })).toEqual([])
  })

  it('returns empty array when forma_pgto is undefined', () => {
    expect(parsePgtosRecibo({ valor: 0 })).toEqual([])
  })

  it('handles malformed JSON gracefully', () => {
    const v = { forma_pgto: 'not-json', valor: 50 }
    expect(parsePgtosRecibo(v)).toEqual([{ forma: 'not-json', valor: 50 }])
  })
})

// ── numeracaoRecibo ────────────────────────────────────────────

describe('numeracaoRecibo', () => {
  const vendas = [
    { id: 'c', data: '2025-01-03T10:00:00' },
    { id: 'a', data: '2025-01-01T10:00:00' },
    { id: 'b', data: '2025-01-02T10:00:00' },
  ]

  it('returns 1 for the oldest sale', () => {
    expect(numeracaoRecibo(vendas, 'a')).toBe(1)
  })

  it('returns 2 for the middle sale', () => {
    expect(numeracaoRecibo(vendas, 'b')).toBe(2)
  })

  it('returns 3 for the newest sale', () => {
    expect(numeracaoRecibo(vendas, 'c')).toBe(3)
  })

  it('returns null when id is not found', () => {
    expect(numeracaoRecibo(vendas, 'z')).toBeNull()
  })

  it('returns null for empty vendas array', () => {
    expect(numeracaoRecibo([], 'a')).toBeNull()
  })

  it('does not mutate the original array', () => {
    const arr = [
      { id: 'x', data: '2025-01-02T00:00:00' },
      { id: 'y', data: '2025-01-01T00:00:00' },
    ]
    numeracaoRecibo(arr, 'x')
    expect(arr[0].id).toBe('x')
  })
})

// ── formatarReciboTexto ────────────────────────────────────────

describe('formatarReciboTexto', () => {
  const vendaBase = {
    data: '2025-07-18T14:30:00',
    valor: 150,
    tipo_venda: 'venda',
    forma_pgto: JSON.stringify([{ forma: 'Pix', valor: 150 }]),
    produtos: [{ nome: 'Calça', variacao: '38', quantidade: 2 }],
    cliente_nome: null,
    vendedora: null,
    obs: null,
  }

  it('includes store name', () => {
    const txt = formatarReciboTexto(vendaBase, 'Minha Loja', 1)
    expect(txt).toContain('Minha Loja')
  })

  it('includes "Recibo de Venda" for venda type', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1)
    expect(txt).toContain('Recibo de Venda')
  })

  it('includes "Recibo de Troca" for troca type', () => {
    const troca = { ...vendaBase, tipo_venda: 'troca' }
    const txt = formatarReciboTexto(troca, 'Loja', null)
    expect(txt).toContain('Recibo de Troca')
  })

  it('includes formatted receipt number', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 7)
    expect(txt).toContain('N° 0007')
  })

  it('omits number line when numero is null', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', null)
    expect(txt).not.toContain('N°')
  })

  it('includes total value', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1)
    expect(txt).toContain('R$ 150,00')
  })

  it('includes product with variation and quantity', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1)
    expect(txt).toContain('2x Calça (38)')
  })

  it('includes product without variation', () => {
    const v = { ...vendaBase, produtos: [{ nome: 'Blusa', quantidade: 1 }] }
    const txt = formatarReciboTexto(v, 'Loja', 1)
    expect(txt).toContain('1x Blusa')
  })

  it('includes client name when present', () => {
    const v = { ...vendaBase, cliente_nome: 'Ana Silva' }
    const txt = formatarReciboTexto(v, 'Loja', 1)
    expect(txt).toContain('Ana Silva')
  })

  it('omits client line when cliente_nome is null', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1)
    expect(txt).not.toContain('Cliente:')
  })

  it('includes vendedora when present', () => {
    const v = { ...vendaBase, vendedora: 'Júlia' }
    const txt = formatarReciboTexto(v, 'Loja', 1)
    expect(txt).toContain('Júlia')
  })

  it('includes payment method', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1)
    expect(txt).toContain('Pix')
  })

  it('includes obs when present', () => {
    const v = { ...vendaBase, obs: 'Entrega quinta' }
    const txt = formatarReciboTexto(v, 'Loja', 1)
    expect(txt).toContain('Entrega quinta')
  })

  it('omits obs line when obs is null', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1)
    expect(txt).not.toContain('Obs:')
  })

  it('always ends with fiscal disclaimer', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1)
    expect(txt).toContain('Documento sem valor fiscal')
  })

  it('handles empty products array', () => {
    const v = { ...vendaBase, produtos: [] }
    expect(() => formatarReciboTexto(v, 'Loja', 1)).not.toThrow()
  })

  it('uses fallback store name when nomeFantasia is falsy', () => {
    const txt = formatarReciboTexto(vendaBase, '', 1)
    expect(txt.split('\n')[0]).toBe('Loja')
  })
})

// ── formatarReciboTexto — aviso fixo (lf_config.features.texto_aviso_recibo) ──
describe('formatarReciboTexto — aviso fixo opcional', () => {
  const vendaBase = {
    data: '2025-07-18T14:30:00',
    valor: 150,
    tipo_venda: 'venda',
    forma_pgto: JSON.stringify([{ forma: 'Pix', valor: 150 }]),
    produtos: [{ nome: 'Calça', variacao: '38', quantidade: 2 }],
    cliente_nome: null,
    vendedora: null,
    obs: null,
  }
  const AVISO = 'Não efetuamos trocas de peças no atacado e/ou promoção'

  it('aparece em negrito (*asterisco*, formatação do WhatsApp) quando o texto é passado', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1, AVISO)
    expect(txt).toContain(`*${AVISO}*`)
  })

  it('não aparece quando o parâmetro não é passado — comportamento idêntico ao de antes', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1)
    expect(txt).not.toContain(AVISO)
    expect(txt).not.toContain('*')
  })

  it('não aparece quando o parâmetro é string vazia (flag ausente/desligada)', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1, '')
    expect(txt).not.toContain('*')
  })

  it('não aparece quando o parâmetro é null (mesmo caso de loja sem o campo em lf_config)', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1, null)
    expect(txt).not.toContain('*')
  })

  it('usa o texto literal, sem alterar uma letra', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1, AVISO)
    expect(txt).toContain('Não efetuamos trocas de peças no atacado e/ou promoção')
  })

  it('continua terminando com o aviso de documento sem valor fiscal, depois do aviso fixo', () => {
    const txt = formatarReciboTexto(vendaBase, 'Loja', 1, AVISO)
    const linhas = txt.split('\n')
    const idxAviso = linhas.findIndex(l => l === `*${AVISO}*`)
    const idxFiscal = linhas.findIndex(l => l === 'Documento sem valor fiscal')
    expect(idxAviso).toBeGreaterThan(-1)
    expect(idxFiscal).toBeGreaterThan(idxAviso)
  })
})
