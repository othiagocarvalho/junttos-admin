// Aviso de possível cliente duplicada no cadastro manual (Clientes.jsx), e a
// regra de telefone compartilhada com a fusão automática da venda
// (utils/clienteVenda.js).
//
// ─── POR QUE ─────────────────────────────────────────────────────────────────
// A limpeza retroativa de 30/09/2026 apagou 341 cópias na tropicaleatacado e 1
// na biastore. O cadastro manual não conferia nada: a lojista criava a mesma
// cliente de novo sem aviso. Agora, antes do INSERT, o sistema procura no
// BANCO (nunca na lista da tela — foi a lista cortada/desatualizada que criou
// as duplicatas de 16–26/09) e, se achar alguém parecido, AVISA. Nunca
// bloqueia: "não é a mesma pessoa" segue com o cadastro normal.
//
// ─── CRITÉRIOS (os mesmos da limpeza, que se mostraram confiáveis) ──────────
//   · mesmo nome   — trim + minúsculas idênticos;
//   · nome parecido — igual depois de tirar acento, pontuação e espaço
//     duplo ("Débora"/"Debora", "VITORIA  ANDRADE/ONLINE"/"VITORIA ANDRADE ONLINE");
//   · mesmo telefone — últimos 8 dígitos iguais.
// Distância de edição (1–2 letras) NÃO é critério: no levantamento de 30/09
// ela trouxe mais homônimas de verdade do que duplicatas ("SARA"/"VARA",
// "LANA"/"JANA").

import { buscarTodasAsLinhas } from './supabasePaginacao'

export const MOTIVOS = {
  mesmo_nome: 'Mesmo nome',
  nome_parecido: 'Nome parecido',
  mesmo_telefone: 'Mesmo telefone',
}

/** Nome exato para comparação: trim + minúsculas. */
export const nomeExato = s => String(s ?? '').trim().toLowerCase()

/** Nome sem acento, pontuação e espaço duplo, em minúsculas. */
export function nomeNormalizado(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Chave de telefone: os últimos 8 dígitos, ignorando tudo que não é número.
 * Absorve DDI (+55), DDD e o nono dígito — "(91) 8278-7235",
 * "91998278-7235" e "+55 91 98278-7235" dão todos "82787235".
 *
 * null quando não dá para comparar: vazio, menos de 8 dígitos, ou número de
 * preenchimento (8 dígitos iguais, como "00000000" ou "99999999" — a biastore
 * tem cadastros assim, e casar por eles juntaria gente sem relação nenhuma).
 *
 * `aceitarCurto`: número com menos de 8 dígitos volta inteiro em vez de null —
 * a fusão da venda sempre comparou esses por igualdade e continua assim.
 */
export function ultimos8Digitos(telefone, { aceitarCurto = false } = {}) {
  const d = String(telefone ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length < 8) return aceitarCurto ? d : null
  const k = d.slice(-8)
  if (/^(\d)\1{7}$/.test(k)) return null
  return k
}

/** O que falta no cadastro para ele ser útil no CRM: telefone e/ou aniversário. */
export function camposFaltando(cliente) {
  const faltando = []
  if (!String(cliente?.telefone ?? '').trim()) faltando.push('telefone')
  if (!cliente?.data_nascimento) faltando.push('aniversário')
  return faltando
}

/** "Cadastro incompleto — falta telefone e aniversário" (ou null se completo). */
export function textoCadastroIncompleto(faltando) {
  if (!faltando?.length) return null
  return `Cadastro incompleto — falta ${faltando.join(' e ')}`
}

/**
 * Candidatos a duplicata de `novo` ({nome, telefone}) entre `existentes`.
 * @returns [{ cliente, motivos: ['mesmo_nome'|'nome_parecido'|'mesmo_telefone'], faltando }]
 *   ordenado: mais motivos primeiro, "mesmo nome" antes de "parecido", depois nome.
 */
export function acharCandidatos(novo, existentes) {
  const exato = nomeExato(novo?.nome)
  const normal = nomeNormalizado(novo?.nome)
  const tel = ultimos8Digitos(novo?.telefone)
  const achados = []
  for (const c of existentes || []) {
    const motivos = []
    if (exato && nomeExato(c.nome) === exato) motivos.push('mesmo_nome')
    else if (normal && nomeNormalizado(c.nome) === normal) motivos.push('nome_parecido')
    if (tel && ultimos8Digitos(c.telefone) === tel) motivos.push('mesmo_telefone')
    if (motivos.length) achados.push({ cliente: c, motivos, faltando: camposFaltando(c) })
  }
  const peso = a => a.motivos.length * 10 + (a.motivos.includes('mesmo_nome') ? 1 : 0)
  return achados.sort((a, b) => peso(b) - peso(a) || String(a.cliente.nome).localeCompare(String(b.cliente.nome), 'pt-BR'))
}

/**
 * Busca candidatos NO BANCO — nunca na lista `clientes` da tela.
 *
 * Lê só id/nome/telefone/aniversário de todas as clientes da loja (paginado:
 * a tropicaleatacado tem mais de 1000, e o PostgREST corta em 1000 em
 * silêncio) e compara aqui, porque "nome parecido" (sem acento) não tem como
 * ser filtrado pelo PostgREST sem extensão no banco. Depois traz a linha
 * completa só dos candidatos — é ela que abre para edição em "Usar este".
 *
 * @returns até `limite` candidatos, no formato de acharCandidatos.
 */
export async function buscarCandidatosDuplicata(supabase, lojaId, novo, { limite = 5 } = {}) {
  const { data, error } = await buscarTodasAsLinhas((from, to) =>
    supabase.from('lf_clientes').select('id, nome, telefone, data_nascimento')
      .eq('loja_id', lojaId).order('id').range(from, to)
  )
  if (error) throw error
  const candidatos = acharCandidatos(novo, data).slice(0, limite)
  if (!candidatos.length) return []

  const { data: completos, error: erroCompletos } = await supabase
    .from('lf_clientes').select('*').eq('loja_id', lojaId).in('id', candidatos.map(c => c.cliente.id))
  if (erroCompletos) throw erroCompletos
  const porId = new Map((completos || []).map(c => [c.id, c]))
  return candidatos
    .filter(c => porId.has(c.cliente.id))
    .map(c => ({ ...c, cliente: porId.get(c.cliente.id) }))
}

/**
 * Fluxo do botão Salvar de um cliente NOVO.
 *   · sem `forcar`: procura candidatos; achou → { acao: 'aviso', candidatos }
 *     e NÃO cria nada (a tela mostra o aviso).
 *   · com `forcar` ("Não é a mesma pessoa — criar cliente nova"), ou sem
 *     candidatos: cria normalmente → { acao: 'criado', cliente }.
 * Se a busca falhar (rede), segue criando: o aviso é ajuda, nunca bloqueio —
 * é o mesmo comportamento de antes deste aviso existir.
 */
export async function salvarClienteNovo({ form, buscarCandidatos, addCliente, forcar = false }) {
  if (!forcar && buscarCandidatos) {
    let candidatos = []
    try {
      candidatos = await buscarCandidatos(form)
    } catch (e) {
      console.error('[duplicata-cliente] busca falhou, seguindo com o cadastro', e)
    }
    if (candidatos?.length) return { acao: 'aviso', candidatos }
  }
  const cliente = await addCliente(form)
  return { acao: 'criado', cliente }
}

/**
 * "Usar este →": o cadastro EXISTENTE abre para edição — nada é criado.
 * Campos vazios nele são pré-preenchidos com o que a lojista já tinha
 * digitado no formulário novo (ex.: o telefone que faltava), para ela
 * conferir e salvar. Campo já preenchido no existente NUNCA é trocado.
 *
 * @returns { cliente: existente com os vazios completados, preenchidos: [campos completados] }
 */
export function usarClienteExistente(existente, formDigitado, campos) {
  const cliente = { ...existente }
  const preenchidos = []
  for (const campo of campos) {
    const digitado = String(formDigitado?.[campo] ?? '').trim()
    if (!digitado) continue
    if (String(existente?.[campo] ?? '').trim()) continue
    cliente[campo] = digitado
    preenchidos.push(campo)
  }
  return { cliente, preenchidos }
}
