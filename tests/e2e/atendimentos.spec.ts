import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import { mockAuth } from './fixtures'

const PACIENTE = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Helena Ribeiro',
  data_nascimento: '2018-05-10',
  telefone: '21964973837',
}

const ATENDIMENTO = {
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
  },
}

const json = (r: Route, body: unknown, total?: number) =>
  r.fulfill({
    json: body,
    headers: total === undefined ? {} : { 'content-range': total ? `0-${total - 1}/${total}` : `*/0` },
  })

/** Simula o PostgREST do Supabase para atendimentos (e o necessário de pacientes). */
async function mockDb(page: Page, { vazio = false } = {}) {
  let salvo: unknown = null
  let patch: unknown = null
  await page.route('**/rest/v1/rpc/buscar_pacientes', (r) =>
    json(r, [{ ...PACIENTE, cpf_mascarado: '***.982.247-**', responsavel: 'Marta Ribeiro', total: 1 }]),
  )
  await page.route('**/rest/v1/pacientes*', (r) => json(r, { ...PACIENTE, responsaveis: [] }))
  await page.route('**/rest/v1/rpc/salvar_atendimento', async (r) => {
    salvo = r.request().postDataJSON()
    return json(r, ATENDIMENTO.id)
  })
  // origem do atendimento (orçamento aprovado)
  await page.route('**/rest/v1/orcamentos*', (r) =>
    json(r, new URL(r.request().url()).searchParams.has('atendimento_id') ? [{ id: 'o9', numero: 'ORC-2026-0009' }] : []),
  )
  await page.route('**/rest/v1/atendimentos*', async (r) => {
    const req = r.request()
    if (req.method() === 'PATCH') {
      patch = req.postDataJSON()
      return r.fulfill({ status: 204, body: '' })
    }
    const url = new URL(req.url())
    if (url.searchParams.get('id')?.startsWith('eq.')) {
      const um = req.headers()['accept']?.includes('vnd.pgrst.object') ? ATENDIMENTO : [ATENDIMENTO]
      return json(r, um)
    }
    const rows = vazio ? [] : [ATENDIMENTO]
    return json(r, rows, rows.length)
  })
  return { salvo: () => salvo, patch: () => patch }
}

async function axe(page: Page) {
  await page.waitForTimeout(900)
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  const v = res.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(v, v.join('\n')).toEqual([])
}

test('lista vazia convida a abrir atendimento', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page, { vazio: true })
  await page.goto('/atendimentos')
  await expect(page.getByText('Nenhum atendimento aqui')).toBeVisible()
  await axe(page)
})

test('lista mostra status, atraso e pagamento parcial', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  await page.goto('/atendimentos')
  const linha = page.getByRole('row', { name: /Helena Ribeiro/ })
  await expect(linha.getByText('Em produção')).toBeVisible()
  await expect(linha.getByText('Atrasado')).toBeVisible()
  await expect(linha.getByText('Parcial')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Em andamento' })).toHaveAttribute('aria-current', 'page')
  await axe(page)
  await page.getByRole('link', { name: 'Atrasados' }).click()
  await expect(page).toHaveURL(/filtro=atrasados/)
})

test('detalhe mostra ficha técnica e avança o status', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto(`/atendimentos/${ATENDIMENTO.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'AFO articulada bilateral' })).toBeVisible()
  await expect(page.getByText('Tira valgo')).toBeVisible()
  await expect(page.getByRole('link', { name: 'ORC-2026-0009' })).toHaveAttribute('href', '/orcamentos/o9')
  await expect(page.getByText(/falta R\$\s*750,00/)).toBeVisible()
  await axe(page)
  await page.getByRole('button', { name: 'Marcar como pronto' }).click()
  await expect(page.getByText('Status atualizado para “Pronto”.')).toBeVisible()
  expect(db.patch()).toEqual({ status: 'pronto' })
})

test('novo atendimento: escolhe paciente, preenche ficha e salva', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/atendimentos/novo')
  await page.getByRole('button', { name: 'Abrir atendimento' }).click()
  await expect(page.getByText('Escolha o paciente.')).toBeVisible()

  await page.getByRole('radio', { name: /Helena Ribeiro/ }).click() // o seletor vira o resumo do paciente
  await expect(page.getByRole('button', { name: 'Trocar paciente' })).toBeVisible()
  await page.getByLabel('Descrição curta').fill('AFO articulada bilateral')
  await page.getByRole('radio', { name: 'Bilateral' }).check()
  await page.getByLabel('Produto').fill('AFO articulada')
  await page.getByRole('checkbox', { name: 'Tira valgo' }).check()
  await page.getByLabel('Valor (R$)').fill('1.250,00')
  await page.getByLabel('Valor pago (R$)').fill('2.000')
  await page.getByLabel('Valor pago (R$)').blur()
  await expect(page.getByText('O valor pago é maior que o valor do atendimento.')).toBeVisible()
  await page.getByLabel('Valor pago (R$)').fill('500')
  await expect(page.getByText(/falta R\$\s*750,00/)).toBeVisible()
  await axe(page)

  await page.getByRole('button', { name: 'Abrir atendimento' }).click()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ATENDIMENTO.id}$`))
  await expect(page.getByText('Atendimento aberto com sucesso.')).toBeVisible()

  const body = db.salvo() as { p_id: string | null; p_dados: Record<string, unknown>; p_ficha: Record<string, unknown> }
  expect(body.p_id).toBeNull()
  expect(body.p_dados).toMatchObject({ paciente_id: PACIENTE.id, valor: 1250, valor_pago: 500, categoria: 'confeccao' })
  expect(body.p_ficha).toMatchObject({ tipo: 'ortese', lateralidade: 'bilateral', produto: 'AFO articulada', especificacoes: ['Tira valgo'] })
})

test('ficha do paciente lista os atendimentos', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  await page.goto(`/clientes/${PACIENTE.id}`)
  await expect(page.getByRole('link', { name: 'AFO articulada bilateral' })).toBeVisible()
  await expect(page.getByRole('link', { name: '+ Novo atendimento' })).toHaveAttribute('href', `/atendimentos/novo?paciente=${PACIENTE.id}`)
})

test('rascunho: sair da tela e voltar mantém o que foi preenchido, e some depois de salvar', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/atendimentos/novo')
  await page.getByRole('radio', { name: /Helena Ribeiro/ }).click()
  await page.getByLabel('Descrição curta').fill('AFO articulada bilateral')
  await page.getByLabel('Valor (R$)').fill('1.250,00')

  await page.getByRole('link', { name: 'Voltar' }).click() // navegação dentro do sistema
  await expect(page).not.toHaveURL(/\/novo$/)
  await page.goBack()
  await expect(page.getByText('Continuando de onde você parou.')).toBeVisible()
  await expect(page.getByLabel('Descrição curta')).toHaveValue('AFO articulada bilateral')
  await expect(page.getByLabel('Valor (R$)')).toHaveValue('1.250,00')
  await expect(page.getByRole('button', { name: 'Trocar paciente' })).toBeVisible()
  await axe(page)

  await page.getByRole('button', { name: 'Abrir atendimento' }).click()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ATENDIMENTO.id}$`))
  expect((db.salvo() as { p_dados: Record<string, unknown> }).p_dados).toMatchObject({ paciente_id: PACIENTE.id, valor: 1250, descricao: 'AFO articulada bilateral' })

  await page.goto('/atendimentos/novo')
  await expect(page.getByLabel('Descrição curta')).toHaveValue('')
  await expect(page.getByText('Continuando de onde você parou.')).toHaveCount(0)
})
