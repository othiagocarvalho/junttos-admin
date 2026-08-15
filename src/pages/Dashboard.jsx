import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Users, DollarSign, MapPin, Building2, AlertTriangle } from 'lucide-react'
import StatCard from '../components/junttos/StatCard'
import Panel from '../components/junttos/Panel'
import ListRow from '../components/junttos/ListRow'
import EmptyState from '../components/junttos/EmptyState'
import { T } from '../theme/tokens'
import { useGeracaoCobrancas } from '../hooks/useGeracaoCobrancas'
import { isLojaAtiva } from '../utils/cobrancas'
import { fmtR } from '../utils/formatters'

export default function Dashboard() {
  const { user } = useAuth()
  const { visits } = useData()
  const [lojas, setLojas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('lf_config')
      .select('id, nome, slug, loja_id, cor_primaria, logo_url, status')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setLojas(data || [])
        setLoading(false)
      })
  }, [])

  // Segunda checagem do ciclo de cobrança. Sem cron no plano gratuito, a
  // geração depende de alguém abrir uma tela — o Dashboard é a mais aberta,
  // então roda aqui também para o atraso não passar semanas sem ser notado.
  const geracao = useGeracaoCobrancas()

  const now = new Date()
  const hora = now.getHours()
  const greeting = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  // lf_config.status é texto livre e o banco tem 'Ativo' e 'ativo' convivendo.
  // A comparação exata que existia aqui deixava de fora as gravadas com
  // maiúscula e subestimava o número. Mesmo critério da tela de Cobranças.
  const activeLojas = lojas.filter((l) => isLojaAtiva(l.status))
  const nomePorLoja = Object.fromEntries(lojas.map(l => [l.loja_id, l.nome]))
  const mostrarAviso = !geracao.rodando && (geracao.atrasadas.length > 0 || geracao.erro)

  return (
    <div style={{ maxWidth: 1200, fontFamily: T.ui }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 13.5, color: T.muted, marginBottom: 4 }}>
          {greeting}, {user?.name.split(' ')[0]}
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: T.muted }}>
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Cobrança do ciclo atrasada — precisa ficar óbvio, não em log */}
      {mostrarAviso && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          background: '#FEE8E8', border: '1px solid #C0392B44',
          borderRadius: T.rCard, padding: '16px 18px', marginBottom: 24,
        }}>
          <AlertTriangle size={17} color="#C0392B" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#C0392B', marginBottom: 4 }}>
              {geracao.atrasadas.length > 0
                ? `${geracao.atrasadas.length} ${geracao.atrasadas.length === 1 ? 'cobrança atrasada não foi gerada' : 'cobranças atrasadas não foram geradas'}`
                : 'A geração automática de cobranças falhou'}
            </p>
            {geracao.atrasadas.length > 0 && (
              <ul style={{ margin: '0 0 6px', paddingLeft: 18, fontSize: 12.5, color: '#C0392B', lineHeight: 1.7 }}>
                {geracao.atrasadas.map((a, i) => (
                  <li key={`${a.loja_id}-${a.vencimento}-${i}`}>
                    <strong>{nomePorLoja[a.loja_id] || a.loja_id}</strong> — {fmtR(a.valor)}, venceu em {a.vencimento.split('-').reverse().join('/')}
                  </li>
                ))}
              </ul>
            )}
            {geracao.erro && <p style={{ fontSize: 12, color: '#C0392B', fontFamily: T.mono, wordBreak: 'break-word' }}>{geracao.erro}</p>}
            <Link to="/cobrancas" style={{ fontSize: 12.5, fontWeight: 700, color: '#C0392B' }}>Abrir Cobranças →</Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={Users}     color="purple" label="Clientes Ativos"    value={loading ? '…' : activeLojas.length} />
        <StatCard icon={DollarSign} color="coral"  label="Faturamento do Mês" value="R$ 0,00" />
        <StatCard icon={MapPin}     color="lilac"  label="Visitas Realizadas" value={visits.length} />
        <StatCard icon={Building2}  color="deep"   label="Lojas na Plataforma" value={loading ? '…' : lojas.length} />
      </div>

      {/* Clientes Cadastrados */}
      <Panel
        title="Clientes Cadastrados"
        subtitle={loading ? 'Carregando…' : `${lojas.length} ${lojas.length === 1 ? 'loja' : 'lojas'} na plataforma`}
        bodyStyle={{ padding: 0 }}
      >
        {loading ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>
            Carregando clientes…
          </div>
        ) : lojas.length === 0 ? (
          <EmptyState
            title="Nenhum cliente cadastrado"
            description="Acesse Clientes para adicionar o primeiro painel de loja."
          />
        ) : (
          <div>
            {lojas.map((loja) => {
              const slug = loja.slug || loja.loja_id
              const link = `${window.location.origin}/${slug}/`
              return (
                <ListRow
                  key={loja.id}
                  logo={loja.logo_url}
                  name={loja.nome}
                  slug={slug}
                  status={loja.status || 'ativo'}
                  href={link}
                  primary={loja.cor_primaria || T.purple}
                />
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
