import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { refresh } from '@/features/auth/auth-client'
import { useSession } from '@/features/auth/useSession'
import { PageSkeleton } from '@/components/layout/AppShell'

/**
 * Protege as rotas internas. A sessão vem do cookie httpOnly via /api/auth/refresh;
 * a autorização real acontece no banco (RLS) — isto aqui é só UX.
 */
export function RequireAuth() {
  const session = useSession()
  const location = useLocation()
  const [checked, setChecked] = useState(session !== null)
  const [hadSession] = useState(session !== null)

  useEffect(() => {
    if (session) return
    let alive = true
    void refresh().finally(() => alive && setChecked(true))
    return () => {
      alive = false
    }
  }, [session])

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

  const next = encodeURIComponent(location.pathname + location.search)
  const motivo = hadSession ? '&motivo=sessao-expirada' : ''
  return <Navigate to={`/login?next=${next}${motivo}`} replace />
}
