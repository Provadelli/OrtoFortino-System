import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Mensagem de erro de campo (ligada via aria-describedby). */
export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null
  return (
    <p id={id} className="m-0 flex items-start gap-1.5 text-sm font-medium text-late-fg animate-fade">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
      </svg>
      {children}
    </p>
  )
}

const controlBase =
  'w-full rounded-field border-[1.5px] bg-white px-3.5 text-base text-ink transition-[border-color,box-shadow] duration-150'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: ReactNode }

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextareaField(
  { label, error, hint, id, className, rows = 3, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? auto
  const describedBy = [hint ? `${fid}-dica` : null, error ? `${fid}-erro` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fid} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fid}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(controlBase, 'min-h-[96px] resize-y py-3 leading-relaxed', error ? 'border-late-fg' : 'border-field hover:border-[#b5cbbf]', className)}
        {...rest}
      />
      {hint && (
        <p id={`${fid}-dica`} className="m-0 text-[13px] text-muted">
          {hint}
        </p>
      )}
      <FieldError id={`${fid}-erro`}>{error}</FieldError>
    </div>
  )
})

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; children: ReactNode }

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField({ label, error, id, className, children, ...rest }, ref) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fid} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-erro` : undefined}
        className={cn(controlBase, 'h-[50px] cursor-pointer appearance-none bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10 select-chevron', error ? 'border-late-fg' : 'border-field hover:border-[#b5cbbf]', className)}
        {...rest}
      >
        {children}
      </select>
      <FieldError id={`${fid}-erro`}>{error}</FieldError>
    </div>
  )
})

/** Grupo de opções acessível (fieldset + legend), visual de "segmentos". */
export function ChoiceGroup({ legend, children, error, hint }: { legend: string; children: ReactNode; error?: string; hint?: ReactNode }) {
  const id = useId()
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" aria-describedby={error ? `${id}-erro` : undefined}>
      <legend className="mb-2 p-0 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {hint && <p className="m-0 text-[13px] text-muted">{hint}</p>}
      <FieldError id={`${id}-erro`}>{error}</FieldError>
    </fieldset>
  )
}

type ChoiceProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; type?: 'radio' | 'checkbox' }

export const Choice = forwardRef<HTMLInputElement, ChoiceProps>(function Choice({ label, type = 'radio', className, ...rest }, ref) {
  return (
    <label
      className={cn(
        'relative flex min-h-11 cursor-pointer items-center gap-2.5 rounded-field border-[1.5px] border-field bg-white px-4 text-[15px] font-medium text-ink transition-colors',
        'hover:border-[#b5cbbf] has-[:checked]:border-primary has-[:checked]:bg-prod-bg has-[:checked]:text-prod-fg has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-mint',
        className,
      )}
    >
      <input ref={ref} type={type} className="m-0 size-[18px] cursor-pointer accent-primary focus-visible:outline-none" {...rest} />
      {label}
    </label>
  )
})

export function Section({ title, description, children, id }: { title: string; description?: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 rounded-card border border-line bg-white p-5 sm:p-6 animate-rise">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="m-0 text-[19px] font-semibold">
          {title}
        </h2>
        {description && <p className="m-0 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}
