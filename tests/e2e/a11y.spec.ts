import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockAuth, mockPainel } from './fixtures'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

async function audit(page: import('@playwright/test').Page) {
  // Espera as animações de entrada terminarem para medir o contraste final.
  await page.waitForTimeout(1200)
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(summary, summary.join('\n')).toEqual([])
}

for (const path of ['/login', '/esqueci-senha', '/redefinir-senha?token_hash=abcdefghijkl']) {
  test(`axe: ${path} sem violações`, async ({ page }) => {
    await mockAuth(page)
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await audit(page)
  })
}

test('axe: painel sem violações', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockPainel(page)
  await page.goto('/painel')
  await expect(page.getByRole('heading', { name: 'Orçamentos recentes' })).toBeVisible()
  await audit(page)
})

test('axe: menu móvel aberto sem violações', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'só no celular')
  await mockAuth(page, { loggedIn: true })
  await mockPainel(page)
  await page.goto('/painel')
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible()
  await audit(page)
})

test('sem rolagem horizontal da página no celular', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'só no celular')
  await mockAuth(page, { loggedIn: true })
  await mockPainel(page)
  for (const path of ['/login', '/painel']) {
    await page.goto(path)
    await page.waitForTimeout(600)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

test('skip link leva ao conteúdo', async ({ page }) => {
  await mockAuth(page, { loggedIn: true })
  await mockPainel(page)
  await page.goto('/painel')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
})
