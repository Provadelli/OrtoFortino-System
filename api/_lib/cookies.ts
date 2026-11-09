/**
 * Cookie do refresh token.
 * __Host-  → exige Secure, Path=/ e proíbe Domain (não vaza para subdomínios).
 * HttpOnly → invisível ao JavaScript (protege contra XSS).
 * SameSite=Strict → não é enviado em navegação/requisição vinda de outro site (CSRF).
 */
const NAME = '__Host-of_rt'
const THIRTY_DAYS = 60 * 60 * 24 * 30

export type RefreshCookie = { token: string; remember: boolean }

export function readRefreshCookie(req: Request): RefreshCookie | null {
  const raw = req.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k !== NAME) continue
    const value = decodeURIComponent(v.join('='))
    const dot = value.indexOf('.')
    if (dot !== 1) return null
    const token = value.slice(2)
    if (!token || token.length > 2048) return null
    return { remember: value[0] === '1', token }
  }
  return null
}

export function refreshCookie({ token, remember }: RefreshCookie) {
  const value = encodeURIComponent(`${remember ? '1' : '0'}.${token}`)
  const maxAge = remember ? `; Max-Age=${THIRTY_DAYS}` : '' // sem Max-Age = cookie de sessão
  return `${NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict${maxAge}`
}

export const clearRefreshCookie = () => `${NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
