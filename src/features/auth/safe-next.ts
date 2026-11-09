/** Só aceita caminhos internos (evita open redirect via ?next=https://…). */
export function safeNext(next: string | null, fallback = '/painel') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
