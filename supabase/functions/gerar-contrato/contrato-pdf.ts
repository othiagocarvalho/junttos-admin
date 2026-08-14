// Montagem do PDF do contrato. Separado do index.ts para poder ser exercitado
// isoladamente (deno run) sem subir o servidor HTTP da function.
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

// Duplicado de src/utils/planos.js de propósito: a function roda em Deno e não
// consegue importar de src/. Se um segmento novo entrar lá, entra aqui também.
export const SEGMENTO_LABEL: Record<string, string> = { moda: 'Moda', mercado: 'Mercado' }

// O contrato precisa nomear o módulo exato que a loja contratou — nunca um
// "Moda/Mercado" genérico.
export function labelSegmento(segmento: string | null | undefined): string {
  return SEGMENTO_LABEL[segmento ?? ''] ?? SEGMENTO_LABEL.moda
}

export const PLANO_LABEL: Record<string, string> = {
  starter: 'Starter', pro: 'Pro', business: 'Business',
}

// ── Helpers de formatação ────────────────────────────────────────────────────

export function ou(v: unknown, fallback = 'não informado'): string {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s === '' ? fallback : s
}

export function fmtValor(v: unknown): string {
  const n = Number(v)
  if (!isFinite(n) || v === null || v === undefined || v === '') return 'não informado'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY'. Feito na mão para não escorregar em timezone.
export function fmtData(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v).slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : 'não informado'
}

// As fontes padrão do PDF usam WinAnsi. Acento latino passa, mas emoji ou
// qualquer coisa fora da tabela faria o pdf-lib estourar no meio da geração —
// e dado do usuário chega como veio digitado.
const WINANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])
export function sanitize(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c === 0x0a || (c >= 0x20 && c <= 0xff) || WINANSI_EXTRA.has(c)) out += ch
  }
  return out
}

// Junta os pedaços do endereço pulando o que não foi preenchido, para o
// contrato não sair com ", ," no meio quando falta complemento ou número.
export function montaEndereco(c: Record<string, unknown>): string {
  const linha1 = [ou(c.endereco, ''), ou(c.numero, ''), ou(c.complemento, '')]
    .filter(Boolean).join(', ')
  const cidadeUf = [ou(c.cidade, ''), ou(c.estado, '')].filter(Boolean).join('/')
  const partes = [linha1, ou(c.bairro, ''), cidadeUf].filter(Boolean).join(', ')
  const cep = ou(c.cep, '')
  const comCep = cep ? `${partes}, CEP ${cep}` : partes
  return comCep || 'endereço não informado'
}

// ── Layout ───────────────────────────────────────────────────────────────────

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 56
const SIZE = 10.5
const LEAD = 15.5
const MAX_W = A4[0] - MARGIN * 2

export type Bloco = { texto: string; bold?: boolean; espacoAntes?: number; centro?: boolean }

export function wrap(texto: string, font: any, size: number, maxWidth: number): string[] {
  const linhas: string[] = []
  for (const paragrafo of texto.split('\n')) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean)
    if (palavras.length === 0) { linhas.push(''); continue }
    let atual = ''
    for (const p of palavras) {
      const teste = atual ? `${atual} ${p}` : p
      if (font.widthOfTextAtSize(teste, size) <= maxWidth) {
        atual = teste
      } else {
        if (atual) linhas.push(atual)
        atual = p
      }
    }
    if (atual) linhas.push(atual)
  }
  return linhas
}

export function montaBlocos(c: Record<string, unknown>): Bloco[] {
  const segmento = labelSegmento(c.segmento as string | null)
  const plano = PLANO_LABEL[String(c.plano ?? '')] ?? ou(c.plano)

  return [
    { texto: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS — SISTEMA JUNTTOS', bold: true, centro: true },

    {
      texto:
        `CONTRATANTE: ${ou(c.razao_social)}, inscrito(a) sob ${ou(c.cpf_cnpj)}, com ` +
        `sede/domicílio em ${montaEndereco(c)}, neste ato representado(a) por ` +
        `${ou(c.responsavel_nome)}, e-mail ${ou(c.responsavel_email)}, telefone ` +
        `${ou(c.responsavel_telefone)}.`,
      espacoAntes: 22,
    },
    { texto: 'CONTRATADA: Junttos Sistemas.', espacoAntes: 12 },

    { texto: 'CLÁUSULA 1 — DO OBJETO', bold: true, espacoAntes: 20 },
    {
      texto:
        `O presente contrato tem por objeto a prestação de serviço de licenciamento ` +
        `de uso do sistema Junttos ${segmento}, plano ${plano}, incluindo as ` +
        `funcionalidades descritas no plano contratado.`,
      espacoAntes: 6,
    },

    { texto: 'CLÁUSULA 2 — DOS VALORES E FORMA DE PAGAMENTO', bold: true, espacoAntes: 16 },
    {
      texto:
        `No ato da assinatura, será cobrada a taxa de implantação de R$ 300,00 ` +
        `(trezentos reais) somada à primeira mensalidade integral do plano contratado, ` +
        `no valor de R$ ${fmtValor(c.valor_mensal)}. A partir do segundo mês, será ` +
        `cobrada apenas a mensalidade recorrente, com vencimento todo dia ` +
        `${ou(c.vencimento_dia)} de cada mês.`,
      espacoAntes: 6,
    },

    { texto: 'CLÁUSULA 3 — DA VIGÊNCIA', bold: true, espacoAntes: 16 },
    {
      texto:
        `Este contrato vigora a partir de ${fmtData(c.contrato_inicio)}, por prazo ` +
        `indeterminado, renovando-se automaticamente a cada período mensal.`,
      espacoAntes: 6,
    },

    { texto: 'CLÁUSULA 4 — DO CANCELAMENTO', bold: true, espacoAntes: 16 },
    {
      texto:
        `Qualquer das partes pode rescindir este contrato mediante aviso prévio de 30 ` +
        `(trinta) dias, sem multa rescisória, respeitando-se as mensalidades já vencidas.`,
      espacoAntes: 6,
    },

    { texto: 'CLÁUSULA 5 — DO SUPORTE', bold: true, espacoAntes: 16 },
    {
      texto:
        `A CONTRATADA prestará suporte técnico referente ao uso do sistema conforme os ` +
        `canais e horários vigentes divulgados pela Junttos.`,
      espacoAntes: 6,
    },

    { texto: 'CLÁUSULA 6 — DA PROTEÇÃO DE DADOS (LGPD)', bold: true, espacoAntes: 16 },
    {
      texto:
        `As partes se comprometem a tratar os dados pessoais envolvidos na execução ` +
        `deste contrato em conformidade com a Lei Geral de Proteção de Dados ` +
        `(Lei nº 13.709/2018).`,
      espacoAntes: 6,
    },

    { texto: 'CLÁUSULA 7 — DO FORO', bold: true, espacoAntes: 16 },
    {
      texto:
        `Fica eleito o foro da comarca de ${ou(c.cidade)}/${ou(c.estado)} para dirimir ` +
        `quaisquer dúvidas oriundas deste contrato.`,
      espacoAntes: 6,
    },

    {
      texto:
        `Este documento constitui aceite eletrônico, com identificação do signatário, ` +
        `registro de IP, data/hora e hash de integridade do documento, nos termos da ` +
        `MP 2.200-2/2001. Este contrato não substitui a revisão de um advogado antes ` +
        `de seu uso oficial.`,
      espacoAntes: 26,
    },
  ]
}

export async function montaPdf(c: Record<string, unknown>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page = pdf.addPage(A4)
  let y = A4[1] - MARGIN

  for (const bloco of montaBlocos(c)) {
    const font = bloco.bold ? negrito : regular
    const size = bloco.centro ? 13 : SIZE
    y -= bloco.espacoAntes ?? 0

    for (const linha of wrap(sanitize(bloco.texto), font, size, MAX_W)) {
      if (y < MARGIN + LEAD) {
        page = pdf.addPage(A4)
        y = A4[1] - MARGIN
      }
      const largura = font.widthOfTextAtSize(linha, size)
      const x = bloco.centro ? (A4[0] - largura) / 2 : MARGIN
      page.drawText(linha, { x, y, size, font, color: rgb(0.09, 0.06, 0.12) })
      y -= LEAD
    }
  }

  // Rodapé de identificação em todas as páginas.
  const paginas = pdf.getPages()
  paginas.forEach((p, i) => {
    p.drawText(
      sanitize(`Junttos Sistemas · contrato ${ou(c.id, '—')} · página ${i + 1} de ${paginas.length}`),
      { x: MARGIN, y: MARGIN - 22, size: 7.5, font: regular, color: rgb(0.55, 0.53, 0.59) },
    )
  })

  return await pdf.save()
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
