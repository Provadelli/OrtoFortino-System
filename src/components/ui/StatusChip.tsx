import { cn } from '@/lib/cn'

/**
 * Tons de status, cada um com cor própria para separar bem as etapas:
 * draft = cinza (início/rascunho), info = azul (em andamento/enviado), ready = amarelo (pronto/aguardando),
 * prod = verde (concluído/aprovado/pago), today = laranja (atenção/parcial/vence hoje), late = rosa (atraso/recusa).
 */
export type Tone = 'late' | 'today' | 'prod' | 'ready' | 'draft' | 'info'

const tones: Record<Tone, string> = {
  late: 'bg-late-bg text-late-fg',
  today: 'bg-today-bg text-today-fg',
  prod: 'bg-prod-bg text-prod-fg',
  ready: 'bg-ready-bg text-ready-fg',
  draft: 'bg-draft-bg text-draft-fg',
  info: 'bg-info-bg text-info-fg',
}

/** Bolinha de cor do tom (decorativa; o texto ao lado carrega o significado). */
export const toneDot: Record<Tone, string> = {
  late: 'bg-late-dot',
  today: 'bg-today-dot',
  prod: 'bg-prod-dot',
  ready: 'bg-ready-dot',
  draft: 'bg-draft-dot',
  info: 'bg-info-dot',
}

/** Selo de status: o texto sempre carrega o significado (não depende só da cor — WCAG 1.4.1). */
export function StatusChip({ tone, children, size = 'sm', className }: { tone: Tone; children: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors duration-300',
        size === 'md' ? 'px-3 py-1.5 text-[13px]' : 'px-2.5 py-[3px] text-xs',
        tones[tone],
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', toneDot[tone])} />
      {children}
    </span>
  )
}
