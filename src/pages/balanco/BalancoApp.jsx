import { useState } from 'react'
import BalancoSessao from './BalancoSessao'
import BalancoContagem from './BalancoContagem'
import BalancoResumo from './BalancoResumo'

export default function BalancoApp() {
  const [screen, setScreen] = useState('sessao') // 'sessao' | 'contagem' | 'resumo'
  const [sessao, setSessao] = useState(null)
  const [subcontagens, setSubcontagens] = useState([])
  const [subcontagemIdx, setSubcontagemIdx] = useState(0)

  function handleSessaoIniciada(sessaoData, subs) {
    setSessao(sessaoData)
    setSubcontagens(subs)
    setSubcontagemIdx(0)
    setScreen('contagem')
  }

  function handleSubcontagemFinalizada() {
    const next = subcontagemIdx + 1
    if (next < subcontagens.length) {
      setSubcontagemIdx(next)
    } else {
      setScreen('resumo')
    }
  }

  function handleDesempate(novaSubcontagem) {
    const novoIdx = subcontagens.length
    setSubcontagens(prev => [...prev, novaSubcontagem])
    setSubcontagemIdx(novoIdx)
    setScreen('contagem')
  }

  function handleNovaSessao() {
    setSessao(null)
    setSubcontagens([])
    setSubcontagemIdx(0)
    setScreen('sessao')
  }

  if (screen === 'sessao') {
    return <BalancoSessao onIniciada={handleSessaoIniciada} />
  }
  if (screen === 'contagem') {
    return (
      <BalancoContagem
        sessao={sessao}
        subcontagem={subcontagens[subcontagemIdx]}
        subcontagemIdx={subcontagemIdx}
        totalSubcontagens={subcontagens.length}
        onFinalizada={handleSubcontagemFinalizada}
      />
    )
  }
  return (
    <BalancoResumo
      sessao={sessao}
      subcontagens={subcontagens}
      onDesempate={handleDesempate}
      onNovaSessao={handleNovaSessao}
    />
  )
}
