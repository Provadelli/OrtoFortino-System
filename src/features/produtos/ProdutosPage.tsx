import { Fragment, useMemo } from 'react'
import { Link, useLocation } from 'react-router'
import { Button, buttonClass } from '@/components/ui/Button'
import { BarraLista, useBuscaUrl, useFiltrosUrl, type GrupoFiltro } from '@/components/ui/Filtros'
import { TagIcon } from '@/components/ui/icons'
import { StatusChip } from '@/components/ui/StatusChip'
import { normalizeSearch } from '@/lib/br'
import { formatBRL } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useProdutos, type Produto } from './api'
import { SEM_CATEGORIA, tipoInfo } from './schema'

const GRUPOS_FIXOS: GrupoFiltro[] = [
  {
    id: 'situacao',
    titulo: 'Situação',
    opcoes: [
      { valor: 'ativos', rotulo: 'Ativos', tom: 'prod' },
      { valor: 'inativos', rotulo: 'Inativos', tom: 'draft' },
    ],
  },
  {
    id: 'tipo',
    titulo: 'Tipo',
    opcoes: [
      { valor: 'base', rotulo: 'Produtos-base', tom: tipoInfo('base').tone },
      { valor: 'adicional', rotulo: 'Adicionais', tom: tipoInfo('adicional').tone },
    ],
  },
]
/** Links antigos (?filtro=ativos). */
const LEGADO: Record<string, string[]> = { ativos: ['ativos'], inativos: ['inativos'], base: ['base'], adicional: ['adicional'] }
const categoriaDe = (p: Produto) => p.categoria?.trim() || SEM_CATEGORIA

/** Dentro de um grupo as opções somam (OU); entre grupos, restringem (E). Sem filtros = todos. */
function filtrar(produtos: Produto[], filtros: string[], busca: string) {
  const q = normalizeSearch(busca)
  const situacao = filtros.filter((f) => f === 'ativos' || f === 'inativos')
  const tipos = filtros.filter((f) => f === 'base' || f === 'adicional')
  const categorias = filtros.filter((f) => f.startsWith('cat:')).map((f) => f.slice(4))
  return produtos.filter((p) => {
    if (situacao.length && !situacao.includes(p.ativo ? 'ativos' : 'inativos')) return false
    if (tipos.length && !tipos.includes(p.tipo)) return false
    if (categorias.length && !categorias.includes(categoriaDe(p))) return false
    if (!q) return true
    return (p.nome_busca ?? normalizeSearch(p.nome)).includes(q) || (p.codigo ?? '').toLowerCase().includes(q) || normalizeSearch(p.categoria ?? '').includes(q)
  })
}

/** Agrupa por categoria (as seções do orçamento), "Sem categoria" por último. */
function agrupar(produtos: Produto[]) {
  const grupos = new Map<string, Produto[]>()
  for (const p of produtos) {
    const c = p.categoria?.trim() || SEM_CATEGORIA
    grupos.set(c, [...(grupos.get(c) ?? []), p])
  }
  return [...grupos.entries()].sort(([a], [b]) => (a === SEM_CATEGORIA ? 1 : b === SEM_CATEGORIA ? -1 : a.localeCompare(b, 'pt-BR')))
}

export default function ProdutosPage() {
  usePageTitle('Tabela de preços')
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const { data, isPending, isError, refetch } = useProdutos()
  const gruposFiltro = useMemo<GrupoFiltro[]>(() => {
    const cats = [...new Set((data ?? []).map(categoriaDe))].sort((a, b) => (a === SEM_CATEGORIA ? 1 : b === SEM_CATEGORIA ? -1 : a.localeCompare(b, 'pt-BR')))
    return cats.length ? [...GRUPOS_FIXOS, { id: 'categoria', titulo: 'Categoria', opcoes: cats.map((c) => ({ valor: `cat:${c}`, rotulo: c, tom: 'info' as const })) }] : GRUPOS_FIXOS
  }, [data])
  const filtros = useFiltrosUrl(gruposFiltro, LEGADO)
  // A lista é local: filtra na hora com o texto digitado (a URL acompanha com pequeno atraso).
  const { texto, setTexto } = useBuscaUrl()
  const busca = texto
  const visiveis = useMemo(() => filtrar(data ?? [], filtros.ativos, busca), [data, filtros.ativos, busca])
  const grupos = useMemo(() => agrupar(visiveis), [visiveis])
  const total = visiveis.length

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[30px] leading-[1.2] font-bold">Tabela de preços</h1>
          <p className="m-0 text-sm text-muted" aria-live="polite">
            {isPending ? 'Carregando…' : total === 1 ? '1 produto' : `${total} produtos`}
            {busca.trim() && !isPending ? ` para “${busca.trim()}”` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/tabela-de-precos/importar" className={buttonClass('outline')}>
            Importar planilha
          </Link>
          <Link to="/tabela-de-precos/novo" className={buttonClass('primary')}>
            + Novo produto
          </Link>
        </div>
      </header>

      {notice && (
        <output className="block rounded-field border border-[#bfe6d2] bg-prod-bg px-4 py-3 text-[15px] font-medium text-prod-fg animate-fade">
          {notice}
        </output>
      )}

      <section aria-labelledby="titulo-lista" className="flex flex-col gap-4 rounded-card border border-line bg-white p-4 sm:p-6 animate-rise">
        <h2 id="titulo-lista" className="sr-only">
          Lista de produtos
        </h2>
        <BarraLista
          nome="produtos"
          busca={{ texto, setTexto, placeholder: 'Buscar por nome, código ou categoria' }}
          grupos={gruposFiltro}
          ativos={filtros.ativos}
          onAlternar={filtros.alternar}
          onLimpar={filtros.limpar}
        />

        {isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-field bg-late-bg px-4 py-3 text-late-fg">
            Não foi possível carregar a tabela de preços.
            <Button variant="outline" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : isPending ? (
          <div aria-hidden="true" className="flex flex-col">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 border-t border-line-soft py-4">
                <div className="h-4 w-56 animate-pulse rounded bg-line" />
                <div className="h-4 w-20 animate-pulse rounded bg-line" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-line" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <Vazio busca={busca.trim()} filtrado={filtros.ativos.length > 0} semProdutos={(data ?? []).length === 0} />
        ) : (
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- área rolável precisa ser alcançável pelo teclado (WCAG 2.1.1)
          <section className="overflow-x-auto overscroll-x-contain" aria-label="Tabela de produtos (role para os lados)" tabIndex={0}>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">Produtos agrupados por categoria, com tipo, unidade e preço</caption>
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th scope="col" className="py-2.5 pr-3 font-semibold">Produto</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Tipo</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Unidade</th>
                  <th scope="col" className="py-2.5 pl-3 text-right font-semibold">Preço</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(([categoria, itens]) => (
                  <Fragment key={categoria}>
                    <tr>
                      <th scope="colgroup" colSpan={4} className="border-t border-line bg-surface px-3 py-2 text-left text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
                        {categoria} <span className="font-medium text-muted normal-case">· {itens.length}</span>
                      </th>
                    </tr>
                    {itens.map((p) => {
                      const t = tipoInfo(p.tipo)
                      return (
                        <tr key={p.id} className="border-t border-line-soft transition-colors hover:bg-surface">
                          <th scope="row" className="py-3 pr-3 text-left font-normal">
                            <Link to={`/tabela-de-precos/${p.id}`} className="text-[15px] font-semibold text-ink no-underline hover:text-primary-ink hover:underline">
                              {p.nome}
                            </Link>
                            {!p.ativo && <StatusChip tone="draft" className="ml-2 align-middle">Inativo</StatusChip>}
                            {(p.codigo || p.descricao) && (
                              <span className="block max-w-[52ch] truncate text-[13px] text-muted">
                                {[p.codigo, p.descricao].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </th>
                          <td className="p-3">
                            <StatusChip tone={t.tone}>{t.label}</StatusChip>
                          </td>
                          <td className="p-3 text-ink-soft">{p.unidade}</td>
                          <td className="py-3 pl-3 text-right text-[15px] font-semibold whitespace-nowrap tabular-nums">{formatBRL(p.preco)}</td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>
    </>
  )
}

function Vazio({ busca, filtrado, semProdutos }: { busca: string; filtrado: boolean; semProdutos: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center animate-fade">
      <div aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-prod-bg text-prod-fg">
        <TagIcon width={26} height={26} />
      </div>
      {semProdutos ? (
        <>
          <p className="m-0 text-lg font-semibold">A tabela de preços está vazia</p>
          <p className="m-0 max-w-md text-muted">Importe a planilha que vocês já usam ou cadastre os produtos um a um.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link to="/tabela-de-precos/importar" className={buttonClass('outline')}>
              Importar planilha
            </Link>
            <Link to="/tabela-de-precos/novo" className={buttonClass('primary')}>
              + Novo produto
            </Link>
          </div>
        </>
      ) : busca ? (
        <>
          <p className="m-0 text-lg font-semibold">Nenhum produto encontrado para “{busca}”</p>
          <p className="m-0 max-w-sm text-muted">Confira a grafia ou procure pelo código.</p>
        </>
      ) : (
        <p className="m-0 text-lg font-semibold">{filtrado ? 'Nenhum produto com esses filtros' : 'Nenhum produto'}</p>
      )}
    </div>
  )
}
