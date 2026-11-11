import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { FileIcon, SearchIcon } from '@/components/ui/icons'
import { StatusChip, type Tone } from '@/components/ui/StatusChip'
import { useSession } from '@/features/auth/useSession'
import { CATEGORIAS, FORMAS_TODAS, label, PAGAMENTO, prazoAlerta, statusInfo } from '@/features/atendimentos/constants'
import { todayIso } from '@/lib/br'
import { cn } from '@/lib/cn'
import { formatBRL, formatLongDate, greeting, initials, shortName } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { STATUS_ORCAMENTO, vencido } from '@/features/orcamentos/constants'
import { usePainel, type Painel } from './api'

const delay = (i: number) => ({ '--i': i }) as CSSProperties

/** Cor do avatar segue o tom do status, como no canvas. */
const avatarBg: Record<Tone, string> = {
  late: 'bg-late-bg',
  today: 'bg-today-bg',
  prod: 'bg-prod-bg',
  ready: 'bg-ready-bg',
  draft: 'bg-draft-bg',
  info: 'bg-info-bg',
}

/** "2026-11-09" → "09/11" */
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export default function DashboardPage() {
  usePageTitle('Painel')
  const session = useSession()
  const [now] = useState(() => new Date())
  const [hoje] = useState(() => todayIso(now))
  const firstName = session?.user.nome?.split(' ')[0]
  const navigate = useNavigate()
  const painel = usePainel(hoje)

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('busca')?.toString().trim()
    navigate(q ? `/clientes?busca=${encodeURIComponent(q)}` : '/clientes')
  }

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
                className="h-12 w-full min-w-[220px] rounded-field border-[1.5px] border-field-soft bg-white pr-3.5 pl-[42px] text-[15px] text-ink transition-colors hover:border-field-hover"
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

      {painel.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg">
          Não foi possível carregar o painel.
          <Button variant="outline" loading={painel.isFetching} onClick={() => void painel.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : painel.isPending ? (
        <Esqueleto />
      ) : (
        <Conteudo p={painel.data} hoje={hoje} />
      )}
    </>
  )
}

function Conteudo({ p, hoje }: { p: Painel; hoje: string }) {
  const kpis: { label: string; value: string; sub: ReactNode; dot: string; alert?: boolean }[] = [
    {
      label: 'Em produção',
      value: String(p.em_producao),
      sub: p.prontos ? `${plural(p.prontos, 'pronto', 'prontos')} para entrega` : 'Nenhum pronto para entrega',
      dot: 'bg-brand-mint',
    },
    {
      label: 'Entregas nos próximos 7 dias',
      value: String(p.entregas_semana),
      sub: p.atrasados ? (
        <Link to="/atendimentos?filtro=atrasados" className="text-late-fg">
          {plural(p.atrasados, 'atrasada', 'atrasadas')}
        </Link>
      ) : (
        'Nenhuma atrasada'
      ),
      dot: 'bg-brand-orange',
      alert: p.atrasados > 0,
    },
    {
      label: 'A receber',
      value: formatBRL(p.a_receber),
      sub: p.pagamentos_abertos ? plural(p.pagamentos_abertos, 'pagamento pendente', 'pagamentos pendentes') : 'Tudo recebido',
      dot: 'bg-brand-pink',
    },
    {
      label: 'Orçamentos em aberto',
      value: String(p.orcamentos_abertos),
      sub: p.orcamentos_vencidos ? (
        <Link to="/orcamentos" className="text-late-fg">
          {plural(p.orcamentos_vencidos, 'vencido', 'vencidos')}
        </Link>
      ) : p.orcamentos_abertos ? (
        `${formatBRL(p.orcamentos_valor_aberto)} em negociação`
      ) : (
        'Nenhum aguardando resposta'
      ),
      dot: 'bg-brand-yellow',
      alert: p.orcamentos_vencidos > 0,
    },
  ]

  const etapas = [
    { label: 'Em contato', n: p.em_contato, color: 'bg-draft-dot' },
    { label: 'Em produção', n: p.em_producao, color: 'bg-info-dot' },
    { label: 'Pronto para entrega', n: p.prontos, color: 'bg-ready-dot' },
    { label: 'Entregues no mês', n: p.entregues_mes, color: 'bg-prod-dot' },
  ]
  const max = Math.max(1, ...etapas.map((e) => e.n))

  return (
    <>
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
        <Card aria-labelledby="titulo-prazos" className="flex-[2_1_480px] gap-2" style={delay(4)}>
          <CardHeader id="titulo-prazos" title="Próximos prazos de entrega" action={{ to: '/atendimentos', label: 'Ver todos', srLabel: 'os atendimentos em andamento' }} />
          {p.prazos.length === 0 ? (
            <p className="m-0 border-t border-line-soft pt-4 text-muted">Nenhum atendimento em andamento com prazo definido.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {p.prazos.map((a) => {
                const chip = prazoAlerta(a.status, a.prazo_entrega, hoje) ?? statusInfo(a.status)
                const nome = shortName(a.paciente)
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3.5 border-t border-line-soft py-3.5">
                    <div
                      aria-hidden="true"
                      className={cn('flex size-[42px] shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-ink', avatarBg[chip.tone])}
                    >
                      {initials(nome)}
                    </div>
                    <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                      <Link to={`/atendimentos/${a.id}`} className="text-[15px] font-semibold text-ink no-underline hover:text-primary-ink hover:underline">
                        {nome}
                      </Link>
                      <span className="text-[13px] text-muted">{a.servico || label(CATEGORIAS, a.categoria)}</span>
                    </div>
                    <div className="flex min-w-[70px] flex-col items-end gap-0.5">
                      <span className="text-xs text-muted">Entrega</span>
                      <span className="text-[15px] font-semibold tabular-nums">{diaMes(a.prazo_entrega)}</span>
                    </div>
                    <StatusChip tone={chip.tone} size="md" className="min-w-[110px] text-center">
                      {chip.label}
                    </StatusChip>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
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

          <Card aria-labelledby="titulo-receber" className="gap-1" style={delay(6)}>
            <div className="mb-2">
              <CardHeader id="titulo-receber" title="A receber" action={{ to: '/atendimentos?filtro=pagamento', label: 'Ver todos', srLabel: 'os pagamentos a receber' }} />
            </div>
            {p.receber.length === 0 ? (
              <p className="m-0 border-t border-line-soft pt-3 text-muted">Nenhum pagamento pendente.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {p.receber.map((g) => {
                  const pg = PAGAMENTO[g.pagamento_status]
                  return (
                    <li key={g.id} className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link to={`/atendimentos/${g.id}`} className="text-[15px] font-semibold text-ink no-underline hover:text-primary-ink hover:underline">
                          {shortName(g.paciente)}
                        </Link>
                        <span className="text-[13px] text-muted">
                          {[g.pagamento_forma ? label(FORMAS_TODAS, g.pagamento_forma) : 'Forma não definida', g.pagamento_detalhe].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[15px] font-bold tabular-nums">{formatBRL(g.restante)}</span>
                        <StatusChip tone={pg.tone}>{pg.label}</StatusChip>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card aria-labelledby="titulo-orcamentos" className="gap-3" style={delay(7)}>
        <CardHeader id="titulo-orcamentos" title="Orçamentos recentes" action={{ to: '/orcamentos?filtro=todos', label: 'Ver todos', srLabel: 'os orçamentos' }} />
        {p.orcamentos.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-field bg-surface p-4 text-sm text-muted">
            <FileIcon className="shrink-0 text-primary" aria-hidden="true" />
            Nenhum orçamento ainda.
            <Link to="/orcamentos/novo" className="font-semibold text-primary-ink">
              Criar o primeiro
            </Link>
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {p.orcamentos.map((o) => {
              const st = STATUS_ORCAMENTO[o.status]
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft py-2.5 first:border-t-0">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link to={`/orcamentos/${o.id}`} className="text-[15px] font-semibold text-ink no-underline tabular-nums hover:text-primary-ink hover:underline">
                      {o.numero}
                    </Link>
                    <span className="text-[13px] text-muted">{shortName(o.paciente)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold tabular-nums">{formatBRL(o.total)}</span>
                    <StatusChip tone={st.tone}>{st.label}</StatusChip>
                    {vencido(o.status, o.validade, hoje) && <StatusChip tone="late">Vencido</StatusChip>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label="Carregando o painel" className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex h-[134px] flex-col gap-3 rounded-card border border-line bg-white p-5">
            <div className="h-4 w-32 animate-pulse rounded bg-line" />
            <div className="h-8 w-20 animate-pulse rounded bg-line" />
          </div>
        ))}
      </div>
      <div className="h-[320px] animate-pulse rounded-card border border-line bg-white" />
    </div>
  )
}
