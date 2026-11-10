import { useId, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, buttonClass } from '@/components/ui/Button'
import { Section } from '@/components/ui/FormControls'
import { ArrowLeftIcon, DownloadIcon } from '@/components/ui/icons'
import { StatusChip } from '@/components/ui/StatusChip'
import { normalizeSearch } from '@/lib/br'
import { formatBRL } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useImportarProdutos, useProdutos, type Produto } from './api'
import { lerPlanilha, MODELO_CSV, parseCsv, type ItemImportado, type ResultadoLeitura } from './csv'
import { tipoInfo } from './schema'

const MAX_BYTES = 2 * 1024 * 1024
const MODELO_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(MODELO_CSV)}`

/** UTF-8 quando válido; senão Windows-1252 (o "CSV separado por ponto e vírgula" do Excel em português). */
async function lerTexto(file: File) {
  const buf = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('windows-1252').decode(buf)
  }
}

type Mudanca = { tipo: 'novo' } | { tipo: 'preco'; antes: number } | { tipo: 'igual'; reativa: boolean }

/** Mesmo critério do banco (importar_produtos): código primeiro, depois nome sem acento. */
function compararComTabela(itens: ItemImportado[], atuais: Produto[]) {
  const porCodigo = new Map(atuais.filter((p) => p.codigo).map((p) => [p.codigo!.toLowerCase(), p]))
  const porNome = new Map(atuais.map((p) => [p.nome_busca ?? normalizeSearch(p.nome), p]))
  return itens.map((item) => {
    const atual = (item.codigo && porCodigo.get(item.codigo.toLowerCase())) || porNome.get(normalizeSearch(item.nome))
    const mudanca: Mudanca = !atual ? { tipo: 'novo' } : atual.preco !== item.preco ? { tipo: 'preco', antes: atual.preco } : { tipo: 'igual', reativa: !atual.ativo }
    return { item, mudanca }
  })
}

export default function ImportarProdutosPage() {
  usePageTitle('Importar planilha de preços')
  const navigate = useNavigate()
  const inputId = useId()
  const { data: atuais, isPending: carregandoTabela } = useProdutos()
  const importar = useImportarProdutos()
  const [arquivo, setArquivo] = useState<string | null>(null)
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [erroImportacao, setErroImportacao] = useState<string | null>(null)

  const previa = useMemo(() => (leitura && atuais ? compararComTabela(leitura.itens, atuais) : []), [leitura, atuais])
  const novos = previa.filter((p) => p.mudanca.tipo === 'novo').length
  const reajustes = previa.filter((p) => p.mudanca.tipo === 'preco').length

  async function onArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setLeitura(null)
    setErroArquivo(null)
    setErroImportacao(null)
    setArquivo(file?.name ?? null)
    if (!file) return
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setErroArquivo('Envie um arquivo .csv. No Excel: Arquivo → Salvar como → “CSV (separado por ponto e vírgula)”.')
      return
    }
    if (file.size > MAX_BYTES) {
      setErroArquivo('O arquivo passa de 2 MB. Confira se é mesmo a tabela de preços.')
      return
    }
    try {
      setLeitura(lerPlanilha(parseCsv(await lerTexto(file))))
    } catch {
      setErroArquivo('Não foi possível ler o arquivo. Tente salvá-lo de novo como CSV.')
    }
  }

  async function onImportar() {
    if (!leitura?.itens.length) return
    setErroImportacao(null)
    try {
      const r = await importar.mutateAsync(leitura.itens)
      const partes = [
        r.criados && `${r.criados} ${r.criados === 1 ? 'produto novo' : 'produtos novos'}`,
        r.atualizados && `${r.atualizados} ${r.atualizados === 1 ? 'atualizado' : 'atualizados'}`,
        r.inalterados && `${r.inalterados} sem mudança`,
      ].filter(Boolean)
      navigate('/tabela-de-precos', { replace: true, state: { notice: `Planilha importada: ${partes.join(', ')}.` } })
    } catch {
      setErroImportacao('A importação não foi concluída e nada foi alterado. Verifique sua conexão e tente de novo.')
    }
  }

  const erros = leitura?.erros ?? []
  const validos = leitura?.itens.length ?? 0

  return (
    <>
      <header className="flex flex-col gap-2 animate-fade">
        <Link
          to="/tabela-de-precos"
          className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary-ink no-underline hover:underline"
        >
          <ArrowLeftIcon /> Voltar para a tabela de preços
        </Link>
        <h1 className="m-0 text-[30px] leading-[1.2] font-bold">Importar planilha de preços</h1>
        <p className="m-0 max-w-prose text-sm text-muted">
          Produtos que já existem (mesmo código ou mesmo nome) são atualizados; os demais são criados. Mudanças de preço entram no histórico.
        </p>
      </header>

      <Section id="sec-arquivo" title="1. Escolha o arquivo">
        <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[15px] text-ink-soft">
          <li>
            Baixe o modelo e preencha uma linha por produto. Colunas obrigatórias: <strong>nome</strong> e <strong>preco</strong>.
          </li>
          <li>
            Em <strong>tipo</strong>, use “base” ou “adicional” (vazio vale base). A <strong>categoria</strong> vira a seção do orçamento.
          </li>
          <li>No Excel, salve como “CSV (separado por ponto e vírgula)”.</li>
        </ol>
        <a href={MODELO_HREF} download="modelo-tabela-de-precos.csv" className={buttonClass('outline', 'md', 'self-start no-underline')}>
          <DownloadIcon /> Baixar modelo (CSV)
        </a>
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-semibold text-ink">
            Planilha (.csv)
          </label>
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv,.txt"
            onChange={(e) => void onArquivo(e)}
            aria-describedby={erroArquivo ? `${inputId}-erro` : undefined}
            aria-invalid={erroArquivo ? true : undefined}
            className="block w-full max-w-[480px] cursor-pointer rounded-field border-[1.5px] border-dashed border-field bg-surface p-3 text-[15px] text-ink file:mr-3 file:h-11 file:cursor-pointer file:rounded-field file:border-0 file:bg-primary file:px-4 file:font-display file:font-semibold file:text-white hover:border-[#b5cbbf]"
          />
          {erroArquivo && (
            <p id={`${inputId}-erro`} role="alert" className="m-0 text-sm font-medium text-late-fg">
              {erroArquivo}
            </p>
          )}
        </div>
      </Section>

      {leitura && (
        <Section id="sec-previa" title="2. Confira antes de importar" description={arquivo ?? undefined}>
          <output aria-live="polite" className="flex flex-wrap gap-2">
            <StatusChip tone="prod" size="md">{`${validos} ${validos === 1 ? 'linha válida' : 'linhas válidas'}`}</StatusChip>
            {!carregandoTabela && validos > 0 && (
              <>
                <StatusChip tone="ready" size="md">{`${novos} ${novos === 1 ? 'novo' : 'novos'}`}</StatusChip>
                <StatusChip tone="today" size="md">{`${reajustes} com preço alterado`}</StatusChip>
              </>
            )}
            {erros.length > 0 && <StatusChip tone="late" size="md">{`${erros.length} ${erros.length === 1 ? 'linha com erro' : 'linhas com erro'}`}</StatusChip>}
          </output>

          {erros.length > 0 && (
            <div className="flex flex-col gap-2 rounded-field border border-[#f6b8d6] bg-late-bg px-4 py-3 text-late-fg">
              <h3 className="m-0 text-[15px] font-semibold">{validos > 0 ? 'Estas linhas serão ignoradas:' : 'Corrija a planilha e envie de novo:'}</h3>
              <ul className="m-0 flex max-h-56 flex-col gap-1 overflow-y-auto pl-5 text-sm">
                {erros.map((e) => (
                  <li key={e.linha}>
                    {e.linha === 1 ? e.mensagem : `Linha ${e.linha}: ${e.mensagem}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validos > 0 && (
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- área rolável precisa ser alcançável pelo teclado (WCAG 2.1.1)
            <section className="max-h-[420px] overflow-auto overscroll-contain rounded-field border border-line" aria-label="Prévia da importação (role para ver tudo)" tabIndex={0}>
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <caption className="sr-only">Produtos que serão importados e o que muda em cada um</caption>
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[13px] text-muted">
                    <th scope="col" className="px-3 py-2.5 font-semibold">Linha</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Produto</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Tipo</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Preço</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">O que muda</th>
                  </tr>
                </thead>
                <tbody>
                  {(previa.length ? previa : leitura.itens.map((item) => ({ item, mudanca: null }))).map(({ item, mudanca }) => (
                    <tr key={item.linha} className="border-t border-line-soft">
                      <td className="px-3 py-2.5 text-muted tabular-nums">{item.linha}</td>
                      <th scope="row" className="px-3 py-2.5 text-left font-semibold">
                        {item.nome}
                        {(item.codigo || item.categoria) && (
                          <span className="block text-[13px] font-normal text-muted">{[item.codigo, item.categoria].filter(Boolean).join(' · ')}</span>
                        )}
                      </th>
                      <td className="px-3 py-2.5">{tipoInfo(item.tipo).label}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatBRL(item.preco)}</td>
                      <td className="px-3 py-2.5">
                        {!mudanca ? (
                          '…'
                        ) : mudanca.tipo === 'novo' ? (
                          <StatusChip tone="ready">Novo</StatusChip>
                        ) : mudanca.tipo === 'preco' ? (
                          <span className="whitespace-nowrap tabular-nums">antes {formatBRL(mudanca.antes)}</span>
                        ) : (
                          <span className="text-muted">{mudanca.reativa ? 'Reativa o produto' : 'Preço igual'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {erroImportacao && (
            <p role="alert" className="m-0 rounded-field bg-late-bg px-4 py-3 text-[15px] font-medium text-late-fg">
              {erroImportacao}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft pt-4">
            <Link to="/tabela-de-precos" className={buttonClass('ghost')}>
              Cancelar
            </Link>
            <Button disabled={validos === 0} loading={importar.isPending} onClick={() => void onImportar()}>
              {importar.isPending
                ? 'Importando…'
                : validos === 0
                  ? 'Nada para importar'
                  : `Importar ${validos} ${validos === 1 ? 'produto' : 'produtos'}${erros.length ? ` e ignorar ${erros.length} ${erros.length === 1 ? 'linha' : 'linhas'}` : ''}`}
            </Button>
          </div>
        </Section>
      )}
    </>
  )
}
