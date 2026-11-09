import * as z from 'zod/mini'
import { refreshCookie } from '../_lib/cookies.js'
import { assertSameOrigin, clientIp, handler, HttpError, json, readJson } from '../_lib/http.js'
import { assertNotLimited, rateKey, registerFailure } from '../_lib/rate-limit.js'
import { adminClient, publicClient, toClientSession } from '../_lib/supabase.js'
import { passwordRule } from '../../src/features/auth/schemas.js'

/**
 * Aceita os dois formatos de link de recuperação:
 * - token_hash (template da marca, com SMTP próprio);
 * - access/refresh token no fragmento # (link padrão do Supabase no plano gratuito).
 */
const Body = z.object({
  tokenHash: z.optional(z.string().check(z.minLength(10), z.maxLength(512))),
  accessToken: z.optional(z.string().check(z.minLength(20), z.maxLength(4096))),
  refreshToken: z.optional(z.string().check(z.minLength(6), z.maxLength(2048))),
  password: passwordRule,
})

export const POST = handler(async (req) => {
  assertSameOrigin(req)
  const parsed = Body.safeParse(await readJson(req))
  if (!parsed.success) throw new HttpError(400, 'Senha não atende à política (12+ caracteres, letras e números).')
  const { tokenHash, accessToken, refreshToken, password } = parsed.data

  const ipKey = rateKey('reset:ip', clientIp(req))
  await assertNotLimited([ipKey])
  const fail = async () => {
    await registerFailure([{ key: ipKey, max: 10, windowSec: 3600, lockSec: 3600 }])
    return new HttpError(400, 'Link inválido ou expirado.')
  }

  const sb = publicClient()
  let session
  if (tokenHash) {
    const { data, error } = await sb.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    if (error || !data.session) throw await fail()
    session = data.session
  } else if (accessToken && refreshToken) {
    // Valida o token no servidor do Supabase (assinatura + expiração) antes de confiar nele.
    const { data, error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error || !data.session) throw await fail()
    session = data.session
  } else {
    throw await fail()
  }

  const admin = adminClient()
  const upd = await admin.auth.admin.updateUserById(session.user.id, { password })
  if (upd.error) throw new HttpError(400, 'Não foi possível salvar a nova senha.')
  // Derruba sessões antigas (ex.: se a senha anterior vazou).
  await admin.auth.admin.signOut(session.access_token, 'others')

  return json(toClientSession(session), 200, {
    'Set-Cookie': refreshCookie({ token: session.refresh_token, remember: false }),
  })
})
