import { useId } from 'react'
import { cn } from '@/lib/cn'

type LogoProps = { size?: 'lg' | 'sm'; withTagline?: boolean; className?: string }

/**
 * Logo tipográfica da Orto Fortino (O·R·T·o / Fortin), reproduzindo o canvas.
 * Feita em SVG com role="img": é um logotipo (isento de contraste — WCAG 1.4.3)
 * e assim o axe/Lighthouse a tratam como imagem, não como texto corrido.
 * Medidas tiradas dos glifos reais da Poppins a 104px (1 unidade = 1px no tamanho grande).
 */
export function Logo({ size = 'lg', withTagline = false, className }: LogoProps) {
  const titleId = useId()
  const lg = size === 'lg'
  return (
    <div className={cn('flex flex-col items-start select-none', className)}>
      {/* role="img" em <svg> é o padrão WAI para gráficos com nome acessível (falso positivo da regra). */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox="0 0 304 192"
        className={cn('h-auto overflow-visible', lg ? 'w-[clamp(200px,24vw,304px)]' : 'w-[100px]')}
        fontFamily="Poppins, 'Poppins Fallback', system-ui, sans-serif"
      >
        <title id={titleId}>{withTagline ? 'Orto Fortino — Órteses Funcionais' : 'Orto Fortino'}</title>
        <g fontSize="104" fontWeight="900">
          <text x="0" y="88" fill="#FFD400">O</text>
          <text x="80" y="88" fill="#F7941D">R</text>
          <text x="147.6" y="88" fill="#E6007E">T</text>
        </g>
        <ellipse cx="259.6" cy="51.7" rx="43.9" ry="51.7" fill="#8FD5B4" />
        <text x="259.6" y="83.7" fontSize="91.5" fontWeight="800" fontStyle="italic" fill="#FFFFFF" textAnchor="middle">
          o
        </text>
        <text x="0" y="177" fontSize="96" fontWeight="800" letterSpacing="-1" fill="#8FD5B4">
          Fortin
        </text>
      </svg>
      {withTagline && (
        <p aria-hidden="true" className="mt-3.5 mb-0 text-[clamp(14px,1.3vw,17px)] tracking-[0.38em] text-ink">
          Órteses Funcionais
        </p>
      )}
    </div>
  )
}
