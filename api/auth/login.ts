import * as z from 'zod/mini'
import { clearMfaPendingCookie, mfaPendingCookie, refreshCookie } from '../_lib/cookies.js'
import { assertSameOrigin, clientIp, handler, HttpError, json, readJson } from '../_lib/http.js'
import { assertNotLimited, rateKey, registerFailure, resetLimit } from '../_lib/rate-limit.js'
import { verifiedTotp } from '../_lib/mfa.js'
import { publicClient, toClientSession } from '../_lib/supabase.js'

const Body = z.object({
  email: z.string().check(z.trim(), z.minLength(3), z.maxLength(254)),
  password: z.string().check(z.minLength(1), z.maxLength(128)),
  remember: z.optional(z.boolean()),
})

export const POST = handler(async (req) => {
  assertSameOrigin(req)
  const parsed = Body.safeParse(await readJson(req))
  if (!parsed.success) throw new HttpError(400, 'Dados inválidos.')
  const { email, password, remember = false } = parsed.data

  const emailKey = rateKey('login:email', email)
  const ipKey = rateKey('login:ip', clientIp(req))
  await assertNotLimited([emailKey, ipKey])

  const { data, error } = await publicClient().auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    await registerFailure([
      { key: emailKey, max: 5, windowSec: 15 * 60, lockSec: 15 * 60 },
      { key: ipKey, max: 20, windowSec: 15 * 60, lockSec: 30 * 60 },
    ])
    // Mensagem genérica: não revela se o e-mail existe.
    throw new HttpError(401, 'E-mail ou senha incorretos.')
  }

  await resetLimit([emailKey])

  // Autenticador ativo: a senha sozinha não abre a sessão. Guarda o passo 1 por 5 min
  // (cookie httpOnly) e pede o código em /api/auth/mfa { acao: 'entrar' }.
  if (verifiedTotp(data.session.user)) {
    return json({ mfaRequired: true }, 200, {
      'Set-Cookie': mfaPendingCookie({ accessToken: data.session.access_token, remember }),
    })
  }

  return json(toClientSession(data.session), 200, [
    ['Set-Cookie', refreshCookie({ token: data.session.refresh_token, remember })],
    ['Set-Cookie', clearMfaPendingCookie()],
  ])
})
