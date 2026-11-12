import type { CSSProperties } from 'react'
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

/** Cena do site da empresa: faixa rosa no alto, espiral amarela, espiral lilás e faixa verde embaixo. */
export function CenaRabiscos() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <Rabisco forma="faixa" className="absolute -top-3 -left-10 h-16 w-[min(70%,460px)] -rotate-2 bg-giz-rosa animate-fade stagger [--i:1]" />
      <Rabisco forma="espiral" className="absolute -top-8 -right-16 size-[clamp(170px,22vw,290px)] bg-giz-amarelo animate-fade stagger [--i:2]" />
      <Rabisco forma="espiral" className="absolute -bottom-14 -left-20 size-[clamp(160px,20vw,260px)] rotate-45 bg-giz-lilas animate-fade stagger [--i:3]" />
      <Rabisco forma="faixa" className="absolute right-[-30px] bottom-2 h-14 w-[min(60%,420px)] rotate-1 bg-giz-verde animate-fade stagger [--i:4]" />
      <Rabisco forma="estrela" className="absolute top-[22%] left-[12%] size-7 rotate-12 bg-giz-laranja animate-fade stagger [--i:5] max-sm:hidden" />
    </div>
  )
}
