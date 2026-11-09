import { tokenStore, type Session } from './token-store'

/** Header exigido pelo BFF: um formulário de outro site não consegue enviá-lo (CSRF). */
const CSRF_HEADER = { 'X-OF-Request': '1' } as const

export class AuthError extends Error {
  status: number
  retryAfter?: number
  constructor(message: string, status: number, retryAfter?: number) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) {
    const retry = Number(res.headers.get('Retry-After')) || undefined
    throw new AuthError(data.error ?? 'Não foi possível concluir. Tente novamente.', res.status, retry)
  }
  return data
}

// ───── Renovação silenciosa ─────
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let inflight: Promise<Session | null> | null = null

function schedule(session: Session) {
  clearTimeout(refreshTimer)
  // Renova 60 s antes de expirar (mínimo 10 s)
  const ms = Math.max(session.expiresAt * 1000 - Date.now() - 60_000, 10_000)
  refreshTimer = setTimeout(() => void refresh(), ms)
}

function accept(session: Session) {
  tokenStore.set(session)
  schedule(session)
  return session
}

/** Troca o cookie httpOnly por um novo access token. Uma única requisição por vez. */
export function refresh(): Promise<Session | null> {
  // 204 = sem sessão (não é erro; evita poluir o console com 401).
  inflight ??= post<Partial<Session>>('refresh')
    .then((s) => {
      if (!s.accessToken || !s.expiresAt || !s.user) throw new Error('sem sessão')
      return accept(s as Session)
    })
    .catch(() => {
      clearTimeout(refreshTimer)
      tokenStore.set(null)
      return null
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export async function login(email: string, password: string, remember: boolean) {
  return accept(await post<Session>('login', { email, password, remember }))
}

/** Revoga a sessão no servidor e limpa a memória. */
export async function logout() {
  clearTimeout(refreshTimer)
  await post('logout').catch(() => undefined)
  tokenStore.set(null, 'logout')
}

export function forgotPassword(email: string) {
  return post<{ ok: true }>('forgot', { email })
}

export async function resetPassword(tokenHash: string, password: string) {
  return accept(await post<Session>('reset', { tokenHash, password }))
}

// Ao voltar para a aba depois de muito tempo (timer congelado), renova se preciso.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const s = tokenStore.get()
    if (document.visibilityState === 'visible' && s && s.expiresAt * 1000 - Date.now() < 60_000) void refresh()
  })
}
