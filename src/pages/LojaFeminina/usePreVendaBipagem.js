// Estado e ações da tela de bipagem da Pré-venda — compartilhado entre
// PreVenda.jsx (mobile) e DesktopPreVenda (ClientDashboardDesktop.jsx). As
// duas telas só desenham; a regra (fila, RPC, gravação, compensação) está em
// utils/bipagemPreVenda.js.
//
// ─── TRAVA DE BALANÇO ────────────────────────────────────────────────────────
// addVenda() (Nova Venda) checa checarTravaBalanco antes de gravar; como
// aqui não passamos por addVenda (addVendaRaw não mexe em estoque, de
// propósito — ver o comentário dela em useLojaData.js), a checagem é feita
// aqui, uma vez, ao abrir a tela: bipar durante um balanço em andamento
// corromperia a contagem em curso.
//
// ─── fetchAll SÓ NA SAÍDA ────────────────────────────────────────────────────
// A bipagem grava com recarregar:false. O resto do app (lista de pré-vendas,
// Início, estoque) só enxerga as mudanças depois de um fetchAll, que roda
// UMA vez: em sair() ("Salvar e continuar depois"), depois de a fila
// esvaziar; ou, se a vendedora sair por outro caminho (menu, aba), quando a
// tela desmonta — também depois de a fila esvaziar. Tarefa já enfileirada
// sempre roda até o fim: desmontar a tela não cancela promessa nenhuma.

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { buscarPorCodigo } from '../../utils/codigoBarras'
import { vendedorParaVenda } from '../../utils/vendedores'
import { checarTravaBalanco } from '../../utils/balanco'
import { calcularTotalVenda } from '../../utils/venda'
import { aplicarReservas, chaveLinha } from '../../utils/prevenda'
import { criarBipagemPreVenda, TEXTO_BALANCO } from '../../utils/bipagemPreVenda'

export function usePreVendaBipagem({ produtosData = [], addVendaRaw, updateVenda, fetchAll, LOJA_ID = '', onSalvo }) {
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTel, setClienteTel] = useState('')
  const [vendedora, setVendedora] = useState('')

  const [checandoTrava, setCheckandoTrava] = useState(true)
  const [travado, setTravado] = useState(false)

  const [estado, setEstado] = useState({ vendaId: null, itens: [], reservas: {}, pendentes: 0, dadosTravados: false })
  const [removendo, setRemovendo] = useState(() => new Set())
  const [saindo, setSaindo] = useState(false)

  const [nucleo] = useState(() => criarBipagemPreVenda({ supabase, lojaId: LOJA_ID, aoMudar: setEstado }))

  // O núcleo lê o contexto na HORA de processar cada tarefa da fila, e não o
  // valor do render em que o bipe aconteceu. Entregue num layout effect
  // (depois de cada render, antes de qualquer evento novo ser tratado).
  useLayoutEffect(() => {
    nucleo.definirContexto({
      clienteNome, clienteTel,
      vendedora: vendedorParaVenda(vendedora),
      produtosData,
      travado,
      addVendaRaw,
      updateVenda,
      fetchAll,
    })
  })

  // Há gravação desta tela que o resto do app ainda não viu (fetchAll)?
  // Abrir e fechar a tela sem bipar nada não recarrega à toa; e um bipe que
  // chegue DEPOIS do fetchAll de sair() volta a marcar, para a desmontagem
  // recarregar de novo.
  const sujoRef = useRef(false)
  // A desmontagem precisa do fetchAll mais recente, não o do primeiro render.
  const fetchAllRef = useRef(fetchAll)
  useLayoutEffect(() => { fetchAllRef.current = fetchAll })

  useEffect(() => {
    let vivo = true
    async function checar() {
      const { travado: t } = await checarTravaBalanco(supabase, LOJA_ID)
      if (vivo) { setTravado(t); setCheckandoTrava(false) }
    }
    checar()
    return () => { vivo = false }
  }, [LOJA_ID])

  // produtosData recarregado do banco já traz as baixas: as reservas locais
  // (só de exibição) deixam de ser descontadas. Ver aplicarReservas.
  useEffect(() => { nucleo.zerarReservas() }, [nucleo, produtosData])

  // Saída por qualquer caminho que não o botão (menu lateral, aba de baixo):
  // espera a fila esvaziar e recarrega uma vez.
  useEffect(() => () => {
    if (!sujoRef.current) return
    nucleo.aguardarVazia().then(() => { sujoRef.current = false; return fetchAllRef.current?.() })
  }, [nucleo])

  // Fechar a aba/recarregar a página com bipe na fila perderia esse bipe:
  // o navegador pergunta antes.
  useEffect(() => {
    if (estado.pendentes === 0) return
    const aviso = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [estado.pendentes])

  /** Caminho único de reserva de peça — leitor e busca por nome. */
  function registrarItem(produto, rotulo) {
    if (travado) return Promise.resolve({ ok: false, texto: TEXTO_BALANCO })
    sujoRef.current = true
    return nucleo.registrarItem(produto, rotulo)
  }

  function lerCodigoBarras(codigo) {
    if (travado) return { ok: false, texto: TEXTO_BALANCO }
    const achado = buscarPorCodigo(produtosData, LOJA_ID, codigo)
    if (!achado) return { ok: false, texto: 'Código não encontrado nesta loja' }
    return registrarItem(achado.produto, achado.rotulo)
  }

  async function removerItem(item) {
    const chave = chaveLinha(item)
    if (removendo.has(chave)) return
    setRemovendo(prev => new Set(prev).add(chave))
    sujoRef.current = true
    try {
      await nucleo.removerItem(item)
    } finally {
      setRemovendo(prev => { const s = new Set(prev); s.delete(chave); return s })
    }
  }

  /** "Salvar e continuar depois": espera a fila, recarrega uma vez, navega. */
  async function sair() {
    if (saindo) return
    setSaindo(true)
    try {
      await nucleo.aguardarVazia()
      if (sujoRef.current) {
        sujoRef.current = false
        await fetchAll?.()
      }
    } finally {
      setSaindo(false)
    }
    onSalvo?.()
  }

  const produtosExibicao = useMemo(() => aplicarReservas(produtosData, estado.reservas), [produtosData, estado.reservas])
  const valor = calcularTotalVenda(estado.itens, produtosData)
  const totalPecas = estado.itens.reduce((s, it) => s + (Number(it.quantidade) || 1), 0)

  return {
    clienteNome, setClienteNome,
    clienteTel, setClienteTel,
    vendedora, setVendedora,
    checandoTrava, travado,
    itens: estado.itens,
    pendentes: estado.pendentes,
    dadosTravados: estado.dadosTravados,
    removendo,
    saindo,
    valor,
    totalPecas,
    produtosExibicao,
    registrarItem,
    lerCodigoBarras,
    removerItem,
    sair,
  }
}
