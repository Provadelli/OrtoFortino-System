import { useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { mensagemErroExclusao, textoConfere } from '@/lib/exclusao'

type Props = {
  /** Texto do botão que abre a caixa. */
  triggerLabel: ReactNode
  /** Troca o estilo padrão do botão de origem (ex.: ícone + "Remover" dentro de um formulário). */
  triggerClassName?: string
  /** Leitores de tela: "Excluir orçamento ORC-2026-0001" em vez de só "Excluir". */
  triggerAriaLabel?: string
  title: string
  description: ReactNode
  /** Lista do que será apagado junto (mostrada em destaque). */
  impact?: string[]
  confirmLabel?: string
  /** Se informado, o botão só habilita depois de digitar este texto. */
  requireText?: string
  /** Executa a exclusão. Se lançar erro, a caixa fica aberta e mostra a mensagem. */
  onConfirm: () => Promise<void>
}

/**
 * Caixa de confirmação única para qualquer exclusão. Usa o <dialog> nativo:
 * foco preso, Esc fecha, foco volta ao botão de origem — sem biblioteca extra.
 */
export function ConfirmDialog({
  triggerLabel,
  triggerClassName,
  triggerAriaLabel,
  title,
  description,
  impact,
  confirmLabel = 'Excluir definitivamente',
  requireText,
  onConfirm,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const uid = useId()
  const [pending, setPending] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [digitado, setDigitado] = useState('')

  const liberado = !requireText || textoConfere(digitado, requireText)

  function reset() {
    setErro(null)
    setDigitado('')
  }

  async function confirmar() {
    if (!liberado || pending) return
    setErro(null)
    setPending(true)
    try {
      await onConfirm()
      dialog.current?.close()
    } catch (err) {
      setErro(mensagemErroExclusao(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={triggerAriaLabel}
        onClick={() => dialog.current?.showModal()}
        className={triggerClassName ?? 'inline-flex min-h-11 cursor-pointer items-center rounded-field px-3 text-sm font-semibold text-late-fg hover:bg-late-bg'}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-t`}
        aria-describedby={`${uid}-d`}
        onClose={reset}
        onCancel={(e) => pending && e.preventDefault()}
        className="m-auto w-[min(460px,calc(100vw-32px))] rounded-card border border-line bg-white p-6 text-ink shadow-2xl backdrop:bg-ink/40 open:animate-rise"
      >
        <h2 id={`${uid}-t`} className="m-0 text-xl font-semibold">
          {title}
        </h2>
        <div id={`${uid}-d`} className="mt-3 text-[15px] text-ink-soft">
          <p className="m-0">{description}</p>
          {impact && impact.length > 0 && (
            <ul className="mt-3 mb-0 flex list-disc flex-col gap-1 rounded-field bg-late-bg py-3 pr-4 pl-8 text-late-fg">
              {impact.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>
        {requireText && (
          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor={`${uid}-c`} className="text-sm font-semibold">
              Para confirmar, digite <span className="break-words">{requireText}</span>
            </label>
            <input
              id={`${uid}-c`}
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              className="h-[50px] w-full rounded-field border-[1.5px] border-field-soft bg-white px-3.5 text-base text-ink hover:border-field-hover"
            />
          </div>
        )}
        {erro && (
          <p role="alert" className="mt-3 mb-0 text-sm font-medium text-late-fg">
            {erro}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={pending} onClick={() => dialog.current?.close()} className="w-full sm:w-auto">
            Voltar
          </Button>
          <Button variant="danger" loading={pending} disabled={!liberado} onClick={() => void confirmar()} className="w-full sm:w-auto">
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  )
}
