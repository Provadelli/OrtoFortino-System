/**
 * Guarda o access token APENAS em memória (nunca localStorage/sessionStorage),
 * reduzindo a superfície de roubo por XSS. O refresh token vive num cookie
 * httpOnly que o JavaScript não consegue ler.
 */
/** `mfa`: verificação em duas etapas ativa (opcional no modo demonstração). */
export type SessionUser = { id: string; email: string; nome: string; mfa?: boolean }
export type Session = { accessToken: string; expiresAt: number; user: SessionUser }
/** Por que a sessão terminou: saída voluntária, expiração, ou nunca existiu. */
export type EndReason = 'logout' | 'expired' | null

type Listener = (session: Session | null) => void

let current: Session | null = null
let endReason: EndReason = null
const listeners = new Set<Listener>()

export const tokenStore = {
  get: () => current,
  getAccessToken: () => current?.accessToken ?? null,
  getEndReason: () => endReason,
  set(session: Session | null, reason: EndReason = null) {
    if (session) endReason = null
    else endReason = reason ?? (current ? 'expired' : endReason)
    current = session
    listeners.forEach((l) => l(session))
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
