import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { Sidebar } from './Sidebar'
import { PageSkeleton } from './PageSkeleton'

export default function AppShell() {
  return (
    <QueryClientProvider client={queryClient}>
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <Sidebar />
      <main id="conteudo" tabIndex={-1} className="flex min-w-0 flex-1 justify-center outline-none">
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
