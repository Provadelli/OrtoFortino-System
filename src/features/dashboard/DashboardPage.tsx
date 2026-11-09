import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { buttonClass } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { DownloadIcon, SearchIcon } from '@/components/ui/icons'
import { StatusChip } from '@/components/ui/StatusChip'
import { useSession } from '@/features/auth/useSession'
import { cn } from '@/lib/cn'
import { formatLongDate, greeting, initials } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { avatarBg, etapas, kpis, orcamentos, pagamentos, prazos } from './sample-data'

const delay = (i: number) => ({ '--i': i }) as CSSProperties

export default function DashboardPage() {
  usePageTitle('Painel')
  const session = useSession()
  const [now] = useState(() => new Date())
  const firstName = session?.user.nome?.split(' ')[0]
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('busca')?.toString().trim()
    navigate(q ? `/clientes?busca=${encodeURIComponent(q)}` : '/clientes')
  }

  const max = Math.max(...etapas.map((e) => e.n))

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade">
        <div className="flex flex-col gap-1">
          <p className="m-0 text-sm text-muted">{formatLongDate(now)}</p>
          <h1 className="m-0 text-[30px] leading-[1.2] font-bold">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ''}!
          </h1>
        </div>
        <div className="flex flex-[1_1_auto] flex-wrap items-center justify-end gap-3">
          <search className="relative flex-[1_1_240px] sm:max-w-[320px]">
          <form onSubmit={onSearch}>
            <label htmlFor="busca" className="sr-only">
              Buscar paciente ou CPF
            </label>
            <SearchIcon className="pointer-events-none absolute top-[15px] left-3.5 text-muted" />
            <input
              id="busca"
              name="busca"
              type="search"
              placeholder="Buscar paciente ou CPF"
              autoComplete="off"
              className="h-12 w-full min-w-[220px] rounded-field border-[1.5px] border-field-soft bg-white pr-3.5 pl-[42px] text-[15px] text-ink transition-colors hover:border-[#b5cbbf]"
            />
          </form>
          </search>
          <Link to="/clientes/novo" className={buttonClass('outline')}>
            + Novo paciente
          </Link>
          <Link to="/orcamentos/novo" className={buttonClass('primary')}>
            + Novo orçamento
          </Link>
        </div>
      </header>

      {/* Indicadores */}
      <section aria-labelledby="titulo-resumo" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <h2 id="titulo-resumo" className="sr-only">
          Resumo
        </h2>
        {kpis.map((k, i) => (
          <article
            key={k.label}
            style={delay(i)}
            className="flex flex-col gap-2.5 rounded-card border border-line bg-white p-5 animate-rise stagger transition-shadow duration-200 hover:shadow-[0_6px_24px_-12px_rgb(31_122_92/0.25)]"
          >
            <h3 className="m-0 flex items-center gap-2.5 font-sans text-sm font-semibold text-ink-soft">
              <span aria-hidden="true" className={cn('size-3 rounded-full', k.dot)} />
              {k.label}
            </h3>
            <p className="m-0 font-display text-[32px] leading-[1.1] font-bold tabular-nums">{k.value}</p>
            <p className={cn('m-0 text-[13px] font-medium', k.alert ? 'text-late-fg' : 'text-muted')}>{k.sub}</p>
          </article>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-4">
        {/* Próximos prazos */}
        <Card aria-labelledby="titulo-prazos" className="flex-[2_1_480px] gap-2" style={delay(4)}>
          <CardHeader id="titulo-prazos" title="Próximos prazos de entrega" action={{ to: '/atendimentos', label: 'Ver todos', srLabel: 'os prazos' }} />
          <ul className="m-0 list-none p-0">
            {prazos.map((p) => (
              <li key={p.nome} className="flex flex-wrap items-center gap-3.5 border-t border-line-soft py-3.5">
                <div
                  aria-hidden="true"
                  className={cn('flex size-[42px] shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-ink', avatarBg[p.tone])}
                >
                  {initials(p.nome)}
                </div>
                <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{p.nome}</span>
                  <span className="text-[13px] text-muted">{p.produto}</span>
                </div>
                <div className="flex min-w-[70px] flex-col items-end gap-0.5">
                  <span className="text-xs text-muted">Entrega</span>
                  <span className="text-[15px] font-semibold tabular-nums">{p.data}</span>
                </div>
                <StatusChip tone={p.tone} size="md" className="min-w-[110px] text-center">
                  {p.status}
                </StatusChip>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          {/* Atendimentos por status */}
          <Card aria-labelledby="titulo-status" className="gap-4" style={delay(5)}>
            <CardHeader id="titulo-status" title="Atendimentos por status" />
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {etapas.map((e, i) => (
                <li key={e.label} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-soft">{e.label}</span>
                    <span className="font-bold tabular-nums">{e.n}</span>
                  </div>
                  <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-track">
                    <div
                      className={cn('h-2.5 origin-left rounded-full animate-grow-x stagger', e.color)}
                      style={{ width: `${Math.round((e.n / max) * 100)}%`, ...delay(i + 5) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* A receber */}
          <Card aria-labelledby="titulo-receber" className="gap-1" style={delay(6)}>
            <div className="mb-2">
              <CardHeader id="titulo-receber" title="A receber" action={{ to: '/atendimentos?pagamento=pendente', label: 'Ver todos', srLabel: 'os pagamentos a receber' }} />
            </div>
            <ul className="m-0 list-none p-0">
              {pagamentos.map((g) => (
                <li key={g.nome} className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{g.nome}</span>
                    <span className="text-[13px] text-muted">{g.forma}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[15px] font-bold tabular-nums">{g.valor}</span>
                    <StatusChip tone={g.tone}>{g.status}</StatusChip>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Orçamentos recentes */}
      <Card aria-labelledby="titulo-orcamentos" className="gap-3" style={delay(7)}>
        <CardHeader id="titulo-orcamentos" title="Orçamentos recentes" action={{ to: '/orcamentos', label: 'Ver todos', srLabel: 'os orçamentos' }} />
        {/* Região rolável precisa ser focável pelo teclado (axe: scrollable-region-focusable / WCAG 2.1.1) */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <section className="overflow-x-auto overscroll-x-contain" aria-label="Tabela de orçamentos recentes (role para os lados)" tabIndex={0}>
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="sr-only">Os 4 orçamentos mais recentes, com valor, status e PDF</caption>
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th scope="col" className="py-2.5 pr-3 font-semibold">Nº</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Paciente</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Itens</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Valor</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Data</th>
                <th scope="col" className="py-2.5 pl-3 text-right font-semibold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {orcamentos.map((o) => (
                <tr key={o.num} className="border-t border-line-soft transition-colors hover:bg-surface">
                  <th scope="row" className="py-3 pr-3 text-left font-semibold whitespace-nowrap">{o.num}</th>
                  <td className="p-3 whitespace-nowrap">{o.nome}</td>
                  <td className="p-3 text-ink-soft">{o.itens}</td>
                  <td className="p-3 text-right font-bold whitespace-nowrap tabular-nums">{o.valor}</td>
                  <td className="p-3">
                    <StatusChip tone={o.tone}>{o.status}</StatusChip>
                  </td>
                  <td className="p-3 text-muted tabular-nums">{o.data}</td>
                  <td className="py-1.5 pl-3 text-right">
                    <button
                      type="button"
                      aria-label={`Baixar PDF do ${o.num}`}
                      onClick={() => setNotice(`O PDF do ${o.num} estará disponível na etapa de orçamentos.`)}
                      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[10px] border border-field-soft bg-white text-primary-ink transition-[background-color,transform] duration-150 hover:bg-prod-bg active:scale-95"
                    >
                      <DownloadIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <output aria-live="polite" className={cn('m-0 block text-sm text-muted', !notice && 'sr-only')}>
          {notice}
        </output>
      </Card>
    </>
  )
}
