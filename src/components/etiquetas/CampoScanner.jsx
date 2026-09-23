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
//
// Câmera (prop `camera`, padrão true): um botão dentro do campo abre o
// BarcodeScanner em modo contínuo. A leitura da câmera passa pelo MESMO
// resolver() do leitor físico — as telas não sabem de onde veio o código.
// O desktop desliga (camera={false}): webcam lê código de barras mal.
//
// Som: resolver() toca o bipe de acerto/erro (utils/bipe.js) para os dois
// caminhos.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ScanLine, Camera } from 'lucide-react'
import { pareceLeitura } from '../../utils/codigoBarras'
import { cameraDisponivel } from '../../utils/leituraCamera'
import { destravarAudio, tocarBipe } from '../../utils/bipe'
import BarcodeScanner from '../BarcodeScanner'

export default function CampoScanner({ aoLer, theme, autoFoco = true, dica = '', camera = true }) {
  const [valor, setValor] = useState('')
  const [aviso, setAviso] = useState(null)      // { tipo: 'ok'|'erro', texto }
  const [cameraAberta, setCameraAberta] = useState(false)
  // Calculado uma vez: getUserMedia não aparece nem some durante a sessão.
  const [mostrarCamera] = useState(() => camera && cameraDisponivel())
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

  // async de propósito — Pré-venda usa isto com um aoLer que chama RPC
  // (bipar_item_prevenda), que é rede, não memória. `await` numa função
  // SÍNCRONA (o caso de Nova Venda, buscarPorCodigo em memória) resolve na
  // mesma volta do event loop — não muda nada pra quem já usa isto hoje.
  //
  // `origem`: 'teclado' (leitor físico ou digitação) ou 'camera'.
  async function resolver(codigo, origem = 'teclado') {
    clearTimeout(timerRajada.current)
    marcas.current = []
    const limpo = String(codigo || '').trim()
    if (!limpo) return
    // Pelo teclado, isto roda dentro do keydown do Enter — um gesto do
    // usuário, que é quando o navegador aceita liberar o áudio. Tem de vir
    // ANTES do await: depois dele o gesto já expirou.
    if (origem === 'teclado') destravarAudio()
    const r = await aoLer?.(limpo)
    setValor('')
    // O foco volta para o campo: quem está bipando passa várias peças
    // seguidas. Pela câmera NÃO — no celular o foco abriria o teclado a cada
    // leitura, por baixo do overlay.
    if (origem !== 'camera') inputRef.current?.focus()
    if (r?.ok) {
      tocarBipe('ok')
      mostrarAviso('ok', r.texto || 'Adicionado')
    } else {
      tocarBipe('erro')
      mostrarAviso('erro', r?.texto || 'Código não encontrado')
    }
  }

  function abrirCamera() {
    // NÃO REMOVER: é o único gesto do usuário no fluxo da câmera. As leituras
    // chegam por callback do zxing, que não conta como gesto — sem destravar
    // aqui, no iOS o bipe da câmera nunca toca. Ver utils/bipe.js.
    destravarAudio()
    setCameraAberta(true)
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
            borderRadius: 'var(--r-input, 12px)', padding: mostrarCamera ? '0 50px 0 38px' : '0 14px 0 38px',
            fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--ink)',
            background: 'var(--surface)', outline: 'none',
          }}
        />
        {mostrarCamera && (
          <button
            type="button"
            onClick={abrirCamera}
            aria-label="Ler código pela câmera"
            title="Ler código pela câmera"
            style={{
              position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
              width: 38, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: theme?.primary || 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Camera size={18} color="#fff" />
          </button>
        )}
      </div>
      {/* Portal: o overlay é position:fixed e não pode ficar preso num
          ancestral que crie contexto de empilhamento. */}
      {cameraAberta && createPortal(
        <BarcodeScanner
          continuo
          mensagem={aviso}
          onDetected={codigo => resolver(codigo, 'camera')}
          onClose={() => setCameraAberta(false)}
        />,
        document.body,
      )}
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
