import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { supabase } from '../lib/supabase'
import { Users, DollarSign, MapPin, Building2 } from 'lucide-react'
import StatCard from '../components/junttos/StatCard'
import Panel from '../components/junttos/Panel'
import ListRow from '../components/junttos/ListRow'
import EmptyState from '../components/junttos/EmptyState'
import { T } from '../theme/tokens'

const PROD_BASE = 'https://junttos-admin.vercel.app'

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

  const now = new Date()
  const hora = now.getHours()
  const greeting = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const activeLojas = lojas.filter((l) => l.status === 'ativo')

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
              const link = `${PROD_BASE}/${slug}/`
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
