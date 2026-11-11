import type { User } from '@supabase/supabase-js'
import { HttpError } from './http.js'

/**
 * Verificação em duas etapas (TOTP) pela API REST do Supabase Auth.
 * Usamos a REST com o access token do usuário (Bearer) porque o BFF não guarda
 * sessão: o supabase-js exigiria o refresh token para cada chamada.
 */

function env(name: string) {
  const v = process.env[name]
  if (!v) throw new HttpError(500, 'Servidor sem configuração.')
  return v
}

/** Lê as claims de um JWT recebido do próprio Supabase (assinatura já validada por ele). */
export function jwtClaims(token: string): { aal?: string; sub?: string; session_id?: string } {
  const payload = token.split('.')[1]
  if (!payload) return {}
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { aal?: string }
  } catch {
    return {}
  }
}

/** Fator TOTP já confirmado (o usuário ativou a verificação em duas etapas). */
export const verifiedTotp = (user: Pick<User, 'factors'> | null | undefined) =>
  (user?.factors ?? []).find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null

/** Quem ativou o autenticador precisa de sessão aal2; os demais, aal1 basta. */
export const sessionSatisfiesMfa = (user: Pick<User, 'factors'>, accessToken: string) =>
  !verifiedTotp(user) || jwtClaims(accessToken).aal === 'aal2'

async function gotrue<T>(path: string, accessToken: string, init: { method: 'POST' | 'PUT' | 'DELETE'; body?: unknown }): Promise<T> {
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1${path}`, {
    method: init.method,
    headers: {
      apikey: env('SUPABASE_PUBLISHABLE_KEY'),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { code?: string; error_code?: string; msg?: string; message?: string }
  if (!res.ok) throw new GoTrueError(res.status, data.error_code ?? data.code ?? '', data.msg ?? data.message ?? '')
  return data
}

export class GoTrueError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message || `gotrue ${status}`)
    this.status = status
    this.code = code
  }
}

export type TotpEnrollment = { id: string; totp: { qr_code: string; secret: string; uri: string } }

/** Cria um fator TOTP ainda não confirmado (aparece como QR code para o app autenticador). */
export const enrollTotp = (accessToken: string) =>
  gotrue<TotpEnrollment>('/factors', accessToken, {
    method: 'POST',
    body: { factor_type: 'totp', issuer: 'Orto Fortino', friendly_name: `Autenticador ${new Date().toISOString().slice(0, 10)}` },
  })

/** Sessão devolvida ao confirmar um código: já em aal2. */
export type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; user: User }

/**
 * Confere o código de 6 dígitos (desafio + verificação).
 * Código errado → HttpError 400; o chamador conta a tentativa no rate limit.
 */
export async function verifyTotp(accessToken: string, factorId: string, code: string): Promise<TokenResponse> {
  const challenge = await gotrue<{ id: string }>(`/factors/${encodeURIComponent(factorId)}/challenge`, accessToken, { method: 'POST' })
  try {
    return await gotrue<TokenResponse>(`/factors/${encodeURIComponent(factorId)}/verify`, accessToken, {
      method: 'POST',
      body: { challenge_id: challenge.id, code },
    })
  } catch (err) {
    if (err instanceof GoTrueError && err.status >= 400 && err.status < 500) throw new HttpError(400, 'Código incorreto ou expirado.')
    throw err
  }
}

/** O QR code vem como data URI de SVG; versões antigas do Auth mandavam o SVG puro. */
export const qrDataUri = (qr: string) => (qr.startsWith('data:') ? qr : `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`)

/**
 * Troca a senha como o próprio usuário (PUT /user com o token dele).
 * Diferente da troca pelo admin, mantém a sessão de quem trocou e encerra as dos outros aparelhos.
 * Pode falhar com reauthentication_needed (sessão com mais de 24 h e "secure password change" ligado).
 */
export async function updatePasswordAs(accessToken: string, password: string) {
  try {
    await gotrue('/user', accessToken, { method: 'PUT', body: { password } })
  } catch (err) {
    if (err instanceof GoTrueError && (err.code === 'same_password' || err.code === 'weak_password')) {
      throw new HttpError(400, err.code === 'same_password' ? 'A nova senha precisa ser diferente da atual.' : 'Senha fraca. Use 12+ caracteres, com letras e números.')
    }
    throw err
  }
}
