import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { ABAS, pontosDaColuna, useRecebimentos, type Aba } from './dados-recebimentos'

const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4)
const reduzMovimento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Número que corre até o valor final (sem animação para quem prefere menos movimento). */
function useContador(alvo: number, ms = 900) {
  const [valor, setValor] = useState(0)
  const atual = useRef(0)
  useEffect(() => {
    const inicio = atual.current
    const t0 = performance.now()
    let raf = 0
    const passo = (agora: number) => {
      const p = reduzMovimento() ? 1 : Math.min(1, (agora - t0) / ms)
      atual.current = inicio + (alvo - inicio) * easeOutQuart(p)
      setValor(atual.current)
      if (p < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [alvo, ms])
  return valor
}

/**
 * Recebimentos no Painel: total do período, variação contra o período anterior e
 * colunas de pontos por dia/mês (cinza = período anterior, verde = atual).
 */
export function Recebimentos({ style, className }: { style?: CSSProperties; className?: string }) {
  const [aba, setAba] = useState<Aba>('30d')
  const { data, isPending, isError, isPlaceholderData } = useRecebimentos(aba)
  const base = useId()
  const [sobre, setSobre] = useState<number | null>(null)
  const total = useContador(data?.totalAtual ?? 0)
  // Enquanto o novo período carrega, os textos seguem o gráfico que está na tela.
  const abaDados = data?.aba ?? aba
  const info = ABAS.find((a) => a.id === abaDados)!
  const indice = ABAS.findIndex((a) => a.id === aba)

  const maior = Math.max(0, ...(data?.colunas.map((c) => c.valor) ?? [0]))
  const metade = (data?.colunas.length ?? 0) / 2
  const dica = sobre !== null ? data?.colunas[sobre] : null

  function teclas(e: KeyboardEvent<HTMLButtonElement>) {
    const i = ABAS.findIndex((a) => a.id === aba)
    const prox = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? ABAS.length - 1 : null
    if (prox === null) return
    e.preventDefault()
    const nova = ABAS[(prox + ABAS.length) % ABAS.length]!
    setAba(nova.id)
    document.getElementById(`${base}-aba-${nova.id}`)?.focus()
  }

  return (
    <Card aria-labelledby={`${base}-titulo`} className={cn('gap-0 p-0', className)} style={style}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 id={`${base}-titulo`} className="m-0 text-xs font-semibold tracking-[0.06em] text-muted uppercase">
            Recebido
          </h2>
          <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
            <span className="font-display text-[32px] leading-none font-bold tracking-tight tabular-nums">{formatBRL(total)}</span>
            {data && (
              <span
                key={data.aba}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[13px] font-semibold animate-fade',
                  data.variacao === null ? 'bg-surface text-muted' : data.variacao >= 0 ? 'bg-prod-bg text-prod-fg' : 'bg-late-bg text-late-fg',
                )}
              >
                {data.variacao === null ? 'sem base anterior' : `${data.variacao >= 0 ? '+' : '−'}${Math.abs(data.variacao)}%`}
                <span className="sr-only"> em relação aos {info.anterior}</span>
              </span>
            )}
          </p>
        </div>
        <div role="tablist" aria-label="Período" className="relative grid grid-cols-3 rounded-full bg-surface p-1">
          {/* pílula que desliza até a aba escolhida */}
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-white shadow-sm transition-transform duration-500 ease-[var(--ease-out-soft)]"
            style={{ transform: `translateX(${indice * 100}%)` }}
          />
          {ABAS.map((a) => (
            <button
              key={a.id}
              id={`${base}-aba-${a.id}`}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              aria-controls={`${base}-painel`}
              tabIndex={aba === a.id ? 0 : -1}
              onClick={() => setAba(a.id)}
              onKeyDown={teclas}
              className={cn(
                'relative min-h-9 cursor-pointer rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition-colors duration-300',
                aba === a.id ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div id={`${base}-painel`} role="tabpanel" aria-labelledby={`${base}-aba-${aba}`} className="relative flex flex-1 flex-col justify-end border-t border-line-soft px-5 pt-8 pb-5 sm:px-6">
        {isError ? (
          <p className="m-0 text-sm text-late-fg">Não foi possível carregar os recebimentos.</p>
        ) : isPending && !data ? (
          <div aria-hidden="true" className="h-[120px] animate-pulse rounded-field bg-surface" />
        ) : !data ? null : (
          <div className={cn('transition-[opacity,filter] duration-300', isPlaceholderData && 'opacity-45 saturate-50')} aria-busy={isPlaceholderData || undefined}>
            {dica && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-md"
                style={{ left: `calc(24px + (100% - 48px) * ${(sobre! + 0.5) / data.colunas.length})` }}
              >
                {dica.rotulo} <span className="text-white/70">{formatBRL(dica.valor)}</span>
              </div>
            )}
            <div
              key={`grafico-${abaDados}`}
              aria-hidden="true"
              className="group/grafico flex h-[120px] items-end gap-px animate-fade sm:gap-[3px]"
              onMouseLeave={() => setSobre(null)}
            >
              {data.colunas.map((c, i) => {
                const n = pontosDaColuna(c.valor, maior)
                return (
                  <div
                    key={c.chave}
                    onMouseEnter={() => setSobre(i)}
                    className={cn(
                      'flex h-full min-w-0 flex-1 cursor-crosshair flex-col-reverse items-center gap-[3px] sm:gap-[4px] transition-opacity duration-300',
                      sobre !== null && sobre !== i && 'opacity-25',
                    )}
                  >
                    {n === 0 ? (
                      <span className="size-1 rounded-full bg-line" />
                    ) : (
                      Array.from({ length: n }, (_, k) => (
                        <span
                          key={k}
                          className={cn(
                            'size-[3px] shrink-0 rounded-full animate-dot transition-transform duration-300 sm:size-[5px]',
                            c.periodo === 'atual' ? 'bg-primary' : 'bg-[#c4d2cb]',
                            sobre === i && 'scale-150',
                          )}
                          // onda da esquerda para a direita em ~0,5 s, qualquer que seja o período
                          style={{ animationDelay: `${Math.round((i / data.colunas.length) * 340 + k * 14)}ms` }}
                        />
                      ))
                    )}
                  </div>
                )
              })}
            </div>
            <div key={`rodape-${abaDados}`} aria-hidden="true" className="mt-4 flex gap-2 text-xs font-semibold animate-fade max-sm:flex-col">
              <span className="text-muted sm:w-1/2">
                {info.anterior} · {formatBRL(data.totalAnterior)}
              </span>
              <span className="text-ink sm:w-1/2">
                {info.atual} · {formatBRL(data.totalAtual)}
              </span>
            </div>
            <table className="sr-only">
              <caption>
                Recebido por {abaDados === '12m' ? 'mês' : 'dia'}: {info.atual} e {info.anterior}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{abaDados === '12m' ? 'Mês' : 'Dia'}</th>
                  <th scope="col">Valor recebido</th>
                </tr>
              </thead>
              <tbody>
                {data.colunas.slice(metade).map((c) => (
                  <tr key={c.chave}>
                    <th scope="row">{c.rotulo}</th>
                    <td>{formatBRL(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0 mt-3 text-xs text-muted">Pelo valor pago e a data do pagamento registrados em cada atendimento.</p>
          </div>
        )}
      </div>
    </Card>
  )
}
