import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Section, TextareaField } from '@/components/ui/FormControls'
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from '@/components/ui/icons'
import { formatCep, formatCnpj, formatPhone } from '@/lib/br'
import { cn } from '@/lib/cn'
import { masked } from '@/lib/masked'
import { isDbError } from '@/lib/supabase'
import { usePageTitle } from '@/lib/usePageTitle'
import { useConfiguracoes, useSalvarConfiguracoes } from './api'
import { ContaSection, SegurancaSection } from './ContaSeguranca'
import { Retorno, Rodape } from './Retorno'
import {
  empresaForm,
  empresaPayload,
  empresaSchema,
  erroItemLista,
  moverItem,
  padroesForm,
  padroesPayload,
  padroesSchema,
  type Configuracoes,
  type EmpresaForm,
  type PadroesForm,
} from './schema'

const SECOES = [
  { id: 'sec-empresa', label: 'Empresa' },
  { id: 'sec-padroes', label: 'Padrões do orçamento' },
  { id: 'sec-listas', label: 'Listas da ficha técnica' },
  { id: 'sec-conta', label: 'Minha conta' },
  { id: 'sec-seguranca', label: 'Segurança' },
]

export default function ConfiguracoesPage() {
  usePageTitle('Configurações')
  const { data: config, isPending, isError, refetch } = useConfiguracoes()

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 animate-fade">
        <h1 className="m-0 text-[30px] leading-[1.2] font-bold">Configurações</h1>
        <p className="m-0 max-w-prose text-muted">Dados da empresa nos documentos, valores que já vêm preenchidos e a sua conta.</p>
      </header>

      <nav aria-label="Seções desta página" className="animate-fade">
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {SECOES.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-primary-ink no-underline hover:bg-surface-hover"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {isPending ? (
        <PageSkeleton />
      ) : isError || !config ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-6">
          <p className="m-0 font-semibold">Não foi possível carregar as configurações da empresa.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <EmpresaSection config={config} />
          <PadroesSection config={config} />
          <ListasSection config={config} />
        </>
      )}

      <ContaSection />
      <SegurancaSection />
    </div>
  )
}

const erroBanco = (err: unknown) =>
  isDbError(err) && err.code === '23514'
    ? 'Algum dado não passou na validação do servidor. Confira os campos.'
    : 'Não foi possível salvar agora. Verifique sua conexão e tente de novo.'

// ───── Empresa ─────

function EmpresaSection({ config }: { config: Configuracoes }) {
  const salvar = useSalvarConfiguracoes()
  const [ok, setOk] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EmpresaForm>({ resolver: zodResolver(empresaSchema), defaultValues: empresaForm(config), mode: 'onTouched' })

  const onSubmit = handleSubmit(async (v) => {
    setOk(null)
    setErro(null)
    try {
      const novo = await salvar.mutateAsync(empresaPayload(v))
      reset(empresaForm(novo))
      setOk('Dados da empresa salvos. Os próximos PDFs já saem com eles.')
    } catch (err) {
      setErro(erroBanco(err))
    }
  })

  return (
    <Section id="sec-empresa" title="Empresa" description="Aparecem no rodapé do PDF do orçamento e nas telas de entrada.">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-labelledby="sec-empresa">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome da empresa *" autoComplete="organization" error={errors.empresa_nome?.message} {...register('empresa_nome')} />
          <Field label="Slogan" autoComplete="off" error={errors.empresa_slogan?.message} {...register('empresa_slogan')} />
          <Field
            label="CNPJ"
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            error={errors.empresa_cnpj?.message}
            {...masked(register('empresa_cnpj'), formatCnpj)}
          />
          <Field
            label="Telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(21) 96497-3837"
            error={errors.empresa_telefone?.message}
            {...masked(register('empresa_telefone'), formatPhone)}
          />
          <Field label="E-mail" type="email" inputMode="email" autoComplete="email" spellCheck={false} error={errors.empresa_email?.message} {...register('empresa_email')} />
        </div>
        <div className="grid gap-5 sm:grid-cols-[1fr_220px_160px]">
          <Field label="Endereço" autoComplete="street-address" error={errors.empresa_endereco?.message} {...register('empresa_endereco')} />
          <Field label="Cidade - UF" autoComplete="off" placeholder="Nova Iguaçu - RJ" error={errors.empresa_cidade?.message} {...register('empresa_cidade')} />
          <Field
            label="CEP"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00.000-000"
            error={errors.empresa_cep?.message}
            {...masked(register('empresa_cep'), formatCep)}
          />
        </div>
        <Retorno ok={ok} erro={erro} />
        <Rodape>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {isSubmitting ? 'Salvando…' : 'Salvar dados da empresa'}
          </Button>
        </Rodape>
      </form>
    </Section>
  )
}

// ───── Padrões do orçamento ─────

function PadroesSection({ config }: { config: Configuracoes }) {
  const salvar = useSalvarConfiguracoes()
  const [ok, setOk] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PadroesForm>({ resolver: zodResolver(padroesSchema), defaultValues: padroesForm(config), mode: 'onTouched' })

  const onSubmit = handleSubmit(async (v) => {
    setOk(null)
    setErro(null)
    try {
      const novo = await salvar.mutateAsync(padroesPayload(v))
      reset(padroesForm(novo))
      setOk('Padrões salvos. Valem para os próximos orçamentos; os já criados não mudam.')
    } catch (err) {
      setErro(erroBanco(err))
    }
  })

  return (
    <Section id="sec-padroes" title="Padrões do orçamento" description="Já vêm preenchidos em cada orçamento novo e podem ser alterados nele.">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-labelledby="sec-padroes">
        <div className="max-w-[220px]">
          <Field
            label="Validade (dias) *"
            inputMode="numeric"
            autoComplete="off"
            hint="Contados a partir da emissão."
            error={errors.orc_validade_dias?.message}
            {...register('orc_validade_dias')}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Condições de pagamento"
            autoComplete="off"
            placeholder="Ex.: 50% na aprovação e 50% na entrega"
            error={errors.orc_condicoes_pagamento?.message}
            {...register('orc_condicoes_pagamento')}
          />
          <Field
            label="Prazo de entrega"
            autoComplete="off"
            placeholder="Ex.: 20 dias úteis após a aprovação"
            error={errors.orc_prazo_entrega?.message}
            {...register('orc_prazo_entrega')}
          />
        </div>
        <TextareaField label="Observações" hint="Aparecem no orçamento entregue ao paciente." error={errors.orc_observacoes?.message} {...register('orc_observacoes')} />
        <Retorno ok={ok} erro={erro} />
        <Rodape>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {isSubmitting ? 'Salvando…' : 'Salvar padrões'}
          </Button>
        </Rodape>
      </form>
    </Section>
  )
}

// ───── Listas da ficha técnica ─────

function ListasSection({ config }: { config: Configuracoes }) {
  const salvar = useSalvarConfiguracoes()
  const [produtos, setProdutos] = useState(config.ficha_produtos)
  const [especificacoes, setEspecificacoes] = useState(config.ficha_especificacoes)
  const [ok, setOk] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const mudou = produtos.join('\n') !== config.ficha_produtos.join('\n') || especificacoes.join('\n') !== config.ficha_especificacoes.join('\n')

  async function onSalvar() {
    setOk(null)
    setErro(null)
    try {
      const novo = await salvar.mutateAsync({ ficha_produtos: produtos, ficha_especificacoes: especificacoes })
      setProdutos(novo.ficha_produtos)
      setEspecificacoes(novo.ficha_especificacoes)
      setOk('Listas salvas. Fichas já preenchidas não mudam.')
    } catch (err) {
      setErro(erroBanco(err))
    }
  }

  return (
    <Section
      id="sec-listas"
      title="Listas da ficha técnica"
      description="Sugestões que aparecem ao preencher a ficha do atendimento. O campo de produto continua aceitando texto livre."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <ListaEditavel titulo="Produtos sugeridos" singular="produto" itens={produtos} onChange={setProdutos} />
        <ListaEditavel titulo="Especificações" singular="especificação" itens={especificacoes} onChange={setEspecificacoes} />
      </div>
      <Retorno ok={ok} erro={erro} />
      <Rodape>
        {mudou && <span className="text-sm text-muted">Há alterações não salvas.</span>}
        <Button loading={salvar.isPending} disabled={!mudou} onClick={() => void onSalvar()}>
          {salvar.isPending ? 'Salvando…' : 'Salvar listas'}
        </Button>
      </Rodape>
    </Section>
  )
}

type Foco = { item: string; acao: 'subir' | 'descer' | 'remover' } | { item: null; acao: 'novo' }

function ListaEditavel({ titulo, singular, itens, onChange }: { titulo: string; singular: string; itens: string[]; onChange: (v: string[]) => void }) {
  const id = useId()
  const lista = useRef<HTMLDivElement>(null)
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [foco, setFoco] = useState<Foco | null>(null)

  // Depois de mover/remover, o foco fica num lugar previsível (WCAG 2.4.3).
  useEffect(() => {
    if (!foco || !lista.current) return
    const alvo =
      foco.acao === 'novo'
        ? lista.current.querySelector<HTMLElement>('input')
        : (lista.current.querySelector<HTMLButtonElement>(`[data-item="${CSS.escape(foco.item)}"][data-acao="${foco.acao}"]:not(:disabled)`) ??
          lista.current.querySelector<HTMLButtonElement>(`[data-item="${CSS.escape(foco.item)}"][data-acao]:not(:disabled)`))
    alvo?.focus()
    setFoco(null)
  }, [foco, itens])

  function adicionar() {
    const msg = erroItemLista(novo, itens)
    if (msg) return setErro(msg)
    const v = novo.trim()
    onChange([...itens, v])
    setNovo('')
    setErro(null)
    setAnuncio(`“${v}” adicionado ao fim da lista.`)
  }

  function mover(i: number, d: -1 | 1) {
    const item = itens[i]!
    onChange(moverItem(itens, i, d))
    setAnuncio(`“${item}” agora é o ${i + d + 1}º de ${itens.length}.`)
    setFoco({ item, acao: d === -1 ? 'subir' : 'descer' })
  }

  function remover(i: number) {
    const item = itens[i]!
    const resto = itens.filter((_, j) => j !== i)
    onChange(resto)
    setAnuncio(`“${item}” removido.`)
    const vizinho = resto[i] ?? resto[i - 1]
    setFoco(vizinho ? { item: vizinho, acao: 'remover' } : { item: null, acao: 'novo' })
  }

  const btn = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-35'

  return (
    <div ref={lista} className="flex min-w-0 flex-col gap-3">
      <h3 id={`${id}-titulo`} className="m-0 text-base font-semibold">
        {titulo} <span className="font-normal text-muted">({itens.length})</span>
      </h3>
      {itens.length === 0 ? (
        <p className="m-0 text-sm text-muted">Nenhum item. Adicione abaixo.</p>
      ) : (
        <ol aria-labelledby={`${id}-titulo`} className="m-0 flex list-none flex-col rounded-field border border-line p-0">
          {itens.map((item, i) => (
            <li key={item} className={cn('flex min-h-12 items-center gap-1 pl-3.5', i > 0 && 'border-t border-line-soft')}>
              <span className="min-w-0 flex-1 py-2 text-[15px] break-words">{item}</span>
              <button type="button" className={btn} data-item={item} data-acao="subir" disabled={i === 0} aria-label={`Subir “${item}”`} onClick={() => mover(i, -1)}>
                <ChevronUpIcon />
              </button>
              <button
                type="button"
                className={btn}
                data-item={item}
                data-acao="descer"
                disabled={i === itens.length - 1}
                aria-label={`Descer “${item}”`}
                onClick={() => mover(i, 1)}
              >
                <ChevronDownIcon />
              </button>
              <button
                type="button"
                className={cn(btn, 'hover:bg-late-bg hover:text-late-fg')}
                data-item={item}
                data-acao="remover"
                aria-label={`Remover “${item}”`}
                onClick={() => remover(i)}
              >
                <CloseIcon size={18} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field
            label={`Novo item em ${titulo.toLowerCase()}`}
            autoComplete="off"
            value={novo}
            maxLength={80}
            placeholder={`Digite ${singular === 'produto' ? 'o produto' : 'a especificação'}`}
            error={erro ?? undefined}
            onChange={(e) => {
              setNovo(e.target.value)
              if (erro) setErro(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                adicionar()
              }
            }}
          />
        </div>
        <Button variant="outline" className="mt-[30px] h-[50px]" onClick={adicionar}>
          Adicionar
        </Button>
      </div>
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </div>
  )
}
