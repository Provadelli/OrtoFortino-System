import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { refresh } from '@/features/auth/auth-client'
import { tokenStore } from '@/features/auth/token-store'
import { useSession } from '@/features/auth/useSession'
import { PageSkeleton } from '@/components/layout/PageSkeleton'

/**
 * Protege as rotas internas. A sessão vem do cookie httpOnly via /api/auth/refresh;
 * a autorização real acontece no banco (RLS) — isto aqui é só UX.
 */
export function RequireAuth() {
  const session = useSession()
  const location = useLocation()
  const [checked, setChecked] = useState(session !== null)

  useEffect(() => {
    if (session || checked) return
    let alive = true
    void refresh().finally(() => alive && setChecked(true))
    return () => {
      alive = false
    }
  }, [session, checked])

  if (session) return <Outlet />
  if (!checked)
    return (
      <main id="conteudo" className="mx-auto w-full max-w-[1280px] p-8">
        <output aria-live="polite" className="sr-only">
          Carregando…
        </output>
        <PageSkeleton />
      </main>
    )

  const reason = tokenStore.getEndReason()
  if (reason === 'logout') return <Navigate to="/login" replace />
  const next = encodeURIComponent(location.pathname + location.search)
  const motivo = reason === 'expired' ? '&motivo=sessao-expirada' : ''
  return <Navigate to={`/login?next=${next}${motivo}`} replace />
}
