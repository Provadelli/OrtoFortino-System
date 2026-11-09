import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'

export function AppShell() {
  return (
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
  )
}

export function PageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="h-16 w-64 animate-pulse rounded-card bg-line" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[130px] animate-pulse rounded-card bg-white" />
        ))}
      </div>
    </div>
  )
}
