/**
 * Guarda o access token APENAS em memória (nunca localStorage/sessionStorage),
 * reduzindo a superfície de roubo por XSS. O refresh token vive num cookie
 * httpOnly que o JavaScript não consegue ler.
 */
export type SessionUser = { id: string; email: string; nome: string }
export type Session = { accessToken: string; expiresAt: number; user: SessionUser }

type Listener = (session: Session | null) => void

let current: Session | null = null
const listeners = new Set<Listener>()

export const tokenStore = {
  get: () => current,
  getAccessToken: () => current?.accessToken ?? null,
  set(session: Session | null) {
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
