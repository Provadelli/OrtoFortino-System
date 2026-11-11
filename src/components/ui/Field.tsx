import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { EyeIcon, EyeOffIcon } from './icons'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: ReactNode
  trailing?: ReactNode
  /** Texto fixo antes do valor (ex.: "R$"). Visual: o rótulo já diz a unidade para leitores de tela. */
  prefix?: string
  /** Texto fixo depois do valor (ex.: "%", "dias"). */
  suffix?: string
  /** Ações rápidas abaixo do campo (ex.: "Hoje", "+15 dias"). */
  actions?: ReactNode
}

export const inputClass = (invalid?: boolean, className?: string) =>
  cn(
    'h-[50px] w-full rounded-field border-[1.5px] bg-white px-3.5 text-base text-ink',
    'transition-[border-color,box-shadow] duration-150',
    invalid ? 'border-late-fg' : 'border-field hover:border-[#b5cbbf]',
    className,
  )

/** Campo com rótulo, dica e erro ligados por aria-describedby (WCAG 1.3.1, 3.3.1). */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, trailing, prefix, suffix, actions, id, className, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-erro`
  const hintId = `${inputId}-dica`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClass(!!error, cn(trailing ? 'pr-[52px]' : undefined, prefix && 'pl-11', suffix && 'pr-14', className))}
          {...rest}
        />
        {prefix && (
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] font-medium text-muted">
            {prefix}
          </span>
        )}
        {suffix && (
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[15px] font-medium text-muted">
            {suffix}
          </span>
        )}
        {trailing}
      </div>
      {actions && <div className="-mt-0.5 flex flex-wrap gap-1.5">{actions}</div>}
      {hint && (
        <p id={hintId} className="m-0 text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="m-0 flex items-start gap-1.5 text-sm font-medium text-late-fg animate-fade">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
})

type PasswordFieldProps = Omit<FieldProps, 'type' | 'trailing'>

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <Field
      ref={ref}
      type={visible ? 'text' : 'password'}
      spellCheck={false}
      autoCapitalize="none"
      {...props}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="absolute top-[3px] right-[3px] flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-surface-hover hover:text-ink"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  )
})
