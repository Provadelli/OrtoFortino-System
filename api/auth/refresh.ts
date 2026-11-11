import { clearRefreshCookie, readRefreshCookie, refreshCookie } from '../_lib/cookies.js'
import { assertSameOrigin, handler, json } from '../_lib/http.js'
import { sessionSatisfiesMfa } from '../_lib/mfa.js'
import { publicClient, toClientSession } from '../_lib/supabase.js'

/** Troca o refresh token (cookie httpOnly) por um novo access token, rotacionando o cookie. */
export const POST = handler(async (req) => {
  assertSameOrigin(req)
  const cookie = readRefreshCookie(req)
  // Sem cookie = visitante sem sessão: 204 (não é erro, não suja o console).
  if (!cookie) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })

  const { data, error } = await publicClient().auth.refreshSession({ refresh_token: cookie.token })
  // Sessão só com senha (aal1) de quem ativou o autenticador não vale: precisa do código.
  if (error || !data.session || !sessionSatisfiesMfa(data.session.user, data.session.access_token)) {
    return json({ error: 'Sessão expirada.' }, 401, { 'Set-Cookie': clearRefreshCookie() })
  }

  return json(toClientSession(data.session), 200, {
    'Set-Cookie': refreshCookie({ token: data.session.refresh_token, remember: cookie.remember }),
  })
})
