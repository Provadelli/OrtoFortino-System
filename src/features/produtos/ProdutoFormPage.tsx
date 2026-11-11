import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { Button, buttonClass } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Choice, ChoiceGroup, Section, TextareaField } from '@/components/ui/FormControls'
import { ArrowLeftIcon } from '@/components/ui/icons'
import { StatusChip } from '@/components/ui/StatusChip'
import { parseBRL } from '@/lib/br'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { dinheiro } from '@/lib/masked'
import { isDbError } from '@/lib/supabase'
import { usePageTitle } from '@/lib/usePageTitle'
import { toForm, useAlternarAtivo, useExcluirProduto, useProduto, useProdutos, useSalvarProduto, type ProdutoDetalhe } from './api'
import { produtoSchema, produtoVazio, TIPOS_PRODUTO, UNIDADES, type ProdutoForm } from './schema'

export default function ProdutoFormPage() {
  const { id } = useParams()
  const { data: produto, isPending, isError } = useProduto(id)

  if (id && isPending) return <PageSkeleton />
  if (id && (isError || !produto))
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-8">
        <h1 className="m-0 text-2xl font-bold">Produto não encontrado</h1>
        <p className="m-0 text-muted">Ele pode ter sido excluído.</p>
        <Link to="/tabela-de-precos" className={buttonClass('outline')}>
          Voltar para a tabela de preços
        </Link>
      </div>
    )

  return <ProdutoFormInner key={produto?.id ?? 'novo'} produto={produto ?? undefined} />
}

const dataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const ORIGEM: Record<string, string> = { manual: 'Edição manual', importacao: 'Importação de planilha', orcamento: 'Salvo a partir de orçamento' }

function ProdutoFormInner({ produto }: { produto?: ProdutoDetalhe }) {
  const editing = !!produto
  usePageTitle(editing ? `Editar ${produto.nome}` : 'Novo produto')
  const navigate = useNavigate()
  const location = useLocation()
  const [notice, setNotice] = useState((location.state as { notice?: string } | null)?.notice)
  const salvar = useSalvarProduto(produto?.id)
  const { data: todos } = useProdutos()
  const [serverError, setServerError] = useState<string | null>(null)
  const categoriasId = useId()
  const unidadesId = useId()

  const categorias = useMemo(
    () => [...new Set((todos ?? []).map((p) => p.categoria?.trim()).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [todos],
  )

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProdutoForm>({
    resolver: zodResolver(produtoSchema),
    defaultValues: produto ? toForm(produto) : produtoVazio,
    mode: 'onTouched',
  })
  const precoTxt = useWatch({ control, name: 'preco' })
  const novoPreco = parseBRL(precoTxt)
  const precoMudou = editing && Number.isFinite(novoPreco) && precoTxt.trim() !== '' && novoPreco !== produto.preco

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    setNotice(undefined)
    try {
      await salvar.mutateAsync(values)
      navigate('/tabela-de-precos', { replace: true, state: { notice: editing ? `“${values.nome.trim()}” atualizado.` : `“${values.nome.trim()}” adicionado à tabela.` } })
    } catch (err) {
      if (isDbError(err) && err.code === '23505') {
        const campo = err.message.includes('codigo') ? 'codigo' : 'nome'
        setError(campo, { message: campo === 'codigo' ? 'Já existe um produto com este código.' : 'Já existe um produto com este nome.' }, { shouldFocus: true })
      } else if (isDbError(err) && err.code === '23514') {
        setServerError('Algum dado não passou na validação do servidor. Confira o nome e o preço.')
      } else {
        setServerError('Não foi possível salvar agora. Verifique sua conexão e tente de novo.')
      }
    }
  })

  const errorCount = Object.keys(errors).length

  return (
    <>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-labelledby="titulo-form">
        <header className="flex flex-col gap-2 animate-fade">
          <Link
            to="/tabela-de-precos"
            className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline"
          >
            <ArrowLeftIcon /> Voltar para a tabela de preços
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 id="titulo-form" className="m-0 text-[30px] leading-[1.2] font-bold">
              {editing ? produto.nome : 'Novo produto'}
            </h1>
            {editing && !produto.ativo && <StatusChip tone="draft" size="md">Inativo</StatusChip>}
          </div>
          <p className="m-0 text-sm text-muted">Campos com * são obrigatórios.</p>
        </header>

        {notice && (
          <output className="block rounded-field border border-[#bfe6d2] bg-prod-bg px-4 py-3 text-[15px] font-medium text-prod-fg animate-fade">
            {notice}
          </output>
        )}
        {(serverError || errorCount > 0) && (
          <div role="alert" className="rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg">
            {serverError ?? (errorCount === 1 ? 'Há 1 campo para corrigir.' : `Há ${errorCount} campos para corrigir.`)}
          </div>
        )}

        <Section id="sec-produto" title="Produto">
          <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
            <Field label="Nome *" autoComplete="off" error={errors.nome?.message} {...register('nome')} />
            <Field label="Código" autoComplete="off" placeholder="Ex.: AFO-01" hint="Opcional. Ajuda a casar a planilha." error={errors.codigo?.message} {...register('codigo')} />
          </div>
          <ChoiceGroup legend="Tipo *" hint="Adicionais são acréscimos a um produto-base no orçamento, como tiras, forros e personalização.">
            {TIPOS_PRODUTO.map((t) => (
              <Choice key={t.value} label={t.label} value={t.value} {...register('tipo')} />
            ))}
          </ChoiceGroup>
          <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
            <Field
              label="Categoria"
              autoComplete="off"
              list={categoriasId}
              placeholder="Ex.: Órteses de membro inferior"
              hint="Vira o título da seção no orçamento."
              error={errors.categoria?.message}
              {...register('categoria')}
            />
            <Field label="Unidade *" autoComplete="off" list={unidadesId} error={errors.unidade?.message} {...register('unidade')} />
          </div>
          <datalist id={categoriasId}>
            {categorias.map((c) => (
              // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- option de datalist é sugestão do campo rotulado, não um controle
              <option key={c} value={c} />
            ))}
          </datalist>
          <datalist id={unidadesId}>
            {UNIDADES.map((u) => (
              // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- option de datalist é sugestão do campo rotulado, não um controle
              <option key={u} value={u} />
            ))}
          </datalist>
          <TextareaField label="Descrição" hint="Aparece abaixo do nome no orçamento." error={errors.descricao?.message} {...register('descricao')} />
        </Section>

        <Section id="sec-preco" title="Preço">
          <div className="max-w-[260px]">
            <Field
              label="Preço (R$) *"
              prefix="R$"
              placeholder="0,00"
              error={errors.preco?.message}
              hint={
                precoMudou ? (
                  <>
                    Antes: {formatBRL(produto.preco)} → agora {formatBRL(novoPreco)}. A mudança fica no histórico; orçamentos já feitos não mudam.
                  </>
                ) : undefined
              }
              {...dinheiro(register('preco'))}
            />
          </div>
        </Section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
          <Link to="/tabela-de-precos" className={buttonClass('ghost')}>
            Cancelar
          </Link>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar à tabela'}
          </Button>
        </div>
      </form>

      {editing && (
        <>
          <Historico produto={produto} />
          <Situacao produto={produto} onNotice={setNotice} />
        </>
      )}
    </>
  )
}

function Historico({ produto }: { produto: ProdutoDetalhe }) {
  const h = produto.historico_precos
  return (
    <Section id="sec-historico" title="Histórico de preços" description="Cada mudança de preço fica registrada, com data e origem.">
      {h.length === 0 ? (
        <p className="m-0 text-muted">Nenhuma alteração registrada.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {h.map((x, i) => {
            const diff = x.preco_anterior === null ? null : x.preco_novo - x.preco_anterior
            return (
              <li key={x.id} className={cn('flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3', i > 0 && 'border-t border-line-soft')}>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold tabular-nums">
                    {x.preco_anterior === null ? (
                      <>Preço inicial: {formatBRL(x.preco_novo)}</>
                    ) : (
                      <>
                        {formatBRL(x.preco_anterior)} <span aria-hidden="true">→</span>
                        <span className="sr-only">para</span> {formatBRL(x.preco_novo)}
                      </>
                    )}
                  </span>
                  <span className="text-[13px] text-muted">{ORIGEM[x.origem] ?? x.origem}</span>
                </div>
                <div className="flex items-center gap-3">
                  {diff !== null && diff !== 0 && (
                    <StatusChip tone={diff > 0 ? 'today' : 'prod'}>{`${diff > 0 ? '+' : '−'}${formatBRL(Math.abs(diff))}`}</StatusChip>
                  )}
                  <time dateTime={x.alterado_em} className="text-[13px] whitespace-nowrap text-muted tabular-nums">
                    {dataHora.format(new Date(x.alterado_em))}
                  </time>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}

function Situacao({ produto, onNotice }: { produto: ProdutoDetalhe; onNotice: (msg: string) => void }) {
  const alternar = useAlternarAtivo()
  const excluir = useExcluirProduto()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  async function onAlternar() {
    setErro(null)
    try {
      await alternar.mutateAsync({ id: produto.id, ativo: !produto.ativo })
      onNotice(produto.ativo ? 'Produto desativado. Ele não aparece mais para novos orçamentos.' : 'Produto reativado.')
    } catch {
      setErro('Não foi possível atualizar agora. Tente de novo.')
    }
  }

  async function onExcluir() {
    setErroExcluir(null)
    try {
      await excluir.mutateAsync(produto.id)
      dialog.current?.close()
      navigate('/tabela-de-precos', { replace: true, state: { notice: `“${produto.nome}” excluído da tabela.` } })
    } catch (err) {
      setErroExcluir(
        isDbError(err) && (err.code === '23503' || err.code === '23001')
          ? 'Este produto já foi usado em orçamentos e não pode ser excluído. Desative-o para tirá-lo da lista.'
          : 'Não foi possível excluir agora. Tente de novo.',
      )
    }
  }

  return (
    <Section
      id="sec-situacao"
      title="Situação"
      description={produto.ativo ? 'Produtos inativos ficam guardados, mas não aparecem para novos orçamentos.' : 'Este produto está inativo e não aparece para novos orçamentos.'}
    >
      {erro && (
        <p role="alert" className="m-0 text-sm font-medium text-late-fg">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" loading={alternar.isPending} onClick={() => void onAlternar()}>
          {produto.ativo ? 'Desativar produto' : 'Reativar produto'}
        </Button>
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-field px-3 text-sm font-semibold text-late-fg hover:bg-late-bg"
        >
          Excluir
        </button>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="dlg-excluir-prod"
        aria-describedby="dlg-excluir-prod-texto"
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-card border border-line bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/40 open:animate-rise"
      >
        <h2 id="dlg-excluir-prod" className="m-0 text-xl font-semibold">
          Excluir “{produto.nome}”?
        </h2>
        <p id="dlg-excluir-prod-texto" className="mt-3 mb-0 text-[15px] text-ink-soft">
          O produto e o histórico de preços dele serão apagados. Para só tirá-lo da lista, prefira “Desativar produto”.
        </p>
        {erroExcluir && (
          <p role="alert" className="mt-3 mb-0 text-sm font-medium text-late-fg">
            {erroExcluir}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>
            Voltar
          </Button>
          <Button variant="danger" loading={excluir.isPending} onClick={() => void onExcluir()}>
            Excluir definitivamente
          </Button>
        </div>
      </dialog>
    </Section>
  )
}
