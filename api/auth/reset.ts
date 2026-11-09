import * as z from 'zod/mini'
import { refreshCookie } from '../_lib/cookies.js'
import { assertSameOrigin, clientIp, handler, HttpError, json, readJson } from '../_lib/http.js'
import { assertNotLimited, rateKey, registerFailure } from '../_lib/rate-limit.js'
import { adminClient, publicClient, toClientSession } from '../_lib/supabase.js'
import { passwordRule } from '../../src/features/auth/schemas.js'

const Body = z.object({
  tokenHash: z.string().check(z.minLength(10), z.maxLength(512)),
  password: passwordRule,
})

/** Valida o link de recuperação (token_hash), troca a senha e encerra as outras sessões. */
export const POST = handler(async (req) => {
  assertSameOrigin(req)
  const parsed = Body.safeParse(await readJson(req))
  if (!parsed.success) throw new HttpError(400, 'Senha não atende à política (12+ caracteres, letras e números).')

  const ipKey = rateKey('reset:ip', clientIp(req))
  await assertNotLimited([ipKey])

  const { data, error } = await publicClient().auth.verifyOtp({ type: 'recovery', token_hash: parsed.data.tokenHash })
  if (error || !data.session || !data.user) {
    await registerFailure([{ key: ipKey, max: 10, windowSec: 3600, lockSec: 3600 }])
    throw new HttpError(400, 'Link inválido ou expirado.')
  }

  const admin = adminClient()
  const upd = await admin.auth.admin.updateUserById(data.user.id, { password: parsed.data.password })
  if (upd.error) throw new HttpError(400, 'Não foi possível salvar a nova senha.')
  // Derruba sessões antigas (ex.: se a senha anterior vazou).
  await admin.auth.admin.signOut(data.session.access_token, 'others')

  return json(toClientSession(data.session), 200, {
    'Set-Cookie': refreshCookie({ token: data.session.refresh_token, remember: false }),
  })
})
