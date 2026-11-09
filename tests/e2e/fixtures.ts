import type { Page } from '@playwright/test'

const session = {
  accessToken: 'token-de-teste',
  expiresAt: Math.floor(Date.now() / 1000) + 900,
  user: { id: 'u1', email: 'equipe@ortofortino.com.br', nome: 'Fernanda Fortino' },
}

/** Simula o BFF (/api/auth/*) para testar o front sem depender do Supabase. */
export async function mockAuth(page: Page, { loggedIn = false, password = 'senhaCorreta2026' } = {}) {
  let authed = loggedIn
  await page.route('**/api/auth/refresh', (r) =>
    authed ? r.fulfill({ json: session }) : r.fulfill({ status: 401, json: { error: 'Sem sessão.' } }),
  )
  await page.route('**/api/auth/login', async (r) => {
    const body = r.request().postDataJSON() as { password: string }
    if (r.request().headers()['x-of-request'] !== '1') return r.fulfill({ status: 403, json: {} })
    if (body.password === password) {
      authed = true
      return r.fulfill({ json: session })
    }
    return r.fulfill({ status: 401, json: { error: 'E-mail ou senha incorretos.' } })
  })
  await page.route('**/api/auth/logout', (r) => {
    authed = false
    return r.fulfill({ json: { ok: true } })
  })
}
