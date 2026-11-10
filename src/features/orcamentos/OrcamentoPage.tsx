import { useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { Button, buttonClass } from '@/components/ui/Button'
import { ArrowLeftIcon } from '@/components/ui/icons'
import { StatusChip } from '@/components/ui/StatusChip'
import { ageFrom, formatAge, formatIsoDate, todayIso } from '@/lib/br'
import { cn } from '@/lib/cn'
import { formatBRL } from '@/lib/format'
import { isDbError } from '@/lib/supabase'
import { usePageTitle } from '@/lib/usePageTitle'
import { useAprovarOrcamento, useExcluirOrcamento, useMudarStatusOrcamento, useNovaVersao, useOrcamento, type Orcamento } from './api'
import { agruparSecoes } from './calc'
import { editavel, STATUS_ORCAMENTO, vencido } from './constants'

const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** key = id: ao navegar entre versões, a página recomeça (avisos e erros da versão anterior somem). */
export default function OrcamentoPage() {
  const { id } = useParams()
  return <OrcamentoView key={id} id={id} />
}

function OrcamentoView({ id }: { id?: string }) {
  const { data: o, isPending, isError } = useOrcamento(id)
  const location = useLocation()
  const [notice, setNotice] = useState((location.state as { notice?: string } | null)?.notice)
  const [erro, setErro] = useState<string | null>(null)
  const [hoje] = useState(todayIso)
  const navigate = useNavigate()
  const mudar = useMudarStatusOrcamento()
  const novaVersao = useNovaVersao()
  usePageTitle(o ? `${o.numero} · ${o.pacientes?.nome ?? ''}` : 'Orçamento')

  if (isPending) return <PageSkeleton />
  if (isError || !o)
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-8">
        <h1 className="m-0 text-2xl font-bold">Orçamento não encontrado</h1>
        <Link to="/orcamentos" className={buttonClass('outline')}>
          Voltar para orçamentos
        </Link>
      </div>
    )

  const st = STATUS_ORCAMENTO[o.status]
  const ultima = o.versoes[0]?.id === o.id

  async function acao(fn: () => Promise<unknown>, msg: string) {
    setErro(null)
    setNotice(undefined)
    try {
      await fn()
      setNotice(msg)
    } catch (err) {
      setErro(isDbError(err) && err.code === '55000' ? 'O orçamento mudou de situação em outra tela. Recarregue a página.' : 'Não foi possível concluir agora. Tente de novo.')
    }
  }

  async function criarVersao() {
    setErro(null)
    try {
      const novoId = await novaVersao.mutateAsync(o!.id)
      navigate(`/orcamentos/${novoId}`, { state: { notice: 'Nova versão criada como rascunho. Edite e aprove quando estiver pronta.' } })
    } catch (err) {
      setErro(isDbError(err) && err.code === '55000' ? 'Já existe uma versão mais nova deste orçamento.' : 'Não foi possível criar a nova versão. Tente de novo.')
    }
  }

  return (
    <>
      <header className="flex flex-col gap-3 animate-fade">
        <Link to="/orcamentos" className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline">
          <ArrowLeftIcon /> Orçamentos
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-[1.2] font-bold tabular-nums">{o.numero}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {o.pacientes && (
                <Link to={`/clientes/${o.pacientes.id}`} className="font-semibold text-primary-ink">
                  {o.pacientes.nome}
                </Link>
              )}
              {o.pacientes?.data_nascimento && <span>· {formatAge(ageFrom(o.pacientes.data_nascimento))}</span>}
              <StatusChip tone={st.tone}>{st.label}</StatusChip>
              {vencido(o.status, o.validade, hoje) && <StatusChip tone="late">Vencido</StatusChip>}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {editavel(o.status) && (
              <>
                <Link to={`/orcamentos/${o.id}/editar`} className={buttonClass('outline')}>
                  Editar
                </Link>
                {o.status === 'rascunho' && (
                  <Button variant="outline" loading={mudar.isPending} onClick={() => void acao(() => mudar.mutateAsync({ id: o.id, status: 'enviado' }), 'Orçamento marcado como enviado.')}>
                    Marcar como enviado
                  </Button>
                )}
                <Aprovar o={o} onDone={setNotice} />
              </>
            )}
            {o.status === 'recusado' && (
              <Button variant="outline" loading={mudar.isPending} onClick={() => void acao(() => mudar.mutateAsync({ id: o.id, status: 'enviado' }), 'Orçamento reaberto como enviado.')}>
                Reabrir
              </Button>
            )}
            {(o.status === 'aprovado' || o.status === 'recusado') && ultima && (
              <Button loading={novaVersao.isPending} onClick={() => void criarVersao()}>
                Criar nova versão
              </Button>
            )}
            {o.status === 'aprovado' && o.atendimento_id && (
              <Link to={`/atendimentos/${o.atendimento_id}`} className={buttonClass('outline')}>
                Ver atendimento
              </Link>
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

      {o.status === 'substituido' && o.versoes[0] && (
        <p className="m-0 rounded-field bg-draft-bg px-4 py-3 text-[15px] text-draft-fg">
          Esta versão foi substituída por{' '}
          <Link to={`/orcamentos/${o.versoes[0].id}`} className="font-semibold text-primary-ink">
            {o.versoes[0].numero}
          </Link>
          .
        </p>
      )}

      <Itens o={o} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Painel title="Condições" id="c-condicoes">
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label="Emissão">{formatIsoDate(o.data_emissao)}</Item>
            <Item label="Válido até">{formatIsoDate(o.validade)}</Item>
            <Item label="Pagamento">{o.condicoes_pagamento || '—'}</Item>
            <Item label="Prazo de entrega">{o.prazo_entrega || '—'}</Item>
            {o.observacoes && (
              <div className="sm:col-span-2">
                <Item label="Observações">
                  <span className="whitespace-pre-line">{o.observacoes}</span>
                </Item>
              </div>
            )}
          </dl>
        </Painel>

        <Painel title="Versões" id="c-versoes">
          <ol className="m-0 flex list-none flex-col p-0">
            {o.versoes.map((v, i) => {
              const vs = STATUS_ORCAMENTO[v.status]
              return (
                <li key={v.id} className={cn('flex flex-wrap items-center justify-between gap-3 py-2.5', i > 0 && 'border-t border-line-soft')}>
                  {v.id === o.id ? (
                    <span className="text-[15px] font-semibold tabular-nums" aria-current="page">
                      {v.numero} <span className="font-normal text-muted">(esta)</span>
                    </span>
                  ) : (
                    <Link to={`/orcamentos/${v.id}`} className="text-[15px] font-semibold text-primary-ink tabular-nums">
                      {v.numero}
                    </Link>
                  )}
                  <span className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">{formatBRL(v.total)}</span>
                    <StatusChip tone={vs.tone}>{vs.label}</StatusChip>
                  </span>
                </li>
              )
            })}
          </ol>
          {o.status !== 'aprovado' && o.status !== 'substituido' && (
            <div className="mt-2 flex flex-wrap gap-2 border-t border-line-soft pt-3">
              {editavel(o.status) && (
                <Button variant="ghost" loading={mudar.isPending} onClick={() => void acao(() => mudar.mutateAsync({ id: o.id, status: 'recusado' }), 'Orçamento marcado como recusado.')}>
                  Marcar como recusado
                </Button>
              )}
              <Excluir o={o} />
            </div>
          )}
        </Painel>
      </div>
    </>
  )
}

function Itens({ o }: { o: Orcamento }) {
  const secoes = agruparSecoes(o.orcamento_itens.map((i) => ({ secao: i.secao ?? '' })))
  return (
    <section aria-labelledby="t-itens" className="flex flex-col gap-4 rounded-card border border-line bg-white p-5 sm:p-6 animate-rise">
      <h2 id="t-itens" className="m-0 text-[19px] font-semibold">
        Itens
      </h2>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- área rolável precisa ser alcançável pelo teclado (WCAG 2.1.1) */}
      <section className="overflow-x-auto overscroll-x-contain" aria-label="Itens do orçamento (role para os lados)" tabIndex={0}>
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <caption className="sr-only">Itens agrupados por seção, com quantidade, preço unitário e total</caption>
          <thead>
            <tr className="text-left text-[13px] text-muted">
              <th scope="col" className="py-2.5 pr-3 font-semibold">Item</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Qtd.</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Preço unit.</th>
              <th scope="col" className="py-2.5 pl-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          {secoes.map((s) => {
            const itens = s.indices.map((i) => o.orcamento_itens[i]!)
            const subtotal = itens.reduce((a, i) => a + i.total, 0)
            return (
              <tbody key={s.nome}>
                <tr>
                  <th scope="colgroup" colSpan={4} className="border-t border-line bg-surface px-3 py-2 text-left text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
                    {s.nome}
                  </th>
                </tr>
                {itens.map((i) => (
                  <tr key={i.id} className="border-t border-line-soft">
                    <th scope="row" className="py-3 pr-3 text-left font-normal">
                      <span className="text-[15px] font-semibold">{i.descricao}</span>
                      {i.detalhe && <span className="block text-[13px] text-muted">{i.detalhe}</span>}
                    </th>
                    <td className="p-3 text-right whitespace-nowrap tabular-nums">
                      {qtd(i.quantidade)} {i.unidade}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap tabular-nums">{formatBRL(i.preco_unitario)}</td>
                    <td className="py-3 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatBRL(i.total)}</td>
                  </tr>
                ))}
                {secoes.length > 1 && (
                  <tr className="border-t border-line-soft">
                    <td colSpan={3} className="py-2 pr-3 text-right text-[13px] text-muted">
                      Subtotal {s.nome}
                    </td>
                    <td className="py-2 pl-3 text-right text-sm font-semibold whitespace-nowrap tabular-nums">{formatBRL(subtotal)}</td>
                  </tr>
                )}
              </tbody>
            )
          })}
        </table>
      </section>
      <dl className="m-0 ml-auto flex w-full max-w-[340px] flex-col gap-1.5 text-[15px]">
        <div className="flex justify-between gap-3">
          <dt>Subtotal</dt>
          <dd className="m-0 tabular-nums">{formatBRL(o.subtotal)}</dd>
        </div>
        {o.desconto_valor > 0 && (
          <div className="flex justify-between gap-3 text-prod-fg">
            <dt>Desconto{o.desconto_tipo === 'percentual' ? ` (${qtd(o.desconto)}%)` : ''}</dt>
            <dd className="m-0 tabular-nums">− {formatBRL(o.desconto_valor)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3 border-t border-line pt-2 text-[19px] font-bold">
          <dt>Total</dt>
          <dd className="m-0 tabular-nums">{formatBRL(o.total)}</dd>
        </div>
      </dl>
    </section>
  )
}

function Aprovar({ o, onDone }: { o: Orcamento; onDone: (msg: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const aprovar = useAprovarOrcamento()
  const [erro, setErro] = useState<string | null>(null)
  const atualiza = o.versao > 1

  async function confirmar() {
    setErro(null)
    try {
      await aprovar.mutateAsync(o.id)
      dialog.current?.close()
      onDone(atualiza ? 'Orçamento aprovado. O atendimento foi atualizado com o novo valor.' : 'Orçamento aprovado. O atendimento foi aberto em produção.')
    } catch (err) {
      setErro(isDbError(err) && err.code === '55000' ? 'O orçamento mudou de situação em outra tela. Recarregue a página.' : 'Não foi possível aprovar agora. Tente de novo.')
    }
  }

  return (
    <>
      <Button onClick={() => dialog.current?.showModal()}>Aprovar</Button>
      <dialog
        ref={dialog}
        aria-labelledby="dlg-aprovar"
        aria-describedby="dlg-aprovar-texto"
        className="m-auto w-[min(460px,calc(100vw-32px))] rounded-card border border-line bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/40 open:animate-rise"
      >
        <h2 id="dlg-aprovar" className="m-0 text-xl font-semibold">
          Aprovar o orçamento {o.numero}?
        </h2>
        <p id="dlg-aprovar-texto" className="mt-3 mb-0 text-[15px] text-ink-soft">
          {atualiza
            ? `O atendimento da versão anterior (se houver) passa a valer ${formatBRL(o.total)}; senão, um novo atendimento é aberto.`
            : `Um atendimento de ${formatBRL(o.total)} será aberto em produção para ${o.pacientes?.nome ?? 'o paciente'}.`}{' '}
          Depois de aprovado, o orçamento fica travado; mudanças exigem uma nova versão.
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
          <Button loading={aprovar.isPending} onClick={() => void confirmar()}>
            Aprovar e abrir atendimento
          </Button>
        </div>
      </dialog>
    </>
  )
}

function Excluir({ o }: { o: Orcamento }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const excluir = useExcluirOrcamento()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    setErro(null)
    try {
      await excluir.mutateAsync(o.id)
      dialog.current?.close()
      navigate('/orcamentos', { replace: true, state: { notice: `Orçamento ${o.numero} excluído.` } })
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
        aria-labelledby="dlg-excluir-orc"
        aria-describedby="dlg-excluir-orc-texto"
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-card border border-line bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/40 open:animate-rise"
      >
        <h2 id="dlg-excluir-orc" className="m-0 text-xl font-semibold">
          Excluir o orçamento {o.numero}?
        </h2>
        <p id="dlg-excluir-orc-texto" className="mt-3 mb-0 text-[15px] text-ink-soft">
          O orçamento e os itens dele serão apagados. Para guardar o registro, prefira “Marcar como recusado”.
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

function Painel({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-card border border-line bg-white p-5 sm:p-6 animate-rise">
      <h2 id={id} className="m-0 text-[19px] font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="m-0 text-[15px]">{children}</dd>
    </div>
  )
}
