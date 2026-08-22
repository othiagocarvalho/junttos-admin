// Tela "Metas & Resultados" — quatro gavetas expansíveis.
//
// Reorganização visual: nenhum cálculo novo. Cada gaveta puxa o componente que
// já existia, na ordem fixa combinada:
//
//   1. Metas do mês            Meta.jsx, sem a seção de corrida (virou a 4)
//   2. Vendedores e comissão   VendedoresConfig (veio de Configurações)
//                              + ComissaoVendedores (estava só no Relatórios)
//   3. Curva ABC               estava inline no Relatorios mobile
//   4. Corrida de vendedores   CorridaSection, que Meta.jsx já montava
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

import { Target, Users, BarChart3, Trophy } from 'lucide-react'
import Meta from './Meta'
import CorridaSection from './CorridaSection'
import Gaveta from '../../components/studio/Gaveta'
import UpgradeWall from '../../components/UpgradeWall'
import VendedoresConfig from '../../components/vendedores/VendedoresConfig'
import { useVendedores } from '../../components/vendedores/useVendedores'
import ComissaoVendedores from '../../components/vendedores/ComissaoVendedores'
import CurvaABC from '../../components/relatorios/CurvaABC'
import { temAcesso } from '../../utils/planos'

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
        titulo="Metas do mês"
        subtitulo="Meta da loja, por vendedor e por produto"
        Icon={Target}
        theme={theme}
        inicialAberta
        compacta={mobile}
      >
        {temStarter ? (
          // semCorrida: a corrida virou a gaveta 4. Sem isto ela apareceria
          // duas vezes na mesma tela.
          <Meta {...data} theme={theme} plano={plano} mobile={mobile} semCorrida vendedoresCadastrados={vendedores} />
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
    </div>
  )
}
