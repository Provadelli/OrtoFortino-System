import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

/**
 * Em desenvolvimento, executa as Vercel Functions de /api dentro do próprio Vite,
 * com o mesmo contrato Web (Request → Response) usado em produção.
 * Assim `npm run dev` sobe front + BFF sem precisar da CLI da Vercel.
 */
export function apiDevServer(): Plugin {
  return {
    name: 'of:api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) return next()
        try {
          await handle(server, req, res)
        } catch (err) {
          server.config.logger.error(`[api] ${String(err)}`)
          res.statusCode = 500
          res.end('Erro interno')
        }
      })
    },
  }
}

/**
 * MODO DEMONSTRAÇÃO — só em `npm run dev` e só enquanto não houver chaves do Supabase.
 * Aceita qualquer e-mail com a senha "demonstracao2026" para visualizar o painel.
 */
const DEMO_PASSWORD = 'demonstracao2026'
const DEMO_COOKIE = 'of_demo=1; Path=/; HttpOnly; SameSite=Strict'
function demoSession() {
  return {
    accessToken: 'demo',
    expiresAt: Math.floor(Date.now() / 1000) + 900,
    user: { id: 'demo', email: 'demo@ortofortino.com.br', nome: 'Equipe Orto Fortino' },
  }
}
async function handleDemo(req: IncomingMessage, res: ServerResponse, route: string) {
  const send = (status: number, body: unknown, cookie?: string) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    if (cookie) res.setHeader('Set-Cookie', cookie)
    res.end(JSON.stringify(body))
  }
  const hasDemo = /(?:^|;\s*)of_demo=1/.test(req.headers.cookie ?? '')
  if (route === 'auth/refresh') return hasDemo ? send(200, demoSession()) : send(204, {})
  if (route === 'auth/logout') return send(200, { ok: true }, `${DEMO_COOKIE}; Max-Age=0`)
  if (route === 'auth/forgot') return send(200, { ok: true })
  if (route === 'auth/login') {
    let body = ''
    for await (const c of req) body += c
    const { password } = JSON.parse(body || '{}') as { password?: string }
    if (password === DEMO_PASSWORD) return send(200, demoSession(), DEMO_COOKIE)
    return send(401, { error: 'E-mail ou senha incorretos.' })
  }
  return send(404, {})
}

async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost')
  if (!process.env.SUPABASE_URL) {
    return handleDemo(req, res, pathname.replace(/^\/api\//, '').replace(/\/$/, ''))
  }
  const route = pathname.replace(/^\/api\//, '').replace(/\/$/, '')
  if (!/^[a-z0-9/-]+$/.test(route) || route.split('/').some((s) => s.startsWith('_'))) {
    res.statusCode = 404
    return res.end()
  }

  let mod: Record<string, unknown>
  try {
    mod = await server.ssrLoadModule(`/api/${route}.ts`)
  } catch {
    res.statusCode = 404
    return res.end()
  }

  const method = (req.method ?? 'GET').toUpperCase()
  const fn = mod[method]
  if (typeof fn !== 'function') {
    res.statusCode = 405
    return res.end()
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const body = chunks.length ? Buffer.concat(chunks) : undefined

  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
    else if (v) headers.set(k, v)
  }
  // Simula o header que a Vercel injeta com o IP do cliente.
  if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', req.socket.remoteAddress ?? '127.0.0.1')

  const request = new Request(`http://${req.headers.host}${req.url}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  })

  const response = (await (fn as (r: Request) => Promise<Response>)(request)) as Response
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value)
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length) res.setHeader('set-cookie', cookies)
  res.end(Buffer.from(await response.arrayBuffer()))
}
