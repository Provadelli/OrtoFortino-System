/** Pula a navegação e vai direto ao conteúdo (WCAG 2.4.1). */
export function SkipLink() {
  return (
    <a
      href="#conteudo"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-field focus:bg-ink focus:px-4 focus:py-3 focus:font-semibold focus:text-white"
    >
      Pular para o conteúdo
    </a>
  )
}
