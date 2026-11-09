import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useFieldArray, useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, buttonClass } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Choice, ChoiceGroup, FieldError, Section, SelectField, TextareaField } from '@/components/ui/FormControls'
import { ArrowLeftIcon, CloseIcon } from '@/components/ui/icons'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { ageFrom, formatAge, formatCpf, formatIsoDate, formatPhone, UFS } from '@/lib/br'
import { isDbError } from '@/lib/supabase'
import { usePageTitle } from '@/lib/usePageTitle'
import { toForm, usePaciente, useSalvarPaciente } from './api'
import { ORIGENS, pacienteSchema, pacienteVazio, type PacienteForm } from './schema'

/** Aplica máscara enquanto digita, mantendo o registro do react-hook-form. */
function masked(reg: UseFormRegisterReturn, format: (v: string) => string): UseFormRegisterReturn {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = format(e.target.value)
    return reg.onChange(e)
  }
  return { ...reg, onChange: onChange as UseFormRegisterReturn['onChange'] }
}

export default function PacienteFormPage() {
  const { id } = useParams()
  const editing = !!id
  const { data: paciente, isPending: loading, isError } = usePaciente(id)

  if (editing && loading) return <PageSkeleton />
  if (editing && (isError || !paciente))
    return (
      <div role="alert" className="rounded-card border border-line bg-white p-8">
        <h1 className="m-0 text-2xl font-bold">Paciente não encontrado</h1>
        <p className="text-muted">O cadastro pode ter sido excluído.</p>
        <Link to="/clientes" className={buttonClass('outline')}>
          Voltar para clientes
        </Link>
      </div>
    )

  return <PacienteFormInner id={id} initial={paciente ? toForm(paciente) : pacienteVazio} consentEm={paciente?.consentimento_lgpd_em} />
}

function PacienteFormInner({ id, initial, consentEm }: { id?: string; initial: PacienteForm; consentEm?: string }) {
  const editing = !!id
  usePageTitle(editing ? `Editar ${initial.nome}` : 'Novo paciente')
  const navigate = useNavigate()
  const salvar = useSalvarPaciente(id)
  const [serverError, setServerError] = useState<string | null>(null)
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10))

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PacienteForm>({
    resolver: zodResolver(pacienteSchema),
    defaultValues: initial,
    mode: 'onTouched',
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'responsaveis', keyName: 'key' })
  const [origem, nascimento, responsaveis] = useWatch({ control, name: ['origem', 'data_nascimento', 'responsaveis'] })
  const idade = useMemo(() => ageFrom(nascimento), [nascimento])
  const menor = idade !== null && idade < 18

  // Avisa antes de sair com alterações não salvas
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  function setPrincipal(index: number) {
    responsaveis.forEach((_, i) => setValue(`responsaveis.${i}.principal`, i === index, { shouldDirty: true }))
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    if (!editing && !values.consentimento) {
      setError('consentimento', { message: 'É preciso registrar o consentimento do paciente ou responsável.' }, { shouldFocus: true })
      return
    }
    // Garante um responsável principal quando houver responsáveis
    if (values.responsaveis.length && !values.responsaveis.some((r) => r.principal)) values.responsaveis[0]!.principal = true
    try {
      const savedId = await salvar.mutateAsync(values)
      navigate(`/clientes/${savedId}`, { replace: true, state: { notice: editing ? 'Alterações salvas.' : 'Paciente cadastrado com sucesso.' } })
    } catch (err) {
      if (isDbError(err) && err.code === '23505') {
        setError('cpf', { message: 'Este CPF já está cadastrado em outro paciente.' }, { shouldFocus: true })
      } else if (isDbError(err) && err.code === '23514') {
        setServerError('Algum dado não passou na validação do servidor. Confira CPF, telefone e datas.')
      } else {
        setServerError('Não foi possível salvar agora. Verifique sua conexão e tente de novo.')
      }
    }
  })

  const origemNomeLabel = origem === 'plano' ? 'Operadora do plano' : 'Nome da clínica'
  const errorCount = Object.keys(errors).length

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-labelledby="titulo-form">
      <header className="flex flex-col gap-2 animate-fade">
        <Link
          to={editing ? `/clientes/${id}` : '/clientes'}
          className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline"
        >
          <ArrowLeftIcon /> {editing ? 'Voltar para a ficha' : 'Voltar para clientes'}
        </Link>
        <h1 id="titulo-form" className="m-0 text-[30px] leading-[1.2] font-bold">
          {editing ? 'Editar paciente' : 'Novo paciente'}
        </h1>
        <p className="m-0 text-sm text-muted">Campos com * são obrigatórios.</p>
      </header>

      {(serverError || errorCount > 0) && (
        <div role="alert" className="rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg">
          {serverError ?? (errorCount === 1 ? 'Há 1 campo para corrigir.' : `Há ${errorCount} campos para corrigir.`)}
        </div>
      )}

      <Section id="sec-dados" title="Dados do paciente">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nome completo *" autoComplete="off" error={errors.nome?.message} {...register('nome')} />
          </div>
          <Field
            label="CPF"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            hint="Opcional para crianças sem CPF."
            error={errors.cpf?.message}
            {...masked(register('cpf'), formatCpf)}
          />
          <Field
            label="Data de nascimento"
            type="date"
            max={hoje}
            hint={idade !== null ? `Idade: ${formatAge(idade)}` : undefined}
            error={errors.data_nascimento?.message}
            {...register('data_nascimento')}
          />
          <Field
            label="Telefone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(21) 90000-0000"
            error={errors.telefone?.message}
            {...masked(register('telefone'), formatPhone)}
          />
        </div>
      </Section>

      <Section id="sec-endereco" title="Endereço">
        <div className="grid gap-5 sm:grid-cols-[1fr_1fr_120px]">
          <div className="sm:col-span-3">
            <Field label="Endereço" autoComplete="off" placeholder="Rua, número, complemento, bairro" error={errors.endereco?.message} {...register('endereco')} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Cidade" autoComplete="off" error={errors.cidade?.message} {...register('cidade')} />
          </div>
          <SelectField label="UF" {...register('uf')}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </SelectField>
        </div>
      </Section>

      <Section id="sec-origem" title="Origem e acompanhamento">
        <ChoiceGroup legend="Como o paciente chegou *">
          {ORIGENS.map((o) => (
            <Choice key={o.value} label={o.label} value={o.value} {...register('origem')} />
          ))}
        </ChoiceGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          {origem !== 'particular' && (
            <div className="animate-fade">
              <Field label={`${origemNomeLabel} *`} autoComplete="off" error={errors.origem_nome?.message} {...register('origem_nome')} />
            </div>
          )}
          <Field label="Médico(a) ou terapeuta" autoComplete="off" error={errors.medico?.message} {...register('medico')} />
        </div>
        <TextareaField label="Diagnóstico" error={errors.diagnostico?.message} {...register('diagnostico')} />
        <TextareaField label="Observações" error={errors.observacoes?.message} {...register('observacoes')} />
      </Section>

      <Section
        id="sec-resp"
        title="Responsáveis"
        description={menor ? 'Paciente menor de idade: o orçamento sai no nome do responsável principal.' : 'Opcional para pacientes adultos.'}
      >
        {menor && fields.length === 0 && (
          <p className="m-0 rounded-field bg-today-bg px-4 py-3 text-sm font-medium text-today-fg">Recomendado: cadastre pelo menos um responsável.</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {fields.map((f, i) => (
            <li key={f.key} className="flex flex-col gap-4 rounded-field border border-line bg-surface p-4 animate-rise">
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-base font-semibold">Responsável {i + 1}</h3>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="-mr-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-field px-3 text-sm font-semibold text-late-fg hover:bg-late-bg"
                >
                  <CloseIcon width={18} height={18} /> Remover<span className="sr-only"> responsável {i + 1}</span>
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome *" autoComplete="off" error={errors.responsaveis?.[i]?.nome?.message} {...register(`responsaveis.${i}.nome`)} />
                <Field label="Parentesco" autoComplete="off" placeholder="Mãe, pai, avó…" {...register(`responsaveis.${i}.parentesco`)} />
                <Field
                  label="CPF"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  error={errors.responsaveis?.[i]?.cpf?.message}
                  {...masked(register(`responsaveis.${i}.cpf`), formatCpf)}
                />
                <Field
                  label="Telefone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="(21) 90000-0000"
                  error={errors.responsaveis?.[i]?.telefone?.message}
                  {...masked(register(`responsaveis.${i}.telefone`), formatPhone)}
                />
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 self-start text-[15px]">
                <input
                  type="radio"
                  name="responsavel-principal"
                  className="m-0 size-[18px] cursor-pointer accent-primary"
                  checked={!!responsaveis[i]?.principal}
                  onChange={() => setPrincipal(i)}
                />
                Responsável principal (nome no orçamento)
              </label>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => append({ nome: '', cpf: '', telefone: '', parentesco: '', principal: fields.length === 0 }, { shouldFocus: true })}
        >
          + Adicionar responsável
        </Button>
      </Section>

      <Section id="sec-lgpd" title="Consentimento (LGPD)">
        {editing ? (
          <p className="m-0 text-[15px] text-ink-soft">
            Consentimento registrado em <strong>{formatIsoDate(consentEm)}</strong>.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-relaxed">
              <input
                type="checkbox"
                className="m-0 mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
                aria-invalid={errors.consentimento ? true : undefined}
                aria-describedby={errors.consentimento ? 'consent-erro' : undefined}
                {...register('consentimento')}
              />
              <span>
                O paciente (ou responsável) autorizou o uso dos dados pessoais e de saúde para atendimento, confecção e orçamento, conforme a LGPD. *
              </span>
            </label>
            <FieldError id="consent-erro">{errors.consentimento?.message}</FieldError>
          </div>
        )}
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <Link to={editing ? `/clientes/${id}` : '/clientes'} className={buttonClass('ghost')}>
          Cancelar
        </Link>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar paciente'}
        </Button>
      </div>
    </form>
  )
}
