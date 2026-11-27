import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockAuth } from './fixtures'

const PACIENTE = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Helena Ribeiro',
  cpf: '52998224725',
  data_nascimento: '2018-05-10',
  telefone: '21964973837',
  endereco: 'Rua das Flores, 10',
  cidade: 'Rio de Janeiro',
  uf: 'RJ',
  origem: 'clinica',
  origem_nome: 'Clínica Movimento',
  medico: 'Dra. Ana',
  diagnostico: 'Pé equino',
  observacoes: null,
  consentimento_lgpd_em: '2026-11-10T12:00:00Z',
  created_at: '2026-11-10T12:00:00Z',
  updated_at: '2026-11-10T12:00:00Z',
  responsaveis: [{ id: 'r1', nome: 'Marta Ribeiro', cpf: '11144477735', telefone: null, parentesco: 'Mãe', principal: true, created_at: '2026-11-10T12:00:00Z' }],
}

/** Simula o PostgREST do Supabase. */
async function mockDb(page: Page, { vazio = false } = {}) {
  let salvo: unknown = null
  let busca: Record<string, unknown> = {}
  await page.route('**/rest/v1/rpc/buscar_pacientes', (r) => {
    busca = r.request().postDataJSON()
    return r.fulfill({
      json: vazio
        ? []
        : [{ ...PACIENTE, cpf_mascarado: '***.982.247-**', responsavel: 'Marta Ribeiro', total: 1 }],
    })
  })
  await page.route('**/rest/v1/rpc/salvar_paciente', async (r) => {
    salvo = r.request().postDataJSON()
    return r.fulfill({ json: PACIENTE.id })
  })
  await page.route('**/rest/v1/pacientes*', (r) => r.fulfill({ json: PACIENTE }))
  await page.route('https://viacep.com.br/ws/*/json/', (r) => {
    const cep = new URL(r.request().url()).pathname.split('/')[2]
    if (cep === '01310100') return r.fulfill({ json: { cep: '01310-100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' } })
    return r.fulfill({ json: { erro: 'true' } })
  })
  await page.route('https://brasilapi.com.br/api/cnpj/v1/*', (r) => {
    const cnpj = new URL(r.request().url()).pathname.split('/')[4]
    if (cnpj === '34130423000148')
      return r.fulfill({
        json: { razao_social: 'ORTO FORTINO LTDA', cep: '01310100', descricao_tipo_de_logradouro: 'AVENIDA', logradouro: 'PAULISTA', numero: '1000', bairro: 'BELA VISTA', municipio: 'SAO PAULO', uf: 'SP' },
      })
    return r.fulfill({ status: 404, json: { message: 'CNPJ não encontrado' } })
  })
  await page.route('**/rest/v1/atendimentos*', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/orcamentos*', (r) => r.fulfill({ json: [] }))
  return { salvo: () => salvo, busca: () => busca }
}

async function axe(page: Page) {
  await page.waitForTimeout(900)
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  const v = res.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(v, v.join('\n')).toEqual([])
}

test('lista vazia convida a cadastrar', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page, { vazio: true })
  await page.goto('/clientes')
  await expect(page.getByText('Nenhum paciente cadastrado ainda')).toBeVisible()
  await axe(page)
})

test('lista mostra CPF mascarado, filtra e leva à ficha', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/clientes')
  await expect(page.getByRole('cell', { name: '***.982.247-**' })).toBeVisible()
  await expect(page.getByText('52998224725')).toHaveCount(0)
  await axe(page)

  // Filtros de origem e idade vão para a busca; sem filtros, aparecem todos.
  expect(db.busca()).not.toHaveProperty('origens')
  await page.getByRole('button', { name: 'Filtros' }).click()
  await page.getByRole('button', { name: 'Clínica' }).click()
  await page.getByRole('button', { name: 'Menores de 18' }).click()
  await expect.poll(() => db.busca()).toMatchObject({ origens: ['clinica'], faixas: ['menor'] })
  await axe(page)
  await page.getByRole('button', { name: /Limpar filtros/ }).click()
  await expect(page).not.toHaveURL(/f=/) // volta à lista completa (do cache)

  await page.getByRole('link', { name: 'Helena Ribeiro' }).click()
  await expect(page).toHaveURL(/\/clientes\/1111/)
  await expect(page.getByRole('heading', { level: 1, name: 'Helena Ribeiro' })).toBeVisible()
})

test('ficha: CPF oculto por padrão e revelável', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  await page.goto(`/clientes/${PACIENTE.id}`)
  await expect(page.getByText('***.982.247-**')).toBeVisible()
  await page.getByRole('button', { name: 'Mostrar CPF completo' }).click()
  await expect(page.getByText('529.982.247-25')).toBeVisible()
  await expect(page.getByText('Menor de idade')).toBeVisible()
  await axe(page)
})

test('cadastro valida CPF, origem e consentimento', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Davi Martins')
  await page.getByRole('textbox', { name: 'CPF', exact: true }).fill('12345678900')
  await page.getByRole('textbox', { name: 'CPF', exact: true }).blur()
  await expect(page.getByText('CPF inválido. Confira os 11 números.')).toBeVisible()
  await page.getByRole('radio', { name: 'Clínica' }).check()
  await page.getByRole('button', { name: 'Cadastrar paciente' }).click()
  await expect(page.getByText('CPF inválido. Confira os 11 números.')).toBeVisible()
  await expect(page.getByText('Informe o nome da clínica ou da operadora.')).toBeVisible()
  await expect(page.getByRole('alert').first()).toContainText('campos para corrigir')
  await axe(page)
})

test('cadastro completo com responsável salva e abre a ficha', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Helena Ribeiro')
  await page.getByRole('textbox', { name: 'CPF', exact: true }).fill('52998224725')
  await expect(page.getByRole('textbox', { name: 'CPF', exact: true })).toHaveValue('529.982.247-25')
  await page.getByLabel('Data de nascimento').fill('2018-05-10')
  await expect(page.getByText(/Idade: \d+ anos/)).toBeVisible()
  await page.getByLabel('Telefone').first().fill('21964973837')
  await expect(page.getByLabel('Telefone').first()).toHaveValue('(21) 96497-3837')
  // CEP inexistente avisa; CEP válido preenche endereço, cidade e troca a UF (padrão RJ) e leva o cursor ao número.
  await page.getByLabel('CEP').fill('99999999')
  await expect(page.getByText('CEP não encontrado.', { exact: false })).toBeVisible()
  await page.getByLabel('CEP').fill('01310100')
  await expect(page.getByLabel('CEP')).toHaveValue('01.310-100')
  await expect(page.getByRole('textbox', { name: 'Endereço' })).toHaveValue('Avenida Paulista - Bela Vista')
  await expect(page.getByLabel('Cidade')).toHaveValue('São Paulo')
  await expect(page.getByLabel('UF')).toHaveValue('SP')
  await expect(page.getByRole('textbox', { name: 'Endereço' })).toBeFocused()
  await page.keyboard.type(', 1000')
  await expect(page.getByRole('textbox', { name: 'Endereço' })).toHaveValue('Avenida Paulista, 1000 - Bela Vista')

  await page.getByRole('radio', { name: 'Clínica' }).check()
  await page.getByLabel('Nome da clínica *').fill('APAE Nova Iguaçu')
  await page.getByLabel('Médico(a) ou terapeuta').fill('Dra. Ana Souza')
  await page.getByRole('button', { name: '+ Adicionar responsável' }).click()
  await page.getByLabel('Nome *', { exact: true }).fill('Marta Ribeiro')
  await page.getByRole('checkbox', { name: /autorizou o uso dos dados/ }).check()
  await page.getByRole('button', { name: 'Cadastrar paciente' }).click()
  await expect(page).toHaveURL(new RegExp(`/clientes/${PACIENTE.id}$`))
  await expect(page.getByText('Paciente cadastrado com sucesso.')).toBeVisible()

  const body = db.salvo() as { p_dados: Record<string, unknown>; p_responsaveis: Array<Record<string, unknown>> }
  expect(body.p_dados.cpf).toBe('52998224725') // só dígitos no banco
  expect(body.p_dados.telefone).toBe('21964973837')
  expect(body.p_dados).toMatchObject({ cep: '01310100', endereco: 'Avenida Paulista, 1000 - Bela Vista', cidade: 'São Paulo', uf: 'SP', origem_nome: 'APAE Nova Iguaçu', medico: 'Dra. Ana Souza' })
  expect(body.p_dados.consentimento).toBe(true)
  expect(body.p_responsaveis[0]).toMatchObject({ nome: 'Marta Ribeiro', principal: true })
})

test('sem consentimento não salva', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lucas Ferreira')
  await page.getByRole('button', { name: 'Cadastrar paciente' }).click()
  await expect(page.getByText('É preciso registrar o consentimento')).toBeVisible()
  expect(db.salvo()).toBeNull()
})

test('rascunho do cadastro volta ao retornar à tela', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Davi Martins')
  await page.getByRole('link', { name: 'Voltar para clientes' }).click()
  await expect(page).toHaveURL(/\/clientes$/)
  await page.goBack()
  await expect(page.getByText('Continuando de onde você parou.')).toBeVisible()
  await expect(page.getByLabel('Nome completo *')).toHaveValue('Davi Martins')
})

test('excluir paciente com histórico mostra o impacto e exige digitar o nome', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  let apagado = false
  await page.route('**/rest/v1/atendimentos*', (r) =>
    r.fulfill({
      json: [
        {
          id: 'a1', numero: 7, categoria: 'ortese', descricao: 'AFO', status: 'entregue', prazo_entrega: null, data_primeiro_contato: '2026-11-01',
          data_conclusao: '2026-11-09', valor: '900.00', valor_pago: '900.00', pagamento_status: 'pago', fichas_tecnicas: [],
        },
      ],
    }),
  )
  await page.route('**/rest/v1/pacientes*', (r) => {
    if (r.request().method() === 'DELETE') {
      apagado = true
      return r.fulfill({ status: 204, body: '' })
    }
    return r.fulfill({ json: PACIENTE })
  })
  await page.goto(`/clientes/${PACIENTE.id}`)
  await page.getByRole('button', { name: 'Excluir cadastro de Helena Ribeiro' }).click()
  const dlg = page.getByRole('dialog', { name: 'Excluir Helena Ribeiro?' })
  await expect(dlg).toContainText('1 atendimento')
  const confirmar = dlg.getByRole('button', { name: 'Excluir definitivamente' })
  await expect(confirmar).toBeDisabled()
  await axe(page)
  await dlg.getByLabel(/Para confirmar, digite/).fill('helena ribeiro')
  await expect(confirmar).toBeEnabled()
  await confirmar.click()
  await expect(page).toHaveURL(/\/clientes$/)
  await expect(page.getByText('Cadastro de Helena Ribeiro excluído.')).toBeVisible()
  expect(apagado).toBe(true)
})

test('cliente pessoa jurídica: CNPJ preenche a razão social e o endereço', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/clientes/novo')
  await page.getByRole('radio', { name: 'CNPJ' }).check()
  await expect(page.getByRole('textbox', { name: 'CPF', exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'CNPJ', exact: true }).fill('34130423000148')
  await expect(page.getByRole('textbox', { name: 'CNPJ', exact: true })).toHaveValue('34.130.423/0001-48')
  await expect(page.getByLabel('Razão social / nome *')).toHaveValue('ORTO FORTINO LTDA')
  await expect(page.getByRole('textbox', { name: 'Endereço' })).toHaveValue('Avenida Paulista, 1000 - Bela Vista')
  await expect(page.getByLabel('Cidade')).toHaveValue('Sao Paulo')
  await page.getByRole('checkbox', { name: /autorizou o uso dos dados/ }).check()
  await page.getByRole('button', { name: 'Cadastrar paciente' }).click()
  await expect(page).toHaveURL(new RegExp(`/clientes/${PACIENTE.id}$`))
  const body = db.salvo() as { p_dados: Record<string, unknown> }
  expect(body.p_dados).toMatchObject({ tipo_documento: 'cnpj', cnpj: '34130423000148', cpf: '', nome: 'ORTO FORTINO LTDA', uf: 'SP' })
})

test('CNPJ inválido é recusado', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  await page.goto('/clientes/novo')
  await page.getByRole('radio', { name: 'CNPJ' }).check()
  await page.getByRole('textbox', { name: 'CNPJ', exact: true }).fill('34130423000149')
  await page.getByRole('textbox', { name: 'CNPJ', exact: true }).blur()
  await expect(page.getByText('CNPJ inválido. Confira os 14 números.')).toBeVisible()
})
