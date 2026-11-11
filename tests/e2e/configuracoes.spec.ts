import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockAuth, mockPainel } from './fixtures'

const CONFIG = {
  id: true,
  empresa_nome: 'Orto Fortino',
  empresa_slogan: 'Órteses Funcionais',
  empresa_cnpj: '34130423000148',
  empresa_endereco: 'Rua Itapicuru, 151',
  empresa_cidade: 'Nova Iguaçu - RJ',
  empresa_cep: '26020560',
  empresa_telefone: '21964973837',
  empresa_email: 'ortofortino@hotmail.com',
  orc_validade_dias: 15,
  orc_condicoes_pagamento: null,
  orc_prazo_entrega: null,
  orc_observacoes: null,
  ficha_produtos: ['AFO fixa', 'KAFO', 'SMO forrada'],
  ficha_especificacoes: ['90°', 'Tira valgo'],
  created_at: '2026-11-11T12:00:00Z',
  updated_at: '2026-11-11T12:00:00Z',
  updated_by: null,
}

const SESSAO = {
  accessToken: 'token-de-teste',
  expiresAt: Math.floor(Date.now() / 1000) + 900,
  user: { id: 'u1', email: 'equipe@ortofortino.com.br', nome: 'Fernanda Fortino', mfa: false },
}
const QR = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>')}`

/** Simula a tabela `configuracoes` e os endpoints de conta/2FA do BFF. */
async function mockConfig(page: Page) {
  let atual = { ...CONFIG }
  const patches: Record<string, unknown>[] = []
  const bff: { path: string; body: Record<string, unknown>; auth?: string }[] = []

  await page.route('**/rest/v1/configuracoes*', (r) => {
    if (r.request().method() === 'PATCH') {
      const body = r.request().postDataJSON() as Record<string, unknown>
      patches.push(body)
      atual = { ...atual, ...body }
    }
    return r.fulfill({ json: atual })
  })
  await page.route('**/api/auth/mfa', (r) => {
    const body = r.request().postDataJSON() as { acao: string; code?: string }
    bff.push({ path: 'mfa', body, auth: r.request().headers()['authorization'] })
    if (body.acao === 'iniciar') return r.fulfill({ json: { factorId: 'fator-123456', qrCode: QR, secret: 'JBSWY3DPEHPK3PXPJBSWY3DP' } })
    if (body.code !== '123456') return r.fulfill({ status: 400, json: { error: 'Código incorreto ou expirado.' } })
    return r.fulfill({ json: { ...SESSAO, user: { ...SESSAO.user, mfa: body.acao === 'ativar' } } })
  })
  await page.route('**/api/auth/conta', (r) => {
    const body = r.request().postDataJSON() as { acao: string; atual?: string }
    bff.push({ path: 'conta', body, auth: r.request().headers()['authorization'] })
    if (body.acao === 'senha' && body.atual !== 'senhaCorreta2026') return r.fulfill({ status: 400, json: { error: 'A senha atual não confere.' } })
    return r.fulfill({ json: { ok: true } })
  })
  return { patches: () => patches, bff: () => bff }
}

async function axe(page: Page) {
  await page.waitForTimeout(900)
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  const v = res.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(v, v.join('\n')).toEqual([])
}

test('configurações carregam com os dados da empresa e sem violações de acessibilidade', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockConfig(page)
  await page.goto('/configuracoes')
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible()
  await expect(page.getByLabel('CNPJ')).toHaveValue('34.130.423/0001-48')
  await expect(page.getByLabel('Telefone')).toHaveValue('(21) 96497-3837')
  await expect(page.getByRole('link', { name: 'Configurações', includeHidden: true })).toHaveAttribute('aria-current', 'page')
  await axe(page)
  // Sem rolagem horizontal no celular
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(largura).toBeLessThanOrEqual(0)
})

test('salva os dados da empresa só com dígitos e recusa CNPJ inválido', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockConfig(page)
  await page.goto('/configuracoes')
  const salvar = page.getByRole('button', { name: 'Salvar dados da empresa' })
  await expect(salvar).toBeDisabled()

  await page.getByLabel('CNPJ').fill('34130423000149')
  await salvar.click()
  await expect(page.getByText('CNPJ inválido. Confira os números.')).toBeVisible()
  expect(db.patches()).toHaveLength(0)

  await page.getByLabel('CNPJ').fill('11222333000181')
  await expect(page.getByLabel('CNPJ')).toHaveValue('11.222.333/0001-81')
  await page.getByLabel('Telefone').fill('2133334444')
  await salvar.click()
  await expect(page.getByText('Dados da empresa salvos.')).toBeVisible()
  expect(db.patches()[0]).toMatchObject({ empresa_cnpj: '11222333000181', empresa_telefone: '2133334444', empresa_cep: '26020560' })
})

test('padrões do orçamento: valida a validade e salva os textos', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockConfig(page)
  await page.goto('/configuracoes')
  await page.getByLabel('Validade (dias) *').fill('500')
  await page.getByRole('button', { name: 'Salvar padrões' }).click()
  await expect(page.getByText('Use um número de 1 a 365 dias.')).toBeVisible()
  await page.getByLabel('Validade (dias) *').fill('30')
  await page.getByLabel('Condições de pagamento').fill('50% na aprovação e 50% na entrega')
  await page.getByRole('button', { name: 'Salvar padrões' }).click()
  await expect(page.getByText(/Padrões salvos/)).toBeVisible()
  expect(db.patches()[0]).toEqual({ orc_validade_dias: 30, orc_condicoes_pagamento: '50% na aprovação e 50% na entrega', orc_prazo_entrega: null, orc_observacoes: null })
})

test('listas da ficha: adiciona, reordena e remove pelo teclado, depois salva', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockConfig(page)
  await page.goto('/configuracoes')
  const salvar = page.getByRole('button', { name: 'Salvar listas' })
  await expect(salvar).toBeDisabled()

  const novo = page.getByLabel('Novo item em produtos sugeridos')
  await novo.fill('kafo')
  await novo.press('Enter')
  await expect(page.getByText('Este item já está na lista.')).toBeVisible()
  await novo.fill('Colete OTLS')
  await novo.press('Enter')
  await expect(novo).toHaveValue('')

  await page.getByRole('button', { name: 'Subir “Colete OTLS”' }).click()
  // O foco acompanha o item movido
  await expect(page.getByRole('button', { name: 'Subir “Colete OTLS”' })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Remover “AFO fixa”' }).click()

  await salvar.click()
  await expect(page.getByText(/Listas salvas/)).toBeVisible()
  expect(db.patches()[0]).toEqual({ ficha_produtos: ['Colete OTLS', 'KAFO', 'SMO forrada'], ficha_especificacoes: ['90°', 'Tira valgo'] })
})

test('ativa e desativa a verificação em duas etapas', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockConfig(page)
  await page.goto('/configuracoes#sec-seguranca')
  const secao = page.getByRole('region', { name: 'Verificação em duas etapas' })
  await expect(secao.getByText('Desativada', { exact: true })).toBeVisible()

  await secao.getByRole('button', { name: 'Ativar verificação em duas etapas' }).click()
  await expect(secao.getByRole('img', { name: /QR code/ })).toBeVisible()
  await expect(secao.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP')).toBeVisible()
  await axe(page)

  await secao.getByLabel('Código do autenticador').fill('000000')
  await secao.getByRole('button', { name: 'Confirmar e ativar' }).click()
  await expect(secao.getByRole('alert')).toHaveText('Código incorreto ou expirado.')
  await expect(secao.getByLabel('Código do autenticador')).toBeFocused()

  await secao.getByLabel('Código do autenticador').fill('123 456')
  await secao.getByRole('button', { name: 'Confirmar e ativar' }).click()
  await expect(secao.getByText('Ativa', { exact: true })).toBeVisible()
  await expect(secao.getByText(/Verificação em duas etapas ativada/)).toBeVisible()
  expect(db.bff().filter((c) => c.body.acao === 'ativar').at(-1)).toMatchObject({ body: { factorId: 'fator-123456', code: '123456' }, auth: 'Bearer token-de-teste' })

  await secao.getByRole('button', { name: 'Desativar' }).click()
  await secao.getByLabel('Código do autenticador').fill('123456')
  await secao.getByRole('button', { name: 'Desativar' }).click()
  await expect(secao.getByText('Desativada', { exact: true })).toBeVisible()
})

test('trocar senha: confere a atual e a política de senha', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  const db = await mockConfig(page)
  await page.goto('/configuracoes#sec-conta')
  await page.getByLabel('Senha atual').fill('errada')
  await page.getByLabel('Nova senha', { exact: true }).fill('curta1')
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText('Use pelo menos 12 caracteres.')).toBeVisible()

  await page.getByLabel('Nova senha', { exact: true }).fill('novaSenhaForte2026')
  await page.getByLabel('Repita a nova senha').fill('novaSenhaForte2026')
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText('A senha atual não confere.')).toBeVisible()
  await expect(page.getByLabel('Senha atual')).toBeFocused()

  await page.getByLabel('Senha atual').fill('senhaCorreta2026')
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page.getByText(/Senha alterada/)).toBeVisible()
  await expect(page.getByLabel('Senha atual')).toHaveValue('')
  expect(db.bff().filter((c) => c.path === 'conta').at(-1)?.body).toEqual({ acao: 'senha', atual: 'senhaCorreta2026', nova: 'novaSenhaForte2026' })
})

test('login com autenticador ativo pede o código antes de abrir o painel', async ({ page }) => {
  await mockAuth(page)
  await mockPainel(page)
  let codigoEnviado = ''
  await page.route('**/api/auth/login', (r) => r.fulfill({ json: { mfaRequired: true } }))
  await page.route('**/api/auth/mfa', (r) => {
    const body = r.request().postDataJSON() as { acao: string; code: string }
    codigoEnviado = body.code
    if (body.code !== '123456') return r.fulfill({ status: 400, json: { error: 'Código incorreto ou expirado.' } })
    return r.fulfill({ json: { ...SESSAO, user: { ...SESSAO.user, mfa: true } } })
  })

  await page.goto('/login')
  await page.getByLabel('E-mail').fill('equipe@ortofortino.com.br')
  await page.getByLabel('Senha', { exact: true }).fill('senhaCorreta2026')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Verificação em duas etapas' })).toBeVisible()
  await expect(page.getByLabel('Código do autenticador')).toBeFocused()
  await axe(page)

  await page.getByLabel('Código do autenticador').fill('111111')
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('Código incorreto')

  await page.getByLabel('Código do autenticador').fill('123456')
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click()
  await expect(page).toHaveURL(/\/painel$/)
  expect(codigoEnviado).toBe('123456')
})

test('código expirado volta para a senha com o aviso', async ({ page }) => {
  await mockAuth(page)
  await page.route('**/api/auth/login', (r) => r.fulfill({ json: { mfaRequired: true } }))
  await page.route('**/api/auth/mfa', (r) =>
    r.fulfill({ status: 401, json: { error: 'O tempo para digitar o código acabou. Entre com a senha de novo.' } }),
  )
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('equipe@ortofortino.com.br')
  await page.getByLabel('Senha', { exact: true }).fill('senhaCorreta2026')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByLabel('Código do autenticador').fill('123456')
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('O tempo para digitar o código acabou')
})

test('rodapé do login mostra o telefone configurado', async ({ page }) => {
  await mockAuth(page)
  await page.route('**/api/empresa', (r) => r.fulfill({ json: { nome: 'Orto Fortino', telefone: '2133334444' } }))
  await page.goto('/login')
  await expect(page.getByText(/Orto Fortino · \(21\) 3333-4444/)).toBeVisible()
})
