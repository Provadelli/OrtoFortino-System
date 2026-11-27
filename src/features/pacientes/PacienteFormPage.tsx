import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AvisoRascunho } from '@/components/ui/AvisoRascunho'
import { Button, buttonClass } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { MapaSecoes } from '@/components/ui/MapaSecoes'
import { Choice, ChoiceGroup, FieldError, Section, SelectField, TextareaField } from '@/components/ui/FormControls'
import { ArrowLeftIcon, CloseIcon } from '@/components/ui/icons'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { ageFrom, formatAge, formatCep, formatCnpj, formatCpf, formatIsoDate, formatPhone, isValidCnpj, onlyDigits, UFS } from '@/lib/br'
import { buscarCep, CepIndisponivel } from '@/lib/cep'
import { buscarCnpj, CnpjIndisponivel } from '@/lib/cnpj'
import { isDbError } from '@/lib/supabase'
import { usePageTitle } from '@/lib/usePageTitle'
import { useRascunho } from '@/lib/rascunho'
import { toForm, usePaciente, useSalvarPaciente } from './api'
import { masked } from '@/lib/masked'
import { ORIGENS, pacienteSchema, pacienteVazio, type PacienteForm } from './schema'

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

  return <PacienteFormInner key={id ?? 'novo'} id={id} initial={paciente ? toForm(paciente) : pacienteVazio} consentEm={paciente?.consentimento_lgpd_em} base={paciente?.updated_at ?? null} />
}

function PacienteFormInner({ id, initial, consentEm, base }: { id?: string; initial: PacienteForm; consentEm?: string; base: string | null }) {
  const editing = !!id
  usePageTitle(editing ? `Editar ${initial.nome}` : 'Novo paciente')
  const navigate = useNavigate()
  const salvar = useSalvarPaciente(id)
  const [serverError, setServerError] = useState<string | null>(null)
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10))

  const form = useForm<PacienteForm>({
    resolver: zodResolver(pacienteSchema),
    defaultValues: initial,
    mode: 'onTouched',
  })
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = form

  // CEP → endereço, cidade e UF (ViaCEP). Só preenche o que está vazio ou que o próprio CEP preencheu antes.
  const [cepStatus, setCepStatus] = useState<{ tipo: 'buscando' | 'ok' | 'erro'; texto: string } | null>(null)
  const [autoCep, setAutoCep] = useState<{ endereco: string; cidade: string; uf: string } | null>(null)
  const cep = useWatch({ control, name: 'cep' })
  const [cepInicial] = useState(initial.cep)
  // Com 8 números (e diferente do CEP já salvo), consulta; trocar de CEP ou sair da tela cancela a consulta anterior.
  useEffect(() => {
    const d = onlyDigits(cep)
    if (d.length !== 8 || d === onlyDigits(cepInicial)) return
    const ctrl = new AbortController()
    void consultarCep(d, ctrl)
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consultarCep lê o formulário na hora; só o CEP dispara a consulta
  }, [cep, cepInicial])

  async function consultarCep(d: string, ctrl: AbortController) {
    await Promise.resolve()
    if (ctrl.signal.aborted) return
    setCepStatus({ tipo: 'buscando', texto: 'Buscando endereço…' })
    try {
      const r = await buscarCep(d, ctrl.signal)
      if (ctrl.signal.aborted) return
      if (!r) {
        setCepStatus({ tipo: 'erro', texto: 'CEP não encontrado. Confira os números ou preencha o endereço à mão.' })
        return
      }
      const pode = (campo: 'endereco' | 'cidade') => {
        const atual = getValues(campo).trim()
        return atual === '' || atual === autoCep?.[campo]
      }
      const novo = {
        endereco: [r.logradouro, r.bairro].filter(Boolean).join(' - '),
        cidade: r.cidade,
        uf: r.uf,
      }
      const opts = { shouldDirty: true, shouldValidate: true }
      const preenchidos: string[] = []
      if (novo.endereco && pode('endereco')) {
        setValue('endereco', novo.endereco, opts)
        preenchidos.push('endereço')
      }
      // A UF acompanha a cidade (a UF vem com RJ por padrão; um CEP de outro estado precisa trocá-la).
      if (novo.cidade && pode('cidade')) {
        setValue('cidade', novo.cidade, opts)
        preenchidos.push('cidade')
        if (novo.uf) {
          setValue('uf', novo.uf, opts)
          preenchidos.push('UF')
        }
      }
      setAutoCep(novo)
      setCepStatus({
        tipo: 'ok',
        texto: preenchidos.length
          ? `Preenchido pelo CEP: ${preenchidos.join(', ')}. Complete o número e o complemento.`
          : `CEP de ${[r.cidade, r.uf].filter(Boolean).join(' - ')}. Os campos já preenchidos foram mantidos.`,
      })
      // Leva o cursor para logo depois da rua, onde entra o número.
      if (preenchidos.includes('endereço') && r.logradouro) {
        const el = document.querySelector<HTMLInputElement>('input[name="endereco"]')
        if (el) {
          el.focus()
          el.setSelectionRange(r.logradouro.length, r.logradouro.length)
        }
      }
    } catch (e) {
      if (ctrl.signal.aborted) return
      setCepStatus({
        tipo: 'erro',
        texto: e instanceof CepIndisponivel ? 'Não foi possível consultar o CEP agora. Preencha o endereço à mão.' : 'Não foi possível consultar o CEP.',
      })
    }
  }
  // CNPJ → razão social e endereço (BrasilAPI). Só preenche o que está vazio; falha da API nunca bloqueia o cadastro.
  const [cnpjStatus, setCnpjStatus] = useState<{ tipo: 'buscando' | 'ok' | 'erro'; texto: string } | null>(null)
  const tipoDoc = useWatch({ control, name: 'tipo_documento' })
  const cnpj = useWatch({ control, name: 'cnpj' })
  const [cnpjInicial] = useState(initial.cnpj)
  useEffect(() => {
    const d = onlyDigits(cnpj)
    if (tipoDoc !== 'cnpj' || d.length !== 14 || !isValidCnpj(d) || d === onlyDigits(cnpjInicial)) return
    const ctrl = new AbortController()
    void consultarCnpj(d, ctrl)
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consultarCnpj lê o formulário na hora; só o CNPJ dispara a consulta
  }, [cnpj, tipoDoc, cnpjInicial])

  async function consultarCnpj(d: string, ctrl: AbortController) {
    await Promise.resolve()
    if (ctrl.signal.aborted) return
    setCnpjStatus({ tipo: 'buscando', texto: 'Buscando empresa…' })
    try {
      const r = await buscarCnpj(d, ctrl.signal)
      if (ctrl.signal.aborted) return
      if (!r) {
        setCnpjStatus({ tipo: 'erro', texto: 'CNPJ não encontrado na Receita. Preencha os dados à mão.' })
        return
      }
      const opts = { shouldDirty: true, shouldValidate: true }
      const vazio = (campo: 'nome' | 'cep' | 'endereco' | 'cidade' | 'telefone') => getValues(campo).trim() === ''
      const preenchidos: string[] = []
      if (vazio('nome')) {
        setValue('nome', r.razaoSocial, opts)
        preenchidos.push('nome')
      }
      if (r.endereco && vazio('endereco')) {
        setValue('endereco', r.endereco, opts)
        preenchidos.push('endereço')
      }
      if (r.cidade && vazio('cidade')) {
        setValue('cidade', r.cidade, opts)
        if (r.uf) setValue('uf', r.uf, opts)
        preenchidos.push('cidade')
      }
      if (r.cep && vazio('cep')) {
        setValue('cep', formatCep(r.cep), opts)
        preenchidos.push('CEP')
      }
      if (r.telefone && vazio('telefone')) {
        setValue('telefone', formatPhone(r.telefone), opts)
        preenchidos.push('telefone')
      }
      setCnpjStatus({
        tipo: 'ok',
        texto: preenchidos.length
          ? `Empresa encontrada. Preenchido: ${preenchidos.join(', ')}. Confira os dados.`
          : `Empresa encontrada: ${r.razaoSocial}. Os campos já preenchidos foram mantidos.`,
      })
    } catch (e) {
      if (ctrl.signal.aborted) return
      setCnpjStatus({
        tipo: 'erro',
        texto: e instanceof CnpjIndisponivel ? 'Não foi possível consultar o CNPJ agora. Preencha os dados à mão.' : 'Não foi possível consultar o CNPJ.',
      })
    }
  }
  const rascunho = useRascunho(form, `paciente:${id ?? 'novo'}`, initial, base)
  const { fields, append, remove } = useFieldArray({ control, name: 'responsaveis', keyName: 'key' })
  const [origem, nascimento, responsaveis, nome, cidade, origemNome, consentimento] = useWatch({
    control,
    name: ['origem', 'data_nascimento', 'responsaveis', 'nome', 'cidade', 'origem_nome', 'consentimento'],
  })
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
      rascunho.concluir()
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
      <AvisoRascunho em={rascunho.restauradoEm} onDescartar={rascunho.descartar} />

      {(serverError || errorCount > 0) && (
        <div role="alert" className="rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg">
          {serverError ?? (errorCount === 1 ? 'Há 1 campo para corrigir.' : `Há ${errorCount} campos para corrigir.`)}
        </div>
      )}

      <MapaSecoes
        itens={[
          {
            id: 'sec-dados',
            titulo: 'Dados',
            estado: errors.nome || errors.cpf || errors.data_nascimento || errors.telefone ? 'erro' : nome?.trim() ? 'ok' : 'pendente',
          },
          { id: 'sec-endereco', titulo: 'Endereço', estado: errors.cep || errors.endereco || errors.cidade ? 'erro' : cidade?.trim() ? 'ok' : 'pendente' },
          {
            id: 'sec-origem',
            titulo: 'Origem',
            estado: errors.origem_nome || errors.medico || errors.diagnostico || errors.observacoes ? 'erro' : origem === 'particular' || origemNome?.trim() ? 'ok' : 'pendente',
          },
          { id: 'sec-resp', titulo: 'Responsáveis', estado: errors.responsaveis ? 'erro' : !menor || responsaveis.length ? 'ok' : 'pendente' },
          { id: 'sec-lgpd', titulo: 'Consentimento', estado: errors.consentimento ? 'erro' : editing || consentimento ? 'ok' : 'pendente' },
        ]}
      />

      <Section id="sec-dados" title="Dados do paciente">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={tipoDoc === 'cnpj' ? 'Razão social / nome *' : 'Nome completo *'} autoComplete="off" error={errors.nome?.message} {...register('nome')} />
          </div>
          <ChoiceGroup legend="Documento">
            <Choice label="CPF" value="cpf" {...register('tipo_documento', { onChange: () => setCnpjStatus(null) })} />
            <Choice label="CNPJ" value="cnpj" {...register('tipo_documento', { onChange: () => setCnpjStatus(null) })} />
          </ChoiceGroup>
          {tipoDoc === 'cnpj' ? (
            <Field
              label="CNPJ"
              inputMode="numeric"
              autoComplete="off"
              placeholder="00.000.000/0000-00"
              error={errors.cnpj?.message}
              hint={
                cnpjStatus ? (
                  <span role="status" className={cnpjStatus.tipo === 'erro' ? 'font-medium text-late-fg' : cnpjStatus.tipo === 'ok' ? 'text-prod-fg' : undefined}>
                    {cnpjStatus.texto}
                  </span>
                ) : (
                  'Ao completar o CNPJ, o nome e o endereço da empresa são preenchidos.'
                )
              }
              {...masked(register('cnpj'), formatCnpj)}
            />
          ) : (
            <Field
              label="CPF"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              hint="Opcional para crianças sem CPF."
              error={errors.cpf?.message}
              {...masked(register('cpf'), formatCpf)}
            />
          )}
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

      <Section id="sec-endereco" title="Endereço" description="Digite o CEP para preencher o endereço automaticamente.">
        <div className="grid gap-5 sm:grid-cols-[1fr_1fr_120px]">
          <div className="sm:col-span-1">
            <Field
              label="CEP"
              inputMode="numeric"
              autoComplete="off"
              placeholder="00.000-000"
              error={errors.cep?.message}
              hint={
                cepStatus ? (
                  <span role="status" className={cepStatus.tipo === 'erro' ? 'font-medium text-late-fg' : cepStatus.tipo === 'ok' ? 'text-prod-fg' : undefined}>
                    {cepStatus.texto}
                  </span>
                ) : (
                  'Não sabe o CEP? Preencha o endereço normalmente.'
                )
              }
              {...masked(register('cep', { onChange: (e) => onlyDigits(e.target.value).length !== 8 && setCepStatus(null) }), formatCep)}
            />
          </div>
          <div className="sm:col-span-3">
            <Field label="Endereço" autoComplete="off" placeholder="Rua, número, complemento - bairro" error={errors.endereco?.message} {...register('endereco')} />
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
                <ConfirmDialog
                  triggerLabel={
                    <>
                      <CloseIcon width={18} height={18} /> Remover
                    </>
                  }
                  triggerAriaLabel={`Remover responsável ${i + 1}`}
                  triggerClassName="-mr-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-field px-3 text-sm font-semibold text-late-fg hover:bg-late-bg"
                  title={`Remover o responsável ${i + 1}?`}
                  description="Os dados deste responsável saem do cadastro. A mudança só vale depois de salvar."
                  confirmLabel="Remover responsável"
                  onConfirm={async () => remove(i)}
                />
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

      <div className="sticky bottom-0 z-10 -mx-4 -mb-12 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:pb-3">
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
