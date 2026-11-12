import { cn } from '@/lib/cn'

export type Etapa = { label: string; detalhe?: string | null }

type Props = {
  etapas: Etapa[]
  /** Índice da etapa atual (0…n-1). */
  atual: number
  /** Quando a última etapa é a atual, ela conta como concluída (ex.: "Entregue"). */
  finalConcluida?: boolean
  cancelado?: boolean
  /** Título para leitor de tela; sem ele, a linha é só visual (aria-hidden), ex.: prévia no formulário. */
  titulo?: string
  className?: string
}

/**
 * Linha de etapas: círculos ligados por um trilho que se preenche até a etapa atual.
 * O trilho cresce ao carregar e desliza quando a etapa muda (sem animação com "reduzir movimento").
 */
export function Etapas({ etapas, atual, finalConcluida = true, cancelado = false, titulo, className }: Props) {
  const n = etapas.length
  const ultima = n - 1
  const feitas = atual === ultima && finalConcluida ? n : atual
  // Fração do trilho preenchida, entre o centro da 1ª e o da última coluna.
  const fracao = cancelado ? 0 : Math.min(1, Math.max(0, atual) / Math.max(1, ultima))
  const margem = `${50 / n}%`

  return (
    <div className={cn("relative", className)} aria-hidden={titulo ? undefined : true}>
      {titulo && <h2 className="sr-only">{titulo}</h2>}
      <div aria-hidden="true" className="absolute top-[15px] h-[3px] rounded-full bg-line" style={{ left: margem, right: margem }} />
      <div aria-hidden="true" className="absolute top-[15px] h-[3px] transition-[width] duration-500 ease-[var(--ease-out-soft)]" style={{ left: margem, width: `calc((100% - 2 * ${margem}) * ${fracao})` }}>
        <div className="h-full origin-left rounded-full bg-primary animate-grow-x" />
      </div>
      <ol className="relative m-0 grid list-none p-0" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {etapas.map((e, i) => {
          const feita = !cancelado && i < feitas
          const corrente = !cancelado && i === atual && !feita
          const estado = feita ? 'concluída' : corrente ? 'etapa atual' : 'pendente'
          return (
            <li key={e.label} aria-current={corrente ? 'step' : undefined} className="flex flex-col items-center gap-2 px-1 text-center">
              <span
                aria-hidden="true"
                style={{ animationDelay: feita ? `${i * 120}ms` : undefined }}
                className={cn(
                  'relative flex size-[33px] items-center justify-center rounded-full border-2 text-sm font-bold transition-colors duration-300',
                  feita && 'border-primary bg-primary text-white animate-pop',
                  corrente && 'border-primary bg-white text-primary-ink animate-ring',
                  !feita && !corrente && 'border-line bg-white text-muted',
                )}
              >
                {feita ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={cn('text-[13px] leading-tight font-semibold sm:text-sm', feita || corrente ? 'text-ink' : 'text-muted')}>
                {e.label}
                <span className="sr-only"> ({estado})</span>
              </span>
              {e.detalhe && <span className="text-xs leading-tight text-muted tabular-nums">{e.detalhe}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
