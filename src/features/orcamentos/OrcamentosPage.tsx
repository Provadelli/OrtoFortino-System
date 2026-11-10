import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Button, buttonClass } from '@/components/ui/Button'
import { FileIcon, SearchIcon } from '@/components/ui/icons'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatIsoDate, todayIso } from '@/lib/br'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { PAGE_SIZE, useOrcamentos } from './api'
import { FILTROS_ORCAMENTO, STATUS_ORCAMENTO, vencido, type FiltroOrcamento } from './constants'

const isFiltro = (v: string | null): v is FiltroOrcamento => FILTROS_ORCAMENTO.some((f) => f.value === v)

export default function OrcamentosPage() {
  usePageTitle('Orçamentos')
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const filtroParam = params.get('filtro')
  const filtro: FiltroOrcamento = isFiltro(filtroParam) ? filtroParam : 'abertos'
  const busca = params.get('busca') ?? ''
  const page = Math.max(0, Number(params.get('pagina') ?? '1') - 1)
  const [texto, setTexto] = useState(busca)
  const [hoje] = useState(todayIso)

  useEffect(() => {
    const t = setTimeout(() => {
      if (texto.trim() === busca) return
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          if (texto.trim()) n.set('busca', texto.trim())
          else n.delete('busca')
          n.delete('pagina')
          return n
        },
        { replace: true },
      )
    }, 250)
    return () => clearTimeout(t)
  }, [texto, busca, setParams])

  const { data, isPending, isError, refetch, isFetching } = useOrcamentos(filtro, busca, page)
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const hrefFiltro = (f: FiltroOrcamento) => {
    const n = new URLSearchParams({ filtro: f })
    if (busca) n.set('busca', busca)
    return `?${n.toString()}`
  }
  const goPage = (n: number) =>
    setParams((p) => {
      const q = new URLSearchParams(p)
      if (n <= 0) q.delete('pagina')
      else q.set('pagina', String(n + 1))
      return q
    })

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[30px] leading-[1.2] font-bold">Orçamentos</h1>
          <p className="m-0 text-sm text-muted" aria-live="polite">
            {isPending ? 'Carregando…' : total === 1 ? '1 orçamento' : `${total} orçamentos`}
            {busca && !isPending ? ` para “${busca}”` : ''}
          </p>
        </div>
        <Link to="/orcamentos/novo" className={buttonClass('primary')}>
          + Novo orçamento
        </Link>
      </header>

      {notice && (
        <output className="block rounded-field border border-[#bfe6d2] bg-prod-bg px-4 py-3 text-[15px] font-medium text-prod-fg animate-fade">
          {notice}
        </output>
      )}

      <section aria-labelledby="titulo-lista" className="flex flex-col gap-4 rounded-card border border-line bg-white p-4 sm:p-6 animate-rise">
        <h2 id="titulo-lista" className="sr-only">
          Lista de orçamentos
        </h2>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Filtrar orçamentos" className="-mx-1 overflow-x-auto px-1">
            <ul className="m-0 flex w-max list-none gap-2 p-0">
              {FILTROS_ORCAMENTO.map((f) => (
                <li key={f.value}>
                  <Link
                    to={hrefFiltro(f.value)}
                    replace
                    aria-current={filtro === f.value ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-[15px] font-semibold no-underline transition-colors',
                      filtro === f.value ? 'border-primary bg-prod-bg text-prod-fg' : 'border-field-soft text-ink-soft hover:border-[#b5cbbf] hover:text-ink',
                    )}
                  >
                    {f.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <search className="w-full lg:max-w-[340px]">
            <form className="relative" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="busca-orcamentos" className="sr-only">
                Buscar por paciente ou número
              </label>
              <SearchIcon className="pointer-events-none absolute top-[15px] left-3.5 text-muted" />
              <input
                id="busca-orcamentos"
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por paciente ou número"
                autoComplete="off"
                className="h-12 w-full rounded-field border-[1.5px] border-field-soft bg-white pr-3.5 pl-[42px] text-[15px] text-ink transition-colors hover:border-[#b5cbbf]"
              />
            </form>
          </search>
        </div>

        {isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-field bg-late-bg px-4 py-3 text-late-fg">
            Não foi possível carregar os orçamentos.
            <Button variant="outline" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : isPending ? (
          <div aria-hidden="true" className="flex flex-col">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 border-t border-line-soft py-4">
                <div className="h-4 w-32 animate-pulse rounded bg-line" />
                <div className="h-4 w-48 animate-pulse rounded bg-line" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-line" />
              </div>
            ))}
          </div>
        ) : data.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center animate-fade">
            <div aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-prod-bg text-prod-fg">
              <FileIcon width={26} height={26} />
            </div>
            <p className="m-0 text-lg font-semibold">
              {busca ? `Nenhum orçamento encontrado para “${busca}”` : filtro === 'abertos' ? 'Nenhum orçamento em aberto' : 'Nenhum orçamento aqui'}
            </p>
            <p className="m-0 max-w-sm text-muted">Monte um orçamento com o paciente cadastrado e os produtos da tabela de preços.</p>
            <Link to="/orcamentos/novo" className={buttonClass('primary', 'md', 'mt-2')}>
              + Novo orçamento
            </Link>
          </div>
        ) : (
          <>
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <section className={cn('overflow-x-auto overscroll-x-contain transition-opacity', isFetching && 'opacity-60')} aria-label="Tabela de orçamentos (role para os lados)" tabIndex={0}>
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <caption className="sr-only">Orçamentos com paciente, emissão, validade, total e situação</caption>
                <thead>
                  <tr className="text-left text-[13px] text-muted">
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Número</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Paciente</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Emissão</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Validade</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Total</th>
                    <th scope="col" className="py-2.5 pl-3 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((o) => {
                    const st = STATUS_ORCAMENTO[o.status]
                    return (
                      <tr key={o.id} className="border-t border-line-soft transition-colors hover:bg-surface">
                        <th scope="row" className="py-3 pr-3 text-left font-normal whitespace-nowrap">
                          <Link to={`/orcamentos/${o.id}`} className="text-[15px] font-semibold text-ink no-underline tabular-nums hover:text-primary-ink hover:underline">
                            {o.numero}
                          </Link>
                        </th>
                        <td className="p-3">{o.pacientes.nome}</td>
                        <td className="p-3 whitespace-nowrap tabular-nums">{formatIsoDate(o.data_emissao)}</td>
                        <td className="p-3 whitespace-nowrap tabular-nums">{formatIsoDate(o.validade)}</td>
                        <td className="p-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatBRL(o.total)}</td>
                        <td className="py-3 pl-3">
                          <span className="flex flex-wrap gap-1.5">
                            <StatusChip tone={st.tone}>{st.label}</StatusChip>
                            {vencido(o.status, o.validade, hoje) && <StatusChip tone="late">Vencido</StatusChip>}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>

            {pages > 1 && (
              <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                <span className="text-sm text-muted">
                  Página {page + 1} de {pages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={page === 0} onClick={() => goPage(page - 1)}>
                    Anterior
                  </Button>
                  <Button variant="outline" disabled={page + 1 >= pages} onClick={() => goPage(page + 1)}>
                    Próxima
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>
    </>
  )
}
