// Busca de produto por nome — extraída da lista do Passo 2 da Nova Venda
// (LojaFeminina/NovaVenda.jsx e a cópia de DesktopNovaVenda): campo de busca
// (contemBusca), chips de categoria (construirCategorias/filtrarPorCategoria/
// ChipsCategoria), lista de produtos e variações.
//
// Usada hoje só pela Pré-venda (mobile e desktop). A Nova Venda continua com a
// lista própria dela — migrar fica para outra tarefa.
//
// ─── DIFERENÇAS DE PROPÓSITO EM RELAÇÃO À LISTA DA NOVA VENDA ───────────────
// - Produto identificado SEMPRE por id (a Nova Venda ainda casa a linha da
//   lista com produtosData pelo nome — com dois produtos de mesmo nome, os
//   dois viravam o primeiro). Aqui cada linha é um objeto de produto.
// - Sem botões de + e −: na Pré-venda cada toque RESERVA uma peça no banco;
//   um "−" seria uma devolução disfarçada. Quem tira peça é a lista de itens
//   bipados da própria tela, que devolve o estoque do jeito certo.
// - Cada toque trava aquele botão até terminar (travaPorChave): toque duplo
//   não vira duas baixas.
// - Estoque mostrado é o que vem em `produtos` — a Pré-venda passa o
//   produtosData com as reservas desta sessão já descontadas. Só exibição:
//   a RPC é quem decide se há estoque.
//
// O componente não sabe nada de pré-venda: só avisa aoEscolher({produto,
// rotulo}) (rotulo null = produto sem variação) e espera a promessa.

import { useState, useMemo } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { ChipsCategoria } from './FiltroProdutos'
import { PrecoProduto } from './ResumoVenda'
import { construirCategorias, filtrarPorCategoria, CHAVE_TODOS } from '../../utils/categoriaProduto'
import { contemBusca } from '../../utils/texto'
import { opcoesDoProduto, chaveReserva } from '../../utils/prevenda'
import { criarTravaPorChave } from '../../utils/travaPorChave'

const FONT = 'Plus Jakarta Sans, sans-serif'

export default function SeletorProduto({ produtos = [], aoEscolher, itens = [], primary = 'var(--primary)', desabilitado = false, alturaLista = 360 }) {
  const [busca, setBusca] = useState('')
  const [catSel, setCatSel] = useState(CHAVE_TODOS)
  const [aberto, setAberto] = useState(null)             // id do produto com variações abertas
  const [ocupados, setOcupados] = useState(() => new Set())
  // Trava síncrona contra toque duplo — ver utils/travaPorChave.js. O Set
  // `ocupados` abaixo é só para desenhar o botão desabilitado.
  const [trava] = useState(criarTravaPorChave)

  const nomes = useMemo(() => produtos.map(p => p.nome), [produtos])
  const cats = useMemo(() => construirCategorias(nomes), [nomes])
  const permitidos = new Set(filtrarPorCategoria(nomes, catSel, cats.mapa))
  const filtrados = produtos.filter(p => permitidos.has(p.nome) && contemBusca(p.nome, busca))

  // Quantas peças deste produto já estão na pré-venda (pelo id).
  function naPreVenda(produtoId) {
    return itens.filter(it => it.produto_id === produtoId).reduce((s, it) => s + (Number(it.quantidade) || 1), 0)
  }

  async function escolher(produto, rotulo) {
    if (desabilitado) return
    const chave = chaveReserva(produto.id, rotulo)
    await trava.executar(chave, async () => {
      setOcupados(prev => new Set(prev).add(chave))
      try {
        await aoEscolher?.({ produto, rotulo })
      } finally {
        setOcupados(prev => { const s = new Set(prev); s.delete(chave); return s })
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar produto pelo nome..."
          aria-label="Buscar produto pelo nome"
          autoComplete="off"
          style={{
            width: '100%', height: 44, boxSizing: 'border-box',
            background: 'var(--surface)', border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-input, 12px)', padding: `0 ${busca ? 40 : 14}px 0 40px`,
            // 16px evita o zoom do iOS ao focar.
            fontFamily: FONT, fontSize: 16, color: 'var(--ink)', outline: 'none',
          }}
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 6, display: 'flex' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <ChipsCategoria
        categorias={cats.categorias}
        exibir={cats.exibir}
        selecionada={catSel}
        onSelecionar={setCatSel}
        primary={primary}
      />

      {filtrados.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '18px 12px', margin: 0 }}>
          Nenhum produto encontrado
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: alturaLista, overflowY: 'auto', paddingBottom: 4 }}>
          {filtrados.map(produto => {
            const opcoes = opcoesDoProduto(produto)
            const semVariacao = opcoes.length === 0
            // Mesma regra da Nova Venda: variação única 'Único' se comporta
            // como produto simples — um toque já escolhe.
            const unico = opcoes.length === 1 && opcoes[0].rotulo === 'Único'
            const direto = semVariacao || unico
            const rotuloDireto = unico ? 'Único' : null
            const estoqueDireto = semVariacao ? (Number(produto.quantidade) || 0) : unico ? opcoes[0].quantidade : null
            const chaveDireta = chaveReserva(produto.id, rotuloDireto)
            const ocupadoDireto = direto && ocupados.has(chaveDireta)
            const esgotadoDireto = direto && estoqueDireto <= 0
            const qtdNaPreVenda = naPreVenda(produto.id)
            const isOpen = aberto === produto.id
            const bloqueado = desabilitado || ocupadoDireto || esgotadoDireto

            return (
              <div key={produto.id}>
                <button
                  type="button"
                  disabled={direto && bloqueado}
                  aria-expanded={direto ? undefined : isOpen}
                  onClick={() => direto ? escolher(produto, rotuloDireto) : setAberto(prev => prev === produto.id ? null : produto.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    width: '100%', textAlign: 'left',
                    padding: '11px 14px', cursor: direto && bloqueado ? 'not-allowed' : 'pointer',
                    borderRadius: isOpen ? '12px 12px 0 0' : 12,
                    border: qtdNaPreVenda > 0 ? `1.5px solid ${primary}` : '1px solid var(--line)',
                    background: qtdNaPreVenda > 0 ? `${primary}14` : 'var(--surface)',
                    opacity: direto && (esgotadoDireto || ocupadoDireto) ? 0.55 : 1,
                    fontFamily: FONT, color: 'var(--ink)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: qtdNaPreVenda > 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {produto.nome}
                    </span>
                    <PrecoProduto preco={Number(produto.preco_venda) || 0} cor={qtdNaPreVenda > 0 ? primary : undefined} />
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {qtdNaPreVenda > 0 && (
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: `${primary}22`, color: primary, fontWeight: 700 }}>
                        {qtdNaPreVenda}× na pré-venda
                      </span>
                    )}
                    {direto && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                        {ocupadoDireto ? 'reservando…' : esgotadoDireto ? 'esgotado' : `${estoqueDireto} disp.`}
                      </span>
                    )}
                    {!direto && (
                      <ChevronDown size={14} color="var(--muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                    )}
                  </span>
                </button>

                {!direto && isOpen && (
                  <div style={{
                    padding: '10px 14px 12px',
                    border: '1px solid var(--line)', borderTop: 'none',
                    borderRadius: '0 0 12px 12px', background: 'var(--bg)',
                  }}>
                    <p style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>
                      Toque na variação para reservar 1 peça
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {opcoes.map(({ rotulo, quantidade }) => {
                        const chave = chaveReserva(produto.id, rotulo)
                        const ocupado = ocupados.has(chave)
                        const esgotado = quantidade <= 0
                        const off = desabilitado || ocupado || esgotado
                        return (
                          <button
                            key={rotulo}
                            type="button"
                            disabled={off}
                            onClick={() => escolher(produto, rotulo)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '7px 12px', borderRadius: 8,
                              cursor: off ? 'not-allowed' : 'pointer',
                              fontFamily: FONT, fontSize: 13, fontWeight: 600,
                              opacity: esgotado || ocupado ? 0.5 : 1,
                              border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)',
                            }}
                          >
                            {rotulo}
                            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>
                              {ocupado ? '(reservando…)' : esgotado ? '(esgotado)' : `(${quantidade})`}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
