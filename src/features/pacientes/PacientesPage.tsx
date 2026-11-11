import type { CSSProperties } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Button, buttonClass } from '@/components/ui/Button'
import { BarraLista, useBuscaUrl, useFiltrosUrl, type GrupoFiltro } from '@/components/ui/Filtros'
import { UsersIcon } from '@/components/ui/icons'
import { StatusChip, type Tone } from '@/components/ui/StatusChip'
import { ageFrom, formatAge, formatPhone } from '@/lib/br'
import { cn } from '@/lib/cn'
import { usePageTitle } from '@/lib/usePageTitle'
import { PAGE_SIZE, usePacientes } from './api'
import { origemLabel } from './schema'

const origemTone: Record<string, Tone> = { clinica: 'info', plano: 'prod', particular: 'draft' }

const GRUPOS: GrupoFiltro[] = [
  {
    id: 'origem',
    titulo: 'Origem',
    opcoes: (['clinica', 'plano', 'particular'] as const).map((o) => ({ valor: `origem_${o}`, rotulo: origemLabel(o), tom: origemTone[o] })),
  },
  {
    id: 'idade',
    titulo: 'Idade',
    opcoes: [
      { valor: 'idade_menor', rotulo: 'Menores de 18', tom: 'ready' },
      { valor: 'idade_adulto', rotulo: 'Adultos', tom: 'draft' },
      { valor: 'idade_sem_data', rotulo: 'Sem data de nascimento', tom: 'today' },
    ],
  },
]

export default function PacientesPage() {
  usePageTitle('Clientes')
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const page = Math.max(0, Number(params.get('pagina') ?? '1') - 1)
  const filtros = useFiltrosUrl(GRUPOS)
  const { busca, texto, setTexto } = useBuscaUrl()

  const { data, isPending, isError, refetch, isFetching } = usePacientes(busca, page, filtros.ativos)
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
          <h1 className="m-0 text-[30px] leading-[1.2] font-bold">Clientes</h1>
          <p className="m-0 text-sm text-muted" aria-live="polite">
            {isPending ? 'Carregando…' : total === 1 ? '1 paciente' : `${total} pacientes`}
            {busca && !isPending ? ` para “${busca}”` : ''}
          </p>
        </div>
        <Link to="/clientes/novo" className={buttonClass('primary')}>
          + Novo paciente
        </Link>
      </header>

      {notice && (
        <output className="block rounded-field border border-[#bfe6d2] bg-prod-bg px-4 py-3 text-[15px] font-medium text-prod-fg animate-fade">
          {notice}
        </output>
      )}

      <section aria-labelledby="titulo-lista" className="flex flex-col gap-4 rounded-card border border-line bg-white p-4 sm:p-6 animate-rise">
        <h2 id="titulo-lista" className="sr-only">
          Lista de pacientes
        </h2>
        <BarraLista
          nome="clientes"
          busca={{ texto, setTexto, placeholder: 'Buscar por nome ou CPF' }}
          grupos={GRUPOS}
          ativos={filtros.ativos}
          onAlternar={filtros.alternar}
          onLimpar={filtros.limpar}
        />

        {isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-field bg-late-bg px-4 py-3 text-late-fg">
            Não foi possível carregar os pacientes.
            <Button variant="outline" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : isPending ? (
          <ListSkeleton />
        ) : data.rows.length === 0 ? (
          <EmptyState busca={busca} filtrado={filtros.ativos.length > 0} />
        ) : (
          <>
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <section className={cn('overflow-x-auto overscroll-x-contain transition-opacity', isFetching && 'opacity-60')} aria-label="Tabela de pacientes (role para os lados)" tabIndex={0}>
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <caption className="sr-only">Pacientes cadastrados, com idade, origem, cidade, telefone e CPF mascarado</caption>
                <thead>
                  <tr className="text-left text-[13px] text-muted">
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Paciente</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Idade</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Origem</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Cidade</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Telefone</th>
                    <th scope="col" className="py-2.5 pl-3 font-semibold">CPF</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((p, i) => (
                    <tr key={p.id} style={{ '--i': Math.min(i, 12) } as CSSProperties} className="border-t border-line-soft transition-colors hover:bg-surface animate-fade stagger">
                      <th scope="row" className="py-3 pr-3 text-left font-normal">
                        <Link to={`/clientes/${p.id}`} className="text-[15px] font-semibold text-ink no-underline hover:text-primary-ink hover:underline">
                          {p.nome}
                        </Link>
                        {p.responsavel && <span className="block text-[13px] text-muted">Resp.: {p.responsavel}</span>}
                      </th>
                      <td className="p-3 whitespace-nowrap tabular-nums">{formatAge(ageFrom(p.data_nascimento))}</td>
                      <td className="p-3">
                        <StatusChip tone={origemTone[p.origem] ?? 'draft'}>{origemLabel(p.origem)}</StatusChip>
                        {p.origem_nome && <span className="mt-1 block text-[13px] text-muted">{p.origem_nome}</span>}
                      </td>
                      <td className="p-3 text-ink-soft">{p.cidade ? `${p.cidade}${p.uf ? `/${p.uf}` : ''}` : '—'}</td>
                      <td className="p-3 whitespace-nowrap tabular-nums">{p.telefone ? formatPhone(p.telefone) : '—'}</td>
                      <td className="py-3 pl-3 whitespace-nowrap text-muted tabular-nums">{p.cpf_mascarado ?? '—'}</td>
                    </tr>
                  ))}
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

function EmptyState({ busca, filtrado }: { busca: string; filtrado: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center animate-fade">
      <div aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-prod-bg text-prod-fg">
        <UsersIcon width={26} height={26} />
      </div>
      {busca ? (
        <>
          <p className="m-0 text-lg font-semibold">Nenhum paciente encontrado para “{busca}”</p>
          <p className="m-0 max-w-sm text-muted">Confira a grafia ou busque pelo CPF. Se for um paciente novo, cadastre agora.</p>
        </>
      ) : filtrado ? (
        <>
          <p className="m-0 text-lg font-semibold">Nenhum paciente com esses filtros</p>
          <p className="m-0 max-w-sm text-muted">Remova algum filtro para ver mais pacientes.</p>
        </>
      ) : (
        <>
          <p className="m-0 text-lg font-semibold">Nenhum paciente cadastrado ainda</p>
          <p className="m-0 max-w-sm text-muted">Comece pelo primeiro paciente. Os responsáveis são cadastrados junto.</p>
        </>
      )}
      <Link to="/clientes/novo" className={buttonClass('primary', 'md', 'mt-2')}>
        + Novo paciente
      </Link>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 border-t border-line-soft py-4">
          <div className="h-4 w-48 animate-pulse rounded bg-line" />
          <div className="h-4 w-16 animate-pulse rounded bg-line" />
          <div className="h-4 w-24 animate-pulse rounded bg-line" />
        </div>
      ))}
    </div>
  )
}
