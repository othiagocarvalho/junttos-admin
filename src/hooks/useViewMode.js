import { useState, useCallback } from 'react'

const KEY = 'junttos_viewMode'

function isForceMobile() {
  return new URLSearchParams(window.location.search).get('forceMobile') === '1'
}

export function useViewMode() {
  const [viewMode, setViewModeState] = useState(
    () => isForceMobile() ? 'mobile' : (localStorage.getItem(KEY) || 'mobile')
  )

  const setViewMode = useCallback((mode) => {
    if (!isForceMobile()) localStorage.setItem(KEY, mode)
    setViewModeState(mode)
  }, [])

  return { viewMode, setViewMode }
}
