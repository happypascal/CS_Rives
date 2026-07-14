import { useState, useEffect } from 'react'

// Détecte un écran mobile (< 768px, breakpoint md de Tailwind).
// Sert à réserver la création/gestion au PC ; le mobile = consultation + vote.
export function useIsMobile(query = '(max-width: 767px)') {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return isMobile
}
