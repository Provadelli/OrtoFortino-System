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
    orcamentos_abertos: 3,
    orcamentos_valor_aberto: '5120.00',
    orcamentos_vencidos: 1,
    orcamentos: [
      { id: 'o1', numero: 'ORC-2026-0012', status: 'enviado', total: '2450.00', validade: '2020-01-01', updated_at: '2026-11-10T12:00:00Z', paciente: 'Helena Ribeiro' },
      { id: 'o2', numero: 'ORC-2026-0011-v2', status: 'aprovado', total: '1800.00', validade: '2099-12-31', updated_at: '2026-11-09T12:00:00Z', paciente: 'Gabriel Teixeira' },
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
  // Recebimentos: um pagamento hoje (R$ 500) e um 10 dias antes (R$ 250).
  await page.route('**/rest/v1/rpc/painel_recebimentos', (r) => {
    const { p_ate } = r.request().postDataJSON() as { p_ate: string }
    const d = new Date(p_ate + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - 10)
    return r.fulfill({ json: [{ dia: d.toISOString().slice(0, 10), total: '250' }, { dia: p_ate, total: '500' }] })
  })
}

/** Paciente e atendimento de exemplo (formato do PostgREST, com ficha técnica). */
export const PACIENTE = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Helena Ribeiro',
  data_nascimento: '2018-05-10',
  telefone: '21964973837',
}

export const ATENDIMENTO = {
  id: '22222222-2222-4222-8222-222222222222',
  numero: 7,
  paciente_id: PACIENTE.id,
  categoria: 'confeccao',
  descricao: 'AFO articulada bilateral',
  status: 'em_producao',
  data_primeiro_contato: '2026-11-01',
  data_fechamento: '2026-11-03',
  prazo_entrega: '2020-01-10', // no passado → "Atrasado"
  data_conclusao: null,
  valor: 1250,
  valor_pago: 500,
  pagamento_status: 'parcial',
  pagamento_forma: 'pix',
  pagamento_detalhe: 'entrada + 2x',
  data_pagamento: '2026-11-03',
  observacoes: null,
  created_at: '2026-11-01T12:00:00Z',
  updated_at: '2026-11-03T12:00:00Z',
  pacientes: PACIENTE,
  fichas_tecnicas: {
    tipo: 'ortese',
    lateralidade: 'bilateral',
    produto: 'AFO articulada',
    especificacoes: ['90°', 'Tira valgo'],
    compensacao_lado: null,
    compensacao_medida: null,
    tamanho_calcado: '28',
    medidas_ml: null,
    nome_na_ortese: true,
    tema: 'dinossauros',
    cor_forro: 'azul',
    cor_tira: null,
    protese_membro: null,
    protese_nivel: null,
    protese_lado: null,
    liner: null,
    tamanho_pe: null,
    observacoes: null,
    medidas: { 'pernas.d_sup': '24', 'pernas.e_sup': '23,5', 'pernas.total': '30' },
  },
}
