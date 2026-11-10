import { useState } from 'react'
import { Link } from 'react-router'
import { buttonClass } from '@/components/ui/Button'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatIsoDate, todayIso } from '@/lib/br'
import { formatBRL } from '@/lib/format'
import { useOrcamentosDoPaciente } from './api'
import { STATUS_ORCAMENTO, vencido } from './constants'

/** Orçamentos de um paciente (usado na ficha do paciente). */
export function HistoricoOrcamentos({ pacienteId }: { pacienteId: string }) {
  const { data, isPending, isError } = useOrcamentosDoPaciente(pacienteId)
  const [hoje] = useState(todayIso)

  return (
    <div className="flex flex-col gap-3">
      {isPending ? (
        <div aria-hidden="true" className="h-16 animate-pulse rounded-field bg-surface" />
      ) : isError ? (
        <p role="alert" className="m-0 text-late-fg">
          Não foi possível carregar os orçamentos.
        </p>
      ) : data.length === 0 ? (
        <p className="m-0 text-muted">Nenhum orçamento ainda.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {data.map((o) => {
            const st = STATUS_ORCAMENTO[o.status]
            return (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft py-3 first:border-t-0 first:pt-0">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link to={`/orcamentos/${o.id}`} className="text-[15px] font-semibold text-ink no-underline tabular-nums hover:text-primary-ink hover:underline">
                    {o.numero}
                  </Link>
                  <span className="text-[13px] text-muted">
                    Emitido em {formatIsoDate(o.data_emissao)} · válido até {formatIsoDate(o.validade)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm tabular-nums">{formatBRL(o.total)}</span>
                  <StatusChip tone={st.tone}>{st.label}</StatusChip>
                  {vencido(o.status, o.validade, hoje) && <StatusChip tone="late">Vencido</StatusChip>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Link to={`/orcamentos/novo?paciente=${pacienteId}`} className={buttonClass('outline', 'md', 'self-start')}>
        + Novo orçamento
      </Link>
    </div>
  )
}
