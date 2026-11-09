/**
 * Utilidades HTTP do BFF. Arquivos em api/_lib não viram endpoints (prefixo "_").
 */
const MAX_BODY = 4 * 1024

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })

export class HttpError extends Error {
  status: number
  headers: HeadersInit
  constructor(status: number, message: string, headers: HeadersInit = {}) {
    super(message)
    this.status = status
    this.headers = headers
  }
}

/**
 * Defesa CSRF em camadas (além do cookie SameSite=Strict):
 * 1) header customizado que formulários de outros sites não conseguem enviar;
 * 2) Origin precisa ser a própria aplicação.
 */
export function assertSameOrigin(req: Request) {
  if (req.headers.get('x-of-request') !== '1') throw new HttpError(403, 'Requisição recusada.')
  const origin = req.headers.get('origin')
  const self = new URL(req.url).origin
  const allowed = new Set([self, ...(process.env.APP_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean)])
  if (!origin || !allowed.has(origin)) throw new HttpError(403, 'Origem não permitida.')
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  if (!req.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Formato inválido.')
  const text = await req.text()
  if (text.length > MAX_BODY) throw new HttpError(413, 'Requisição muito grande.')
  try {
    return JSON.parse(text || '{}') as T
  } catch {
    throw new HttpError(400, 'JSON inválido.')
  }
}

export function clientIp(req: Request) {
  // Na Vercel, o primeiro IP de x-forwarded-for é o do cliente (definido pela borda).
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0'
}

/** Envolve o handler: erros conhecidos viram JSON; o resto vira 500 genérico (sem vazar detalhes). */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status, err.headers)
      console.error('[api]', err instanceof Error ? err.message : err)
      return json({ error: 'Erro interno. Tente novamente.' }, 500)
    }
  }
}
