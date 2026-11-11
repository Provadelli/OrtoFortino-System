import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import { gerarXlsx } from '../support/xlsx'
import { mockAuth } from './fixtures'

const AFO = {
  id: '33333333-3333-4333-8333-333333333333',
  codigo: 'AFO-01',
  nome: 'AFO articulada',
  nome_busca: 'afo articulada',
  tipo: 'base',
  categoria: 'Órteses de membro inferior',
  descricao: 'Polipropileno com articulação',
  unidade: 'par',
  preco: '1250.00', // numeric chega como string
  ativo: true,
  updated_at: '2026-11-10T12:00:00Z',
}
const TIRA = { ...AFO, id: '44444444-4444-4444-8444-444444444444', codigo: null, nome: 'Tira valgo', nome_busca: 'tira valgo', tipo: 'adicional', categoria: 'Adicionais', descricao: null, unidade: 'un', preco: '80.00' }
const ANTIGO = { ...AFO, id: '55555555-5555-4555-8555-555555555555', codigo: null, nome: 'Palmilha antiga', nome_busca: 'palmilha antiga', categoria: null, descricao: null, preco: '300.00', ativo: false }

const HISTORICO = [
  { id: 'h2', preco_anterior: '1100.00', preco_novo: '1250.00', origem: 'importacao', alterado_em: '2026-11-09T15:30:00Z' },
  { id: 'h1', preco_anterior: null, preco_novo: '1100.00', origem: 'manual', alterado_em: '2026-01-05T10:00:00Z' },
]

const json = (r: Route, body: unknown) => r.fulfill({ json: body })

async function mockDb(page: Page, { vazio = false, erroExcluir = false, erroImportar = false } = {}) {
  const chamadas: { metodo: string; corpo: unknown }[] = []
  let importados: unknown = null
  await page.route('**/rest/v1/rpc/importar_produtos', (r) => {
    importados = r.request().postDataJSON()
    if (erroImportar) return r.fulfill({ status: 409, json: { code: '23505', message: 'duplicado', details: '1', hint: 'nome' } })
    return json(r, { criados: 1, atualizados: 1, inalterados: 0 })
  })
  await page.route('**/rest/v1/produtos*', (r) => {
    const req = r.request()
    const metodo = req.method()
    if (metodo !== 'GET') chamadas.push({ metodo, corpo: metodo === 'DELETE' ? null : req.postDataJSON() })
    if (metodo === 'DELETE') return erroExcluir ? r.fulfill({ status: 409, json: { code: '23503', message: 'fk' } }) : r.fulfill({ status: 204, body: '' })
    if (metodo === 'POST' || metodo === 'PATCH') return json(r, { id: AFO.id })
    const id = new URL(req.url()).searchParams.get('id')
    if (id?.startsWith('eq.')) return json(r, { ...AFO, historico_precos: HISTORICO })
    return json(r, vazio ? [] : [AFO, TIRA, ANTIGO])
  })
  return { chamadas: () => chamadas, importados: () => importados }
}

async function axe(page: Page) {
  await page.waitForTimeout(900)
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  const v = res.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(v, v.join('\n')).toEqual([])
}

test('tabela vazia convida a importar a planilha', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page, { vazio: true })
  await page.goto('/tabela-de-precos')
  await expect(page.getByText('A tabela de preços está vazia')).toBeVisible()
  await axe(page)
})

test('lista agrupa por categoria, filtra e busca sem acento', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  await page.goto('/tabela-de-precos')
  await expect(page.getByRole('table').getByText(/Órteses de membro inferior/)).toBeVisible()
  const afo = page.getByRole('row', { name: /AFO articulada/ })
  await expect(afo.getByText(/R\$\s1\.250,00/)).toBeVisible()
  await expect(afo.getByText('Produto-base')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Palmilha antiga' })).toBeVisible() // sem filtros, aparecem todos (inclusive inativos)
  await axe(page)

  await page.getByRole('button', { name: 'Filtros' }).click()
  await page.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Adicionais' }).click()
  await expect(page.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Adicionais' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: 'Tira valgo' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'AFO articulada' })).toHaveCount(0)
  await axe(page)

  await page.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Adicionais' }).click()
  await page.getByRole('button', { name: 'Inativos', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Palmilha antiga' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'AFO articulada' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Remover filtro Inativos' }).click()
  await page.getByRole('button', { name: 'Ativos', exact: true }).click()
  await page.getByLabel('Buscar por nome, código ou categoria').fill('ORTESES')
  await expect(page.getByRole('link', { name: 'AFO articulada' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tira valgo' })).toHaveCount(0)
  await expect(page.getByText('1 produto para “ORTESES”')).toBeVisible()
})

test('novo produto valida o preço e salva', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/tabela-de-precos/novo')
  await page.getByRole('button', { name: 'Adicionar à tabela' }).click()
  await expect(page.getByText('Informe o nome do produto.')).toBeVisible()
  await expect(page.getByText('Informe o preço (pode ser 0,00).')).toBeVisible()

  await page.getByLabel('Nome *').fill('Forro temático')
  await page.getByRole('radio', { name: 'Adicional' }).check()
  await page.getByLabel('Categoria').fill('Personalização')
  // O campo não aceita mais de 2 casas decimais e completa os centavos ao sair.
  await page.getByLabel('Preço (R$) *').fill('12,345')
  await expect(page.getByLabel('Preço (R$) *')).toHaveValue('12,34')
  await page.getByLabel('Preço (R$) *').fill('45')
  await page.getByLabel('Preço (R$) *').blur()
  await expect(page.getByLabel('Preço (R$) *')).toHaveValue('45,00')
  await axe(page)

  await page.getByRole('button', { name: 'Adicionar à tabela' }).click()
  await expect(page).toHaveURL(/\/tabela-de-precos$/)
  await expect(page.getByText('“Forro temático” adicionado à tabela.')).toBeVisible()
  expect(db.chamadas()[0]).toEqual({
    metodo: 'POST',
    corpo: { nome: 'Forro temático', codigo: null, tipo: 'adicional', categoria: 'Personalização', unidade: 'un', preco: 45, descricao: null },
  })
})

test('editar mostra o histórico, avisa a mudança de preço e desativa', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto(`/tabela-de-precos/${AFO.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'AFO articulada' })).toBeVisible()
  const hist = page.getByRole('region', { name: 'Histórico de preços' })
  await expect(hist.getByText('Importação de planilha')).toBeVisible()
  await expect(hist.getByText(/\+R\$\s150,00/)).toBeVisible()
  await expect(hist.getByText(/Preço inicial: R\$\s1\.100,00/)).toBeVisible()

  await page.getByLabel('Preço (R$) *').fill('1.300,00')
  await expect(page.getByText(/Antes: R\$\s*1\.250,00 → agora R\$\s*1\.300,00/)).toBeVisible()
  await axe(page)

  await page.getByRole('button', { name: 'Desativar produto' }).click()
  await expect(page.getByText('Produto desativado. Ele não aparece mais para novos orçamentos.')).toBeVisible()
  expect(db.chamadas()[0]).toEqual({ metodo: 'PATCH', corpo: { ativo: false } })
})

test('excluir produto em uso sugere desativar', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page, { erroExcluir: true })
  await page.goto(`/tabela-de-precos/${AFO.id}`)
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Excluir “AFO articulada”?' })).toBeVisible()
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click()
  await expect(page.getByText(/já foi usado em orçamentos/)).toBeVisible()
})

test('importar planilha: prévia, erros por linha e importação', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/tabela-de-precos/importar')
  await expect(page.getByRole('link', { name: 'Baixar modelo (CSV)' })).toHaveAttribute('download', 'modelo-tabela-de-precos.csv')

  // Windows-1252, como o Excel em português salva ("Ó" = 0xD3, "ç" = 0xE7, "ã" = 0xE3)
  const csv = 'codigo;nome;tipo;categoria;preco\r\nAFO-01;AFO articulada;base;Órteses;1.300,00\r\n;Forro temático;adicional;Personalização;45\r\n;;base;;10\r\n'
  const bytes = Buffer.from([...csv].map((c) => ({ Ó: 0xd3, ç: 0xe7, ã: 0xe3, á: 0xe1 })[c] ?? c.charCodeAt(0)))
  await page.getByLabel('Planilha (.xlsx ou .csv)').setInputFiles({ name: 'precos.csv', mimeType: 'text/csv', buffer: bytes })

  await expect(page.getByText('2 linhas válidas')).toBeVisible()
  await expect(page.getByText('1 novo', { exact: true })).toBeVisible()
  await expect(page.getByText('1 com preço alterado')).toBeVisible()
  await expect(page.getByText('Linha 4: nome vazio')).toBeVisible()
  await expect(page.getByRole('row', { name: /Forro temático/ })).toContainText('Personalização')
  await expect(page.getByRole('row', { name: /AFO articulada/ })).toContainText(/antes R\$\s1\.250,00/)
  await axe(page)

  await page.getByRole('button', { name: 'Importar 2 produtos e ignorar 1 linha' }).click()
  await expect(page).toHaveURL(/\/tabela-de-precos$/)
  await expect(page.getByText('Planilha importada: 1 produto novo, 1 atualizado.')).toBeVisible()
  expect(db.importados()).toEqual({
    p_itens: [
      { codigo: 'AFO-01', nome: 'AFO articulada', tipo: 'base', categoria: 'Órteses', unidade: 'un', preco: 1300, descricao: '' },
      { codigo: '', nome: 'Forro temático', tipo: 'adicional', categoria: 'Personalização', unidade: 'un', preco: 45, descricao: '' },
    ],
  })
})

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

test('importar planilha do Excel (.xlsx): título acima do cabeçalho, nomes de coluna livres e conflito com a tabela', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/tabela-de-precos/importar')
  const planilha = gerarXlsx([
    ['Tabela de preços 2026'],
    [],
    ['Cód.', 'Descrição do produto', 'Und.', 'Preço unitário (R$)', 'Grupo'],
    ['', 'AFO articulada', 'par', 1300, 'Órteses'],
    ['SMO-02', 'SMO forrada', 'par', 'R$ 890,00', 'Órteses'],
    ['AFO-01', 'Tira valgo', 'un', 85, 'Adicionais'], // código de um produto, nome de outro
  ])
  await page.getByLabel('Planilha (.xlsx ou .csv)').setInputFiles({ name: 'Tabela 2026.xlsx', mimeType: XLSX, buffer: Buffer.from(planilha) })

  await expect(page.getByText('Arquivo: Tabela 2026.xlsx')).toBeVisible()
  await expect(page.getByText('2 linhas válidas')).toBeVisible()
  await expect(page.getByText(/Linha 6: o código “AFO-01” é de “AFO articulada”, mas o nome “Tira valgo” já é de outro produto/)).toBeVisible()
  await expect(page.getByRole('row', { name: /SMO forrada/ })).toContainText('Novo')
  await axe(page)

  await page.getByRole('button', { name: 'Importar 2 produtos e ignorar 1 linha' }).click()
  await expect(page).toHaveURL(/\/tabela-de-precos$/)
  expect(db.importados()).toEqual({
    p_itens: [
      { codigo: '', nome: 'AFO articulada', tipo: 'base', categoria: 'Órteses', unidade: 'par', preco: 1300, descricao: '' },
      { codigo: 'SMO-02', nome: 'SMO forrada', tipo: 'base', categoria: 'Órteses', unidade: 'par', preco: 890, descricao: '' },
    ],
  })
})

test('importar: arquivo de formato antigo é recusado com orientação, e o erro do banco diz a linha', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page, { erroImportar: true })
  await page.goto('/tabela-de-precos/importar')
  const campo = page.getByLabel('Planilha (.xlsx ou .csv)')
  await campo.setInputFiles({ name: 'antiga.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') })
  await expect(page.getByRole('alert')).toContainText('Pasta de Trabalho do Excel (.xlsx)')
  await campo.setInputFiles({ name: 'quebrada.xlsx', mimeType: XLSX, buffer: Buffer.from('não é zip') })
  await expect(page.getByRole('alert')).toContainText('Não foi possível ler a planilha')

  await campo.setInputFiles({ name: 'precos.csv', mimeType: 'text/csv', buffer: Buffer.from('nome;preco\nKAFO novo;2000\n') })
  await page.getByRole('button', { name: 'Importar 1 produto' }).click()
  await expect(page.getByRole('alert')).toHaveText('Linha 2 (“KAFO novo”): o nome já pertence a outro produto da tabela. Corrija a planilha e envie de novo. Nada foi alterado.')
  await expect(page).toHaveURL(/\/importar$/)
})

test('sem rolagem horizontal da página no celular', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'só no celular')
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  for (const path of ['/tabela-de-precos', `/tabela-de-precos/${AFO.id}`, '/tabela-de-precos/importar']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForTimeout(600)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})
