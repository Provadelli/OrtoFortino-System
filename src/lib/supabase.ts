import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { refresh } from '@/features/auth/auth-client'
import { tokenStore } from '@/features/auth/token-store'
import type { Database } from './database.types'

/**
 * Cliente do banco para as telas internas.
 * - Usa o access token que está SÓ em memória (nada no localStorage);
 * - renova pelo BFF quando está perto de expirar;
 * - a segurança real é o RLS no Postgres.
 * Carregado sob demanda: a tela de login não baixa este código.
 */
let client: SupabaseClient<Database> | undefined

async function accessToken() {
  const s = tokenStore.get()
  if (s && s.expiresAt * 1000 - Date.now() > 30_000) return s.accessToken
  return (await refresh())?.accessToken ?? null
}

export function db() {
  client ??= createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    accessToken,
    db: { schema: 'public' },
  })
  return client
}

/** Erro do Postgres/PostgREST com código (ex.: 23505 = valor duplicado). */
export type DbError = { code?: string; message: string; details?: string | null; hint?: string | null }
export const isDbError = (e: unknown): e is DbError => typeof e === 'object' && e !== null && 'message' in e
