import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AvisoRascunho } from '@/components/ui/AvisoRascunho'
import { Button, buttonClass } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Choice, ChoiceGroup, Section, SelectField, TextareaField } from '@/components/ui/FormControls'
import { ArrowLeftIcon } from '@/components/ui/icons'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { StatusChip } from '@/components/ui/StatusChip'
import { parseBRL, todayIso } from '@/lib/br'
import { formatBRL } from '@/lib/format'
import { isDbError } from '@/lib/supabase'
import { usePageTitle } from '@/lib/usePageTitle'
import { useRascunho } from '@/lib/rascunho'
import { useConfiguracoes } from '@/features/configuracoes/api'
import { toForm, useAtendimento, useSalvarAtendimento } from './api'
import { CATEGORIAS, ESPECIFICACOES, FORMAS, LATERALIDADES, PAGAMENTO, PRODUTOS, STATUS, TIPOS, type StatusPagamento } from './constants'
import { PacientePicker } from './PacientePicker'
import { atendimentoSchema, atendimentoVazio, type AtendimentoForm } from './schema'

export default function AtendimentoFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const [hoje] = useState(todayIso)
  const { data, isPending, isError } = useAtendimento(id)

  if (id && isPending) return <PageSkeleton />
  if (id && (isError || !data))
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-8">
        <h1 className="m-0 text-2xl font-bold">Atendimento não encontrado</h1>
        <Link to="/atendimentos" className={buttonClass('outline')}>
          Voltar para atendimentos
        </Link>
      </div>
    )

  const initial = data ? toForm(data) : atendimentoVazio(params.get('paciente') ?? '', hoje)
  return <Inner key={id ?? 'novo'} id={id} numero={data?.numero} initial={initial} hoje={hoje} base={data?.updated_at ?? null} />
}

function statusPagamento(valor: number, pago: number): StatusPagamento {
  if (!(valor > 0)) return 'isento'
  if (pago >= valor) return 'pago'
  return pago > 0 ? 'parcial' : 'pendente'
}

function Inner({ id, numero, initial, hoje, base }: { id?: string; numero?: number; initial: AtendimentoForm; hoje: string; base: string | null }) {
  const editing = !!id
  usePageTitle(editing ? `Editar atendimento nº ${numero}` : 'Novo atendimento')
  const navigate = useNavigate()
  const salvar = useSalvarAtendimento(id)
  const [serverError, setServerError] = useState<string | null>(null)
  // Sugestões editáveis em Configurações (enquanto carregam, valem as da ficha em papel).
  const { data: config } = useConfiguracoes()
  const produtosFicha = config?.ficha_produtos ?? PRODUTOS
  const especificacoes = useMemo(() => {
    const lista = config?.ficha_especificacoes ?? ESPECIFICACOES
    // Uma especificação já marcada continua visível mesmo que tenha saído da lista.
    const marcadas = (initial.ficha?.especificacoes ?? []).filter((e) => !lista.includes(e))
    return [...lista, ...marcadas]
  }, [config, initial])

  const form = useForm<AtendimentoForm>({ resolver: zodResolver(atendimentoSchema), defaultValues: initial, mode: 'onTouched' })
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = form
  const rascunho = useRascunho(form, `atendimento:${id ?? 'novo'}`, initial, base)

  const [categoria, comFicha, tipo, compLado, nomeNaOrtese, valor, valorPago] = useWatch({
    control,
    name: ['categoria', 'com_ficha', 'ficha.tipo', 'ficha.compensacao_lado', 'ficha.nome_na_ortese', 'valor', 'valor_pago'],
  })
  const pg = PAGAMENTO[statusPagamento(parseBRL(valor), parseBRL(valorPago))]
  const restante = Math.max(0, (parseBRL(valor) || 0) - (parseBRL(valorPago) || 0))

  useEffect(() => {
    if (!isDirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [isDirty])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const savedId = await salvar.mutateAsync(values)
      rascunho.concluir()
      navigate(`/atendimentos/${savedId}`, { replace: true, state: { notice: editing ? 'Alterações salvas.' : 'Atendimento aberto com sucesso.' } })
    } catch (err) {
      setServerError(
        isDbError(err) && err.code === '23514'
          ? 'Algum dado não passou na validação do servidor. Confira datas e valores.'
          : 'Não foi possível salvar agora. Verifique sua conexão e tente de novo.',
      )
    }
  })

  const errorCount = Object.keys(errors).length + (errors.ficha ? Object.keys(errors.ficha).length - 1 : 0)
  const voltar = editing ? `/atendimentos/${id}` : initial.paciente_id ? `/clientes/${initial.paciente_id}` : '/atendimentos'

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-labelledby="titulo-form">
      <header className="flex flex-col gap-2 animate-fade">
        <Link to={voltar} className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline">
          <ArrowLeftIcon /> Voltar
        </Link>
        <h1 id="titulo-form" className="m-0 text-[30px] leading-[1.2] font-bold">
          {editing ? `Editar atendimento nº ${numero}` : 'Novo atendimento'}
        </h1>
        <p className="m-0 text-sm text-muted">Campos com * são obrigatórios.</p>
      </header>
      <AvisoRascunho em={rascunho.restauradoEm} onDescartar={rascunho.descartar} />

      {(serverError || errorCount > 0) && (
        <div role="alert" className="rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg">
          {serverError ?? (errorCount === 1 ? 'Há 1 campo para corrigir.' : `Há ${errorCount} campos para corrigir.`)}
        </div>
      )}

      <Section id="sec-atend" title="Atendimento">
        <Controller
          control={control}
          name="paciente_id"
          render={({ field, fieldState }) =>
            editing ? (
              <input type="hidden" {...field} />
            ) : (
              <PacientePicker value={field.value} onChange={(v) => field.onChange(v)} error={fieldState.error?.message} />
            )
          }
        />
        <ChoiceGroup legend="Categoria *" hint={categoria === 'reparo' ? 'Reparo sem custo: deixe o valor em branco ou zero.' : undefined}>
          {CATEGORIAS.map((c) => (
            <Choice key={c.value} label={c.label} value={c.value} {...register('categoria')} />
          ))}
        </ChoiceGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Descrição curta" placeholder="Ex.: AFO articulada bilateral" autoComplete="off" error={errors.descricao?.message} {...register('descricao')} />
          <SelectField label="Status *" {...register('status')}>
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
        </div>
      </Section>

      <Section id="sec-datas" title="Datas" description="Fechamento e conclusão são preenchidos sozinhos quando o status avança.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Primeiro contato *" type="date" max={hoje} error={errors.data_primeiro_contato?.message} {...register('data_primeiro_contato')} />
          <Field label="Fechamento" type="date" error={errors.data_fechamento?.message} {...register('data_fechamento')} />
          <Field label="Prazo de entrega" type="date" error={errors.prazo_entrega?.message} {...register('prazo_entrega')} />
          <Field label="Conclusão" type="date" error={errors.data_conclusao?.message} {...register('data_conclusao')} />
        </div>
      </Section>

      <Section id="sec-ficha" title="Ficha técnica" description="Os mesmos campos da ficha em papel.">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start text-[15px] font-medium">
          <input type="checkbox" className="m-0 size-5 cursor-pointer accent-primary" {...register('com_ficha')} />
          Preencher ficha técnica neste atendimento
        </label>

        {comFicha && (
          <div className="flex flex-col gap-5 animate-fade">
            <ChoiceGroup legend="Tipo *">
              {TIPOS.map((t) => (
                <Choice key={t.value} label={t.label} value={t.value} {...register('ficha.tipo')} />
              ))}
            </ChoiceGroup>

            {tipo !== 'protese' ? (
              <>
                <ChoiceGroup legend="Lateralidade">
                  {LATERALIDADES.map((l) => (
                    <Choice key={l.value} label={l.label} value={l.value} {...register('ficha.lateralidade')} />
                  ))}
                </ChoiceGroup>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Produto"
                    list="lista-produtos"
                    autoComplete="off"
                    placeholder="Escolha ou digite"
                    hint="Sugestões da ficha em papel; aceita texto livre."
                    error={errors.ficha?.produto?.message}
                    {...register('ficha.produto')}
                  />
                  <datalist id="lista-produtos">
                    {produtosFicha.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </datalist>
                  <Field label="Tamanho do calçado" autoComplete="off" inputMode="numeric" error={errors.ficha?.tamanho_calcado?.message} {...register('ficha.tamanho_calcado')} />
                </div>

                <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 p-0 text-sm font-semibold text-ink">Especificações</legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {especificacoes.map((e) => (
                      <Choice key={e} type="checkbox" label={e} value={e} {...register('ficha.especificacoes')} />
                    ))}
                  </div>
                </fieldset>

                <div className="grid items-end gap-5 sm:grid-cols-[auto_1fr]">
                  <ChoiceGroup legend="Compensação">
                    <Choice label="Nenhuma" value="" {...register('ficha.compensacao_lado')} />
                    <Choice label="D" value="D" {...register('ficha.compensacao_lado')} />
                    <Choice label="E" value="E" {...register('ficha.compensacao_lado')} />
                  </ChoiceGroup>
                  {compLado && (
                    <div className="animate-fade">
                      <Field label="Medida da compensação" placeholder="Ex.: 1,5 cm" autoComplete="off" error={errors.ficha?.compensacao_medida?.message} {...register('ficha.compensacao_medida')} />
                    </div>
                  )}
                </div>

                <TextareaField label="Medidas ML" rows={2} error={errors.ficha?.medidas_ml?.message} {...register('ficha.medidas_ml')} />

                <fieldset className="m-0 flex min-w-0 flex-col gap-4 rounded-field border border-line p-4">
                  <legend className="px-1 text-sm font-semibold text-ink">Personalização</legend>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start text-[15px]">
                    <input type="checkbox" className="m-0 size-5 cursor-pointer accent-primary" {...register('ficha.nome_na_ortese')} />
                    Nome na órtese
                  </label>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field label={nomeNaOrtese ? 'Tema' : 'Tema (opcional)'} autoComplete="off" placeholder="Ex.: dinossauros" error={errors.ficha?.tema?.message} {...register('ficha.tema')} />
                    <Field label="Cor do forro" autoComplete="off" error={errors.ficha?.cor_forro?.message} {...register('ficha.cor_forro')} />
                    <Field label="Cor da tira" autoComplete="off" error={errors.ficha?.cor_tira?.message} {...register('ficha.cor_tira')} />
                  </div>
                </fieldset>
              </>
            ) : (
              <>
                <div className="grid gap-5 lg:grid-cols-3">
                  <ChoiceGroup legend="Membro">
                    <Choice label="Superior" value="superior" {...register('ficha.protese_membro')} />
                    <Choice label="Inferior" value="inferior" {...register('ficha.protese_membro')} />
                  </ChoiceGroup>
                  <ChoiceGroup legend="Nível">
                    <Choice label="Transtibial" value="transtibial" {...register('ficha.protese_nivel')} />
                    <Choice label="Transfemoral" value="transfemoral" {...register('ficha.protese_nivel')} />
                  </ChoiceGroup>
                  <ChoiceGroup legend="Lado">
                    <Choice label="D" value="D" {...register('ficha.protese_lado')} />
                    <Choice label="E" value="E" {...register('ficha.protese_lado')} />
                  </ChoiceGroup>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Liner" autoComplete="off" error={errors.ficha?.liner?.message} {...register('ficha.liner')} />
                  <Field label="Tamanho do pé" autoComplete="off" error={errors.ficha?.tamanho_pe?.message} {...register('ficha.tamanho_pe')} />
                </div>
              </>
            )}
            <TextareaField label="Observações da ficha" error={errors.ficha?.observacoes?.message} {...register('ficha.observacoes')} />
          </div>
        )}
      </Section>

      <Section id="sec-pag" title="Pagamento">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Valor (R$)" inputMode="decimal" autoComplete="off" placeholder="0,00" error={errors.valor?.message} {...register('valor')} />
          <Field label="Valor pago (R$)" inputMode="decimal" autoComplete="off" placeholder="0,00" error={errors.valor_pago?.message} {...register('valor_pago')} />
          <div className="flex flex-col gap-2" aria-live="polite">
            <span className="text-sm font-semibold text-ink">Situação</span>
            <div className="flex min-h-[50px] flex-wrap items-center gap-2">
              <StatusChip tone={pg.tone} size="md">
                {pg.label}
              </StatusChip>
              {restante > 0 && <span className="text-sm text-muted">falta {formatBRL(restante)}</span>}
            </div>
          </div>
          <SelectField label="Forma de pagamento" {...register('pagamento_forma')}>
            <option value="">—</option>
            {FORMAS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </SelectField>
          <Field label="Detalhe" placeholder="Ex.: 3x no cartão, entrada + 2x" autoComplete="off" error={errors.pagamento_detalhe?.message} {...register('pagamento_detalhe')} />
          <Field label="Data do pagamento" type="date" error={errors.data_pagamento?.message} {...register('data_pagamento')} />
        </div>
        {parseBRL(valor) > 0 && parseBRL(valorPago) < parseBRL(valor) && (
          <Button variant="ghost" className="self-start" onClick={() => setValue('valor_pago', valor, { shouldDirty: true, shouldValidate: true })}>
            Marcar como pago integralmente
          </Button>
        )}
      </Section>

      <Section id="sec-obs" title="Observações gerais">
        <TextareaField label="Observações" error={errors.observacoes?.message} {...register('observacoes')} />
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <Link to={voltar} className={buttonClass('ghost')}>
          Cancelar
        </Link>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Abrir atendimento'}
        </Button>
      </div>
    </form>
  )
}
