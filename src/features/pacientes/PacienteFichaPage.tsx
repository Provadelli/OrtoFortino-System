import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { buttonClass } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from '@/components/ui/icons'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { StatusChip } from '@/components/ui/StatusChip'
import { ageFrom, formatAge, formatCnpj, formatCpf, formatIsoDate, formatPhone } from '@/lib/br'
import { maskCnpj, maskCpf } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useAtendimentosDoPaciente } from '@/features/atendimentos/api'
import { HistoricoAtendimentos } from '@/features/atendimentos/HistoricoAtendimentos'
import { useOrcamentosDoPaciente } from '@/features/orcamentos/api'
import { HistoricoOrcamentos } from '@/features/orcamentos/HistoricoOrcamentos'
import { useExcluirPaciente, usePaciente } from './api'
import { origemLabel } from './schema'

export default function PacienteFichaPage() {
  const { id } = useParams()
  const { data: p, isPending, isError } = usePaciente(id)
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  usePageTitle(p?.nome ?? 'Paciente')

  if (isPending) return <PageSkeleton />
  if (isError || !p)
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-8">
        <h1 className="m-0 text-2xl font-bold">Paciente não encontrado</h1>
        <p className="m-0 text-muted">O cadastro pode ter sido excluído.</p>
        <Link to="/clientes" className={buttonClass('outline')}>
          Voltar para clientes
        </Link>
      </div>
    )

  const idade = ageFrom(p.data_nascimento)

  return (
    <>
      <header className="flex flex-col gap-3 animate-fade">
        <Link to="/clientes" className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline">
          <ArrowLeftIcon /> Clientes
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-[1.2] font-bold">{p.nome}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{formatAge(idade)}</span>
              {idade !== null && idade < 18 && <StatusChip tone="today">Menor de idade</StatusChip>}
              <StatusChip tone={p.origem === 'clinica' ? 'prod' : p.origem === 'plano' ? 'today' : 'draft'}>
                {origemLabel(p.origem) + (p.origem_nome ? ` · ${p.origem_nome}` : '')}
              </StatusChip>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={`/clientes/${p.id}/editar`} className={buttonClass('outline')}>
              Editar
            </Link>
            <Link to={`/orcamentos/novo?paciente=${p.id}`} className={buttonClass('primary')}>
              + Novo orçamento
            </Link>
          </div>
        </div>
      </header>

      {notice && (
        <output className="block rounded-field border border-[#bfe6d2] bg-prod-bg px-4 py-3 text-[15px] font-medium text-prod-fg animate-fade">
          {notice}
        </output>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title="Dados pessoais" id="c-dados">
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {p.tipo_documento === 'cnpj' ? (
              <Item label="CNPJ">{p.cnpj ? <CpfReveal cpf={p.cnpj} tipo="cnpj" /> : '—'}</Item>
            ) : (
              <Item label="CPF">{p.cpf ? <CpfReveal cpf={p.cpf} /> : '—'}</Item>
            )}
            <Item label="Nascimento">{p.data_nascimento ? `${formatIsoDate(p.data_nascimento)} (${formatAge(idade)})` : '—'}</Item>
            <Item label="Telefone">{p.telefone ? <a href={`tel:+55${p.telefone}`} className="text-primary-ink">{formatPhone(p.telefone)}</a> : '—'}</Item>
            <Item label="Cidade">{p.cidade ? `${p.cidade}${p.uf ? `/${p.uf}` : ''}` : '—'}</Item>
            <Item label="Endereço" className="sm:col-span-2">
              {p.endereco || '—'}
            </Item>
          </dl>
        </Card>

        <Card title="Acompanhamento" id="c-clinico">
          <dl className="m-0 grid gap-y-4">
            <Item label="Médico(a) / terapeuta">{p.medico || '—'}</Item>
            <Item label="Diagnóstico">
              <span className="whitespace-pre-wrap">{p.diagnostico || '—'}</span>
            </Item>
            <Item label="Observações">
              <span className="whitespace-pre-wrap">{p.observacoes || '—'}</span>
            </Item>
          </dl>
        </Card>

        <Card title="Responsáveis" id="c-resp">
          {p.responsaveis.length === 0 ? (
            <p className="m-0 text-muted">Nenhum responsável cadastrado.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {p.responsaveis.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft py-3 first:border-t-0 first:pt-0">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">
                      {r.nome}
                      {r.parentesco && <span className="font-normal text-muted"> · {r.parentesco}</span>}
                    </span>
                    <span className="text-[13px] text-muted">
                      {[r.cpf ? maskCpf(r.cpf) : null, r.telefone ? formatPhone(r.telefone) : null].filter(Boolean).join(' · ') || 'Sem CPF e telefone'}
                    </span>
                  </div>
                  {r.principal && <StatusChip tone="prod">Principal</StatusChip>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Atendimentos" id="c-hist">
          <HistoricoAtendimentos pacienteId={p.id} />
        </Card>

        <Card title="Orçamentos" id="c-orc">
          <HistoricoOrcamentos pacienteId={p.id} />
        </Card>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[13px] text-muted">
        <span>
          Cadastrado em {formatIsoDate(p.created_at)} · consentimento LGPD em {formatIsoDate(p.consentimento_lgpd_em)} · última alteração em{' '}
          {formatIsoDate(p.updated_at)}
        </span>
        <ExcluirPaciente id={p.id} nome={p.nome} />
      </footer>
    </>
  )
}

function Card({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-card border border-line bg-white p-5 sm:p-6 animate-rise">
      <h2 id={id} className="m-0 text-[19px] font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Item({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="m-0 text-[15px] break-words">{children}</dd>
    </div>
  )
}

/** CPF/CNPJ mascarado por padrão (LGPD); revela sob demanda. */
function CpfReveal({ cpf, tipo = 'cpf' }: { cpf: string; tipo?: 'cpf' | 'cnpj' }) {
  const rotulo = tipo === 'cnpj' ? 'CNPJ' : 'CPF'
  const [show, setShow] = useState(false)
  return (
    <span className="inline-flex items-center gap-1">
      <span className="tabular-nums">{show ? (tipo === 'cnpj' ? formatCnpj(cpf) : formatCpf(cpf)) : tipo === 'cnpj' ? maskCnpj(cpf) : maskCpf(cpf)}</span>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-pressed={show}
        aria-label={show ? `Ocultar ${rotulo}` : `Mostrar ${rotulo} completo`}
        className="-my-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-muted hover:bg-surface-hover hover:text-ink"
      >
        {show ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
      </button>
    </span>
  )
}

function ExcluirPaciente({ id, nome }: { id: string; nome: string }) {
  const excluir = useExcluirPaciente()
  const navigate = useNavigate()
  // mesmas consultas do histórico da ficha: vêm do cache, sem pedido extra
  const atendimentos = useAtendimentosDoPaciente(id).data?.length ?? 0
  const orcamentos = useOrcamentosDoPaciente(id).data?.length ?? 0
  const impact = [
    atendimentos > 0 && `${atendimentos} ${atendimentos === 1 ? 'atendimento' : 'atendimentos'}, com ficha técnica e pagamentos`,
    orcamentos > 0 && `${orcamentos} ${orcamentos === 1 ? 'orçamento' : 'orçamentos'}, inclusive aprovados`,
  ].filter((x): x is string => !!x)

  return (
    <ConfirmDialog
      triggerLabel="Excluir cadastro"
      triggerAriaLabel={`Excluir cadastro de ${nome}`}
      title={`Excluir ${nome}?`}
      description={`Os dados pessoais e os responsáveis serão apagados de forma definitiva (direito de eliminação — LGPD). Esta ação não pode ser desfeita.${impact.length ? ' Junto com o cadastro serão apagados:' : ''}`}
      impact={impact.length ? impact : undefined}
      requireText={impact.length ? nome : undefined}
      onConfirm={async () => {
        await excluir.mutateAsync(id)
        navigate('/clientes', { replace: true, state: { notice: `Cadastro de ${nome} excluído.` } })
      }}
    />
  )
}
