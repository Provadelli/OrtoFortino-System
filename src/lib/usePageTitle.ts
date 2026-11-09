import { useEffect } from 'react'

/** Título único por página (WCAG 2.4.2). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Orto Fortino`
  }, [title])
}
