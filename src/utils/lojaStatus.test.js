import { describe, it, expect } from 'vitest'
import { isLojaExcluida, STATUS_EXCLUIDA } from './lojaStatus.js'

describe('STATUS_EXCLUIDA', () => {
  // Trava proposital: este é exatamente o literal que CadastroCliente grava em
  // `update({ status: 'excluida' })`. Se ele mudar lá sem mudar aqui, o acesso
  // da loja excluída reabre em silêncio — este teste quebra antes disso.
  it("é exatamente 'excluida', o valor que o soft delete grava", () => {
    expect(STATUS_EXCLUIDA).toBe('excluida')
  })
})

describe('isLojaExcluida', () => {
  it('reconhece a loja excluída', () => {
    expect(isLojaExcluida('excluida')).toBe(true)
  })

  it('normaliza caixa e espaço — Studio digitado à mão não reabre o acesso', () => {
    expect(isLojaExcluida('Excluida')).toBe(true)
    expect(isLojaExcluida('EXCLUIDA')).toBe(true)
    expect(isLojaExcluida('  excluida  ')).toBe(true)
    expect(isLojaExcluida('ExClUiDa')).toBe(true)
  })

  it('status ausente é loja normal, NÃO excluída', () => {
    // Tratar ausência como exclusão derrubaria loja legítima sem status.
    expect(isLojaExcluida(null)).toBe(false)
    expect(isLojaExcluida(undefined)).toBe(false)
    expect(isLojaExcluida('')).toBe(false)
  })

  it('nenhum status real do banco é confundido com excluída', () => {
    // Os valores que existem hoje em lf_config, conferidos em 20/08/2026.
    for (const s of ['ativo', 'Ativo', 'Trial', 'demo', 'Inativo']) {
      expect(isLojaExcluida(s)).toBe(false)
    }
  })

  it('não casa por prefixo/substring', () => {
    expect(isLojaExcluida('excluida_em_2026')).toBe(false)
    expect(isLojaExcluida('nao-excluida')).toBe(false)
  })
})

// ── Resolução de slug (App.jsx) ─────────────────────────────────────────────
// Espelha exatamente a decisão de App.jsx:
//   if (!data || isLojaExcluida(data.status)) → 'inexistente'
// Loja excluída e slug inexistente caem no MESMO estado de propósito: a tela
// diz só "Loja não encontrada", sem revelar que a loja já existiu.

function resolverLoja(data) {
  if (!data || isLojaExcluida(data.status)) return 'inexistente'
  return 'ok'
}

describe('resolução de slug — loja carrega ou não', () => {
  it('loja ativa carrega normalmente', () => {
    expect(resolverLoja({ loja_id: 'audazwear', segmento: 'moda', status: 'Ativo' })).toBe('ok')
  })

  it('loja excluída NÃO carrega', () => {
    expect(resolverLoja({ loja_id: 'convenienciagaia', segmento: 'moda', status: 'excluida' })).toBe('inexistente')
  })

  it('as 11 lojas ativas de hoje continuam carregando', () => {
    // Snapshot do banco em 20/08/2026 — âncora de regressão.
    const lojas = [
      { loja_id: 'estrada',             status: 'ativo'  },
      { loja_id: 'biastore',            status: 'ativo'  },
      { loja_id: 'sualoja',             status: 'demo'   },
      { loja_id: 'catalogob2bdemo',     status: 'demo'   },
      { loja_id: 'teixeiramultimarcas', status: 'Trial'  },
      { loja_id: 'encantodemulher',     status: 'Trial'  },
      { loja_id: 'mercadodemo',         status: 'Ativo'  },
      { loja_id: 'audazwear',           status: 'Ativo'  },
      { loja_id: 'hmboutique',          status: 'Ativo'  },
      { loja_id: 'nbdistribuidora',     status: 'Trial'  },
      { loja_id: 'tropicaleatacado',    status: 'Ativo'  },
      { loja_id: 'gaiaconveniencia',    status: 'Ativo'  },
    ]
    expect(lojas.every(l => resolverLoja(l) === 'ok')).toBe(true)
  })

  it('slug inexistente e loja excluída dão o MESMO resultado — não vaza que existiu', () => {
    const inexistente = resolverLoja(null)
    const excluida    = resolverLoja({ loja_id: 'convenienciagaia', status: 'excluida' })
    expect(excluida).toBe(inexistente)
  })

  it('loja sem status ainda carrega — a correção não derruba loja legítima', () => {
    expect(resolverLoja({ loja_id: 'qualquer', segmento: 'moda', status: null })).toBe('ok')
    expect(resolverLoja({ loja_id: 'qualquer', segmento: 'moda' })).toBe('ok')
  })
})
