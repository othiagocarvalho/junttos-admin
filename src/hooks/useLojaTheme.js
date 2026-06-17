import { useEffect } from 'react'

export function useLojaTheme(config) {
  useEffect(() => {
    if (!config?.cor_primaria) return
    const root = document.documentElement
    root.style.setProperty('--primary',   config.cor_primaria)
    root.style.setProperty('--rose',      config.cor_primaria)
    root.style.setProperty('--rose-deep', config.cor_secundaria || config.cor_primaria)
    return () => {
      root.style.removeProperty('--primary')
      root.style.removeProperty('--rose')
      root.style.removeProperty('--rose-deep')
    }
  }, [config?.cor_primaria, config?.cor_secundaria])
}
