import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { TRACOS, type FormaTracada } from './rabiscos-tracos'

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

/** Textura de giz de cera (contorno irregular + granulado), definida uma vez por página. */
export function FiltroGiz() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        <filter id="giz" x="-20%" y="-50%" width="140%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="9" result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.55" result="ga" />
          <feComposite in="d" in2="ga" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}

/**
 * Rabisco que se desenha na tela, como um traço de giz (stroke-dashoffset de 1 a 0).
 * Precisa de <FiltroGiz /> na página. Com "reduzir movimento" já aparece pronto.
 */
export function RabiscoTracado({
  forma,
  cor,
  atraso = 0,
  duracao = 1000,
  className,
}: {
  forma: FormaTracada
  cor: string
  atraso?: number
  duracao?: number
  className?: string
}) {
  const t = TRACOS[forma]
  return (
    <svg aria-hidden="true" viewBox={t.viewBox} className={cn('block overflow-visible', className)}>
      <path
        d={t.d}
        pathLength={1}
        fill="none"
        strokeWidth={t.largura}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#giz)"
        className="tracar"
        style={{ stroke: cor, animationDelay: `${atraso}ms`, animationDuration: `${duracao}ms` }}
      />
    </svg>
  )
}

/**
 * Cena do login e da 404, na composição do site da empresa: diagonais opostas
 * (faixa rosa ↖ e faixa verde ↘; espiral amarela ↗ e espiral lilás ↙) com os raios
 * de sol girando devagar atrás da marca. Os rabiscos são desenhados em sequência
 * (~1,5 s) e depois só "respiram": espirais girando lento, faixas flutuando.
 * Com "reduzir movimento" tudo aparece pronto e parado.
 */
export function CenaRabiscos() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <FiltroGiz />
      {/* raios: só no centro, desaparecendo nas bordas */}
      <div className="absolute top-1/2 left-1/2 size-[1100px] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(circle,#000_0,#000_18%,transparent_58%)] animate-fade">
        <div className="sunburst size-full opacity-70 animate-spin-slow will-change-transform" />
      </div>

      <div className="absolute -top-4 -left-12 h-16 w-[min(62%,420px)] -rotate-3">
        <div className="size-full animate-flutua will-change-transform">
          <RabiscoTracado forma="faixa" cor="var(--color-giz-rosa)" atraso={100} duracao={800} className="size-full" />
        </div>
      </div>
      <div className="absolute -top-16 -right-20 size-[clamp(180px,24vw,300px)]">
        <div className="size-full animate-gira will-change-transform">
          <RabiscoTracado forma="espiral" cor="var(--color-giz-amarelo)" atraso={300} duracao={1200} className="size-full" />
        </div>
      </div>
      <div className="absolute -bottom-20 -left-20 size-[clamp(170px,22vw,280px)] max-sm:-bottom-24 max-sm:size-[150px]">
        <div className="size-full animate-gira-inverso will-change-transform">
          <RabiscoTracado forma="espiral" cor="var(--color-giz-lilas)" atraso={500} duracao={1200} className="size-full" />
        </div>
      </div>
      <div className="absolute -right-12 bottom-1 h-14 w-[min(62%,420px)] rotate-2 max-sm:-bottom-3 max-sm:h-10 max-sm:w-[48%]">
        <div className="size-full animate-flutua will-change-transform [animation-delay:-3.5s]">
          <RabiscoTracado forma="faixa" cor="var(--color-giz-verde)" atraso={700} duracao={800} className="size-full" />
        </div>
      </div>
    </div>
  )
}
