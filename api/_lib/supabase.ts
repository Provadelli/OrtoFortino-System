import { createClient, type User } from '@supabase/supabase-js'
import { verifiedTotp } from './mfa.js'
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

/** Formato comum à sessão do supabase-js e à resposta da API REST do Auth. */
type SessionLike = { access_token: string; expires_at?: number; expires_in?: number; user: User }

/**
 * O que o navegador recebe: o access token (curto) e dados mínimos do usuário. Nunca o refresh token.
 * `mfa` indica se a verificação em duas etapas está ativa (para a tela de Segurança).
 */
export function toClientSession(s: SessionLike) {
  const meta = (s.user.user_metadata ?? {}) as { nome?: string }
  return {
    accessToken: s.access_token,
    expiresAt: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600),
    user: { id: s.user.id, email: s.user.email ?? '', nome: meta.nome ?? '', mfa: !!verifiedTotp(s.user) },
  }
}
