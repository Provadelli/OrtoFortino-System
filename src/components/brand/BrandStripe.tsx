import { cn } from '@/lib/cn'

/** Faixa decorativa com as 4 cores da marca. */
export function BrandStripe({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('grid grid-cols-4 overflow-hidden', className)}>
      <div className="bg-brand-yellow" />
      <div className="bg-brand-orange" />
      <div className="bg-brand-pink" />
      <div className="bg-brand-mint" />
    </div>
  )
}
