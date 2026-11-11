import * as z from 'zod/mini'
import { requireUser } from '../_lib/auth.js'
import { assertSameOrigin, handler, HttpError, json, readJson } from '../_lib/http.js'
import { assertNotLimited, rateKey, registerFailure, resetLimit } from '../_lib/rate-limit.js'
import { adminClient, publicClient } from '../_lib/supabase.js'
import { passwordRule } from '../../src/features/auth/schemas.js'

/**
 * Minha conta (usuário logado, via Bearer):
 * - nome:  nome exibido no menu (user_metadata.nome);
 * - senha: troca a senha conferindo a atual; encerra as sessões dos outros aparelhos.
 */
const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('nome'), nome: z.string().check(z.trim(), z.minLength(2), z.maxLength(80)) }),
  z.object({ acao: z.literal('senha'), atual: z.string().check(z.minLength(1), z.maxLength(128)), nova: passwordRule }),
])

export const POST = handler(async (req) => {
  assertSameOrigin(req)
  const parsed = Body.safeParse(await readJson(req))
  if (!parsed.success) throw new HttpError(400, 'Dados inválidos. Confira os campos.')
  const body = parsed.data
  const { user, accessToken } = await requireUser(req)
  const admin = adminClient()

  if (body.acao === 'nome') {
    const { error } = await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, nome: body.nome } })
    if (error) throw new HttpError(500, 'Não foi possível salvar agora. Tente de novo.')
    return json({ ok: true })
  }

  if (body.atual === body.nova) throw new HttpError(400, 'A nova senha precisa ser diferente da atual.')
  const key = rateKey('senha:user', user.id)
  await assertNotLimited([key])

  // Confere a senha atual abrindo uma sessão descartável (encerrada logo em seguida).
  const check = await publicClient().auth.signInWithPassword({ email: user.email ?? '', password: body.atual })
  if (check.error || !check.data.session) {
    await registerFailure([{ key, max: 5, windowSec: 15 * 60, lockSec: 15 * 60 }])
    throw new HttpError(400, 'A senha atual não confere.')
  }
  await admin.auth.admin.signOut(check.data.session.access_token, 'local')
  await resetLimit([key])

  const upd = await admin.auth.admin.updateUserById(user.id, { password: body.nova })
  if (upd.error) throw new HttpError(400, 'Não foi possível salvar a nova senha. Tente outra.')
  // Se a senha antiga vazou, quem a usou em outro aparelho perde o acesso.
  await admin.auth.admin.signOut(accessToken, 'others')
  return json({ ok: true })
})
