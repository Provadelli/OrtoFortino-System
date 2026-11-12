import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type FormaRabisco = 'espiral' | 'faixa' | 'sublinhado' | 'laco' | 'estrela'

/**
 * Rabisco de giz de cera (como no site da Orto Fortino). Puramente decorativo:
 * a forma vem de /rabiscos/<forma>.svg como máscara e a cor do `bg-*` passado em className
 * (ou de `cor`, ex.: 'var(--secao)').
 */
export function Rabisco({ forma, cor, className, style }: { forma: FormaRabisco; cor?: string; className?: string; style?: CSSProperties }) {
  const url = `url('/rabiscos/${forma}.svg')`
  return <span aria-hidden="true" className={cn('rabisco block', className)} style={{ maskImage: url, WebkitMaskImage: url, background: cor, ...style }} />
}

/**
 * Cena do login e da 404, na composição do site da empresa: diagonais opostas
 * (faixa rosa ↖ e faixa verde ↘; espiral amarela ↗ e espiral lilás ↙) com os raios
 * de sol girando devagar atrás da marca. Cada peça chega em sequência e depois só
 * "respira" (espirais girando lento, faixas flutuando). Tudo para com "reduzir movimento".
 */
export function CenaRabiscos() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* raios: só no centro, desaparecendo nas bordas */}
      <div className="absolute top-1/2 left-1/2 size-[1100px] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(circle,#000_0,#000_18%,transparent_58%)] animate-fade">
        <div className="sunburst size-full opacity-70 animate-spin-slow will-change-transform" />
      </div>

      <Peca className="-top-4 -left-12 h-16 w-[min(62%,420px)] -rotate-3" i={1}>
        <Rabisco forma="faixa" className="size-full bg-giz-rosa animate-flutua" />
      </Peca>
      <Peca className="-top-16 -right-20 size-[clamp(180px,24vw,300px)]" i={2}>
        <Rabisco forma="espiral" className="size-full bg-giz-amarelo animate-gira will-change-transform" />
      </Peca>
      <Peca className="-bottom-20 -left-20 size-[clamp(170px,22vw,280px)] max-sm:-bottom-24 max-sm:size-[150px]" i={3}>
        <Rabisco forma="espiral" className="size-full bg-giz-lilas animate-gira-inverso will-change-transform" />
      </Peca>
      <Peca className="-right-12 bottom-1 h-14 w-[min(62%,420px)] rotate-2 max-sm:-bottom-3 max-sm:h-10 max-sm:w-[48%]" i={4}>
        <Rabisco forma="faixa" className="size-full bg-giz-verde animate-flutua [animation-delay:-3.5s]" />
      </Peca>
    </div>
  )
}

/** Posição + entrada (escala e opacidade); o movimento contínuo fica no filho. */
function Peca({ className, i, children }: { className: string; i: number; children: ReactNode }) {
  return (
    <div className={cn('absolute animate-chega stagger', className)} style={{ '--i': i * 2 } as CSSProperties}>
      {children}
    </div>
  )
}
