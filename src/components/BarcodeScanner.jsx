import { useState, useEffect, useRef } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const onDetectedRef = useRef(onDetected)
  const [permErr, setPermErr] = useState(false)

  useEffect(() => { onDetectedRef.current = onDetected }, [onDetected])

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      videoRef.current,
      (result) => {
        if (result) {
          controlsRef.current?.stop()
          onDetectedRef.current(result.getText())
        }
      }
    ).then(controls => {
      controlsRef.current = controls
    }).catch(err => {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermErr(true)
      }
    })
    return () => { controlsRef.current?.stop() }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: 20,
    }}>
      {permErr ? (
        <div style={{ textAlign: 'center', color: '#fff', padding: 20 }}>
          <AlertCircle size={40} color="#f59e0b" style={{ marginBottom: 12 }} />
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 600 }}>
            Permissão de câmera negada
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
            Ative o acesso à câmera nas configurações do navegador.
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
