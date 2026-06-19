import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { consultants as consultantsList, initialVisits } from '../data/initialData'

const DataContext = createContext(null)

const STATUS_MAP = {
  ativo:     'Ativo',
  trial:     'Trial',
  cancelado: 'Cancelado',
  Ativo:     'Ativo',
  Trial:     'Trial',
  Cancelado: 'Cancelado',
}

function mapConfig(c) {
  return {
    id:          c.loja_id,
    name:        c.nome || c.loja_id,
    company:     c.nome || c.loja_id,
    polo:        c.polo || '',
    product:     c.product || 'Sistema de Gestão',
    value:       Number(c.valor_mensal || 0),
    closedDate:  c.created_at?.slice(0, 10) || c.updated_at?.slice(0, 10) || '',
    status:      STATUS_MAP[c.status] || 'Ativo',
    consultantId: c.consultant_id || null,
  }
}

function load(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function DataProvider({ children }) {
  const [clients,   setClients]   = useState([])
  const [extraClients, setExtraClients] = useState(() => load('junttos_extra_clients_v1', []))
  const [visits,    setVisits]    = useState(() => load('junttos_visits_v2', initialVisits))
  const consultants = consultantsList

  useEffect(() => {
    supabase
      .from('lf_config')
      .select('loja_id, nome, status, plano, polo, product, valor_mensal, consultant_id, created_at, updated_at')
      .then(({ data }) => {
        if (data) setClients(data.map(mapConfig))
      })
  }, [])

  const allClients = [...clients, ...extraClients]

  function addClient(data) {
    const client = { ...data, id: Date.now().toString() }
    const updated = [client, ...extraClients]
    setExtraClients(updated)
    save('junttos_extra_clients_v1', updated)
    return client
  }

  function updateClient(id, data) {
    // Update in supabase clients array
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    // Or in extra clients
    setExtraClients(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...data } : c)
      save('junttos_extra_clients_v1', updated)
      return updated
    })
  }

  function deleteClient(id) {
    setClients(prev => prev.filter(c => c.id !== id))
    setExtraClients(prev => {
      const updated = prev.filter(c => c.id !== id)
      save('junttos_extra_clients_v1', updated)
      return updated
    })
  }

  function addVisit(data) {
    const visit = { ...data, id: Date.now().toString() }
    const updated = [visit, ...visits]
    setVisits(updated)
    save('junttos_visits_v2', updated)
    return visit
  }

  return (
    <DataContext.Provider value={{
      clients: allClients,
      addClient, updateClient, deleteClient,
      consultants,
      visits, addVisit,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
