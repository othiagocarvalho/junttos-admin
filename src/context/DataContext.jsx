import { createContext, useContext, useState } from 'react'
import { initialClients, consultants as consultantsList, initialVisits } from '../data/initialData'

const DataContext = createContext(null)

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
  const [clients, setClients] = useState(() => load('junttos_clients', initialClients))
  const [visits, setVisits] = useState(() => load('junttos_visits', initialVisits))
  const consultants = consultantsList

  function addClient(data) {
    const client = { ...data, id: Date.now().toString() }
    const updated = [client, ...clients]
    setClients(updated)
    save('junttos_clients', updated)
    return client
  }

  function updateClient(id, data) {
    const updated = clients.map((c) => (c.id === id ? { ...c, ...data } : c))
    setClients(updated)
    save('junttos_clients', updated)
  }

  function deleteClient(id) {
    const updated = clients.filter((c) => c.id !== id)
    setClients(updated)
    save('junttos_clients', updated)
  }

  function addVisit(data) {
    const visit = { ...data, id: Date.now().toString() }
    const updated = [visit, ...visits]
    setVisits(updated)
    save('junttos_visits', updated)
    return visit
  }

  return (
    <DataContext.Provider value={{ clients, addClient, updateClient, deleteClient, consultants, visits, addVisit }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
