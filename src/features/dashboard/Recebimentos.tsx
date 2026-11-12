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
export function Recebimentos({ style }: { style?: CSSProperties }) {
  const [aba, setAba] = useState<Aba>('30d')
  const { data, isPending, isError, isPlaceholderData } = useRecebimentos(aba)
  const base = useId()
  const [sobre, setSobre] = useState<number | null>(null)
  // Pontos sobem em onda só na primeira exibição; nas trocas de período o gráfico só faz um fade.
  const [primeira, setPrimeira] = useState(true)
  const indice = ABAS.findIndex((a) => a.id === aba)
  function trocar(nova: Aba) {
    if (nova === aba) return
    setPrimeira(false)
    setSobre(null)
    setAba(nova)
  }
  const total = useContador(data?.totalAtual ?? 0)
  const info = ABAS.find((a) => a.id === (data?.aba ?? aba))!

  const maior = Math.max(0, ...(data?.colunas.map((c) => c.valor) ?? [0]))
  const metade = (data?.colunas.length ?? 0) / 2
  const dica = sobre !== null ? data?.colunas[sobre] : null

  function teclas(e: KeyboardEvent<HTMLButtonElement>) {
    const i = ABAS.findIndex((a) => a.id === aba)
    const prox = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? ABAS.length - 1 : null
    if (prox === null) return
    e.preventDefault()
    const nova = ABAS[(prox + ABAS.length) % ABAS.length]!
    trocar(nova.id)
    document.getElementById(`${base}-aba-${nova.id}`)?.focus()
  }

  return (
    <Card aria-labelledby={`${base}-titulo`} className="hover-suave gap-0 p-0" style={style}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 id={`${base}-titulo`} className="m-0 text-xs font-semibold tracking-[0.06em] text-muted uppercase">
            Recebido
          </h2>
          <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
            <span className="font-display text-[32px] leading-none font-bold tracking-tight tabular-nums">{formatBRL(total)}</span>
            {data && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[13px] font-semibold',
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
          {/* pílula branca que desliza até o período escolhido */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-white shadow-sm transition-transform duration-[450ms] ease-[var(--ease-out-soft)]"
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
              onClick={() => trocar(a.id)}
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

      <div id={`${base}-painel`} role="tabpanel" aria-labelledby={`${base}-aba-${aba}`} className="relative border-t border-line-soft px-5 pt-8 pb-5 sm:px-6">
        {isError ? (
          <p className="m-0 text-sm text-late-fg">Não foi possível carregar os recebimentos.</p>
        ) : isPending || !data ? (
          <div aria-hidden="true" className="h-[120px] animate-pulse rounded-field bg-surface" />
        ) : (
          <>
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
              key={data.aba}
              aria-hidden="true"
              className={cn(
                'group/grafico flex h-[120px] items-end gap-px transition-opacity duration-300 sm:gap-[3px]',
                !primeira && 'animate-fade',
                isPlaceholderData && 'opacity-50',
              )}
              onMouseLeave={() => setSobre(null)}
            >
              {data.colunas.map((c, i) => {
                const n = pontosDaColuna(c.valor, maior)
                return (
                  <div
                    key={c.chave}
                    onMouseEnter={() => setSobre(i)}
                    className={cn(
                      'flex h-full min-w-0 flex-1 cursor-crosshair flex-col-reverse items-center gap-[3px] transition-opacity duration-300 sm:gap-[4px]',
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
                            'size-[3px] shrink-0 rounded-full transition-[scale] duration-300 sm:size-[5px]',
                            primeira && 'animate-dot',
                            c.periodo === 'atual' ? 'bg-primary' : 'bg-[#c4d2cb]',
                            sobre === i && 'scale-150',
                          )}
                          style={{ animationDelay: `${i * 14 + k * 30}ms` }}
                        />
                      ))
                    )}
                  </div>
                )
              })}
            </div>
            <div aria-hidden="true" className="mt-4 flex gap-1 text-xs font-semibold max-sm:flex-col">
              <span className="text-muted sm:w-1/2">
                {info.anterior} · {formatBRL(data.totalAnterior)}
              </span>
              <span className="text-ink sm:w-1/2">
                {info.atual} · {formatBRL(data.totalAtual)}
              </span>
            </div>
            {/* Tabela para leitores de tela. Fica dentro de um div sr-only: uma <table> não respeita
                a altura de 1 px e esticava a página com uma linha por dia. */}
            <div className="sr-only">
              <table>
                <caption>
                  Recebido por {data.aba === '12m' ? 'mês' : 'dia'}: {info.atual} e {info.anterior}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{data.aba === '12m' ? 'Mês' : 'Dia'}</th>
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
            </div>
            <p className="m-0 mt-3 text-xs text-muted">Pelo valor pago e a data do pagamento registrados em cada atendimento.</p>
          </>
        )}
      </div>
    </Card>
  )
}
