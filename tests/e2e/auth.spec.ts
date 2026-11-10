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
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
