import { useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button, buttonClass } from '@/components/ui/Button'
import { ArrowLeftIcon } from '@/components/ui/icons'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { Etapas } from '@/components/ui/Etapas'
import { StatusChip } from '@/components/ui/StatusChip'
import { ageFrom, formatAge, formatIsoDate, todayIso } from '@/lib/br'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useOrcamentoDoAtendimento } from '@/features/orcamentos/api'
import { FichaVisual } from './ficha/FichaVisual'
import { fichaDe, useAtendimento, useExcluirAtendimento, useMudarStatus } from './api'
import { CATEGORIAS, descreverPagamento, label, LATERALIDADES, PAGAMENTO, prazoAlerta, PROXIMO, STATUS, statusInfo, TIPOS, type StatusAtendimento } from './constants'

const FLUXO = STATUS.filter((s) => s.value !== 'cancelado')

export default function AtendimentoPage() {
  const { id } = useParams()
  const { data: a, isPending, isError } = useAtendimento(id)
  const location = useLocation()
  const [notice, setNotice] = useState((location.state as { notice?: string } | null)?.notice)
  const [hoje] = useState(todayIso)
  const mudar = useMudarStatus()
  const [erro, setErro] = useState<string | null>(null)
  usePageTitle(a ? `Atendimento nº ${a.numero} · ${a.pacientes?.nome ?? ''}` : 'Atendimento')

  if (isPending) return <PageSkeleton />
  if (isError || !a)
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-8">
        <h1 className="m-0 text-2xl font-bold">Atendimento não encontrado</h1>
        <Link to="/atendimentos" className={buttonClass('outline')}>
          Voltar para atendimentos
        </Link>
      </div>
    )

  const f = fichaDe(a)
  const st = statusInfo(a.status)
  const prox = PROXIMO[a.status]
  const alerta = prazoAlerta(a.status, a.prazo_entrega, hoje)
  const pg = PAGAMENTO[a.pagamento_status]
  const idxAtual = FLUXO.findIndex((s) => s.value === a.status)

  async function avancar(status: StatusAtendimento, msg: string) {
    setErro(null)
    try {
      await mudar.mutateAsync({ id: a!.id, status })
      setNotice(msg)
    } catch {
      setErro('Não foi possível atualizar o status. Tente de novo.')
    }
  }

  return (
    <>
      <header className="flex flex-col gap-3 animate-fade">
        <Link
          to={a.pacientes ? `/clientes/${a.pacientes.id}` : '/atendimentos'}
          className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline"
        >
          <ArrowLeftIcon /> {a.pacientes?.nome ?? 'Atendimentos'}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-[1.2] font-bold">
              {a.descricao || f?.produto || label(CATEGORIAS, a.categoria)}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>Nº {a.numero}</span>
              <span aria-hidden="true">·</span>
              <span>{label(CATEGORIAS, a.categoria)}</span>
              <OrigemOrcamento atendimentoId={a.id} />
              <StatusChip tone={st.tone}>{st.label}</StatusChip>
              {alerta && <StatusChip tone={alerta.tone}>{alerta.label}</StatusChip>}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={`/atendimentos/${a.id}/editar`} className={buttonClass('outline')}>
              Editar
            </Link>
            {prox && (
              <Button loading={mudar.isPending} onClick={() => void avancar(prox.status, `Status atualizado para “${statusInfo(prox.status).label}”.`)}>
                {prox.acao}
              </Button>
            )}
          </div>
        </div>
      </header>

      {(notice || erro) && (
        <output
          className={cn(
            'block rounded-field border px-4 py-3 text-[15px] font-medium animate-fade',
            erro ? 'border-[#f6b8d6] bg-late-bg text-late-fg' : 'border-[#bfe6d2] bg-prod-bg text-prod-fg',
          )}
        >
          {erro ?? notice}
        </output>
      )}

      <section className="rounded-card border border-line bg-white px-3 py-5 sm:p-6 animate-rise">
        <Etapas
          titulo="Etapas do atendimento"
          atual={a.status === 'cancelado' ? -1 : idxAtual}
          cancelado={a.status === 'cancelado'}
          etapas={[
            { label: 'Em contato', detalhe: formatIsoDate(a.data_primeiro_contato) },
            { label: 'Em produção', detalhe: a.data_fechamento ? formatIsoDate(a.data_fechamento) : null },
            { label: 'Pronto', detalhe: a.prazo_entrega && !a.data_conclusao ? `prazo ${formatIsoDate(a.prazo_entrega)}` : null },
            { label: 'Entregue', detalhe: a.data_conclusao ? formatIsoDate(a.data_conclusao) : null },
          ]}
        />
        {a.status === 'cancelado' && <p className="m-0 mt-4 text-center text-sm font-semibold text-late-fg">Atendimento cancelado</p>}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title="Paciente e datas" id="c-datas">
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label="Paciente">
              {a.pacientes ? (
                <Link to={`/clientes/${a.pacientes.id}`} className="font-semibold text-primary-ink">
                  {a.pacientes.nome}
                </Link>
              ) : (
                '—'
              )}
              {a.pacientes?.data_nascimento && <span className="text-muted"> · {formatAge(ageFrom(a.pacientes.data_nascimento))}</span>}
            </Item>
            <Item label="Primeiro contato">{formatIsoDate(a.data_primeiro_contato)}</Item>
            <Item label="Fechamento">{formatIsoDate(a.data_fechamento)}</Item>
            <Item label="Prazo de entrega">{formatIsoDate(a.prazo_entrega)}</Item>
            <Item label="Conclusão">{formatIsoDate(a.data_conclusao)}</Item>
          </dl>
        </Card>

        <Card title="Pagamento" id="c-pag">
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label="Valor">
              <span className="text-[19px] font-semibold tabular-nums">{formatBRL(a.valor)}</span>
            </Item>
            <Item label="Situação">
              <StatusChip tone={pg.tone}>{pg.label}</StatusChip>
            </Item>
            <Item label="Pago">
              <span className="tabular-nums">{formatBRL(a.valor_pago)}</span>
              {a.valor > a.valor_pago && <span className="block text-[13px] text-muted">falta {formatBRL(a.valor - a.valor_pago)}</span>}
            </Item>
            <Item label="Forma">
              {descreverPagamento(a.pagamento_forma, a.pagamento_parcelas, a.valor) ?? '—'}
              {a.pagamento_detalhe && <span className="block text-[13px] text-muted">{a.pagamento_detalhe}</span>}
            </Item>
            <Item label="Data do pagamento">{formatIsoDate(a.data_pagamento)}</Item>
          </dl>
        </Card>

        <Card title="Ficha técnica" id="c-ficha" className="lg:col-span-2">
          {!f ? (
            <p className="m-0 text-muted">
              Sem ficha técnica.{' '}
              <Link to={`/atendimentos/${a.id}/editar`} className="font-semibold text-primary-ink">
                Preencher agora
              </Link>
            </p>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <FichaVisual f={f} className="lg:order-last" />
            <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Item label="Tipo">{label(TIPOS, f.tipo)}</Item>
              {f.tipo === 'protese' ? (
                <>
                  <Item label="Membro">{f.protese_membro ? (f.protese_membro === 'superior' ? 'Superior' : 'Inferior') : '—'}</Item>
                  <Item label="Nível">{f.protese_nivel ? (f.protese_nivel === 'transtibial' ? 'Transtibial' : 'Transfemoral') : '—'}</Item>
                  <Item label="Lado">{f.protese_lado ?? '—'}</Item>
                  <Item label="Liner">{f.liner ?? '—'}</Item>
                  <Item label="Tamanho do pé">{f.tamanho_pe ?? '—'}</Item>
                </>
              ) : (
                <>
                  <Item label="Lateralidade">{label(LATERALIDADES, f.lateralidade)}</Item>
                  <Item label="Produto">{f.produto ?? '—'}</Item>
                  <Item label="Tamanho do calçado">{f.tamanho_calcado ?? '—'}</Item>
                  <Item label="Especificações" className="sm:col-span-2 lg:col-span-3">
                    {f.especificacoes.length ? (
                      <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">
                        {f.especificacoes.map((e) => (
                          <li key={e} className="rounded-full bg-surface px-3 py-1 text-[13px] font-medium">
                            {e}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </Item>
                  <Item label="Compensação">{f.compensacao_lado ? `${f.compensacao_lado}${f.compensacao_medida ? ` · ${f.compensacao_medida}` : ''}` : '—'}</Item>
                  <Item label="Nome na órtese">{f.nome_na_ortese ? 'Sim' : 'Não'}</Item>
                  <Item label="Tema">{f.tema ?? '—'}</Item>
                  <Item label="Cores">{[f.cor_forro && `forro ${f.cor_forro}`, f.cor_tira && `tira ${f.cor_tira}`].filter(Boolean).join(' · ') || '—'}</Item>
                  {f.medidas_ml && (
                    <Item label="Medidas" className="sm:col-span-2 lg:col-span-3">
                      <span className="whitespace-pre-wrap">{f.medidas_ml}</span>
                    </Item>
                  )}
                </>
              )}
              {f.observacoes && (
                <Item label="Observações da ficha" className="sm:col-span-2 lg:col-span-3">
                  <span className="whitespace-pre-wrap">{f.observacoes}</span>
                </Item>
              )}
            </dl>
            </div>
          )}
        </Card>

        {a.observacoes && (
          <Card title="Observações" id="c-obs" className="lg:col-span-2">
            <p className="m-0 text-[15px] whitespace-pre-wrap">{a.observacoes}</p>
          </Card>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[13px] text-muted">
        <span>
          Aberto em {formatIsoDate(a.created_at)} · última alteração em {formatIsoDate(a.updated_at)}
        </span>
        <div className="flex flex-wrap gap-2">
          {a.status !== 'cancelado' && a.status !== 'entregue' && (
            <button
              type="button"
              onClick={() => void avancar('cancelado', 'Atendimento cancelado.')}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-field px-3 text-sm font-semibold text-ink-soft hover:bg-surface-hover"
            >
              Cancelar atendimento
            </button>
          )}
          {a.status === 'cancelado' && (
            <button
              type="button"
              onClick={() => void avancar('em_contato', 'Atendimento reaberto.')}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-field px-3 text-sm font-semibold text-primary-ink hover:bg-surface-hover"
            >
              Reabrir atendimento
            </button>
          )}
          <Excluir id={a.id} numero={a.numero} pacienteId={a.paciente_id} />
        </div>
      </footer>
    </>
  )
}

function Card({ title, id, children, className }: { title: string; id: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-4 rounded-card border border-line bg-white p-5 sm:p-6 animate-rise', className)}>
      <h2 id={id} className="m-0 text-[19px] font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Item({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="m-0 text-[15px] break-words">{children}</dd>
    </div>
  )
}

function Excluir({ id, numero, pacienteId }: { id: string; numero: number; pacienteId: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const excluir = useExcluirAtendimento()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    setErro(null)
    try {
      await excluir.mutateAsync(id)
      dialog.current?.close()
      navigate(`/clientes/${pacienteId}`, { replace: true, state: { notice: `Atendimento nº ${numero} excluído.` } })
    } catch {
      setErro('Não foi possível excluir agora. Tente de novo.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-field px-3 text-sm font-semibold text-late-fg hover:bg-late-bg"
      >
        Excluir
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="dlg-excluir-at"
        aria-describedby="dlg-excluir-at-texto"
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-card border border-line bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/40 open:animate-rise"
      >
        <h2 id="dlg-excluir-at" className="m-0 text-xl font-semibold">
          Excluir o atendimento nº {numero}?
        </h2>
        <p id="dlg-excluir-at-texto" className="mt-3 mb-0 text-[15px] text-ink-soft">
          A ficha técnica e o registro de pagamento deste atendimento serão apagados. Para só encerrar, prefira “Cancelar atendimento”.
        </p>
        {erro && (
          <p role="alert" className="mt-3 mb-0 text-sm font-medium text-late-fg">
            {erro}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>
            Voltar
          </Button>
          <Button variant="danger" loading={excluir.isPending} onClick={() => void confirmar()}>
            Excluir definitivamente
          </Button>
        </div>
      </dialog>
    </>
  )
}

/** "· do orçamento ORC-2026-0001" quando o atendimento nasceu de uma aprovação. */
function OrigemOrcamento({ atendimentoId }: { atendimentoId: string }) {
  const { data } = useOrcamentoDoAtendimento(atendimentoId)
  if (!data) return null
  return (
    <>
      <span aria-hidden="true">·</span>
      <span>
        do orçamento{' '}
        <Link to={`/orcamentos/${data.id}`} className="font-semibold text-primary-ink tabular-nums">
          {data.numero}
        </Link>
      </span>
    </>
  )
}
