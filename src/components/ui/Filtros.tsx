import { useEffect, useId, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { cn } from '@/lib/cn'
import { CloseIcon, FilterIcon, SearchIcon } from './icons'
import { toneDot, type Tone } from './StatusChip'

export type OpcaoFiltro = { valor: string; rotulo: string; tom?: Tone }
export type GrupoFiltro = { id: string; titulo: string; opcoes: OpcaoFiltro[] }

/**
 * Filtros na URL (?f=enviado,aprovado): o link e o "voltar" do navegador mantêm a lista.
 * Sem filtros = todos os registros. `legado` traduz os links antigos (?filtro=atrasados).
 */
export function useFiltrosUrl(grupos: GrupoFiltro[], legado: Record<string, string[]> = {}) {
  const [params, setParams] = useSearchParams()
  const validos = new Set(grupos.flatMap((g) => g.opcoes.map((o) => o.valor)))
  const bruto = params.get('f')
  const antigo = params.get('filtro') ?? (params.get('pagamento') ? 'pagamento' : null)
  const ativos = (bruto !== null ? bruto.split(',') : antigo ? (legado[antigo] ?? []) : []).filter((v) => validos.has(v))

  const gravar = (novos: string[]) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.delete('filtro')
        n.delete('pagamento')
        n.delete('pagina')
        if (novos.length) n.set('f', novos.join(','))
        else n.delete('f')
        return n
      },
      { replace: true },
    )

  return {
    ativos,
    alternar: (v: string) => gravar(ativos.includes(v) ? ativos.filter((x) => x !== v) : [...ativos, v]),
    limpar: () => gravar([]),
  }
}

/** Busca com espera curta (250 ms), gravada em ?busca= e voltando para a 1ª página. */
export function useBuscaUrl() {
  const [params, setParams] = useSearchParams()
  const busca = params.get('busca') ?? ''
  const [texto, setTexto] = useState(busca)
  useEffect(() => {
    const t = setTimeout(() => {
      if (texto.trim() === busca) return
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          if (texto.trim()) n.set('busca', texto.trim())
          else n.delete('busca')
          n.delete('pagina')
          return n
        },
        { replace: true },
      )
    }, 250)
    return () => clearTimeout(t)
  }, [texto, busca, setParams])
  return { busca, texto, setTexto }
}

type BarraProps = {
  /** Nome da lista, para os rótulos acessíveis ("orçamentos"). */
  nome: string
  busca: { texto: string; setTexto: (v: string) => void; placeholder: string }
  grupos: GrupoFiltro[]
  ativos: string[]
  onAlternar: (valor: string) => void
  onLimpar: () => void
  extra?: ReactNode
}

/**
 * Barra das listas: busca + botão "Filtros" (três linhas) que abre os filtros para adicionar.
 * Os filtros ativos aparecem como etiquetas removíveis; sem nenhum, a lista mostra tudo.
 */
export function BarraLista({ nome, busca, grupos, ativos, onAlternar, onLimpar, extra }: BarraProps) {
  const id = useId()
  const [aberto, setAberto] = useState(false)
  const opcao = (v: string) => grupos.flatMap((g) => g.opcoes).find((o) => o.valor === v)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <search className="min-w-0 flex-1 basis-full sm:basis-auto">
          <form className="relative" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor={`${id}-busca`} className="sr-only">
              {busca.placeholder}
            </label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <input
              id={`${id}-busca`}
              type="search"
              value={busca.texto}
              onChange={(e) => busca.setTexto(e.target.value)}
              placeholder={busca.placeholder}
              autoComplete="off"
              className="h-12 w-full rounded-field border-[1.5px] border-field-soft bg-white pr-3.5 pl-[42px] text-[15px] text-ink transition-[border-color,box-shadow] duration-200 hover:border-field-hover"
            />
          </form>
        </search>
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={`${id}-painel`}
          onClick={() => setAberto((v) => !v)}
          className={cn(
            'inline-flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-field border-[1.5px] px-4 text-[15px] font-semibold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98]',
            aberto || ativos.length ? 'border-primary bg-prod-bg text-prod-fg' : 'border-field-soft bg-white text-ink hover:border-field-hover hover:bg-surface-hover',
          )}
        >
          <FilterIcon />
          Filtros
          {ativos.length > 0 && (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-6 text-white">
              <span className="sr-only">(</span>
              {ativos.length}
              <span className="sr-only"> {ativos.length === 1 ? 'ativo' : 'ativos'})</span>
            </span>
          )}
        </button>
        {extra}
      </div>

      <div id={`${id}-painel`} hidden={!aberto} className="rounded-field border border-line bg-surface p-4 animate-drop">
        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {grupos.map((g) => (
            <div key={g.id} role="group" aria-labelledby={`${id}-${g.id}`} className="flex flex-col gap-2">
              <span id={`${id}-${g.id}`} className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">
                {g.titulo}
              </span>
              <div className="flex flex-wrap gap-2">
                {g.opcoes.map((o) => {
                  const on = ativos.includes(o.valor)
                  return (
                    <button
                      key={o.valor}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onAlternar(o.valor)}
                      className={cn(
                        'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3.5 text-sm font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-200 active:scale-[0.97]',
                        on ? 'border-primary bg-white text-ink shadow-sm' : 'border-field-soft bg-white/70 text-ink-soft hover:border-field-hover hover:text-ink',
                      )}
                    >
                      <span aria-hidden="true" className={cn('size-2.5 rounded-full transition-transform duration-200', toneDot[o.tom ?? 'draft'], on && 'scale-125')} />
                      {o.rotulo}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {ativos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 animate-fade">
          <span className="text-sm text-muted" id={`${id}-ativos`}>
            Filtrando por:
          </span>
          <ul aria-labelledby={`${id}-ativos`} className="m-0 flex list-none flex-wrap gap-2 p-0">
            {ativos.map((v) => {
              const o = opcao(v)
              return (
                <li key={v} className="animate-pop">
                  <button
                    type="button"
                    onClick={() => onAlternar(v)}
                    aria-label={`Remover filtro ${o?.rotulo ?? v}`}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white py-1 pr-2 pl-3 text-sm font-semibold text-ink transition-colors duration-200 hover:border-late-fg hover:text-late-fg"
                  >
                    <span aria-hidden="true" className={cn('size-2 rounded-full', toneDot[o?.tom ?? 'draft'])} />
                    {o?.rotulo ?? v}
                    <CloseIcon width={16} height={16} />
                  </button>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={onLimpar}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-full px-2 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
          >
            Limpar filtros<span className="sr-only"> de {nome}</span>
          </button>
        </div>
      )}
    </div>
  )
}
