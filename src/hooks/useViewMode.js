import { useState, useCallback } from 'react'

const KEY = 'junttos_viewMode'

export function useViewMode() {
  const [viewMode, setViewModeState] = useState(
    () => localStorage.getItem(KEY) || 'mobile'
  )

  const setViewMode = useCallback((mode) => {
    localStorage.setItem(KEY, mode)
    setViewModeState(mode)
  }, [])

  return { viewMode, setViewMode }
}
