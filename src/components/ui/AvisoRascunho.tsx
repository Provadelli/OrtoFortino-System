const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Aviso exibido quando um formulário foi restaurado do rascunho automático. */
export function AvisoRascunho({ em, onDescartar }: { em: number | null; onDescartar: () => void }) {
  if (em === null) return null
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-[#bfe6d2] bg-prod-bg px-4 py-3 text-[15px] text-prod-fg animate-fade">
      <span>
        <strong className="font-semibold">Continuando de onde você parou.</strong> Rascunho salvo às {hora.format(em)}, ainda não enviado.
      </span>
      <button type="button" onClick={onDescartar} className="min-h-11 cursor-pointer rounded-field px-2 font-semibold text-link-pink underline hover:text-link-pink-hover">
        Descartar rascunho
      </button>
    </div>
  )
}
