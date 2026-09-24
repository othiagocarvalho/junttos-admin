// Avisos da tela Início — regra única de "o que mostrar, em que ordem".
//
// Substitui a lógica que morava espalhada em AlertaBanner.jsx (estoque,
// meta batida, contas, Sócio) e BannerMeta.jsx (sem meta). Função pura: sem
// React, sem Supabase — quem busca os dados é AvisosInicio.jsx.
//
// ORDEM (aprovada): conta vencendo > Sócio pronto > estoque baixo > sem meta
//                   > Sócio conhecer > meta batida.
// Conta a pagar e conta a receber viram avisos separados (nunca misturar
// recebimento com pagamento), os dois na faixa de prioridade de "conta",
// pagar antes de receber.
//
// DISPENSA (o X) — cada aviso diz o que gravar em `dispensa`:
//   · sem meta        → lf_config.meta_lembrete_dispensado_em = 'YYYY-MM' (já existia)
//   · Sócio pronto    → lf_config.socio_visto_periodo = periodo_inicio      (já existia)
//   · Sócio conhecer  → lf_config.socio_intro_visto = true                  (já existia)
//   · meta batida     → avisos_dispensados.meta_batida = 'YYYY-MM'
//   · contas          → avisos_dispensados.conta = ['pagar:ID', 'receber:ID', …]
//   · estoque         → avisos_dispensados.estoque = { ids: [...], em: 'YYYY-MM-DD' }
// Colunas ausentes no banco chegam undefined e contam como "nunca dispensou",
// mesmo tratamento de deveMostrarLembreteMeta.
//
// DATAS: sempre o dia LOCAL do aparelho (diaISO / diasEntre), nunca
// toISOString(), que usa UTC e no Brasil vira o dia seguinte depois das 21h.

import { temAcesso } from './planos'
import { fmtR } from './formatters'
import { diaISO } from './caixa'
import { diasEntre, somarDias, fmtDiaMes } from './datas'
import { competenciaAtual, deveMostrarLembreteMeta } from './lembreteMeta'
import { avisoSocioBanner, rotuloPeriodo } from './socioDigital'

/** Soma das variações até este número (inclusive) = estoque baixo. 0 = esgotado. */
export const ESTOQUE_BAIXO_MAX = 6
/** Contas pendentes que vencem até hoje + N dias (as vencidas entram sempre). */
export const JANELA_CONTAS_DIAS = 3
/** Estoque dispensado volta depois de N dias, mesmo sem mudar a lista. */
export const ESTOQUE_DISPENSA_DIAS = 7

export const COR = {
  pagar: '#C0392B',
  receber: '#1F6FB2',
  socio: '#5E2BD0',
  estoque: '#D85A30',
  metaBatida: '#1F8A5B',
}

// Prioridade: menor aparece primeiro.
const ORDEM = {
  conta_pagar: 10,
  conta_receber: 11,
  socio_pronto: 20,
  estoque: 30,
  sem_meta: 40,
  socio_intro: 50,
  meta_batida: 60,
}

// Destinos que o papel 'gerente' não acessa (ver TABS_RESTRITAS_GERENTE).
// Hoje o gerente nem vê o Início; filtrar aqui é defesa em profundidade.
const TABS_GERENTE_BLOQUEADAS = ['financeiro', 'meta', 'socio_digital']

// ── Datas ──────────────────────────────────────────────────────────────────

/** Último dia da janela de contas ('YYYY-MM-DD', local). Usado também na busca. */
export function limiteJanelaContas(hoje = new Date()) {
  return diaISO(somarDias(diaISO(hoje), JANELA_CONTAS_DIAS))
}

function plural(n, um, varios) { return n === 1 ? um : varios }

/** "venceu há 2 dias" · "venceu ontem" · "vence hoje" · "vence amanhã" · "vence dia 27/09" */
export function quandoVence(dataVencimento, hoje = new Date()) {
  const d = diasEntre(diaISO(hoje), dataVencimento)
  if (d === null) return ''
  if (d < -1) return `venceu há ${-d} dias`
  if (d === -1) return 'venceu ontem'
  if (d === 0) return 'vence hoje'
  if (d === 1) return 'vence amanhã'
  return `vence dia ${fmtDiaMes(dataVencimento)}`
}

// ── Estoque ────────────────────────────────────────────────────────────────

export function qtdProduto(p) {
  return (p?.variacoes || []).reduce((s, v) => s + (Number(v?.quantidade) || 0), 0)
}

/** Produtos com estoque baixo OU esgotado (0 peças), já com a quantidade. */
export function produtosEstoqueBaixo(produtosData = []) {
  return (produtosData || [])
    .map(p => ({ id: p.id, nome: p.nome, qtd: qtdProduto(p) }))
    .filter(p => p.qtd <= ESTOQUE_BAIXO_MAX)
}

function mesmaLista(a = [], b = []) {
  if (a.length !== b.length) return false
  const sa = [...a].map(String).sort()
  const sb = [...b].map(String).sort()
  return sa.every((x, i) => x === sb[i])
}

/** O estoque está dispensado? Volta com 7 dias OU com a lista diferente. */
export function estoqueDispensado(dispensa, idsAtuais, hoje = new Date()) {
  if (!dispensa?.em || !Array.isArray(dispensa.ids)) return false
  const dias = diasEntre(dispensa.em, diaISO(hoje))
  if (dias === null || dias >= ESTOQUE_DISPENSA_DIAS) return false
  return mesmaLista(dispensa.ids, idsAtuais)
}

// ── Contas ─────────────────────────────────────────────────────────────────

/** Contas pendentes vencidas ou vencendo na janela (independente do que a busca trouxe). */
export function contasNaJanela(contas = [], hoje = new Date()) {
  const lim = limiteJanelaContas(hoje)
  return (contas || []).filter(c =>
    (c?.status ?? 'pendente') === 'pendente' && c?.data_vencimento && String(c.data_vencimento).slice(0, 10) <= lim)
}

const chaveConta = (tipo, c) => `${tipo}:${c.id}`

function avisoConta(tipo, contas, dispensadas, todasChaves, hoje) {
  const hojeIso = diaISO(hoje)
  const pendentes = contasNaJanela(contas, hoje)
    .filter(c => !dispensadas.includes(chaveConta(tipo, c)))
    .sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)))
  if (pendentes.length === 0) return null

  const pagar = tipo === 'pagar'
  const n = pendentes.length
  const vencidas = pendentes.filter(c => String(c.data_vencimento).slice(0, 10) < hojeIso).length
  const total = pendentes.reduce((s, c) => s + (Number(c.valor) || 0), 0)

  // Todas em dia / todas atrasadas / misturado.
  const T = pagar
    ? { breve: ['Conta a pagar vence em breve', `${n} contas a pagar vencem em breve`],
        atraso: ['Conta a pagar atrasada', `${n} contas a pagar atrasadas`],
        misto: `${n} contas a pagar pendentes` }
    : { breve: ['Recebimento previsto', `${n} recebimentos previstos`],
        atraso: ['Recebimento atrasado', `${n} recebimentos atrasados`],
        misto: `${n} recebimentos pendentes` }
  const titulo = vencidas === 0 ? plural(n, ...T.breve)
    : vencidas === n ? plural(n, ...T.atraso)
    : T.misto

  const c0 = pendentes[0]
  const texto = n === 1
    ? `${c0.descricao || (pagar ? 'Conta' : 'Recebimento')} · ${fmtR(Number(c0.valor) || 0)} · ${quandoVence(c0.data_vencimento, hoje)}`
    : `${fmtR(total)} ${pagar ? 'a pagar' : 'a receber'}${vencidas > 0 && vencidas < n ? ` · ${vencidas} ${plural(vencidas, 'já venceu', 'já venceram')}` : ''}`

  // Grava as chaves destas contas + as já dispensadas que ainda estão na
  // janela (as que saíram — pagas/recebidas — não precisam mais ficar).
  const novas = pendentes.map(c => chaveConta(tipo, c))
  const valor = [...new Set([...dispensadas.filter(k => todasChaves.includes(k)), ...novas])]

  return {
    tipo: pagar ? 'conta_pagar' : 'conta_receber',
    cor: pagar ? COR.pagar : COR.receber,
    icone: pagar ? 'conta_pagar' : 'conta_receber',
    titulo,
    texto,
    botao: pagar ? 'Ver contas a pagar' : 'Ver contas a receber',
    tab: 'financeiro',
    dispensa: { campo: 'avisos_dispensados', chave: 'conta', valor },
    rotuloDispensar: pagar ? 'Esconder estas contas a pagar' : 'Esconder estes recebimentos',
  }
}

// ── Função principal ───────────────────────────────────────────────────────

/**
 * Lista ordenada de avisos ativos da tela Início.
 *
 * @param {object}  p
 * @param {string}  p.plano
 * @param {boolean} p.gerente           papel 'gerente' (esconde destinos restritos)
 * @param {string}  p.corLoja           theme.primary — cor do aviso "sem meta"
 * @param {Array}   p.vendas            vendas da loja (usa só as completas do mês)
 * @param {object}  p.metas             { 'YYYY-MM': valor }
 * @param {Array}   p.produtosData      produtos ativos com variacoes
 * @param {Array|null} p.contasPagar    null/undefined = ainda não carregou
 * @param {Array|null} p.contasReceber
 * @param {object|null|undefined} p.socioUltimo   relatório mais recente; null = nenhum; undefined = não carregou
 * @param {string}  p.socioVistoPeriodo lf_config.socio_visto_periodo
 * @param {boolean} p.socioIntroVisto   lf_config.socio_intro_visto
 * @param {string}  p.metaDispensadaEm  lf_config.meta_lembrete_dispensado_em
 * @param {object}  p.dispensados       lf_config.avisos_dispensados
 * @param {Date}    p.hoje
 */
export function montarAvisos({
  plano, gerente = false, corLoja = COR.socio,
  vendas = [], metas = {}, produtosData = [],
  contasPagar, contasReceber,
  socioUltimo, socioVistoPeriodo, socioIntroVisto,
  metaDispensadaEm, dispensados, hoje = new Date(),
} = {}) {
  const disp = (dispensados && typeof dispensados === 'object') ? dispensados : {}
  const mes = competenciaAtual(hoje)
  const avisos = []

  // ── Contas (a pagar e a receber, separadas) ──
  // Só Business: o Financeiro, onde a lojista age sobre a conta, é exclusivo
  // do plano (mesmo gate temAcesso(plano, 'business') da tela). Starter/Pro
  // com conta cadastrada cairiam numa UpgradeWall ao clicar.
  if (temAcesso(plano, 'business')) {
    const contasDispensadas = Array.isArray(disp.conta) ? disp.conta.map(String) : []
    const todasChaves = [
      ...contasNaJanela(contasPagar || [], hoje).map(c => chaveConta('pagar', c)),
      ...contasNaJanela(contasReceber || [], hoje).map(c => chaveConta('receber', c)),
    ]
    if (contasPagar) {
      const a = avisoConta('pagar', contasPagar, contasDispensadas, todasChaves, hoje)
      if (a) avisos.push(a)
    }
    if (contasReceber) {
      const a = avisoConta('receber', contasReceber, contasDispensadas, todasChaves, hoje)
      if (a) avisos.push(a)
    }
  }

  // ── Sócio Digital (intro e pronto são exclusivos — ver avisoSocioBanner) ──
  const socio = avisoSocioBanner({
    liberado: temAcesso(plano, 'pro'),
    ultimoPeriodo: socioUltimo === undefined ? undefined : (socioUltimo?.periodo_inicio ?? null),
    vistoPeriodo: socioVistoPeriodo,
    introVisto: socioIntroVisto,
  })
  if (socio === 'pronto') {
    avisos.push({
      tipo: 'socio_pronto',
      cor: COR.socio,
      icone: 'socio',
      titulo: 'Seu Sócio Digital está pronto',
      texto: `Resumo de ${rotuloPeriodo({ inicio: socioUltimo.periodo_inicio, fim: socioUltimo.periodo_fim })}`,
      botao: 'Abrir resumo',
      tab: 'socio_digital',
      dispensa: { campo: 'socio_visto_periodo', valor: socioUltimo.periodo_inicio },
      rotuloDispensar: 'Esconder aviso do resumo do Sócio Digital',
    })
  }
  if (socio === 'intro') {
    avisos.push({
      tipo: 'socio_intro',
      cor: COR.socio,
      icone: 'socio',
      titulo: 'Conheça seu Sócio Digital',
      texto: 'Ele te ajuda a entender sua loja a cada 15 dias',
      botao: 'Conhecer',
      tab: 'socio_digital',
      dispensa: { campo: 'socio_intro_visto', valor: true },
      rotuloDispensar: 'Esconder apresentação do Sócio Digital',
    })
  }

  // ── Estoque baixo / esgotado ──
  const baixos = produtosEstoqueBaixo(produtosData)
  const idsBaixos = baixos.map(p => p.id)
  if (baixos.length > 0 && !estoqueDispensado(disp.estoque, idsBaixos, hoje)) {
    const esgotados = baixos.filter(p => p.qtd === 0).length
    const poucos = baixos.length - esgotados
    const n = baixos.length
    const titulo = esgotados === 0
      ? 'Estoque baixo'
      : poucos === 0
        ? plural(esgotados, 'Produto esgotado', `${esgotados} produtos esgotados`)
        : 'Estoque baixo e produtos esgotados'
    const p0 = baixos[0]
    const texto = n === 1
      ? `${p0.nome} · ${p0.qtd === 0 ? 'esgotado' : `${plural(p0.qtd, 'resta 1 peça', `restam ${p0.qtd} peças`)}`}`
      : esgotados > 0 && poucos > 0
        ? `${esgotados} ${plural(esgotados, 'esgotado', 'esgotados')} · ${poucos} com estoque baixo`
        : esgotados > 0
          ? `${n} produtos sem nenhuma peça`
          : `${n} produtos com ${ESTOQUE_BAIXO_MAX} peças ou menos`
    avisos.push({
      tipo: 'estoque',
      cor: COR.estoque,
      icone: 'estoque',
      titulo,
      texto,
      botao: 'Ver estoque',
      tab: 'estoque',
      dispensa: { campo: 'avisos_dispensados', chave: 'estoque', valor: { ids: idsBaixos, em: diaISO(hoje) } },
      rotuloDispensar: `Esconder aviso de estoque por ${ESTOQUE_DISPENSA_DIAS} dias`,
    })
  }

  // ── Sem meta (regra de sempre, em utils/lembreteMeta.js) ──
  if (deveMostrarLembreteMeta({ metas, dispensadoEm: metaDispensadaEm, hoje })) {
    avisos.push({
      tipo: 'sem_meta',
      cor: corLoja || COR.socio,
      icone: 'meta',
      titulo: 'Ainda sem meta este mês',
      texto: 'Defina um objetivo de faturamento e acompanhe o progresso na tela inicial.',
      botao: 'Definir meta',
      tab: 'meta',
      dispensa: { campo: 'meta_lembrete_dispensado_em', valor: mes },
      rotuloDispensar: 'Esconder lembrete de meta até o mês que vem',
    })
  }

  // ── Meta batida (Pro/Business — intencional) ──
  const meta = Number(metas?.[mes]) || 0
  if (temAcesso(plano, 'pro') && meta > 0 && disp.meta_batida !== mes) {
    const totalMes = (vendas || [])
      .filter(v => (v?.status ?? 'completa') === 'completa')   // = vendasCompletas
      .filter(v => {
        const d = new Date(v.data)
        return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth()
      })
      .reduce((s, v) => s + (Number(v.valor) || 0), 0)
    if (totalMes >= meta) {
      avisos.push({
        tipo: 'meta_batida',
        cor: COR.metaBatida,
        icone: 'meta_batida',
        titulo: 'Meta batida!',
        texto: `Você atingiu ${fmtR(totalMes)} este mês`,
        botao: 'Ver resultados',
        tab: 'meta',
        dispensa: { campo: 'avisos_dispensados', chave: 'meta_batida', valor: mes },
        rotuloDispensar: 'Esconder aviso de meta batida até o mês que vem',
      })
    }
  }

  return avisos
    .filter(a => !(gerente && TABS_GERENTE_BLOQUEADAS.includes(a.tab)))
    .sort((a, b) => ORDEM[a.tipo] - ORDEM[b.tipo])
}

/** Novo valor de lf_config.avisos_dispensados depois de dispensar um aviso. */
export function aplicarDispensa(atual, dispensa) {
  const base = (atual && typeof atual === 'object' && !Array.isArray(atual)) ? atual : {}
  if (dispensa?.campo !== 'avisos_dispensados' || !dispensa.chave) return base
  return { ...base, [dispensa.chave]: dispensa.valor }
}
