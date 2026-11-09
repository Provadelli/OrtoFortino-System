import { describe, expect, it } from 'vitest'
import { clearRefreshCookie, readRefreshCookie, refreshCookie } from '../../api/_lib/cookies'
import { assertSameOrigin, HttpError } from '../../api/_lib/http'
import { rateKey } from '../../api/_lib/rate-limit'

const req = (headers: Record<string, string>) => new Request('https://app.ortofortino.com.br/api/auth/login', { method: 'POST', headers })

describe('cookie do refresh token', () => {
  it('é httpOnly, Secure, SameSite=Strict e __Host-', () => {
    const c = refreshCookie({ token: 'abc', remember: true })
    expect(c).toMatch(/^__Host-of_rt=/)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Strict')
    expect(c).toContain('Path=/')
    expect(c).not.toMatch(/Domain=/i)
  })
  it('"lembrar" define Max-Age; sem lembrar é cookie de sessão', () => {
    expect(refreshCookie({ token: 'a', remember: true })).toContain('Max-Age=2592000')
    expect(refreshCookie({ token: 'a', remember: false })).not.toContain('Max-Age')
  })
  it('lê o próprio cookie de volta', () => {
    const value = refreshCookie({ token: 'tok-123', remember: false }).split(';')[0]!
    expect(readRefreshCookie(req({ cookie: `outro=1; ${value}` }))).toEqual({ token: 'tok-123', remember: false })
  })
  it('ignora cookie malformado', () => expect(readRefreshCookie(req({ cookie: '__Host-of_rt=lixo' }))).toBeNull())
  it('limpeza expira o cookie', () => expect(clearRefreshCookie()).toContain('Max-Age=0'))
})

describe('CSRF', () => {
  const ok = { 'x-of-request': '1', origin: 'https://app.ortofortino.com.br' }
  it('aceita mesma origem com header', () => expect(() => assertSameOrigin(req(ok))).not.toThrow())
  it('recusa sem header customizado', () => expect(() => assertSameOrigin(req({ origin: ok.origin }))).toThrow(HttpError))
  it('recusa outra origem', () => expect(() => assertSameOrigin(req({ ...ok, origin: 'https://mal.com' }))).toThrow(HttpError))
  it('recusa sem Origin', () => expect(() => assertSameOrigin(req({ 'x-of-request': '1' }))).toThrow(HttpError))
})

describe('rate limit', () => {
  it('não guarda e-mail em texto puro e normaliza caixa', () => {
    const k = rateKey('login:email', 'Equipe@OrtoFortino.com.br')
    expect(k).not.toContain('ortofortino')
    expect(k).toBe(rateKey('login:email', 'equipe@ortofortino.com.br'))
  })
})
