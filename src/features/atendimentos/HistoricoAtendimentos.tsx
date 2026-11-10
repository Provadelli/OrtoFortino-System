import { useState } from 'react'
import { Link } from 'react-router'
import { buttonClass } from '@/components/ui/Button'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatIsoDate, todayIso } from '@/lib/br'
import { formatBRL } from '@/lib/format'
import { fichaDe, useAtendimentosDoPaciente } from './api'
import { CATEGORIAS, label, PAGAMENTO, prazoAlerta, statusInfo } from './constants'

/** Atendimentos de um paciente (usado na ficha do paciente). */
export function HistoricoAtendimentos({ pacienteId }: { pacienteId: string }) {
  const { data, isPending, isError } = useAtendimentosDoPaciente(pacienteId)
  const [hoje] = useState(todayIso)

  return (
    <div className="flex flex-col gap-3">
      {isPending ? (
        <div aria-hidden="true" className="h-16 animate-pulse rounded-field bg-surface" />
      ) : isError ? (
        <p role="alert" className="m-0 text-late-fg">
          Não foi possível carregar os atendimentos.
        </p>
      ) : data.length === 0 ? (
        <p className="m-0 text-muted">Nenhum atendimento ainda.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {data.map((a) => {
            const st = statusInfo(a.status)
            const pg = PAGAMENTO[a.pagamento_status]
            const alerta = prazoAlerta(a.status, a.prazo_entrega, hoje)
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft py-3 first:border-t-0 first:pt-0">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link to={`/atendimentos/${a.id}`} className="text-[15px] font-semibold text-ink no-underline hover:text-primary-ink hover:underline">
                    {a.descricao || fichaDe(a)?.produto || label(CATEGORIAS, a.categoria)}
                  </Link>
                  <span className="text-[13px] text-muted">
                    Nº {a.numero} · {label(CATEGORIAS, a.categoria)} · aberto em {formatIsoDate(a.data_primeiro_contato)}
                    {a.prazo_entrega && a.status !== 'entregue' ? ` · prazo ${formatIsoDate(a.prazo_entrega)}` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={st.tone}>{st.label}</StatusChip>
                  {alerta && <StatusChip tone={alerta.tone}>{alerta.label}</StatusChip>}
                  <span className="text-sm tabular-nums">{formatBRL(a.valor)}</span>
                  <StatusChip tone={pg.tone}>{pg.label}</StatusChip>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Link to={`/atendimentos/novo?paciente=${pacienteId}`} className={buttonClass('outline', 'md', 'self-start')}>
        + Novo atendimento
      </Link>
    </div>
  )
}
