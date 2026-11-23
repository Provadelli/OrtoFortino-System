import { Fragment, useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { AvisoRascunho } from '@/components/ui/AvisoRascunho'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button, buttonClass } from '@/components/ui/Button'
import { Atalhos } from '@/components/ui/Atalhos'
import { Combobox } from '@/components/ui/Combobox'
import { Field } from '@/components/ui/Field'
import { Choice, ChoiceGroup, FieldError, Section, TextareaField } from '@/components/ui/FormControls'
import { ArrowLeftIcon, CloseIcon, SearchIcon } from '@/components/ui/icons'
import { PacientePicker } from '@/features/atendimentos/PacientePicker'
import { useProdutos } from '@/features/produtos/api'
import { tipoInfo } from '@/features/produtos/schema'
import { formatMoneyInput, parseBRL, somarDias, todayIso } from '@/lib/br'
import { formatBRL } from '@/lib/format'
import { decimal, dinheiro } from '@/lib/masked'
import { isDbError } from '@/lib/supabase'
import { usePageTitle } from '@/lib/usePageTitle'
import { useRascunho } from '@/lib/rascunho'
import { toForm, useOrcamento, useSalvarOrcamento } from './api'
import { calcular, SEM_SECAO } from './calc'
import { editavel, STATUS_ORCAMENTO } from './constants'
import { useConfiguracoes } from '@/features/configuracoes/api'
import { orcamentoSchema, orcamentoVazio, parseQtd, type ItemForm, type OrcamentoForm } from './schema'

const nomeSecao = (s: string | undefined) => s?.trim() || SEM_SECAO

export default function OrcamentoFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const [hoje] = useState(todayIso)
  const { data: o, isPending, isError } = useOrcamento(id)
  // Orçamento novo já nasce com os padrões de Configurações (se falhar, usa os de sempre).
  const config = useConfiguracoes()

  if (id && isPending) return <PageSkeleton />
  if (!id && config.isPending) return <PageSkeleton />
  if (id && (isError || !o))
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-8">
        <h1 className="m-0 text-2xl font-bold">Orçamento não encontrado</h1>
        <Link to="/orcamentos" className={buttonClass('outline')}>
          Voltar para orçamentos
        </Link>
      </div>
    )
  if (o && !editavel(o.status))
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-8">
        <h1 className="m-0 text-2xl font-bold">O orçamento {o.numero} não pode ser editado</h1>
        <p className="m-0 text-muted">
          Ele está “{STATUS_ORCAMENTO[o.status].label.toLowerCase()}”. Para mudar algo, crie uma nova versão na página do orçamento.
        </p>
        <Link to={`/orcamentos/${o.id}`} className={buttonClass('outline')}>
          Ver orçamento
        </Link>
      </div>
    )

  return <OrcamentoFormInner key={o?.id ?? 'novo'} id={o?.id} numero={o?.numero} base={o?.updated_at ?? null} initial={o ? toForm(o) : orcamentoVazio(params.get('paciente') ?? '', hoje, config.data)} />
}

function OrcamentoFormInner({ id, numero, initial, base }: { id?: string; numero?: string; initial: OrcamentoForm; base: string | null }) {
  const editing = !!id
  usePageTitle(editing ? `Editar ${numero}` : 'Novo orçamento')
  const navigate = useNavigate()
  const salvar = useSalvarOrcamento(id)
  const [serverError, setServerError] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')

  const form = useForm<OrcamentoForm>({ resolver: zodResolver(orcamentoSchema), defaultValues: initial, mode: 'onTouched' })
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = form
  const rascunho = useRascunho(form, `orcamento:${id ?? 'novo'}`, initial, base)
  const { fields, append, insert, remove } = useFieldArray({ control, name: 'itens', keyName: 'key' })
  const [itens, descontoTipo, desconto, emissao, validade] = useWatch({ control, name: ['itens', 'desconto_tipo', 'desconto', 'data_emissao', 'validade'] })
  const [hoje] = useState(todayIso)

  const calc = useMemo(
    () =>
      calcular(
        itens.map((i) => ({ secao: i.secao, quantidade: parseQtd(i.quantidade), preco_unitario: parseBRL(i.preco_unitario) })),
        descontoTipo,
        desconto.trim() ? parseBRL(desconto) : 0,
      ),
    [itens, descontoTipo, desconto],
  )

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  function adicionarAvulso() {
    append(
      { produto_id: '', tipo: 'base', secao: '', descricao: '', detalhe: '', quantidade: '1', unidade: 'un', preco_unitario: '', preco_tabela: null, salvar_na_tabela: false },
      { focusName: `itens.${fields.length}.descricao` },
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const savedId = await salvar.mutateAsync(values)
      rascunho.concluir()
      navigate(`/orcamentos/${savedId}`, { replace: true, state: { notice: editing ? 'Alterações salvas.' : 'Orçamento criado.' } })
    } catch (err) {
      if (isDbError(err) && err.code === '55000') setServerError('Este orçamento foi aprovado ou recusado enquanto você editava. Abra-o de novo e crie uma nova versão.')
      else if (isDbError(err) && (err.code === '23514' || err.code === '22023')) setServerError('Algum dado não passou na validação do servidor. Confira datas, quantidades e preços.')
      else setServerError('Não foi possível salvar agora. Verifique sua conexão e tente de novo.')
    }
  })

  const errorCount = Object.keys(errors).length
  const erroItens = errors.itens?.message ?? errors.itens?.root?.message

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-labelledby="titulo-form">
      <header className="flex flex-col gap-2 animate-fade">
        <Link
          to={editing ? `/orcamentos/${id}` : '/orcamentos'}
          className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline"
        >
          <ArrowLeftIcon /> {editing ? 'Voltar para o orçamento' : 'Voltar para orçamentos'}
        </Link>
        <h1 id="titulo-form" className="m-0 text-[30px] leading-[1.2] font-bold">
          {editing ? `Editar ${numero}` : 'Novo orçamento'}
        </h1>
        <p className="m-0 text-sm text-muted">Campos com * são obrigatórios. Os preços são copiados da tabela e podem ser ajustados em cada item.</p>
      </header>
      <AvisoRascunho em={rascunho.restauradoEm} onDescartar={rascunho.descartar} />

      {(serverError || errorCount > 0) && (
        <div role="alert" className="rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg">
          {serverError ?? (errorCount === 1 ? 'Há 1 campo para corrigir.' : `Há ${errorCount} campos para corrigir.`)}
        </div>
      )}

      <Section id="sec-paciente" title="Paciente">
        <Controller
          control={control}
          name="paciente_id"
          render={({ field, fieldState }) => <PacientePicker value={field.value} onChange={(v) => field.onChange(v)} error={fieldState.error?.message} />}
        />
      </Section>

      <Section id="sec-itens" title="Itens" description="Busque na tabela de preços ou inclua um item avulso. No orçamento, os itens saem agrupados pela seção.">
        <AdicionarProduto
          onAdd={(item) => {
            // entra logo depois do último item da mesma seção (a lista continua agrupada)
            const nome = nomeSecao(item.secao)
            const ultimo = itens.findLastIndex((x) => nomeSecao(x.secao) === nome)
            if (ultimo >= 0) insert(ultimo + 1, item, { shouldFocus: false })
            else append(item, { shouldFocus: false })
            setAnuncio(`${item.descricao} adicionado ao orçamento.`)
          }}
        />
        <p className="sr-only" aria-live="polite">
          {anuncio}
        </p>

        {fields.length === 0 ? (
          <div className="rounded-field border-[1.5px] border-dashed border-field bg-surface px-4 py-6 text-center text-[15px] text-muted">Nenhum item ainda.</div>
        ) : (
          // Lista única e estável: um item nunca é remontado enquanto se digita (ex.: o nome da seção).
          // O cabeçalho aparece quando a seção muda; ao salvar, os itens são agrupados de vez.
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {fields.map((f, i) => {
              // no render logo após append/insert, useWatch ainda traz a lista anterior: usa os valores do próprio campo
              const item: ItemForm = itens[i] ?? f
              const nome = nomeSecao(item.secao)
              const novaSecao = i === 0 || nome !== nomeSecao(itens[i - 1]?.secao)
              return (
                <Fragment key={f.key}>
                  {novaSecao && (
                    <li className="mt-2 flex items-baseline justify-between gap-3 border-b border-line pb-2 first:mt-0">
                      <h3 className="m-0 text-base font-semibold">{nome}</h3>
                      <span className="text-sm text-muted tabular-nums">
                        Subtotal <strong className="text-ink">{formatBRL(calc.secoes.find((s) => s.nome === nome)?.subtotal ?? 0)}</strong>
                      </span>
                    </li>
                  )}
                  <ItemEditor
                    index={i}
                    item={item}
                    total={calc.totais[i] ?? 0}
                    register={register}
                    errors={errors}
                    onRemove={() => {
                      setAnuncio(`${item.descricao || 'Item'} removido.`)
                      remove(i)
                    }}
                  />
                </Fragment>
              )
            })}
          </ul>
        )}
        <Button variant="outline" className="self-start" onClick={adicionarAvulso}>
          + Item avulso
        </Button>
        <FieldError id="itens-erro">{erroItens}</FieldError>
      </Section>

      <Section id="sec-condicoes" title="Condições">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Data de emissão *"
            type="date"
            error={errors.data_emissao?.message}
            actions={
              <Atalhos
                rotulo="Atalhos: emissão"
                itens={[{ rotulo: 'Hoje', valor: hoje }]}
                atual={emissao}
                onEscolher={(v) => setValue('data_emissao', v, { shouldDirty: true, shouldValidate: true })}
              />
            }
            {...register('data_emissao')}
          />
          <Field
            label="Válido até *"
            type="date"
            min={emissao || undefined}
            error={errors.validade?.message}
            actions={
              emissao ? (
                <Atalhos
                  rotulo="Atalhos: validade"
                  itens={[15, 30, 60].map((d) => ({ rotulo: `${d} dias`, valor: somarDias(emissao, d), descricao: `Validade de ${d} dias` }))}
                  atual={validade}
                  onEscolher={(v) => setValue('validade', v, { shouldDirty: true, shouldValidate: true })}
                />
              ) : undefined
            }
            {...register('validade')}
          />
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <ChoiceGroup legend="Desconto">
            <Choice label="Em reais (R$)" value="valor" {...register('desconto_tipo')} />
            <Choice label="Percentual (%)" value="percentual" {...register('desconto_tipo')} />
          </ChoiceGroup>
          <div className="w-full max-w-[200px]">
            {descontoTipo === 'percentual' ? (
              <Field key="pct" label="Desconto (%)" suffix="%" placeholder="0" error={errors.desconto?.message} {...decimal(register('desconto'))} />
            ) : (
              <Field key="rs" label="Desconto (R$)" prefix="R$" placeholder="0,00" error={errors.desconto?.message} {...dinheiro(register('desconto'))} />
            )}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Condições de pagamento" autoComplete="off" placeholder="Ex.: 50% na aprovação e 50% na entrega" error={errors.condicoes_pagamento?.message} {...register('condicoes_pagamento')} />
          <Field label="Prazo de entrega" autoComplete="off" placeholder="Ex.: 20 dias úteis após a aprovação" error={errors.prazo_entrega?.message} {...register('prazo_entrega')} />
        </div>
        <TextareaField label="Observações" hint="Aparecem no orçamento entregue ao paciente." error={errors.observacoes?.message} {...register('observacoes')} />
      </Section>

      <section aria-labelledby="titulo-resumo" className="flex flex-col gap-2 rounded-card border border-line bg-white p-5 sm:p-6 animate-rise">
        <h2 id="titulo-resumo" className="m-0 mb-1 text-[19px] font-semibold">
          Resumo
        </h2>
        <dl className="m-0 flex flex-col gap-1.5 text-[15px]">
          {calc.secoes.map((s) => (
            <div key={s.nome} className="flex justify-between gap-3 text-ink-soft">
              <dt>{s.nome}</dt>
              <dd className="m-0 tabular-nums">{formatBRL(s.subtotal)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-line-soft pt-2">
            <dt>Subtotal</dt>
            <dd className="m-0 tabular-nums">{formatBRL(calc.subtotal)}</dd>
          </div>
          {calc.descontoValor > 0 && (
            <div className="flex justify-between gap-3 text-prod-fg">
              <dt>Desconto{descontoTipo === 'percentual' ? ` (${desconto.trim()}%)` : ''}</dt>
              <dd className="m-0 tabular-nums">− {formatBRL(calc.descontoValor)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-[19px] font-bold">
            <dt>Total</dt>
            <dd className="m-0 tabular-nums">{formatBRL(calc.total)}</dd>
          </div>
        </dl>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-12 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:pb-3">
        <span className="mr-auto text-[15px]">
          Total <strong className="text-[19px] tabular-nums">{formatBRL(calc.total)}</strong>
        </span>
        <Link to={editing ? `/orcamentos/${id}` : '/orcamentos'} className={buttonClass('ghost')}>
          Cancelar
        </Link>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Salvar orçamento'}
        </Button>
      </div>
    </form>
  )
}

type ItemEditorProps = {
  index: number
  item: ItemForm
  total: number
  register: UseFormRegister<OrcamentoForm>
  errors: FieldErrors<OrcamentoForm>
  onRemove: () => void
}

function ItemEditor({ index: i, item, total, register, errors, onRemove }: ItemEditorProps) {
  const e = errors.itens?.[i]
  const legenda = item.descricao.trim() || `Item ${i + 1}`
  const preco = parseBRL(item.preco_unitario)
  const precoDiferente = item.preco_tabela !== null && Number.isFinite(preco) && item.preco_unitario.trim() !== '' && preco !== item.preco_tabela

  return (
    <li className="rounded-field border border-line bg-surface p-4 animate-rise">
      <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <legend className="sr-only">{legenda}</legend>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted">
            {item.produto_id ? <span>{tipoInfo(item.tipo).label} da tabela</span> : <span>Item avulso</span>}
          </div>
          {item.descricao.trim() ? (
            <ConfirmDialog
              triggerLabel={
                <>
                  <CloseIcon width={18} height={18} /> Remover
                </>
              }
              triggerAriaLabel={`Remover ${legenda}`}
              triggerClassName="-my-2 -mr-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-field px-3 text-sm font-semibold text-late-fg hover:bg-late-bg"
              title={`Remover “${legenda}”?`}
              description="O item sai do orçamento e o total é recalculado. A mudança só vale depois de salvar."
              confirmLabel="Remover item"
              onConfirm={async () => onRemove()}
            />
          ) : (
            <button
              type="button"
              onClick={onRemove}
              className="-my-2 -mr-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-field px-3 text-sm font-semibold text-late-fg hover:bg-late-bg"
            >
              <CloseIcon width={18} height={18} /> Remover<span className="sr-only"> {legenda}</span>
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Descrição *" autoComplete="off" error={e?.descricao?.message} {...register(`itens.${i}.descricao`)} />
          {item.produto_id ? (
            <Field label="Detalhe" autoComplete="off" placeholder="Ex.: lado direito, tema dinossauros" error={e?.detalhe?.message} {...register(`itens.${i}.detalhe`)} />
          ) : (
            <Field label="Seção" autoComplete="off" placeholder="Ex.: Adicionais" hint="Vazio = “Outros itens”." error={e?.secao?.message} {...register(`itens.${i}.secao`)} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[110px_110px_minmax(150px,200px)_1fr] sm:items-start">
          <Field label="Quantidade *" error={e?.quantidade?.message} {...decimal(register(`itens.${i}.quantidade`))} />
          <Field label="Unidade *" autoComplete="off" error={e?.unidade?.message} {...register(`itens.${i}.unidade`)} />
          <Field
            label="Preço unitário (R$) *"
            prefix="R$"
            placeholder="0,00"
            error={e?.preco_unitario?.message}
            hint={item.preco_tabela !== null ? `Tabela: ${formatBRL(item.preco_tabela)}` : undefined}
            {...dinheiro(register(`itens.${i}.preco_unitario`))}
          />
          <div className="flex flex-col gap-2 sm:items-end">
            <span className="text-sm font-semibold text-ink">Total do item</span>
            <span className="flex h-[50px] items-center text-[17px] font-bold tabular-nums">{formatBRL(total)}</span>
          </div>
        </div>
        {precoDiferente && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 self-start text-[15px] animate-fade">
            <input type="checkbox" className="m-0 size-[18px] cursor-pointer accent-primary" {...register(`itens.${i}.salvar_na_tabela`)} />
            Salvar {formatBRL(preco)} como novo preço na tabela
          </label>
        )}
      </fieldset>
    </li>
  )
}

/** Menu com a tabela de preços (só ativos, agrupados por categoria): ao escolher, entra como item com o preço da tabela. */
function AdicionarProduto({ onAdd }: { onAdd: (item: ItemForm) => void }) {
  const [texto, setTexto] = useState('')
  const { data: produtos, isPending, isError } = useProdutos()
  const ativos = useMemo(
    () =>
      (produtos ?? [])
        .filter((p) => p.ativo)
        .toSorted((x, y) => (x.categoria ?? 'zzz').localeCompare(y.categoria ?? 'zzz', 'pt-BR') || x.nome.localeCompare(y.nome, 'pt-BR')),
    [produtos],
  )
  const opcoes = useMemo(
    () =>
      ativos.map((p) => ({
        id: p.id,
        rotulo: p.nome,
        detalhe: [tipoInfo(p.tipo).label, p.codigo].filter(Boolean).join(' · '),
        extra: `${formatBRL(p.preco)} /${p.unidade}`,
        grupo: p.categoria || 'Sem categoria',
      })),
    [ativos],
  )

  return (
    <div className="max-w-[560px]">
      <Combobox
        label="Adicionar da tabela de preços"
        value={texto}
        placeholder="Clique para ver a tabela ou digite para buscar"
        icone={<SearchIcon />}
        opcoes={opcoes}
        limite={200}
        hint={isError ? 'Não foi possível carregar a tabela de preços.' : isPending ? 'Carregando a tabela de preços…' : `${ativos.length} produto(s) ativo(s) na tabela.`}
        vazio={ativos.length === 0 ? 'A tabela de preços não tem produtos ativos.' : 'Nenhum produto ativo encontrado.'}
        onInputChange={setTexto}
        onEscolher={(o) => {
          const p = ativos.find((x) => x.id === o.id)
          if (!p) return
          onAdd({
            produto_id: p.id,
            tipo: p.tipo,
            secao: p.categoria ?? '',
            descricao: p.nome,
            detalhe: '',
            quantidade: '1',
            unidade: p.unidade,
            preco_unitario: formatMoneyInput(p.preco),
            preco_tabela: p.preco,
            salvar_na_tabela: false,
          })
          setTexto('')
        }}
      />
    </div>
  )
}
