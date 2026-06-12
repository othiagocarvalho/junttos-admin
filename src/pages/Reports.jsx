import EmptyState from '../components/junttos/EmptyState'

export default function Reports() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <EmptyState
        title="Relatórios em desenvolvimento"
        description="Os relatórios detalhados da plataforma estarão disponíveis em breve."
      />
    </div>
  )
}
