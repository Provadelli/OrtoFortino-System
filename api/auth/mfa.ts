import * as z from 'zod/mini'
import { requireUser } from '../_lib/auth.js'
import { clearMfaPendingCookie, readMfaPendingCookie, readRefreshCookie, refreshCookie } from '../_lib/cookies.js'
import { assertSameOrigin, clientIp, handler, HttpError, json, readJson } from '../_lib/http.js'
import { enrollTotp, qrDataUri, verifiedTotp, verifyTotp } from '../_lib/mfa.js'
import { assertNotLimited, rateKey, registerFailure, resetLimit } from '../_lib/rate-limit.js'
import { adminClient, publicClient, toClientSession } from '../_lib/supabase.js'

/**
 * Verificação em duas etapas (TOTP, app autenticador). Um endpoint, quatro ações:
 * - entrar:    2º passo do login (cookie __Host-of_mfa + código) → abre a sessão aal2;
 * - iniciar:   gera o QR code de um autenticador novo (ainda não vale);
 * - ativar:    confirma o 1º código → autenticador ativo e sessão aal2; derruba as outras sessões;
 * - desativar: pede um código válido e remove o autenticador.
 */
const code = z.string().check(z.trim(), z.regex(/^\d{6}$/, 'O código tem 6 números.'))
const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('entrar'), code }),
  z.object({ acao: z.literal('iniciar') }),
  z.object({ acao: z.literal('ativar'), factorId: z.string().check(z.minLength(10), z.maxLength(64)), code }),
  z.object({ acao: z.literal('desativar'), code }),
])

/** 5 códigos errados por usuário em 15 min bloqueiam por 15 min (o Supabase também limita). */
const limites = (req: Request, userId: string) => {
  const userKey = rateKey('mfa:user', userId)
  const ipKey = rateKey('mfa:ip', clientIp(req))
  return {
    keys: [userKey, ipKey],
    userKey,
    rules: [
      { key: userKey, max: 5, windowSec: 15 * 60, lockSec: 15 * 60 },
      { key: ipKey, max: 20, windowSec: 15 * 60, lockSec: 30 * 60 },
    ],
  }
}

async function conferirCodigo(req: Request, userId: string, accessToken: string, factorId: string, codigo: string) {
  const lim = limites(req, userId)
  await assertNotLimited(lim.keys)
  try {
    const tokens = await verifyTotp(accessToken, factorId, codigo)
    await resetLimit([lim.userKey])
    return tokens
  } catch (err) {
    if (err instanceof HttpError && err.status === 400) await registerFailure(lim.rules)
    throw err
  }
}

export const POST = handler(async (req) => {
  assertSameOrigin(req)
  const parsed = Body.safeParse(await readJson(req))
  if (!parsed.success) throw new HttpError(400, 'O código tem 6 números.')
  const body = parsed.data

  if (body.acao === 'entrar') {
    const pending = readMfaPendingCookie(req)
    if (!pending) throw new HttpError(401, 'O tempo para digitar o código acabou. Entre com a senha de novo.')
    const { data, error } = await publicClient().auth.getUser(pending.accessToken)
    const factor = verifiedTotp(data.user)
    if (error || !data.user || !factor) {
      throw new HttpError(401, 'O tempo para digitar o código acabou. Entre com a senha de novo.', { 'Set-Cookie': clearMfaPendingCookie() })
    }
    const tokens = await conferirCodigo(req, data.user.id, pending.accessToken, factor.id, body.code)
    return json(toClientSession(tokens), 200, [
      ['Set-Cookie', refreshCookie({ token: tokens.refresh_token, remember: pending.remember })],
      ['Set-Cookie', clearMfaPendingCookie()],
    ])
  }

  const { user, accessToken } = await requireUser(req)
  const admin = adminClient()

  if (body.acao === 'iniciar') {
    if (verifiedTotp(user)) throw new HttpError(409, 'A verificação em duas etapas já está ativa.')
    // Tentativas anteriores não concluídas (QR code gerado e abandonado) são descartadas.
    for (const f of user.factors ?? []) {
      if (f.status !== 'verified') await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
    }
    const e = await enrollTotp(accessToken)
    return json({ factorId: e.id, qrCode: qrDataUri(e.totp.qr_code), secret: e.totp.secret })
  }

  if (body.acao === 'ativar') {
    if (verifiedTotp(user)) throw new HttpError(409, 'A verificação em duas etapas já está ativa.')
    const pendente = (user.factors ?? []).find((f) => f.id === body.factorId && f.status !== 'verified')
    if (!pendente) throw new HttpError(400, 'Gere o QR code de novo e tente outra vez.')
    const tokens = await conferirCodigo(req, user.id, accessToken, pendente.id, body.code)
    // Sessões abertas em outros aparelhos ficaram só com senha (aal1): encerra todas.
    await admin.auth.admin.signOut(tokens.access_token, 'others')
    const remember = readRefreshCookie(req)?.remember ?? false
    const session = toClientSession(tokens)
    return json({ ...session, user: { ...session.user, mfa: true } }, 200, {
      'Set-Cookie': refreshCookie({ token: tokens.refresh_token, remember }),
    })
  }

  // desativar: exige um código válido do autenticador (não basta estar logado).
  const factor = verifiedTotp(user)
  if (!factor) throw new HttpError(409, 'A verificação em duas etapas já está desativada.')
  const tokens = await conferirCodigo(req, user.id, accessToken, factor.id, body.code)
  const del = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id })
  if (del.error) throw new HttpError(500, 'Não foi possível desativar agora. Tente de novo.')
  const remember = readRefreshCookie(req)?.remember ?? false
  const session = toClientSession(tokens)
  return json({ ...session, user: { ...session.user, mfa: false } }, 200, {
    'Set-Cookie': refreshCookie({ token: tokens.refresh_token, remember }),
  })
})
