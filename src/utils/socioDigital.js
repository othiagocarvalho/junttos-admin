// Sócio Digital — regras puras (sem React, sem Supabase), testáveis no Vitest.
//
// Os NÚMEROS do relatório são calculados e congelados no banco
// (supabase/fix_socio_digital.sql → lf_socio_relatorios.dados). Aqui mora só
// o que é apresentação e depende de data de hoje:
//   · qual quinzena está fechada / quando sai o próximo resumo
//   · se o aviso do banner aparece
//   · a leitura "Foi bem / De olho" a partir dos números gravados
//   · o texto do WhatsApp e o HTML do PDF
//
// Datas trafegam como 'YYYY-MM-DD' e são montadas à mão, sem Date.toISOString
// (que converteria para UTC e poderia virar o dia à noite no Brasil).

import { fmtR } from './formatters'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// isodow do Postgres: 1 = segunda … 7 = domingo
const DIAS_SEMANA = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 7: 'Domingo' }

/** Dias sem compra para a cliente contar como "sumiu" — mesma régua do CRM. */
export const DIAS_INATIVO = 45

const pad = n => String(n).padStart(2, '0')
const iso = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`
const ultimoDia = (a, m) => new Date(a, m, 0).getDate()   // m em 1..12

/** Date local ou 'YYYY-MM-DD' → { a, m, d } (m em 1..12). */
function partes(hoje) {
  if (typeof hoje === 'string') {
    const [a, m, d] = hoje.slice(0, 10).split('-').map(Number)
    return { a, m, d }
  }
  const h = hoje || new Date()
  return { a: h.getFullYear(), m: h.getMonth() + 1, d: h.getDate() }
}

/**
 * Quinzena que JÁ FECHOU em `hoje` — a mesma regra de gerar_relatorios_socio:
 *   dia 16..31 → 1 a 15 do mês corrente
 *   dia  1..15 → 16 ao último dia do mês anterior
 */
export function periodoFechado(hoje = new Date()) {
  const { a, m, d } = partes(hoje)
  if (d >= 16) return { inicio: iso(a, m, 1), fim: iso(a, m, 15) }
  const am = m === 1 ? a - 1 : a
  const mm = m === 1 ? 12 : m - 1
  return { inicio: iso(am, mm, 16), fim: iso(am, mm, ultimoDia(am, mm)) }
}

/** Data ('YYYY-MM-DD') em que o próximo resumo é gerado: dia 16 ou dia 1º. */
export function proximaGeracao(hoje = new Date()) {
  const { a, m, d } = partes(hoje)
  if (d < 16) return iso(a, m, 16)
  return m === 12 ? iso(a + 1, 1, 1) : iso(a, m + 1, 1)
}

/** "16 de setembro" / "1º de outubro" */
export function dataPorExtenso(dataIso) {
  const [, m, d] = dataIso.split('-').map(Number)
  return `${d === 1 ? '1º' : d} de ${MESES[m - 1]}`
}

/** Rodapé da tela: "próximo resumo em 1º de outubro". */
export function textoProximoResumo(hoje = new Date()) {
  return `próximo resumo em ${dataPorExtenso(proximaGeracao(hoje))}`
}

/** "01 a 15 de setembro" · "16 a 31 de dezembro" · (virada de mês não acontece por construção) */
export function rotuloPeriodo(periodo) {
  if (!periodo?.inicio || !periodo?.fim) return ''
  const [, m, di] = periodo.inicio.split('-').map(Number)
  const df = Number(periodo.fim.split('-')[2])
  return `${pad(di)} a ${pad(df)} de ${MESES[m - 1]}`
}

/**
 * Mostra o aviso "Seu Sócio Digital está pronto"?
 *
 * `periodoAtual`  = periodo_inicio do relatório mais recente ('YYYY-MM-DD'),
 *                   ou null se a loja ainda não tem nenhum.
 * `vistoPeriodo`  = lf_config.socio_visto_periodo.
 *
 * Coluna ainda inexistente no banco chega undefined e conta como "nunca viu"
 * — mesmo tratamento de deveMostrarLembreteMeta. Comparação por string: ISO
 * ordena igual à data, e um visto MAIS NOVO que o relatório (não deveria
 * acontecer) também silencia, em vez de insistir.
 */
export function deveMostrarAvisoSocio({ periodoAtual, vistoPeriodo } = {}) {
  if (!periodoAtual) return false
  return String(vistoPeriodo || '') < String(periodoAtual)
}

/** Variação percentual (número) ou null quando não há base de comparação. */
export function variacaoPct(atual, anterior) {
  const a = Number(atual) || 0
  const b = Number(anterior) || 0
  if (b <= 0) return null
  return ((a - b) / b) * 100
}

/** "▲ +12%" · "▼ −18%" · "= 0%" · "—" (sem base) */
export function formatarDelta(pct) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—'
  const r = Math.round(pct)
  if (r > 0) return `▲ +${r}%`
  if (r < 0) return `▼ −${Math.abs(r)}%`
  return '= 0%'
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

/**
 * Leitura do relatório em linguagem de gente.
 *
 * Devolve { tom, foiBem[], deOlho[] } — no máximo 3 itens em cada lista
 * (o layout é de 3 linhas). `tom` alimenta a frase de abertura:
 * 'sem_vendas' | 'crescimento' | 'queda' | 'estavel'.
 *
 * Limiar de 5% para "subiu/caiu": variação menor que isso numa quinzena é
 * ruído (uma venda a mais ou a menos), não tendência.
 */
export function montarLeituraSocio(dados) {
  const met = dados?.metricas || {}
  const ant = dados?.anterior || {}
  const foiBem = []
  const deOlho = []

  const vendas = Number(met.vendas) || 0
  const fat = Number(met.faturamento) || 0
  const varFat = variacaoPct(fat, ant.faturamento)
  const varTicket = variacaoPct(met.ticket_medio, ant.ticket_medio)

  let tom = 'estavel'
  if (vendas === 0) tom = 'sem_vendas'
  else if (varFat !== null && varFat >= 5) tom = 'crescimento'
  else if (varFat !== null && varFat <= -5) tom = 'queda'

  // ── Foi bem ──
  if (varFat !== null && varFat >= 5) {
    foiBem.push(`Faturamento subiu ${Math.round(varFat)}% sobre a quinzena anterior`)
  }
  const top = (dados?.top_produtos || [])[0]
  if (top?.nome && Number(top.qtd) > 0) {
    foiBem.push(`${top.nome} foi o mais vendido (${plural(Number(top.qtd), 'peça', 'peças')})`)
  }
  const dia = dados?.melhor_dia_semana
  if (dia?.isodow && fat > 0 && Number(dia.total) > 0) {
    const pct = Math.round((Number(dia.total) / fat) * 100)
    foiBem.push(`${DIAS_SEMANA[dia.isodow]} foi o dia mais forte (${pct}% do faturamento)`)
  }
  if (varTicket !== null && varTicket >= 5) {
    foiBem.push(`Ticket médio subiu ${Math.round(varTicket)}%`)
  }
  const trocas = Number(met.trocas) || 0
  const trocasAnt = Number(ant.trocas) || 0
  if (trocasAnt > 0 && trocas < trocasAnt) {
    foiBem.push(`Trocas caíram de ${trocasAnt} para ${trocas}`)
  }

  // ── De olho ──
  if (varFat !== null && varFat <= -5) {
    deOlho.push(`Faturamento caiu ${Math.abs(Math.round(varFat))}% sobre a quinzena anterior`)
  }
  const cred = dados?.crediario || {}
  if (Number(cred.parcelas_atrasadas) > 0) {
    deOlho.push(`${plural(Number(cred.parcelas_atrasadas), 'parcela', 'parcelas')} de crediário em atraso (${fmtR(cred.valor_atrasado)})`)
  }
  if (Number(dados?.caixa?.saldo) < 0) {
    deOlho.push('Contas a pagar dos próximos 15 dias passam das entradas previstas')
  }
  const recomprar = dados?.recomprar || []
  if (recomprar.length > 0) {
    deOlho.push(`${plural(recomprar.length, 'produto vendendo bem', 'produtos vendendo bem')} com estoque no fim`)
  }
  if (trocas > trocasAnt && trocas > 0) {
    deOlho.push(`Trocas subiram de ${trocasAnt} para ${trocas}`)
  }
  const inativos = Number(dados?.clientes_inativos?.total) || 0
  if (inativos > 0) {
    deOlho.push(`${plural(inativos, 'cliente', 'clientes')} sem comprar há ${DIAS_INATIVO}+ dias`)
  }
  const parados = dados?.parados || []
  if (parados.length > 0) {
    deOlho.push(`${plural(parados.length, 'produto parado', 'produtos parados')} há ${DIAS_INATIVO}+ dias`)
  }

  return { tom, foiBem: foiBem.slice(0, 3), deOlho: deOlho.slice(0, 3) }
}

/** Frase de abertura do chat. */
export function fraseAbertura(tom, periodo) {
  const rot = rotuloPeriodo(periodo)
  if (tom === 'sem_vendas') return `Oi, sócio 👋 Fechei o período de ${rot}. Não encontrei vendas registradas — se vendeu, vale lançar para eu te ajudar melhor.`
  if (tom === 'crescimento') return `Oi, sócio 👋 Fechei o período de ${rot}. Foi um período de crescimento — puxei o que importa, direto ao ponto.`
  if (tom === 'queda') return `Oi, sócio 👋 Fechei o período de ${rot}. Foi um período mais fraco que o anterior — separei o que merece atenção.`
  return `Oi, sócio 👋 Fechei o período de ${rot}. Segue o resumo, direto ao ponto.`
}

// ── Compartilhamento ─────────────────────────────────────────────────────────

/**
 * Texto do WhatsApp — mesmo estilo de formatarReciboTexto (utils/recibo.js):
 * linhas curtas, separador '---', negrito com *asterisco*.
 */
export function formatarSocioTexto(relatorio, nomeLoja) {
  const dados = relatorio?.dados || {}
  const met = dados.metricas || {}
  const ant = dados.anterior || {}
  const leitura = montarLeituraSocio(dados)
  const periodo = { inicio: relatorio?.periodo_inicio, fim: relatorio?.periodo_fim }
  const L = []
  L.push(`*${nomeLoja || 'Loja'} — Sócio Digital*`)
  L.push(`Resumo de ${rotuloPeriodo(periodo)}`)
  L.push('---')
  L.push(`Faturamento: ${fmtR(met.faturamento)} (${formatarDelta(variacaoPct(met.faturamento, ant.faturamento))})`)
  L.push(`Vendas: ${Number(met.vendas) || 0} (${formatarDelta(variacaoPct(met.vendas, ant.vendas))})`)
  L.push(`Ticket médio: ${fmtR(met.ticket_medio)}`)
  L.push(`Trocas: ${Number(met.trocas) || 0}`)
  if (leitura.foiBem.length) {
    L.push('')
    L.push('*Foi bem*')
    leitura.foiBem.forEach(t => L.push(`• ${t}`))
  }
  if (leitura.deOlho.length) {
    L.push('')
    L.push('*De olho*')
    leitura.deOlho.forEach(t => L.push(`• ${t}`))
  }
  const cx = dados.caixa
  if (cx) {
    L.push('')
    L.push('*Caixa — próximos 15 dias*')
    L.push(`Entram ${fmtR(cx.entradas)} · Saem ${fmtR(cx.saidas)} · Saldo ${fmtR(cx.saldo)}`)
  }
  L.push('')
  L.push('Gerado pelo Junttos')
  return L.join('\n')
}

/** Escapa texto para dentro de HTML — nome de produto/cliente é texto livre. */
export function escaparHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * HTML do "Baixar PDF" — mesmo mecanismo do Recibo (ReciboVenda.jsx
 * handleImprimir): documento autocontido, aberto numa janela e impresso;
 * "Salvar como PDF" é o destino que a lojista escolhe na caixa de impressão.
 * Diferença deliberada: A4, não bobina de 80mm — é um relatório, não um cupom.
 */
export function montarHtmlSocio(relatorio, nomeLoja) {
  const e = escaparHtml
  const dados = relatorio?.dados || {}
  const met = dados.metricas || {}
  const ant = dados.anterior || {}
  const leitura = montarLeituraSocio(dados)
  const periodo = { inicio: relatorio?.periodo_inicio, fim: relatorio?.periodo_fim }
  const lista = itens => itens.length ? `<ul>${itens.map(t => `<li>${e(t)}</li>`).join('')}</ul>` : '<p class="muted">—</p>'
  const linhas = (arr, fn) => arr.length ? arr.map(fn).join('') : '<tr><td colspan="3" class="muted">—</td></tr>'
  const cx = dados.caixa || {}

  const card = (rot, val, delta) =>
    `<div class="card"><div class="rot">${rot}</div><div class="val">${val}</div>${delta ? `<div class="delta">${delta}</div>` : ''}</div>`

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Sócio Digital — ${e(rotuloPeriodo(periodo))}</title><style>
@page{size:A4;margin:14mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#18181B}
h1{font-size:20px;margin-bottom:2px}
h2{font-size:13px;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:#52407F}
.sub{color:#71717A;margin-bottom:14px}
.cards{display:flex;gap:10px}
.card{flex:1;border:1px solid #E4E4E7;border-radius:8px;padding:10px}
.rot{font-size:9px;font-weight:bold;color:#71717A;text-transform:uppercase;letter-spacing:.06em}
.val{font-size:17px;font-weight:bold;margin-top:4px}
.delta{font-size:11px;color:#52525B;margin-top:2px}
.duas{display:flex;gap:14px}
.duas>div{flex:1}
ul{padding-left:16px}
li{margin:3px 0}
table{width:100%;border-collapse:collapse}
td,th{padding:4px 6px;border-bottom:1px solid #F0F0F3;text-align:left}
th{font-size:10px;color:#71717A;text-transform:uppercase}
td.n{text-align:right;white-space:nowrap}
.muted{color:#A1A1AA}
.rodape{margin-top:22px;font-size:10px;color:#A1A1AA}
</style></head><body>
<h1>${e(nomeLoja || 'Loja')} — Sócio Digital</h1>
<div class="sub">Resumo de ${e(rotuloPeriodo(periodo))}</div>
<div class="cards">
${card('Faturamento', e(fmtR(met.faturamento)), e(formatarDelta(variacaoPct(met.faturamento, ant.faturamento))))}
${card('Ticket médio', e(fmtR(met.ticket_medio)), e(formatarDelta(variacaoPct(met.ticket_medio, ant.ticket_medio))))}
${card('Vendas', e(Number(met.vendas) || 0), e(formatarDelta(variacaoPct(met.vendas, ant.vendas))))}
${card('Trocas', e(Number(met.trocas) || 0), '')}
</div>
<div class="duas">
<div><h2>Foi bem</h2>${lista(leitura.foiBem)}</div>
<div><h2>De olho</h2>${lista(leitura.deOlho)}</div>
</div>
<div class="duas">
<div><h2>Recomprar já</h2><table><tr><th>Produto</th><th class="n">Vendidos</th><th class="n">Restam</th></tr>
${linhas(dados.recomprar || [], p => `<tr><td>${e(p.nome)}</td><td class="n">${e(p.vendidos)}</td><td class="n">${e(p.estoque)}</td></tr>`)}</table></div>
<div><h2>Girar em promoção</h2><table><tr><th>Produto</th><th class="n">Estoque</th><th class="n">Parado</th></tr>
${linhas(dados.parados || [], p => `<tr><td>${e(p.nome)}</td><td class="n">${e(p.estoque)}</td><td class="n">${e(p.dias)} dias</td></tr>`)}</table></div>
</div>
<div class="duas">
<div><h2>Compraram mais</h2><table>
${linhas(dados.clientes_top || [], c => `<tr><td>${e(c.nome)}</td><td class="n">${e(fmtR(c.total))}</td><td class="n">${e(c.compras)}x</td></tr>`)}</table></div>
<div><h2>Sumiram (${DIAS_INATIVO}+ dias)</h2><table>
${linhas(dados.clientes_inativos?.lista || [], c => `<tr><td>${e(c.nome)}</td><td class="n">${e(c.telefone || '')}</td><td class="n">${e(c.dias)} dias</td></tr>`)}</table></div>
</div>
<h2>Caixa — próximos 15 dias</h2>
<p>Entradas previstas <b>${e(fmtR(cx.entradas))}</b> · Contas a pagar <b>${e(fmtR(cx.saidas))}</b> · Saldo projetado <b>${e(fmtR(cx.saldo))}</b></p>
${cx.maior_conta ? `<p class="muted">Maior conta do período: ${e(cx.maior_conta.descricao)} — ${e(fmtR(cx.maior_conta.valor))}</p>` : ''}
<div class="rodape">Gerado pelo Junttos · números congelados no fechamento do período</div>
</body></html>`
}
