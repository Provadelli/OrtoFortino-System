import { useState, type CSSProperties } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Button, buttonClass } from '@/components/ui/Button'
import { BarraLista, useBuscaUrl, useFiltrosUrl } from '@/components/ui/Filtros'
import { FileIcon } from '@/components/ui/icons'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatIsoDate, todayIso } from '@/lib/br'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { PAGE_SIZE, useOrcamentos } from './api'
import { GRUPOS_FILTRO_ORCAMENTO, LEGADO_FILTRO_ORCAMENTO, STATUS_ORCAMENTO, vencido } from './constants'

export default function OrcamentosPage() {
  usePageTitle('Orçamentos')
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const filtros = useFiltrosUrl(GRUPOS_FILTRO_ORCAMENTO, LEGADO_FILTRO_ORCAMENTO)
  const { busca, texto, setTexto } = useBuscaUrl()
  const page = Math.max(0, Number(params.get('pagina') ?? '1') - 1)
  const [hoje] = useState(todayIso)

  const { data, isPending, isError, refetch, isFetching } = useOrcamentos(filtros.ativos, busca, page)
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
        <BarraLista
          nome="orçamentos"
          busca={{ texto, setTexto, placeholder: 'Buscar por paciente ou número' }}
          grupos={GRUPOS_FILTRO_ORCAMENTO}
          ativos={filtros.ativos}
          onAlternar={filtros.alternar}
          onLimpar={filtros.limpar}
        />

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
              {busca ? `Nenhum orçamento encontrado para “${busca}”` : filtros.ativos.length ? 'Nenhum orçamento com esses filtros' : 'Nenhum orçamento ainda'}
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
                  {data.rows.map((o, i) => {
                    const st = STATUS_ORCAMENTO[o.status]
                    return (
                      <tr key={o.id} style={{ '--i': Math.min(i, 12) } as CSSProperties} className="border-t border-line-soft transition-colors hover:bg-surface animate-fade stagger">
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
