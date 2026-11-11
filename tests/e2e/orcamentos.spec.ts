import { copyFileSync, readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import { mockAuth } from './fixtures'

const PACIENTE = { id: '11111111-1111-4111-8111-111111111111', nome: 'Helena Ribeiro', data_nascimento: '2018-05-10', telefone: '21964973837' }

const PRODUTOS = [
  { id: 'p-afo', codigo: 'AFO-01', nome: 'AFO articulada', nome_busca: 'afo articulada', tipo: 'base', categoria: 'Órteses', descricao: null, unidade: 'par', preco: '1250.00', ativo: true, updated_at: '2026-11-01T00:00:00Z' },
  { id: 'p-tira', codigo: null, nome: 'Tira valgo', nome_busca: 'tira valgo', tipo: 'adicional', categoria: 'Adicionais', descricao: null, unidade: 'un', preco: '80.00', ativo: true, updated_at: '2026-11-01T00:00:00Z' },
  { id: 'p-velho', codigo: null, nome: 'AFO antiga', nome_busca: 'afo antiga', tipo: 'base', categoria: 'Órteses', descricao: null, unidade: 'par', preco: '900.00', ativo: false, updated_at: '2026-11-01T00:00:00Z' },
]

const ID = '66666666-6666-4666-8666-666666666666'
const ID_V2 = '77777777-7777-4777-8777-777777777777'
const ATENDIMENTO_ID = '22222222-2222-4222-8222-222222222222'

function orcamento(status: string) {
  return {
    id: ID,
    ano: 2026,
    sequencial: 12,
    versao: 1,
    numero: 'ORC-2026-0012',
    versao_anterior_id: null,
    paciente_id: PACIENTE.id,
    status,
    data_emissao: '2026-11-10',
    validade: '2099-12-31',
    desconto_tipo: 'percentual',
    desconto: '10.00',
    subtotal: '1330.00',
    desconto_valor: '133.00',
    total: '1197.00',
    condicoes_pagamento: '50% na aprovação e 50% na entrega',
    prazo_entrega: '20 dias úteis',
    observacoes: null,
    atendimento_id: status === 'aprovado' ? ATENDIMENTO_ID : null,
    enviado_em: null,
    aprovado_em: null,
    created_at: '2026-11-10T12:00:00Z',
    updated_at: '2026-11-10T12:00:00Z',
    pacientes: { ...PACIENTE, cpf: '52998224725', responsaveis: [{ nome: 'Marina Ribeiro', cpf: '11144477735', telefone: '21981180919', parentesco: 'Mãe', principal: true }] },
    orcamento_itens: [
      { id: 'i1', ordem: 1, produto_id: 'p-afo', tipo: 'base', secao: 'Órteses', descricao: 'AFO articulada', detalhe: 'tema dinossauros', quantidade: '1.00', unidade: 'par', preco_unitario: '1250.00', total: '1250.00', produtos: { preco: '1250.00', ativo: true } },
      { id: 'i2', ordem: 2, produto_id: 'p-tira', tipo: 'adicional', secao: 'Adicionais', descricao: 'Tira valgo', detalhe: null, quantidade: '1.00', unidade: 'un', preco_unitario: '80.00', total: '80.00', produtos: { preco: '80.00', ativo: true } },
    ],
  }
}

const json = (r: Route, body: unknown, total?: number) =>
  r.fulfill({ json: body, headers: total === undefined ? {} : { 'content-range': total ? `0-${total - 1}/${total}` : '*/0', 'access-control-expose-headers': 'content-range' } })

async function mockDb(page: Page, { status = 'enviado', vazio = false } = {}) {
  const rpc: Record<string, unknown> = {}
  let urlLista = ''
  await page.route('**/rest/v1/rpc/buscar_pacientes', (r) => json(r, [{ ...PACIENTE, cpf_mascarado: '***.982.247-**', responsavel: null, total: 1 }]))
  await page.route('**/rest/v1/pacientes*', (r) => json(r, { ...PACIENTE, responsaveis: [] }))
  await page.route('**/rest/v1/produtos*', (r) => json(r, PRODUTOS))
  for (const fn of ['salvar_orcamento', 'mudar_status_orcamento', 'aprovar_orcamento', 'nova_versao_orcamento']) {
    await page.route(`**/rest/v1/rpc/${fn}`, (r) => {
      rpc[fn] = r.request().postDataJSON()
      const resposta = fn === 'aprovar_orcamento' ? ATENDIMENTO_ID : fn === 'nova_versao_orcamento' ? ID_V2 : fn === 'salvar_orcamento' ? ID : null
      return resposta ? json(r, resposta) : r.fulfill({ status: 204, body: '' })
    })
  }
  await page.route('**/rest/v1/orcamentos*', (r) => {
    const url = new URL(r.request().url())
    if (r.request().method() === 'DELETE') return r.fulfill({ status: 204, body: '' })
    if (url.searchParams.get('id')?.startsWith('eq.')) {
      const id = url.searchParams.get('id')!.slice(3)
      if (id === ID_V2) return json(r, { ...orcamento('rascunho'), id: ID_V2, versao: 2, numero: 'ORC-2026-0012-v2', versao_anterior_id: ID })
      return json(r, orcamento(status))
    }
    if (url.searchParams.has('ano')) {
      return json(r, [{ id: ID, numero: 'ORC-2026-0012', versao: 1, status, total: '1197.00', updated_at: '2026-11-10T12:00:00Z' }])
    }
    urlLista = url.search
    const rows = vazio
      ? []
      : [
          { id: ID, numero: 'ORC-2026-0012', status: 'enviado', data_emissao: '2026-11-10', validade: '2020-01-01', total: '1197.00', versao: 1, updated_at: '', pacientes: PACIENTE },
          { id: 'o2', numero: 'ORC-2026-0011-v2', status: 'rascunho', data_emissao: '2026-11-09', validade: '2099-12-31', total: '450.00', versao: 2, updated_at: '', pacientes: PACIENTE },
        ]
    return json(r, rows, rows.length)
  })
  return { rpc: (fn: string) => rpc[fn] as Record<string, unknown> | undefined, urlLista: () => urlLista }
}

async function axe(page: Page) {
  await page.waitForTimeout(900)
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  const v = res.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(v, v.join('\n')).toEqual([])
}

test('lista vazia convida a criar orçamento', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page, { vazio: true })
  await page.goto('/orcamentos')
  await expect(page.getByText('Nenhum orçamento ainda')).toBeVisible()
  await axe(page)
})

test('lista mostra situação, vencidos e busca por número', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/orcamentos')
  const linha = page.getByRole('row', { name: /ORC-2026-0012/ })
  await expect(linha.getByText('Enviado')).toBeVisible()
  await expect(linha.getByText('Vencido')).toBeVisible()
  await expect(page.getByRole('row', { name: /ORC-2026-0011-v2/ }).getByText('Vencido')).toHaveCount(0)
  await expect(page.getByText('2 orçamentos')).toBeVisible()
  await expect.poll(() => decodeURIComponent(db.urlLista())).not.toContain('status=')
  await axe(page)

  await page.getByRole('button', { name: 'Filtros' }).click()
  await page.getByRole('group', { name: 'Situação' }).getByRole('button', { name: 'Enviado' }).click()
  await page.getByRole('group', { name: 'Situação' }).getByRole('button', { name: 'Rascunho' }).click()
  await expect.poll(() => decodeURIComponent(db.urlLista())).toMatch(/status=in\.\((enviado,rascunho|rascunho,enviado)\)/)
  await page.getByRole('button', { name: 'Vencidos' }).click()
  await expect.poll(() => decodeURIComponent(db.urlLista())).toContain('validade=lt.')
  await page.getByRole('button', { name: /Limpar filtros/ }).click()

  await page.getByLabel('Buscar por paciente ou número').fill('0012')
  await expect(page).toHaveURL(/busca=0012/)
  await expect.poll(() => decodeURIComponent(db.urlLista())).toContain('numero=ilike.%0012%')
})

test('novo orçamento: produtos da tabela, preço editado, item avulso, desconto e totais', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page)
  await page.goto('/orcamentos/novo')
  await page.getByRole('button', { name: 'Salvar orçamento' }).click()
  await expect(page.getByText('Escolha o paciente.')).toBeVisible()
  await expect(page.getByText('Inclua pelo menos um item.')).toBeVisible()

  await page.getByRole('radio', { name: /Helena Ribeiro/ }).click()
  const busca = page.getByRole('combobox', { name: 'Adicionar da tabela de preços' })
  await busca.click() // ao focar, a tabela inteira aparece agrupada por categoria
  await expect(page.getByRole('group', { name: 'Adicionais' }).getByRole('option', { name: /Tira valgo/ })).toBeVisible()
  await busca.fill('afo')
  await expect(page.getByRole('option', { name: /AFO antiga/ })).toHaveCount(0) // inativo não aparece
  await page.getByRole('option', { name: /AFO articulada/ }).click()
  await expect(busca).toHaveValue('')
  await busca.click()
  await page.getByRole('option', { name: /Tira valgo/ }).click()

  const afo = page.getByRole('group', { name: 'AFO articulada' })
  await expect(afo.getByText(/Tabela: R\$/)).toBeVisible()
  await afo.getByLabel('Preço unitário (R$) *').fill('1.300,00')
  await afo.getByRole('checkbox', { name: /Salvar R\$\s1\.300,00 como novo preço/ }).check()

  await page.getByRole('button', { name: '+ Item avulso' }).click()
  const novo = page.getByRole('group', { name: 'Item 3' }).getByLabel('Descrição *')
  await expect(novo).toBeFocused()
  await page.keyboard.type('Ajuste de velcro')
  const avulso = page.getByRole('group', { name: 'Ajuste de velcro' })
  await avulso.getByLabel('Seção').pressSequentially('Serviços') // tecla a tecla: o campo não pode perder o foco
  await expect(avulso.getByLabel('Seção')).toBeFocused()
  await avulso.getByLabel('Preço unitário (R$) *').fill('50')
  await avulso.getByLabel('Preço unitário (R$) *').blur()
  await expect(avulso.getByLabel('Preço unitário (R$) *')).toHaveValue('50,00')
  await avulso.getByLabel('Quantidade *').fill('2')
  await page.getByRole('button', { name: 'Validade de 30 dias' }).click()

  await page.getByRole('radio', { name: 'Percentual (%)' }).check()
  await page.getByLabel('Desconto (%)').fill('10')

  const resumo = page.getByRole('region', { name: 'Resumo' })
  await expect(resumo).toContainText(/Órteses\s*R\$\s1\.300,00/)
  await expect(resumo).toContainText(/Serviços\s*R\$\s100,00/)
  await expect(resumo).toContainText(/Subtotal\s*R\$\s1\.480,00/)
  await expect(resumo).toContainText(/Desconto \(10%\)\s*− R\$\s148,00/)
  await expect(resumo).toContainText(/Total\s*R\$\s1\.332,00/)
  await axe(page)

  await page.getByRole('button', { name: 'Salvar orçamento' }).click()
  await expect(page).toHaveURL(new RegExp(`/orcamentos/${ID}$`))
  await expect(page.getByText('Orçamento criado.')).toBeVisible()

  const body = db.rpc('salvar_orcamento') as { p_id: null; p_dados: Record<string, unknown>; p_itens: Record<string, unknown>[] }
  expect(body.p_id).toBeNull()
  expect(body.p_dados).toMatchObject({ paciente_id: PACIENTE.id, desconto_tipo: 'percentual', desconto: 10 })
  const dados = body.p_dados as { data_emissao: string; validade: string }
  expect((Date.parse(dados.validade) - Date.parse(dados.data_emissao)) / 86_400_000).toBe(30)
  expect(body.p_itens).toEqual([
    { produto_id: 'p-afo', tipo: 'base', secao: 'Órteses', descricao: 'AFO articulada', detalhe: '', quantidade: 1, unidade: 'par', preco_unitario: 1300, salvar_na_tabela: true },
    { produto_id: 'p-tira', tipo: 'adicional', secao: 'Adicionais', descricao: 'Tira valgo', detalhe: '', quantidade: 1, unidade: 'un', preco_unitario: 80, salvar_na_tabela: false },
    { produto_id: null, tipo: 'base', secao: 'Serviços', descricao: 'Ajuste de velcro', detalhe: '', quantidade: 2, unidade: 'un', preco_unitario: 50, salvar_na_tabela: false },
  ])
})

test('orçamento enviado: itens por seção e aprovação que abre o atendimento', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page, { status: 'enviado' })
  await page.goto(`/orcamentos/${ID}`)
  await expect(page.getByRole('heading', { level: 1, name: 'ORC-2026-0012' })).toBeVisible()
  const itens = page.getByRole('region', { name: 'Itens', exact: true })
  await expect(itens.getByText('tema dinossauros').filter({ visible: true })).toBeVisible() // tabela no desktop, lista no celular
  await expect(itens.getByText(/R\$\s1\.250,00/).filter({ visible: true }).first()).toBeVisible()
  await expect(itens).toContainText(/Desconto \(10%\)\s*− R\$\s133,00/)
  await expect(itens).toContainText(/Total\s*R\$\s1\.197,00/)
  await axe(page)

  await page.getByRole('button', { name: 'Aprovar', exact: true }).click()
  const dlg = page.getByRole('dialog', { name: 'Aprovar o orçamento ORC-2026-0012?' })
  await expect(dlg).toContainText(/atendimento de R\$\s1\.197,00/)
  await dlg.getByRole('button', { name: 'Aprovar e abrir atendimento' }).click()
  await expect(page.getByText('Orçamento aprovado. O atendimento foi aberto em produção.')).toBeVisible()
  expect(db.rpc('aprovar_orcamento')).toMatchObject({ p_id: ID })
})

test('orçamento aprovado fica travado e gera nova versão', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page, { status: 'aprovado' })
  await page.goto(`/orcamentos/${ID}`)
  await expect(page.getByRole('heading', { level: 1, name: 'ORC-2026-0012' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Editar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Excluir' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ver atendimento' })).toHaveAttribute('href', `/atendimentos/${ATENDIMENTO_ID}`)
  await axe(page)

  await page.getByRole('button', { name: 'Criar nova versão' }).click()
  await expect(page).toHaveURL(new RegExp(`/orcamentos/${ID_V2}$`))
  await expect(page.getByRole('heading', { level: 1, name: 'ORC-2026-0012-v2' })).toBeVisible()
  await expect(page.getByText('Nova versão criada como rascunho.', { exact: false })).toBeVisible()
  expect(db.rpc('nova_versao_orcamento')).toMatchObject({ p_id: ID })

  await page.goto(`/orcamentos/${ID}/editar`)
  await expect(page.getByRole('heading', { name: 'O orçamento ORC-2026-0012 não pode ser editado' })).toBeVisible()
})

test('editar enviado carrega os itens e marca como recusado', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockDb(page, { status: 'enviado' })
  await page.goto(`/orcamentos/${ID}/editar`)
  await expect(page.getByRole('heading', { level: 1, name: 'Editar ORC-2026-0012' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'AFO articulada' }).getByLabel('Preço unitário (R$) *')).toHaveValue('1.250,00')
  await expect(page.getByRole('region', { name: 'Resumo' })).toContainText(/Total\s*R\$\s1\.197,00/)
  await axe(page)

  await page.goto(`/orcamentos/${ID}`)
  await page.getByRole('button', { name: 'Marcar como recusado' }).click()
  await expect(page.getByText('Orçamento marcado como recusado.')).toBeVisible()
  expect(db.rpc('mudar_status_orcamento')).toEqual({ p_id: ID, p_status: 'recusado' })
})

test('sem rolagem horizontal da página no celular', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'só no celular')
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  for (const path of ['/orcamentos', `/orcamentos/${ID}`, `/orcamentos/${ID}/editar`]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForTimeout(600)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

test('baixa o PDF do orçamento com o nome do arquivo certo', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  await page.goto(`/orcamentos/${ID}`)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PDF' }).click()
  const arquivo = await download
  expect(arquivo.suggestedFilename()).toBe('ORC-2026-0012 - Helena Ribeiro.pdf')
  const caminho = await arquivo.path()
  const pdf = readFileSync(caminho)
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  expect(pdf.length).toBeGreaterThan(20_000) // com logo e fontes embutidas
  if (process.env.PDF_OUT) copyFileSync(caminho, process.env.PDF_OUT)
})

test('rascunho do orçamento: volta com os itens e pode ser descartado', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockDb(page)
  await page.goto('/orcamentos/novo')
  await page.getByRole('radio', { name: /Helena Ribeiro/ }).click()
  await page.getByRole('combobox', { name: 'Adicionar da tabela de preços' }).fill('afo')
  await page.getByRole('option', { name: /AFO articulada/ }).click()
  await page.getByRole('button', { name: '+ Item avulso' }).click()
  await page.keyboard.type('Ajuste de velcro')

  await page.getByRole('link', { name: 'Voltar para orçamentos' }).click()
  await expect(page).toHaveURL(/\/orcamentos$/)
  await page.goBack()
  await expect(page.getByText('Continuando de onde você parou.')).toBeVisible()
  await expect(page.getByRole('group', { name: 'AFO articulada' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Ajuste de velcro' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Resumo' })).toContainText(/R\$\s1\.250,00/)
  await axe(page)

  await page.getByRole('button', { name: 'Descartar rascunho' }).click()
  await expect(page.getByText('Continuando de onde você parou.')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'AFO articulada' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('group', { name: 'Ajuste de velcro' })).toHaveCount(0)
})
