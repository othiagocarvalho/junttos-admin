import { useState, useEffect, useRef } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { criarControleLeitura, mensagemErroCamera } from '../utils/leituraCamera'

// Leitor de código de barras pela câmera.
//
// Dois modos:
//   - padrão (continuo=false): lê UM código, desliga a câmera e chama
//     onDetected(texto) — quem chamou fecha. É o que Mercado, Balanço, Contar
//     Estoque e Cadastrar Produto usam desde sempre; não mudou.
//   - continuo=true: a câmera fica aberta e cada leitura aceita vai para
//     onDetected, que pode ser async. As regras de aceitação (espera o
//     onDetected terminar; mesma peça só depois de ~1,5s) estão em
//     criarControleLeitura (utils/leituraCamera.js). `mensagem`
//     ({ tipo: 'ok'|'erro', texto }) aparece por cima do vídeo — é o retorno
//     do último bipe, já que o overlay cobre a tela de onde ele veio.
//
// Formatos: o leitor aceita todos os que o zxing conhece, de propósito. O
// Mercado lê EAN de fábrica e o Moda aceita código manual por variação
// (pode ser o EAN do fornecedor) — restringir a Code128 quebraria os dois.
export default function BarcodeScanner({ onDetected, onClose, continuo = false, mensagem = null }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const onDetectedRef = useRef(onDetected)
  const [erro, setErro] = useState(null)   // { titulo, detalhe }

  useEffect(() => { onDetectedRef.current = onDetected }, [onDetected])

  useEffect(() => {
    // `cancelado` cobre o desmonte ANTES de a câmera terminar de abrir
    // (fechar rápido, ou o StrictMode montando/desmontando em dev): nesse
    // caso controlsRef ainda está vazio no cleanup, e sem esta guarda a
    // câmera ficava ligada (luz acesa) depois de o componente sumir.
    let cancelado = false
    const controle = criarControleLeitura()
    const reader = new BrowserMultiFormatReader()

    reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      videoRef.current,
      (result) => {
        if (!result || cancelado) return
        const codigo = result.getText()
        if (!continuo) {
          controlsRef.current?.stop()
          onDetectedRef.current(codigo)
          return
        }
        if (!controle.tentar(codigo, Date.now())) return
        Promise.resolve()
          .then(() => onDetectedRef.current(codigo))
          .catch(() => {})
          .finally(() => controle.concluir(Date.now()))
      }
    ).then(controls => {
      if (cancelado) { controls.stop(); return }
      controlsRef.current = controls
    }).catch(err => {
      if (!cancelado) setErro(mensagemErroCamera(err))
    })

    return () => {
      cancelado = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [continuo])

  const corMensagem = mensagem?.tipo === 'ok' ? '#86efac' : '#fca5a5'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: 20,
    }}>
      {erro ? (
        <div style={{ textAlign: 'center', color: '#fff', padding: 20 }}>
          <AlertCircle size={40} color="#f59e0b" style={{ marginBottom: 12 }} />
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 600 }}>
            {erro.titulo}
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
            {erro.detalhe}
          </p>
        </div>
      ) : (
        <>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Aponte para o código de barras
          </p>
          <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 14, display: 'block', background: '#111' }} />
            <div style={{
              position: 'absolute', top: '35%', left: '10%', right: '10%', height: '30%',
              border: '2px solid rgba(94,43,208,0.8)', borderRadius: 8,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            }} />
          </div>
          {continuo && (
            // Altura reservada mesmo sem mensagem: o vídeo não pula a cada bipe.
            <p role="status" aria-live="polite" style={{
              minHeight: 20, margin: 0, textAlign: 'center', maxWidth: 380,
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700,
              color: corMensagem,
            }}>
              {mensagem?.texto || ''}
            </p>
          )}
        </>
      )}
      <button onClick={() => { controlsRef.current?.stop(); onClose() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 28px', borderRadius: 12, border: 'none',
          background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600,
        }}>
        <X size={16} /> Fechar câmera
      </button>
    </div>
  )
}
