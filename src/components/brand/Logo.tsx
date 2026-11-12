import logoCompleta from '@/assets/logo-orto-fortino.svg'
import logoCompacta from '@/assets/logo-orto-fortino-sem-slogan.svg'
import { cn } from '@/lib/cn'

type LogoProps = {
  /** `completa`: com "Órteses Funcionais". `compacta`: sem o slogan (tamanhos pequenos). `responsiva`: compacta no celular, completa a partir do desktop. */
  variant?: 'completa' | 'compacta' | 'responsiva'
  className?: string
  /** Logo da primeira dobra (login): baixa com prioridade alta. */
  prioridade?: boolean
}

/**
 * Logo oficial da Orto Fortino em vetor (SVG), redesenhada a partir da arte da empresa:
 * nítida em qualquer tamanho e tela. Arquivos de marca para uso externo em docs/marca/.
 */
export function Logo({ variant = 'completa', className, prioridade }: LogoProps) {
  const completa = variant === 'completa'
  const img = (
    <img
      src={completa ? logoCompleta : logoCompacta}
      alt={completa ? 'Orto Fortino — Órteses Funcionais' : 'Orto Fortino'}
      width={completa ? 2355 : 2340}
      height={completa ? 1221 : 1030}
      className={cn('block h-auto max-w-full select-none', className)}
      draggable={false}
      fetchPriority={prioridade ? 'high' : undefined}
      decoding={prioridade ? 'sync' : 'async'}
    />
  )
  if (variant !== 'responsiva') return img
  return (
    <picture>
      <source media="(min-width: 1024px)" srcSet={logoCompleta} width={2355} height={1221} />
      {img}
    </picture>
  )
}
