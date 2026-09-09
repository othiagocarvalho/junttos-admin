// Tela "Metas & Resultados" — cinco gavetas expansíveis.
//
// Reorganização visual: nenhum cálculo novo. Cada gaveta puxa o componente que
// já existia, na ordem fixa combinada:
//
//   1. Meta mensal             Meta.jsx, seções 'mensal' + 'vendedor' + 'produto'
//   2. Vendedores e comissão   VendedoresConfig (veio de Configurações)
//                              + ComissaoVendedores (estava só no Relatórios)
//   3. Curva ABC               estava inline no Relatorios mobile
//   4. Corrida de Vendas       CorridaSection, que Meta.jsx já montava
//   5. Comparativo Mensal      Meta.jsx, seção 'comparativo'
//
// Meta por vendedor(a) e Meta por produto tinham gaveta própria e voltaram
// para DENTRO da gaveta 1, como sub-seções: são as três faces da mesma
// pergunta ("qual é o alvo do mês"), e quebrar isso em três gavetas espalhava
// pela lista o que se lê junto. Não é duplicação de código — o Meta.jsx recebe
// as três chaves em `secoes` no mesmo mount, e cada sub-seção volta a exibir o
// próprio título e selo de plano (é para isso que `semRotulos` existe: aqui
// ele NÃO é passado).
//
// NENHUMA gaveta abre por padrão. A Meta mensal era a única com
// `inicialAberta` e passou a se comportar como as outras — com as duas
// sub-seções dentro, deixá-la aberta faria a tela nascer com quase tudo
// expandido, que é justamente o que a gaveta veio resolver.
//
// Abrem e fecham independentemente — não é accordion exclusivo.
//
// ─── GATE POR GAVETA ────────────────────────────────────────────────────────
// A gaveta SEMPRE aparece; quem não tem o plano vê o UpgradeWall dentro dela.
// É o padrão que o próprio Meta.jsx já usa nas suas subseções (metas por
// vendedor, meta por produto, corrida) — esconder a gaveta faria a loja Starter
// nem saber que a Curva ABC existe, e é justamente o contrário do que a tela de
// upgrade serve. Nenhum critério novo: reaproveita temAcesso(plano, ...) com os
// mesmos níveis já usados por cada feature hoje.

import { Target, Users, BarChart3, Trophy, CalendarRange } from 'lucide-react'
import Meta from './Meta'
import CorridaSection from './CorridaSection'
import Gaveta from '../../components/studio/Gaveta'
import UpgradeWall from '../../components/UpgradeWall'
import VendedoresConfig from '../../components/vendedores/VendedoresConfig'
import { useVendedores } from '../../components/vendedores/useVendedores'
import ComissaoVendedores from '../../components/vendedores/ComissaoVendedores'
import CurvaABC from '../../components/relatorios/CurvaABC'
import { temAcesso } from '../../utils/planos'
import SeloPlano from '../../components/studio/SeloPlano'

// Fora do componente de propósito: array novo a cada render faria o Meta
// remontar sem necessidade.
//
// A gaveta 1 pede as TRÊS seções de meta de uma vez. A ordem aqui não decide
// nada — quem manda no desenho é a ordem dos blocos dentro do Meta.jsx
// (mensal, depois vendedor, depois produto).
const METAS_DO_MES   = ['mensal', 'vendedor', 'produto']
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

      {/* 1 ── Meta mensal, com as metas por vendedor e por produto dentro ── */}
      <Gaveta
        titulo="Meta mensal"
        subtitulo="Meta da loja, por vendedor(a) e por produto"
        Icon={Target}
        theme={theme}
        compacta={mobile}
      >
        {/* As três seções no MESMO mount. Sem `semRotulos` de propósito: cada
            sub-seção volta a desenhar o próprio título com o selo de plano
            (Meta por Vendedor(a) · Pro, Meta por Produto · Business), que é o
            que as separa visualmente dentro da gaveta.

            O gate de cada sub-seção continua sendo o do próprio Meta.jsx —
            mesmo nível e mesma `funcionalidade` de sempre (meta_vendedor/Pro,
            meta_produto/Business). Quem não tem o plano vê o UpgradeWall no
            lugar daquela sub-seção, e só dela.

            A corrida e o comparativo seguem fora: têm as gavetas 4 e 5. */}
        {temStarter ? (
          <Meta
            {...data} theme={theme} plano={plano} mobile={mobile}
            secoes={METAS_DO_MES}
            /* vem de lf_vendedores: sem ele a lista só reconhecia quem JÁ
               vendeu, e a lojista não conseguia definir a meta de alguém antes
               da primeira venda. Correção anterior, preservada — mudou de
               gaveta junto com a sub-seção. */
            vendedoresCadastrados={vendedores}
          />
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

      {/* 4 ── Corrida de Vendas ──────────────────────────────────────────── */}
      <Gaveta
        titulo="Corrida de Vendas"
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

      {/* 5 ── Comparativo Mensal ─────────────────────────────────────────
          Última gaveta da lista. O gate continua sendo o do próprio Meta.jsx
          (meta_comparativo/Pro); `semRotulos` desliga o título interno, que
          aqui é o cabeçalho da gaveta, e o selo vem pelo badge. */}
      <Gaveta
        titulo="Comparativo Mensal"
        subtitulo="Meta e realizado dos últimos 6 meses"
        Icon={CalendarRange}
        /* Condicional: loja Pro ou Business não vê selo nenhum aqui.
           Antes era fixo e aparecia até para quem já tinha o plano. */
        badge={<SeloPlano planoAtual={plano} planoNecessario="pro" />}
        theme={theme}
        compacta={mobile}
      >
        <Meta {...data} theme={theme} plano={plano} mobile={mobile} secoes={SO_COMPARATIVO} semRotulos />
      </Gaveta>
    </div>
  )
}
