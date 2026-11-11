import { describe, expect, it } from 'vitest'
import { clearMfaPendingCookie, clearRefreshCookie, mfaPendingCookie, readMfaPendingCookie, readRefreshCookie, refreshCookie } from '../../api/_lib/cookies'
import { assertSameOrigin, HttpError, json } from '../../api/_lib/http'
import { jwtClaims, qrDataUri, sessionSatisfiesMfa, verifiedTotp } from '../../api/_lib/mfa'
import { rateKey } from '../../api/_lib/rate-limit'

describe('verificação em duas etapas', () => {
  const r = (headers: Record<string, string>) => new Request('https://app.ortofortino.com.br/api/auth/mfa', { method: 'POST', headers })
  const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`
  const fator = (status: 'verified' | 'unverified') => ({ id: 'f1', factor_type: 'totp', status }) as never

  it('cookie do 2º passo é __Host-, httpOnly, Strict e dura 5 min', () => {
    const c = mfaPendingCookie({ accessToken: 'tok', remember: true })
    expect(c).toMatch(/^__Host-of_mfa=/)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Strict')
    expect(c).toContain('Max-Age=300')
    expect(clearMfaPendingCookie()).toContain('Max-Age=0')
  })
  it('lê o cookie do 2º passo de volta e ignora lixo', () => {
    const value = mfaPendingCookie({ accessToken: 'a.b.c', remember: false }).split(';')[0]!
    expect(readMfaPendingCookie(r({ cookie: `x=1; ${value}` }))).toEqual({ accessToken: 'a.b.c', remember: false })
    expect(readMfaPendingCookie(r({ cookie: '__Host-of_mfa=lixo' }))).toBeNull()
    expect(readMfaPendingCookie(r({}))).toBeNull()
  })
  it('lê a claim aal do JWT', () => {
    expect(jwtClaims(jwt({ aal: 'aal2', sub: 'u' })).aal).toBe('aal2')
    expect(jwtClaims('quebrado')).toEqual({})
  })
  it('só fator verificado conta como ativo', () => {
    expect(verifiedTotp({ factors: [fator('unverified')] })).toBeNull()
    expect(verifiedTotp({ factors: [fator('verified')] })?.id).toBe('f1')
    expect(verifiedTotp({})).toBeNull()
  })
  it('com autenticador ativo, sessão só com senha (aal1) não vale', () => {
    const ativo = { factors: [fator('verified')] }
    expect(sessionSatisfiesMfa(ativo, jwt({ aal: 'aal1' }))).toBe(false)
    expect(sessionSatisfiesMfa(ativo, jwt({ aal: 'aal2' }))).toBe(true)
    expect(sessionSatisfiesMfa({ factors: [] }, jwt({ aal: 'aal1' }))).toBe(true)
  })
  it('QR code sempre como data URI', () => {
    expect(qrDataUri('data:image/svg+xml;utf-8,<svg/>')).toBe('data:image/svg+xml;utf-8,<svg/>')
    expect(qrDataUri('<svg/>')).toBe('data:image/svg+xml;utf8,%3Csvg%2F%3E')
  })
})

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

describe('resposta JSON', () => {
  it('envia vários Set-Cookie quando os headers vêm em lista', () => {
    const res = json({ ok: true }, 200, [
      ['Set-Cookie', 'a=1; Path=/'],
      ['Set-Cookie', 'b=2; Path=/'],
    ])
    expect(res.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/'])
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
  it('aceita objeto e permite sobrescrever o padrão', () => {
    const res = json({}, 200, { 'Set-Cookie': 'a=1', 'Cache-Control': 'public, max-age=300' })
    expect(res.headers.getSetCookie()).toEqual(['a=1'])
    expect(res.headers.get('cache-control')).toBe('public, max-age=300')
  })
})
