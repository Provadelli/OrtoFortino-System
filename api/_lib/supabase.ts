import { createClient, type Session as SbSession } from '@supabase/supabase-js'
import { HttpError } from './http.js'

function env(name: string) {
  const v = process.env[name]
  if (!v) throw new HttpError(500, 'Servidor sem configuração.')
  return v
}

const serverAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const

/** Cliente "público" por requisição, para operações de sessão do usuário. */
export const publicClient = () => createClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), { auth: serverAuth })

/** Cliente administrativo (chave secreta). SOMENTE no servidor. */
export const adminClient = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: serverAuth })

/** O que o navegador recebe: o access token (curto) e dados mínimos do usuário. Nunca o refresh token. */
export function toClientSession(s: SbSession) {
  const meta = (s.user.user_metadata ?? {}) as { nome?: string }
  return {
    accessToken: s.access_token,
    expiresAt: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600),
    user: { id: s.user.id, email: s.user.email ?? '', nome: meta.nome ?? '' },
  }
}
