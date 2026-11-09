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

async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost')
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
