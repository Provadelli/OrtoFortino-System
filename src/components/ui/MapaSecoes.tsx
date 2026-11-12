import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

export type EstadoSecao = 'ok' | 'erro' | 'pendente'
export type ItemSecao = { id: string; titulo: string; estado: EstadoSecao }

const texto: Record<EstadoSecao, string> = { ok: 'preenchida', erro: 'com erro', pendente: 'a preencher' }

/**
 * Mapa das seções de um formulário longo: barra fixa no topo com a seção atual destacada,
 * bolinha cheia quando a seção está completa e rosa quando tem erro. Clicar rola até ela.
 */
export function MapaSecoes({ itens }: { itens: ItemSecao[] }) {
  const [atual, setAtual] = useState(itens[0]?.id)
  const ids = itens.map((i) => i.id).join(',')

  useEffect(() => {
    const alvos = ids
      .split(',')
      .map((id) => document.getElementById(id)?.closest('section'))
      .filter((s): s is HTMLElement => !!s)
    if (!alvos.length || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        const id = visivel?.target.getAttribute('aria-labelledby')
        if (id) setAtual(id)
      },
      { rootMargin: '-90px 0px -55% 0px' },
    )
    alvos.forEach((a) => obs.observe(a))
    return () => obs.disconnect()
  }, [ids])

  return (
    <nav aria-label="Seções do formulário" className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-surface/90 px-1 py-2 backdrop-blur-sm">
      <ol className="m-0 flex w-max list-none gap-1 p-0">
        {itens.map((s, i) => {
          const corrente = s.id === atual
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={corrente ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(s.id)?.closest('section')?.scrollIntoView({ block: 'start' })
                  setAtual(s.id)
                }}
                className={cn(
                  'flex min-h-10 items-center gap-2 rounded-full px-3 text-[13px] font-semibold no-underline transition-[background-color,color] duration-300',
                  corrente ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:bg-white/70 hover:text-ink',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-[18px] items-center justify-center rounded-full border-2 text-[10px] transition-[background-color,border-color] duration-300',
                    s.estado === 'ok' && 'border-primary bg-primary text-white',
                    s.estado === 'erro' && 'border-late-fg bg-late-fg text-white',
                    s.estado === 'pendente' && 'border-field-hover bg-white text-muted',
                  )}
                >
                  {s.estado === 'ok' ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-pop">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  ) : s.estado === 'erro' ? (
                    '!'
                  ) : (
                    i + 1
                  )}
                </span>
                {s.titulo}
                <span className="sr-only"> ({texto[s.estado]})</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
