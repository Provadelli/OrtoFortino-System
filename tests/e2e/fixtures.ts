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
    authed ? r.fulfill({ json: session }) : r.fulfill({ status: 204, body: '' }),
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

/** Resumo do painel com dados realistas (atrasado, entrega hoje, pagamento parcial). */
export function painelExemplo(hoje: string) {
  return {
    em_contato: 4,
    em_producao: 12,
    prontos: 3,
    entregues_mes: 9,
    entregas_semana: 5,
    atrasados: 1,
    a_receber: '8450.00', // numeric chega como string
    pagamentos_abertos: 4,
    prazos: [
      { id: 'a1', numero: 41, status: 'em_producao', prazo_entrega: '2020-01-06', categoria: 'confeccao', servico: 'AFO articulada bilateral', paciente: 'Polyana Souza Lima' },
      { id: 'a2', numero: 42, status: 'pronto', prazo_entrega: hoje, categoria: 'confeccao', servico: null, paciente: 'Mariana Lopes' },
      { id: 'a3', numero: 43, status: 'em_producao', prazo_entrega: '2099-12-31', categoria: 'ajuste', servico: 'SMO forrada', paciente: 'João Pedro' },
    ],
    receber: [
      { id: 'a4', numero: 30, pagamento_status: 'parcial', pagamento_forma: 'pix', pagamento_detalhe: '50% na aprovação', restante: '2450.00', paciente: 'Helena Ribeiro' },
      { id: 'a5', numero: 31, pagamento_status: 'pendente', pagamento_forma: null, pagamento_detalhe: null, restante: '1800.00', paciente: 'Gabriel Teixeira' },
    ],
  }
}

/** Simula a RPC painel_resumo; `body` substitui o exemplo (ou `status` força erro). */
export async function mockPainel(page: Page, opts: { body?: unknown; status?: number } = {}) {
  await page.route('**/rest/v1/rpc/painel_resumo', (r) => {
    if (opts.status) return r.fulfill({ status: opts.status, json: { message: 'erro' } })
    const { p_hoje } = r.request().postDataJSON() as { p_hoje: string }
    return r.fulfill({ json: opts.body ?? painelExemplo(p_hoje) })
  })
}
