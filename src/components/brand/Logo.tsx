import { cn } from '@/lib/cn'

type LogoProps = { size?: 'lg' | 'sm'; withTagline?: boolean; className?: string }

/**
 * Logo tipográfica da Orto Fortino (O·R·T·o / Fortin), como no canvas.
 * Exposta como uma única imagem acessível; as letras são apresentacionais.
 */
export function Logo({ size = 'lg', withTagline = false, className }: LogoProps) {
  const lg = size === 'lg'
  return (
    <div className={cn('flex flex-col items-start select-none', className)}>
      <span className="sr-only">Orto Fortino — Órteses Funcionais</span>
      <div aria-hidden="true" className="contents">
      <div
        className={cn(
          'flex items-center font-display font-black',
          lg ? 'text-[clamp(64px,9vw,104px)] leading-[0.9] tracking-[-2px]' : 'text-[34px] leading-[0.95]',
        )}
      >
        <span className="text-brand-yellow">O</span>
        <span className="text-brand-orange">R</span>
        <span className="text-brand-pink">T</span>
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-brand-mint text-white italic font-extrabold leading-none',
            lg ? 'ml-1.5 h-[1.13em] w-[0.96em] text-[0.88em]' : 'ml-0.5 h-[38px] w-8 text-[30px]',
          )}
        >
          o
        </span>
      </div>
      <div
        className={cn(
          'font-display font-extrabold leading-none text-brand-mint',
          lg ? '-mt-2 text-[clamp(60px,8.3vw,96px)] tracking-[-1px]' : 'text-[30px]',
        )}
      >
        Fortin
      </div>
      {withTagline && (
        <div className="mt-3.5 text-[clamp(14px,1.3vw,17px)] tracking-[0.38em] text-ink">Órteses Funcionais</div>
      )}
      </div>
    </div>
  )
}
