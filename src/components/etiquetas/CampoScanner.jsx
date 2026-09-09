// Campo dedicado à leitura de código de barras na Nova Venda.
//
// O leitor USB/bluetooth se comporta como teclado: dispara os caracteres em
// rajada e termina com Enter. Este campo NÃO substitui a busca manual de
// produto — os dois coexistem, e é de propósito: código só resolve peça já
// etiquetada, e a loja vai ter peça sem etiqueta por muito tempo.
//
// Duas formas de confirmar, porque leitor barato às vezes vem sem sufixo Enter:
//   1. Enter (o caminho normal);
//   2. rajada de digitação rápida seguida de pausa — se os intervalos entre
//      teclas ficam abaixo de ~35ms, foi máquina, e o campo resolve sozinho
//      depois de 120ms parado. Gente digitando na mão nunca cai aqui.

import { useEffect, useRef, useState } from 'react'
import { ScanLine } from 'lucide-react'
import { pareceLeitura } from '../../utils/codigoBarras'

export default function CampoScanner({ aoLer, theme, autoFoco = true, dica = '' }) {
  const [valor, setValor] = useState('')
  const [aviso, setAviso] = useState(null)      // { tipo: 'ok'|'erro', texto }
  const inputRef = useRef(null)
  const marcas = useRef([])                     // timestamps entre teclas
  const timerRajada = useRef(null)
  const avisoTimer = useRef(null)

  useEffect(() => {
    if (autoFoco) inputRef.current?.focus()
    return () => { clearTimeout(timerRajada.current); clearTimeout(avisoTimer.current) }
  }, [autoFoco])

  function mostrarAviso(tipo, texto) {
    setAviso({ tipo, texto })
    clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(null), 2600)
  }

  function resolver(codigo) {
    clearTimeout(timerRajada.current)
    marcas.current = []
    const limpo = String(codigo || '').trim()
    if (!limpo) return
    const r = aoLer?.(limpo)
    setValor('')
    // O foco volta para o campo: quem está bipando passa várias peças seguidas.
    inputRef.current?.focus()
    if (r?.ok) mostrarAviso('ok', r.texto || 'Adicionado')
    else mostrarAviso('erro', r?.texto || 'Código não encontrado')
  }

  function aoDigitar(e) {
    const novo = e.target.value
    setValor(novo)

    const agora = Date.now()
    marcas.current.push(agora)
    if (marcas.current.length > 12) marcas.current.shift()

    // Confirmação por rajada: só entra quando TODOS os intervalos observados
    // são rápidos demais para mão humana.
    clearTimeout(timerRajada.current)
    const intervalos = marcas.current.slice(1).map((t, i) => t - marcas.current[i])
    if (novo.length >= 6 && intervalos.length >= 3 && pareceLeitura(intervalos)) {
      timerRajada.current = setTimeout(() => resolver(novo), 120)
    }
  }

  const corAviso = aviso?.tipo === 'ok' ? 'var(--status-ok-tx, #15803d)' : 'var(--status-bad-tx, #b91c1c)'

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <ScanLine
          size={17}
          style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          color={theme?.primary || 'var(--muted)'}
        />
        <input
          ref={inputRef}
          value={valor}
          onChange={aoDigitar}
          onKeyDown={e => {
            if (e.key !== 'Enter') return
            e.preventDefault()          // não deixa o Enter do leitor submeter o form
            resolver(e.currentTarget.value)
          }}
          placeholder="Bipe o código de barras"
          aria-label="Leitor de código de barras"
          autoComplete="off"
          // 16px evita o zoom do iOS ao focar — o campo abre focado, então o
          // zoom aconteceria na entrada da tela.
          style={{
            width: '100%', height: 46, boxSizing: 'border-box',
            border: `1.5px solid ${theme?.primary ? `${theme.primary}55` : 'var(--line)'}`,
            borderRadius: 'var(--r-input, 12px)', padding: '0 14px 0 38px',
            fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--ink)',
            background: 'var(--surface)', outline: 'none',
          }}
        />
      </div>
      {aviso ? (
        <p role="status" aria-live="polite" style={{ margin: '6px 0 0', fontFamily: 'var(--font-ui)', fontSize: 12.5, color: corAviso }}>
          {aviso.texto}
        </p>
      ) : dica ? (
        <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>{dica}</p>
      ) : null}
    </div>
  )
}
