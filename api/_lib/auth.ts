import type { User } from '@supabase/supabase-js'
import { HttpError } from './http.js'
import { sessionSatisfiesMfa } from './mfa.js'
import { publicClient } from './supabase.js'

/**
 * Exige o usuário logado pelo access token (Authorization: Bearer), validado no Supabase Auth.
 * Quem ativou a verificação em duas etapas precisa estar com sessão aal2.
 */
export async function requireUser(req: Request): Promise<{ user: User; accessToken: string }> {
  const auth = req.headers.get('authorization') ?? ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!accessToken || accessToken.length > 4096) throw new HttpError(401, 'Sessão expirada. Entre de novo.')

  const { data, error } = await publicClient().auth.getUser(accessToken)
  if (error || !data.user) throw new HttpError(401, 'Sessão expirada. Entre de novo.')
  if (!sessionSatisfiesMfa(data.user, accessToken)) throw new HttpError(401, 'Confirme o código do autenticador para continuar.')
  return { user: data.user, accessToken }
}
