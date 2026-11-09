import { createHash } from 'node:crypto'
import { adminClient } from './supabase.js'
import { HttpError } from './http.js'

/**
 * Limite de tentativas persistido no Postgres (funções em supabase/migrations).
 * Chaves são hashes: não guardamos e-mail nem IP em texto puro (LGPD).
 */
export const rateKey = (scope: string, value: string) =>
  `${scope}:${createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 40)}`

type Rule = { key: string; max: number; windowSec: number; lockSec: number }

export async function assertNotLimited(keys: string[]) {
  const db = adminClient()
  for (const key of keys) {
    const { data, error } = await db.rpc('auth_rate_check', { p_key: key })
    if (error) throw new Error(`rate_check: ${error.message}`)
    const wait = Number(data) || 0
    if (wait > 0) throw new HttpError(429, 'Muitas tentativas. Aguarde e tente novamente.', { 'Retry-After': String(wait) })
  }
}

export async function registerFailure(rules: Rule[]) {
  const db = adminClient()
  await Promise.all(
    rules.map((r) =>
      db.rpc('auth_rate_fail', { p_key: r.key, p_max: r.max, p_window_sec: r.windowSec, p_lock_sec: r.lockSec }),
    ),
  )
}

export async function resetLimit(keys: string[]) {
  const db = adminClient()
  await Promise.all(keys.map((k) => db.rpc('auth_rate_reset', { p_key: k })))
}
