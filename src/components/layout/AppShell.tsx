import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { secaoDe } from '@/lib/secoes'
import { Rabisco } from '@/components/ui/Rabisco'
import { Sidebar } from './Sidebar'
import { PageSkeleton } from './PageSkeleton'

export default function AppShell() {
  const { pathname } = useLocation()
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
        <Sidebar />
        <main id="conteudo" tabIndex={-1} data-secao={secaoDe(pathname)} className="relative isolate flex min-w-0 flex-1 justify-center overflow-x-clip outline-none">
          {/* Rabiscos de giz na cor da seção, atrás do conteúdo */}
          <Rabisco
            forma="espiral"
            cor="var(--secao)"
            className="absolute -top-[100px] -right-[80px] -z-10 size-[150px] opacity-70 transition-[background-color] duration-500 sm:size-[220px] sm:-top-[150px] sm:-right-[90px]"
          />
          <Rabisco forma="laco" className="absolute right-[6%] bottom-3 -z-10 h-6 w-[140px] bg-giz-lilas opacity-50 max-sm:hidden" />
          <div className="flex w-full max-w-[1280px] flex-col gap-6 px-4 pt-8 pb-12 sm:px-[clamp(16px,3vw,40px)]">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </QueryClientProvider>
  )
}
