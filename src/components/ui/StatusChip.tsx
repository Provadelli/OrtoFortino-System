import { cn } from '@/lib/cn'

export type Tone = 'late' | 'today' | 'prod' | 'ready' | 'draft'

const tones: Record<Tone, string> = {
  late: 'bg-late-bg text-late-fg',
  today: 'bg-today-bg text-today-fg',
  prod: 'bg-prod-bg text-prod-fg',
  ready: 'bg-ready-bg text-ready-fg',
  draft: 'bg-draft-bg text-draft-fg',
}

/** Selo de status: o texto sempre carrega o significado (não depende só da cor — WCAG 1.4.1). */
export function StatusChip({ tone, children, size = 'sm', className }: { tone: Tone; children: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full font-semibold whitespace-nowrap',
        size === 'md' ? 'px-3 py-1.5 text-[13px]' : 'px-2.5 py-[3px] text-xs',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
