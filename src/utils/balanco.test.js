import { describe, it, expect } from 'vitest'
import {
  getVarLabel,
  itemKey,
  agruparItensPorProduto,
  verificarBatimento,
  calcularDivergencia,
  compararConferencia,
  somarSetores,
} from './balanco'

const UUID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const UUID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const SUB1 = 'sub1-uuid'
const SUB2 = 'sub2-uuid'

// ── getVarLabel ──────────────────────────────────────────────────────────────

describe('getVarLabel', () => {
  it('extrai a chave dinâmica de cor', () => {
    expect(getVarLabel({ cor: 'Preto', quantidade: 5 })).toBe('Preto')
  })
  it('extrai a chave dinâmica de tamanho', () => {
    expect(getVarLabel({ tamanho: 'M', quantidade: 3, custo: 10 })).toBe('M')
  })
  it('retorna null para objeto vazio', () => {
    expect(getVarLabel({})).toBeNull()
  })
  it('retorna null para valor nulo', () => {
    expect(getVarLabel(null)).toBeNull()
  })
})

// ── itemKey ──────────────────────────────────────────────────────────────────

describe('itemKey', () => {
  it('usa produto_id quando disponível', () => {
    expect(itemKey(UUID_A, 'Preto', 'Camiseta')).toBe(`${UUID_A}::Preto`)
  })
  it('usa ext:: com nome quando produto_id é null', () => {
    expect(itemKey(null, null, 'Item Manual')).toBe('ext::Item Manual')
  })
  it('trata variacao_label null como string vazia', () => {
    expect(itemKey(UUID_A, null, 'Camiseta')).toBe(`${UUID_A}::`)
  })
  it('produto_id tem precedência sobre nome', () => {
    expect(itemKey(UUID_A, 'G', 'Calça')).toBe(`${UUID_A}::G`)
  })
})

// ── verificarBatimento ───────────────────────────────────────────────────────

describe('verificarBatimento', () => {
  it('retorna ok com apenas 1 subcontagem', () => {
    expect(verificarBatimento(new Map([[SUB1, 3]]))).toBe('ok')
  })
  it('retorna ok quando todas as quantidades são iguais', () => {
    expect(verificarBatimento(new Map([[SUB1, 3], [SUB2, 3]]))).toBe('ok')
  })
  it('retorna divergencia quando há diferença', () => {
    expect(verificarBatimento(new Map([[SUB1, 3], [SUB2, 4]]))).toBe('divergencia')
  })
  it('retorna ok com mapa vazio', () => {
    expect(verificarBatimento(new Map())).toBe('ok')
  })
  it('detecta divergencia com 3 conferentes', () => {
    expect(verificarBatimento(new Map([[SUB1, 5], [SUB2, 5], ['sub3', 6]]))).toBe('divergencia')
  })
})

// ── calcularDivergencia ──────────────────────────────────────────────────────

describe('calcularDivergencia', () => {
  it('retorna negativo quando contagem é menor que sistema', () => {
    expect(calcularDivergencia(5, 3)).toBe(-2)
  })
  it('retorna positivo quando contagem supera sistema', () => {
    expect(calcularDivergencia(3, 5)).toBe(2)
  })
  it('retorna zero quando bate exato', () => {
    expect(calcularDivergencia(5, 5)).toBe(0)
  })
  it('retorna null quando sistema é null', () => {
    expect(calcularDivergencia(null, 3)).toBeNull()
  })
  it('retorna null quando contada é null', () => {
    expect(calcularDivergencia(5, null)).toBeNull()
  })
  it('lida com strings numéricas', () => {
    expect(calcularDivergencia('10', '7')).toBe(-3)
  })
})

// ── agruparItensPorProduto ───────────────────────────────────────────────────

describe('agruparItensPorProduto', () => {
  const itens = [
    { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'Camiseta', variacao_label: 'P', quantidade: 2, qtd_sistema: 10 },
    { subcontagem_id: SUB2, produto_id: UUID_A, produto_nome: 'Camiseta', variacao_label: 'P', quantidade: 3, qtd_sistema: 10 },
    { subcontagem_id: SUB1, produto_id: UUID_B, produto_nome: 'Calça',    variacao_label: 'M', quantidade: 1, qtd_sistema: 4  },
  ]

  it('cria um grupo por produto_id+variacao_label', () => {
    expect(agruparItensPorProduto(itens).size).toBe(2)
  })
  it('separa quantidades por subcontagem', () => {
    const mapa = agruparItensPorProduto(itens)
    const grupo = mapa.get(`${UUID_A}::P`)
    expect(grupo.porSubcontagem.get(SUB1)).toBe(2)
    expect(grupo.porSubcontagem.get(SUB2)).toBe(3)
  })
  it('acumula múltiplas bipagens da mesma subcontagem', () => {
    const duplos = [
      { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'X', variacao_label: 'G', quantidade: 2, qtd_sistema: null },
      { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'X', variacao_label: 'G', quantidade: 1, qtd_sistema: null },
    ]
    const grupo = agruparItensPorProduto(duplos).get(`${UUID_A}::G`)
    expect(grupo.porSubcontagem.get(SUB1)).toBe(3)
  })
  it('preserva qtd_sistema do primeiro item que a tiver', () => {
    const grupo = agruparItensPorProduto(itens).get(`${UUID_A}::P`)
    expect(grupo.qtd_sistema).toBe(10)
  })
  it('agrupa itens externos (produto_id null) por nome', () => {
    const externos = [
      { subcontagem_id: SUB1, produto_id: null, produto_nome: 'Paracetamol', variacao_label: null, quantidade: 5, qtd_sistema: null },
      { subcontagem_id: SUB2, produto_id: null, produto_nome: 'Paracetamol', variacao_label: null, quantidade: 5, qtd_sistema: null },
    ]
    expect(agruparItensPorProduto(externos).size).toBe(1)
  })
})

// ── compararConferencia ──────────────────────────────────────────────────────

describe('compararConferencia', () => {
  it('marca ok e calcula divergência quando todos batem', () => {
    const itens = [
      { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'Camiseta', variacao_label: 'P', quantidade: 3, qtd_sistema: 5 },
      { subcontagem_id: SUB2, produto_id: UUID_A, produto_nome: 'Camiseta', variacao_label: 'P', quantidade: 3, qtd_sistema: 5 },
    ]
    const res = compararConferencia(itens)
    expect(res[0].batimento).toBe('ok')
    expect(res[0].qtdContada).toBe(3)
    expect(res[0].divergencia).toBe(-2)
  })
  it('marca divergencia e deixa qtdContada null quando diferem', () => {
    const itens = [
      { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'Camiseta', variacao_label: 'P', quantidade: 3, qtd_sistema: 5 },
      { subcontagem_id: SUB2, produto_id: UUID_A, produto_nome: 'Camiseta', variacao_label: 'P', quantidade: 4, qtd_sistema: 5 },
    ]
    const res = compararConferencia(itens)
    expect(res[0].batimento).toBe('divergencia')
    expect(res[0].qtdContada).toBeNull()
    expect(res[0].divergencia).toBeNull()
  })
  it('ordena divergencias antes de itens ok', () => {
    const itens = [
      { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'A-ok',  variacao_label: null, quantidade: 3, qtd_sistema: 3 },
      { subcontagem_id: SUB2, produto_id: UUID_A, produto_nome: 'A-ok',  variacao_label: null, quantidade: 3, qtd_sistema: 3 },
      { subcontagem_id: SUB1, produto_id: UUID_B, produto_nome: 'B-div', variacao_label: null, quantidade: 2, qtd_sistema: 2 },
      { subcontagem_id: SUB2, produto_id: UUID_B, produto_nome: 'B-div', variacao_label: null, quantidade: 5, qtd_sistema: 2 },
    ]
    const res = compararConferencia(itens)
    expect(res[0].produto_nome).toBe('B-div')
    expect(res[1].produto_nome).toBe('A-ok')
  })
  it('divergência 0 quando bate e sistema é igual', () => {
    const itens = [
      { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'X', variacao_label: null, quantidade: 7, qtd_sistema: 7 },
      { subcontagem_id: SUB2, produto_id: UUID_A, produto_nome: 'X', variacao_label: null, quantidade: 7, qtd_sistema: 7 },
    ]
    expect(compararConferencia(itens)[0].divergencia).toBe(0)
  })
  it('divergência null quando qtd_sistema é desconhecida', () => {
    const itens = [
      { subcontagem_id: SUB1, produto_id: null, produto_nome: 'Manual', variacao_label: null, quantidade: 2, qtd_sistema: null },
      { subcontagem_id: SUB2, produto_id: null, produto_nome: 'Manual', variacao_label: null, quantidade: 2, qtd_sistema: null },
    ]
    expect(compararConferencia(itens)[0].divergencia).toBeNull()
  })
})

// ── somarSetores ─────────────────────────────────────────────────────────────

describe('somarSetores', () => {
  it('soma quantidades de todos os setores', () => {
    const itens = [
      { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'Camiseta', variacao_label: 'P', quantidade: 5, qtd_sistema: 10 },
      { subcontagem_id: SUB2, produto_id: UUID_A, produto_nome: 'Camiseta', variacao_label: 'P', quantidade: 3, qtd_sistema: 10 },
    ]
    const res = somarSetores(itens)
    expect(res[0].qtdContada).toBe(8)
    expect(res[0].divergencia).toBe(-2)
  })
  it('todos os itens têm batimento ok', () => {
    const itens = [
      { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'X', variacao_label: null, quantidade: 1, qtd_sistema: null },
    ]
    expect(somarSetores(itens)[0].batimento).toBe('ok')
  })
  it('item com qtd_sistema null resulta em divergencia null', () => {
    const itens = [
      { subcontagem_id: SUB1, produto_id: null, produto_nome: 'Externo', variacao_label: null, quantidade: 4, qtd_sistema: null },
    ]
    expect(somarSetores(itens)[0].divergencia).toBeNull()
  })
  it('ordena por nome do produto', () => {
    const itens = [
      { subcontagem_id: SUB1, produto_id: UUID_B, produto_nome: 'Calça',    variacao_label: null, quantidade: 1, qtd_sistema: null },
      { subcontagem_id: SUB1, produto_id: UUID_A, produto_nome: 'Camiseta', variacao_label: null, quantidade: 2, qtd_sistema: null },
    ]
    const res = somarSetores(itens)
    expect(res[0].produto_nome).toBe('Calça')
    expect(res[1].produto_nome).toBe('Camiseta')
  })
})
