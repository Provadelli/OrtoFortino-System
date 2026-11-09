import { clearRefreshCookie, readRefreshCookie } from '../_lib/cookies.js'
import { assertSameOrigin, handler, json } from '../_lib/http.js'
import { adminClient, publicClient } from '../_lib/supabase.js'

/** Revoga a sessão no Supabase (não só apaga o cookie) e limpa o cookie. */
export const POST = handler(async (req) => {
  assertSameOrigin(req)
  const cookie = readRefreshCookie(req)
  if (cookie) {
    const { data } = await publicClient().auth.refreshSession({ refresh_token: cookie.token })
    if (data.session) await adminClient().auth.admin.signOut(data.session.access_token, 'local')
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearRefreshCookie() })
})
