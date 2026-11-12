import { expect, test } from '@playwright/test'
import { mockAuth, mockPainel } from './fixtures'

test('rota protegida redireciona para o login', async ({ page }) => {
  await mockAuth(page)
  await mockPainel(page)
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/login\?next=%2Fpainel/)
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
})

test('validação mostra erros acessíveis', async ({ page }) => {
  await mockAuth(page)
  await mockPainel(page)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar' }).click()
  const email = page.getByLabel('E-mail')
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toBeFocused()
  await expect(page.getByText('Informe seu e-mail.')).toBeVisible()
})

test('senha errada mostra alerta; certa entra no painel', async ({ page }) => {
  await mockAuth(page)
  await mockPainel(page)
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('equipe@ortofortino.com.br')
  await page.getByLabel('Senha', { exact: true }).fill('errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos')

  await page.getByLabel('Senha', { exact: true }).fill('senhaCorreta2026')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fernanda')
})

test('mostrar/ocultar senha', async ({ page }) => {
  await mockAuth(page)
  await mockPainel(page)
  await page.goto('/login')
  const senha = page.getByLabel('Senha', { exact: true })
  await expect(senha).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Mostrar senha' }).click()
  await expect(senha).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')
})

test('nenhum token fica no storage do navegador', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockPainel(page)
  await page.goto('/painel')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
  expect(stored).not.toContain('token')
})

test('sair volta para o login', async ({ page, isMobile }) => {
  await mockAuth(page, { loggedIn: true })
  await mockPainel(page)
  await page.goto('/painel')
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click()
  // Cartão da conta: símbolo da marca como foto e menu com Minha conta, Suporte e Sair.
  const conta = page.getByRole('button', { name: /abrir menu da conta/ })
  await expect(conta.locator('img[src="/favicon.svg"]')).toBeVisible()
  await conta.click()
  await expect(conta).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('link', { name: /Acionar suporte/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/5500000000000\?text=/)
  await page.keyboard.press('Escape')
  await expect(conta).toHaveAttribute('aria-expanded', 'false')
  await expect(conta).toBeFocused()
  await conta.click()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('login: entrada animada termina visível e oferece suporte', async ({ page }) => {
  await mockAuth(page, { loggedIn: false })
  await page.goto('/login')
  const entrar = page.getByRole('button', { name: 'Entrar' })
  await expect(entrar).toBeVisible()
  await expect.poll(() => entrar.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  await expect(page.getByRole('link', { name: /Acionar suporte/ })).toHaveAttribute('href', /wa\.me\/5500000000000/)
})

test('404 com a marca, voltar e suporte', async ({ page }) => {
  await mockAuth(page, { loggedIn: false })
  await page.goto('/pagina-que-nao-existe')
  await expect(page.getByRole('heading', { level: 1, name: 'Não encontramos esta página' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entrar no sistema' })).toHaveAttribute('href', '/login')
  await expect(page.getByRole('link', { name: /Acionar suporte/ })).toHaveAttribute('href', /wa\.me/)
  await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible()
})

test.describe('com "reduzir movimento"', () => {
  test.use({ reducedMotion: 'reduce' })
  test('login e 404 aparecem inteiros, sem esperar animação', async ({ page }) => {
    await mockAuth(page, { loggedIn: false })
    await page.goto('/login')
    for (const el of [page.getByRole('button', { name: 'Entrar' }), page.getByRole('link', { name: /Acionar suporte/ })])
      expect(await el.evaluate((e) => getComputedStyle(e.closest('.animate-rise, .animate-fade') ?? e).opacity)).toBe('1')
    await page.goto('/nao-existe')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
