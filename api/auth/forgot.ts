import * as z from 'zod/mini'
import { assertSameOrigin, clientIp, handler, HttpError, json, readJson } from '../_lib/http.js'
import { assertNotLimited, rateKey, registerFailure } from '../_lib/rate-limit.js'
import { publicClient } from '../_lib/supabase.js'

const Body = z.object({ email: z.string().check(z.trim(), z.minLength(3), z.maxLength(254)) })

/** Sempre responde "ok": não revela se o e-mail está cadastrado. */
export const POST = handler(async (req) => {
  assertSameOrigin(req)
  const parsed = Body.safeParse(await readJson(req))
  if (!parsed.success) throw new HttpError(400, 'Dados inválidos.')
  const { email } = parsed.data

  const emailKey = rateKey('forgot:email', email)
  const ipKey = rateKey('forgot:ip', clientIp(req))
  await assertNotLimited([emailKey, ipKey])
  // Cada pedido conta como "tentativa": no máx. 3 por e-mail/hora e 10 por IP/hora.
  await registerFailure([
    { key: emailKey, max: 3, windowSec: 3600, lockSec: 3600 },
    { key: ipKey, max: 10, windowSec: 3600, lockSec: 3600 },
  ])

  const origin = new URL(req.url).origin
  await publicClient().auth.resetPasswordForEmail(email, { redirectTo: `${origin}/redefinir-senha` })
  return json({ ok: true })
})
