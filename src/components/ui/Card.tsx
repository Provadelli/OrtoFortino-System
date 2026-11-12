import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('flex min-w-0 flex-col rounded-card border border-line bg-white p-6 animate-rise stagger', className)}
      {...rest}
    >
      {children}
    </section>
  )
}

export function CardHeader({ title, id, action }: { title: string; id: string; action?: { to: string; label: string; srLabel: string } | ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="m-0 min-w-0 text-[19px] font-semibold">
        {title}
      </h2>
      {action && typeof action === 'object' && 'to' in action ? (
        <Link
          to={action.to}
          className="-my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-1 text-sm font-semibold whitespace-nowrap text-primary-ink no-underline hover:underline"
        >
          {action.label}
          <span className="sr-only"> {action.srLabel}</span>
        </Link>
      ) : (
        action
      )}
    </div>
  )
}
