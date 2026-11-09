import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'outline' | 'ghost'
type Size = 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-[0_1px_0_rgb(0_0_0/0.04)]',
  outline: 'border-[1.5px] border-primary bg-white text-primary-ink hover:bg-prod-bg',
  ghost: 'bg-transparent text-primary-ink hover:bg-surface-hover',
}
const sizes: Record<Size, string> = {
  md: 'h-12 px-[18px] text-[15px]',
  lg: 'h-[54px] px-6 text-[17px]',
}

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-field font-display font-semibold whitespace-nowrap',
    'cursor-pointer transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-70 aria-busy:cursor-progress',
    variants[variant],
    sizes[size],
    className,
  )

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }

export function Button({ variant, size, loading, className, children, type = 'button', disabled, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner() {
  return (
    <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
