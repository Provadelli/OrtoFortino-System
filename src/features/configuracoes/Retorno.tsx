import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Retorno de cada seção: sucesso (status) ou erro (alert). */
export function Retorno({ ok, erro }: { ok?: string | null; erro?: string | null }) {
  if (erro)
    return (
      <p role="alert" className="m-0 rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg">
        {erro}
      </p>
    )
  return (
    <output aria-live="polite" className={cn(ok ? 'block rounded-field border border-[#bfe6d2] bg-prod-bg px-4 py-3 text-[15px] font-medium text-prod-fg animate-fade' : 'sr-only')}>
      {ok ?? ''}
    </output>
  )
}

export function Rodape({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft pt-4">{children}</div>
}
