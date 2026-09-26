// Sincronização de cliente em lf_clientes a partir de uma venda — caminho
// ÚNICO de criação/atualização automática de cliente. Chamado por addVenda
// (Nova Venda mobile e desktop, useLojaData.js) e pela finalização da
// Pré-venda (PreVendasLista.jsx, via sincronizarClienteVenda do hook).
//
// ─── POR QUE MORA AQUI, E NÃO EM DOIS LUGARES ──────────────────────────────
// Até o commit 77ff869 existiam dois caminhos: addVenda criava o cliente
// (sem aniversário) e, logo depois, salvarAniversarioCliente procurava o
// mesmo cliente na lista `clientes` da TELA — que ainda não tinha sido
// recarregada (fetchAll só roda depois) — não achava e criava um SEGUNDO
// registro, esse com o aniversário. Resultado: 353 duplicatas na
// tropicaleatacado entre 16/09 e 26/09. Agora o aniversário entra junto, na
// mesma chamada, e a busca é sempre no BANCO, nunca numa lista de tela.
//
// ─── REGRA DE CASAMENTO (a mesma que addVenda já usava) ───────────────────
// Nome: trim + sem caixa (mesmo critério do CRM/Sócio Digital). Telefone só
// desempata: se a venda E o cadastro têm telefone, precisam bater; se um dos
// dois não tem, o nome basta.
//
// ─── O QUE ATUALIZA NUM CLIENTE JÁ EXISTENTE ──────────────────────────────
// Só preenche o que está vazio — telefone e aniversário. Nunca sobrescreve
// um valor que já estava no cadastro.
//
// Erros aqui nunca derrubam a venda — ela já foi gravada antes desta função
// rodar. O try/catch é de propósito; o erro vai para o console como sempre
// foi ('[auto-cliente]').

const normNome = s => (s || '').trim().toLowerCase()
const normTel = t => (t || '').replace(/[\s\-().]/g, '')

/**
 * @param db { buscarPorNome(nome) → Promise<rows>, inserir(row) → Promise<row>, atualizar(id, campos) → Promise<row> }
 *           — quem chama injeta o acesso ao banco (useLojaData.js), já com loja_id.
 * @param dados { nome, telefone, aniversario } — aniversario em ISO (AAAA-MM-DD) ou vazio.
 * @returns {Promise<{acao: 'ignorado'|'criado'|'atualizado'|'existente'|'erro', cliente: object|null}>}
 */
export async function sincronizarClienteDaVenda(db, { nome, telefone, aniversario } = {}) {
  const nomeVenda = (nome || '').trim()
  if (!nomeVenda) return { acao: 'ignorado', cliente: null }

  try {
    const telVenda = (telefone || '').trim()
    const telVendaNorm = normTel(telVenda)

    const existentes = await db.buscarPorNome(nomeVenda)
    // O filtro de nome aqui é exato (trim+lower): a busca no banco é por
    // ilike, e um "_" ou "%" no nome viraria curinga lá.
    const match = (existentes || []).find(c => {
      if (normNome(c.nome) !== normNome(nomeVenda)) return false
      const ct = normTel(c.telefone || '')
      if (telVendaNorm && ct) return ct === telVendaNorm
      return true
    })

    if (!match) {
      const cliente = await db.inserir({
        nome: nomeVenda,
        telefone: telVenda || null,
        email: null,
        data_nascimento: aniversario || null,
        observacoes: null,
      })
      return { acao: 'criado', cliente: cliente || null }
    }

    const campos = {}
    if (!match.telefone && telVenda) campos.telefone = telVenda
    if (!match.data_nascimento && aniversario) campos.data_nascimento = aniversario
    if (Object.keys(campos).length === 0) return { acao: 'existente', cliente: match }

    const cliente = await db.atualizar(match.id, campos)
    return { acao: 'atualizado', cliente: cliente || { ...match, ...campos } }
  } catch (e) {
    console.error('[auto-cliente]', e)
    return { acao: 'erro', cliente: null }
  }
}
