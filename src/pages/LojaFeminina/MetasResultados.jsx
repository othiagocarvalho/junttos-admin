// Tela "Metas & Resultados" — sete gavetas expansíveis.
//
// Reorganização visual: nenhum cálculo novo. Cada gaveta puxa o componente que
// já existia, na ordem fixa combinada:
//
//   1. Meta mensal             Meta.jsx, seção 'mensal'
//   2. Vendedores e comissão   VendedoresConfig (veio de Configurações)
//                              + ComissaoVendedores (estava só no Relatórios)
//   3. Curva ABC               estava inline no Relatorios mobile
//   4. Corrida de vendedores   CorridaSection, que Meta.jsx já montava
//   5. Meta por vendedor(a)    Meta.jsx, seção 'vendedor'
//   6. Meta por produto        Meta.jsx, seção 'produto'
//   7. Comparativo mês a mês   Meta.jsx, seção 'comparativo'
//
// As três últimas eram blocos SOLTOS dentro da gaveta 1: abriam expandidos
// junto com a meta mensal e faziam a primeira gaveta ocupar a tela inteira.
// Agora cada uma tem gaveta própria, fechada, e o Meta.jsx recebe `secoes`
// dizendo qual parte renderizar (ver TODAS_SECOES lá).
//
// Só a primeira abre por padrão. As outras abrem e fecham independentemente —
// não é accordion exclusivo.
//
// ─── GATE POR GAVETA ────────────────────────────────────────────────────────
// A gaveta SEMPRE aparece; quem não tem o plano vê o UpgradeWall dentro dela.
// É o padrão que o próprio Meta.jsx já usa nas suas subseções (metas por
// vendedor, meta por produto, corrida) — esconder a gaveta faria a loja Starter
// nem saber que a Curva ABC existe, e é justamente o contrário do que a tela de
// upgrade serve. Nenhum critério novo: reaproveita temAcesso(plano, ...) com os
// mesmos níveis já usados por cada feature hoje.

import { Target, Users, BarChart3, Trophy, UserCheck, Package, CalendarRange } from 'lucide-react'
import Meta from './Meta'
import CorridaSection from './CorridaSection'
import Gaveta from '../../components/studio/Gaveta'
import UpgradeWall from '../../components/UpgradeWall'
import VendedoresConfig from '../../components/vendedores/VendedoresConfig'
import { useVendedores } from '../../components/vendedores/useVendedores'
import ComissaoVendedores from '../../components/vendedores/ComissaoVendedores'
import CurvaABC from '../../components/relatorios/CurvaABC'
import { temAcesso } from '../../utils/planos'

// Os selos que ficavam ao lado do título dentro do Meta.jsx. Com a seção
// virando gaveta, o título passou para o cabeçalho dela — e o selo vai junto,
// pela prop `badge`, em vez de sumir.
function Selo({ texto, fundo, cor }) {
  return (
    <span style={{
      background: fundo, color: cor, fontSize: 9, fontWeight: 700,
      borderRadius: 99, padding: '2px 7px', textTransform: 'uppercase',
      letterSpacing: '0.1em',
    }}>{texto}</span>
  )
}
const SELO_PRO      = <Selo texto="Pro" fundo="#dbeafe" cor="#1d4ed8" />
const SELO_BUSINESS = <Selo texto="Business" fundo="#ede9fe" cor="#6d28d9" />

// Fora do componente de propósito: array novo a cada render faria o Meta
// remontar sem necessidade.
const SO_MENSAL      = ['mensal']
const SO_VENDEDOR    = ['vendedor']
const SO_PRODUTO     = ['produto']
const SO_COMPARATIVO = ['comparativo']

/** Vendas do mês corrente — recorte que as gavetas 2 e 3 usam.
 *  Metas e Corrida têm o próprio recorte interno e não passam por aqui. */
function vendasDoMes(vendas = []) {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = agora.getMonth()
  return (vendas || []).filter(v => {
    const d = new Date(v?.data)
    return d.getFullYear() === ano && d.getMonth() === mes
  })
}

export default function MetasResultados({ data, theme, plano, legado = false, mobile = false }) {
  const temStarter  = legado || temAcesso(plano, 'starter')
  const temPro      = temAcesso(plano, 'pro')
  const temBusiness = temAcesso(plano, 'business')

  const doMes = vendasDoMes(data?.vendas)
  const lojaId = data?.LOJA_ID || ''

  // A gaveta 1 (Meta por vendedor) precisa do cadastro, não só do histórico de
  // vendas — senão só reconhece quem já vendeu. Buscado aqui e passado por
  // prop para o Meta seguir sem I/O próprio.
  const { vendedores } = useVendedores(lojaId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>

      {/* 1 ── Metas do mês (única aberta por padrão) ─────────────────────── */}
      <Gaveta
        titulo="Meta mensal"
        subtitulo="Meta da loja e progresso do mês"
        Icon={Target}
        theme={theme}
        inicialAberta
        compacta={mobile}
      >
        {/* Só a seção 'mensal'. Vendedor, produto e comparativo saíram daqui
            para gavetas próprias (5, 6 e 7) — antes vinham juntos e abertos,
            e esta gaveta ocupava a tela inteira ao carregar. A corrida
            continua fora: tem a gaveta 4. */}
        {temStarter ? (
          <Meta {...data} theme={theme} plano={plano} mobile={mobile} secoes={SO_MENSAL} />
        ) : (
          <UpgradeWall planoAtual={plano} planoNecessario="starter" funcionalidade="meta" theme={theme} />
        )}
      </Gaveta>

      {/* 2 ── Vendedores e comissão ──────────────────────────────────────── */}
      <Gaveta
        titulo="Vendedores e comissão"
        subtitulo="Cadastro, percentual e quanto cada um recebe no mês"
        Icon={Users}
        theme={theme}
        compacta={mobile}
      >
        {temPro ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <VendedoresConfig lojaId={lojaId} theme={theme} />
            <ComissaoVendedores lojaId={lojaId} vendas={doMes} theme={theme} compacto={mobile} />
          </div>
        ) : (
          <UpgradeWall planoAtual={plano} planoNecessario="pro" funcionalidade="meta_vendedor" theme={theme} />
        )}
      </Gaveta>

      {/* 3 ── Curva ABC ──────────────────────────────────────────────────── */}
      <Gaveta
        titulo="Curva ABC"
        subtitulo="Quais produtos puxam o faturamento do mês"
        Icon={BarChart3}
        theme={theme}
        compacta={mobile}
      >
        {temPro ? (
          <CurvaABC vendas={doMes} theme={theme} semTitulo />
        ) : (
          <UpgradeWall planoAtual={plano} planoNecessario="pro" funcionalidade="relatorios" theme={theme} />
        )}
      </Gaveta>

      {/* 4 ── Corrida de vendedores ──────────────────────────────────────── */}
      <Gaveta
        titulo="Corrida de vendedores"
        subtitulo="Ranking e disputa por período"
        Icon={Trophy}
        theme={theme}
        compacta={mobile}
      >
        {temBusiness ? (
          <CorridaSection
            vendas={data?.vendas || []}
            corridas={data?.corridas || []}
            salvarCorrida={data?.salvarCorrida}
            excluirCorrida={data?.excluirCorrida}
            produtosData={data?.produtosData || []}
            mobile={mobile}
          />
        ) : (
          <UpgradeWall planoAtual={plano} planoNecessario="business" funcionalidade="corrida" theme={theme} />
        )}
      </Gaveta>

      {/* ── 5, 6 e 7 ────────────────────────────────────────────────────────
          Eram blocos SOLTOS dentro da gaveta 1: abriam expandidos junto com a
          meta mensal e faziam a primeira gaveta ocupar a tela inteira.

          O gate de cada um continua SENDO O DO PRÓPRIO Meta.jsx — mesmo nível
          e mesma `funcionalidade` de antes (meta_vendedor/Pro,
          meta_produto/Business, meta_comparativo/Pro). Nada de gate novo: a
          gaveta aparece sempre e o UpgradeWall vem de dentro, que é o padrão
          das outras.

          `semRotulos` desliga o título e o selo que ficavam dentro da seção —
          agora eles são o cabeçalho e o badge da própria gaveta. */}

      {/* 5 ── Meta por vendedor(a) ───────────────────────────────────────── */}
      <Gaveta
        titulo="Meta por vendedor(a)"
        subtitulo="Alvo individual do mês e quanto cada um já fez"
        Icon={UserCheck}
        badge={SELO_PRO}
        theme={theme}
        compacta={mobile}
      >
        {/* vendedoresCadastrados vem de lf_vendedores: sem ele a lista só
            reconhecia quem JÁ vendeu, e a lojista não conseguia definir a meta
            de alguém antes da primeira venda. Correção anterior, preservada. */}
        <Meta
          {...data} theme={theme} plano={plano} mobile={mobile}
          secoes={SO_VENDEDOR} semRotulos
          vendedoresCadastrados={vendedores}
        />
      </Gaveta>

      {/* 6 ── Meta por produto ───────────────────────────────────────────── */}
      <Gaveta
        titulo="Meta por produto"
        subtitulo="Alvo por produto ou categoria, em peças ou faturamento"
        Icon={Package}
        badge={SELO_BUSINESS}
        theme={theme}
        compacta={mobile}
      >
        <Meta {...data} theme={theme} plano={plano} mobile={mobile} secoes={SO_PRODUTO} semRotulos />
      </Gaveta>

      {/* 7 ── Comparativo mês a mês ──────────────────────────────────────── */}
      <Gaveta
        titulo="Comparativo mês a mês"
        subtitulo="Meta e realizado dos últimos 6 meses"
        Icon={CalendarRange}
        badge={SELO_PRO}
        theme={theme}
        compacta={mobile}
      >
        <Meta {...data} theme={theme} plano={plano} mobile={mobile} secoes={SO_COMPARATIVO} semRotulos />
      </Gaveta>
    </div>
  )
}
